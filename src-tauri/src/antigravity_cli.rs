use crate::ai_agents::{AiAgentAvailability, AiAgentStreamEvent};
use crate::cli_agent_runtime::AgentStreamRequest;
use regex::Regex;
use std::io::{BufRead, Read};
use std::path::Path;
use std::process::{ChildStderr, ChildStdout};

struct AntigravityProcessError {
    stderr_output: String,
    status: String,
}

pub fn check_cli() -> AiAgentAvailability {
    crate::antigravity_discovery::check_cli()
}

pub fn run_agent_stream<F>(request: AgentStreamRequest, emit: F) -> Result<String, String>
where
    F: FnMut(AiAgentStreamEvent),
{
    let binary = crate::antigravity_discovery::find_binary()?;
    run_agent_stream_with_binary(&binary, request, emit)
}

fn run_agent_stream_with_binary<F>(
    binary: &Path,
    request: AgentStreamRequest,
    mut emit: F,
) -> Result<String, String>
where
    F: FnMut(AiAgentStreamEvent),
{
    let mut child = crate::antigravity_config::build_command(binary, &request)?
        .spawn()
        .map_err(|error| format!("Failed to spawn agy: {error}"))?;
    let stderr_handle = read_stderr_async(child.stderr.take().ok_or("No stderr handle")?);
    let session_id = antigravity_session_id();

    emit(AiAgentStreamEvent::Init {
        session_id: session_id.clone(),
    });
    stream_stdout(child.stdout.take().ok_or("No stdout handle")?, &mut emit);

    let stderr_output = stderr_handle.join().unwrap_or_default();
    let status = child
        .wait()
        .map_err(|error| format!("Wait failed: {error}"))?;
    if !status.success() {
        emit(AiAgentStreamEvent::Error {
            message: format_antigravity_error(AntigravityProcessError {
                stderr_output,
                status: status.to_string(),
            }),
        });
    }

    emit(AiAgentStreamEvent::Done);
    Ok(session_id)
}

fn antigravity_session_id() -> String {
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    format!("antigravity-{}-{ts}", std::process::id())
}

fn stream_stdout<F>(stdout: ChildStdout, emit: &mut F)
where
    F: FnMut(AiAgentStreamEvent),
{
    let reader = std::io::BufReader::new(stdout);
    for line in reader.lines() {
        match line {
            Ok(line) => emit(AiAgentStreamEvent::TextDelta {
                text: format!("{}\n", strip_ansi_codes(&line)),
            }),
            Err(error) => {
                emit(AiAgentStreamEvent::Error {
                    message: format!("Read error: {error}"),
                });
                break;
            }
        }
    }
}

fn read_stderr_async(mut stderr: ChildStderr) -> std::thread::JoinHandle<String> {
    std::thread::spawn(move || {
        let mut output = String::new();
        let _ = stderr.read_to_string(&mut output);
        output
    })
}

fn strip_ansi_codes(input: &str) -> String {
    static RE: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
    let re = RE.get_or_init(|| Regex::new(r"\x1b\[[0-?]*[ -/]*[@-~]").unwrap());
    re.replace_all(input, "").to_string()
}

fn format_antigravity_error(error: AntigravityProcessError) -> String {
    if is_auth_or_setup_error(&error.stderr_output) {
        return "Antigravity CLI is not ready. Run `agy` in your terminal to finish install and sign-in, then retry in Tolaria.".into();
    }

    let stderr = error.stderr_output.trim();
    if stderr.is_empty() {
        format!("agy exited with status {}", error.status)
    } else {
        stderr.lines().take(3).collect::<Vec<_>>().join("\n")
    }
}

fn is_auth_or_setup_error(stderr_output: &str) -> bool {
    let lower = stderr_output.to_ascii_lowercase();
    [
        "auth",
        "api key",
        "keyring",
        "login",
        "oauth",
        "sign in",
        "token",
        "unauthorized",
    ]
    .iter()
    .any(|needle| lower.contains(needle))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai_agents::AiAgentPermissionMode;
    use std::path::PathBuf;

    fn request(vault_path: String) -> AgentStreamRequest {
        AgentStreamRequest {
            message: "Summarize".into(),
            system_prompt: Some("Use Tolaria conventions".into()),
            vault_path,
            vault_paths: Vec::new(),
            permission_mode: AiAgentPermissionMode::Safe,
        }
    }

    #[cfg(unix)]
    fn executable_script(dir: &Path, body: &str) -> PathBuf {
        use std::os::unix::fs::PermissionsExt;

        let script = dir.join("agy");
        std::fs::write(&script, format!("#!/bin/sh\n{body}")).unwrap();
        std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o755)).unwrap();
        script
    }

    #[cfg(unix)]
    #[test]
    fn run_agent_stream_maps_stdout_and_writes_workspace_mcp_config() {
        let dir = tempfile::tempdir().unwrap();
        let vault = tempfile::tempdir().unwrap();
        let binary = executable_script(
            dir.path(),
            r#"printf '%s\n' 'Hello from Antigravity'
printf '%s\n' 'Second line'
"#,
        );

        let mut events = Vec::new();
        let session_id = run_agent_stream_with_binary(
            &binary,
            request(vault.path().to_string_lossy().into_owned()),
            |event| events.push(event),
        )
        .unwrap();

        assert!(session_id.starts_with("antigravity-"));
        assert!(matches!(
            &events[0],
            AiAgentStreamEvent::Init { session_id } if session_id.starts_with("antigravity-")
        ));
        assert!(events.iter().any(|event| matches!(
            event,
            AiAgentStreamEvent::TextDelta { text } if text == "Hello from Antigravity\n"
        )));
        assert!(vault
            .path()
            .join(".agents")
            .join("mcp_config.json")
            .exists());
        assert!(matches!(events.last(), Some(AiAgentStreamEvent::Done)));
    }

    #[cfg(unix)]
    #[test]
    fn run_agent_stream_reports_antigravity_auth_errors() {
        let dir = tempfile::tempdir().unwrap();
        let vault = tempfile::tempdir().unwrap();
        let binary = executable_script(
            dir.path(),
            r#"printf '%s\n' 'oauth login required' >&2
exit 3
"#,
        );

        let mut events = Vec::new();
        let session_id = run_agent_stream_with_binary(
            &binary,
            request(vault.path().to_string_lossy().into_owned()),
            |event| events.push(event),
        )
        .unwrap();

        assert!(session_id.starts_with("antigravity-"));
        assert!(events.iter().any(|event| matches!(
            event,
            AiAgentStreamEvent::Error { message } if message.contains("not ready")
        )));
        assert!(matches!(events.last(), Some(AiAgentStreamEvent::Done)));
    }
}
