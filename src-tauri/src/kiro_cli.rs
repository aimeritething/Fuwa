use crate::ai_agents::{AiAgentAvailability, AiAgentStreamEvent};
use crate::cli_agent_runtime::AgentStreamRequest;
use regex::Regex;
use std::io::BufRead;
use std::path::Path;
use std::process::Stdio;

pub fn check_cli() -> AiAgentAvailability {
    crate::kiro_discovery::check_cli()
}

pub fn run_agent_stream<F>(request: AgentStreamRequest, mut emit: F) -> Result<String, String>
where
    F: FnMut(AiAgentStreamEvent),
{
    let binary = crate::kiro_discovery::find_binary()?;
    ensure_mcp_config(&request.vault_path)?;
    let prompt = crate::cli_agent_runtime::build_prompt(
        &request.message,
        request.system_prompt.as_deref(),
    );

    let mut command = crate::hidden_command(&binary);
    crate::cli_agent_runtime::configure_agent_command_environment(&mut command, &binary);
    command
        .arg("chat")
        .arg("--no-interactive")
        .arg("--trust-all-tools")
        .current_dir(&request.vault_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = command
        .spawn()
        .map_err(|e| format!("Failed to spawn kiro-cli: {e}"))?;

    // Write prompt from a separate thread to avoid deadlock when prompt > pipe buffer (64KB)
    let stdin = child.stdin.take().ok_or("No stdin handle")?;
    let prompt_handle = std::thread::spawn(move || {
        use std::io::Write;
        let mut stdin = stdin;
        let _ = stdin.write_all(prompt.as_bytes());
    });

    let session_id = format!("kiro-{}-{}", std::process::id(), std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0));
    emit(AiAgentStreamEvent::Init {
        session_id: session_id.clone(),
    });

    let stdout = child.stdout.take().ok_or("No stdout handle")?;
    let reader = std::io::BufReader::new(stdout);

    for line in reader.lines() {
        let line = match line {
            Ok(l) => l,
            Err(e) => {
                emit(AiAgentStreamEvent::Error {
                    message: format!("Read error: {e}"),
                });
                break;
            }
        };

        if !line.is_empty() {
            let clean = strip_ansi_codes(&line);
            emit(AiAgentStreamEvent::TextDelta {
                text: format!("{clean}\n"),
            });
        } else {
            emit(AiAgentStreamEvent::TextDelta {
                text: "\n".to_string(),
            });
        }
    }

    let stderr_output = child
        .stderr
        .take()
        .and_then(|stderr| std::io::read_to_string(stderr).ok())
        .unwrap_or_default();

    let _ = prompt_handle.join();
    let status = child.wait().map_err(|e| format!("Wait failed: {e}"))?;
    if !status.success() {
        emit(AiAgentStreamEvent::Error {
            message: format_kiro_error(stderr_output, status.to_string()),
        });
    }

    emit(AiAgentStreamEvent::Done);
    Ok(session_id)
}

fn ensure_mcp_config(vault_path: &str) -> Result<(), String> {
    let mcp_server_path = crate::cli_agent_runtime::mcp_server_path_string()?;
    write_mcp_json(vault_path, &mcp_server_path)
}

fn write_mcp_json(vault_path: &str, mcp_server_path: &str) -> Result<(), String> {
    let config_dir = Path::new(vault_path).join(".kiro").join("settings");
    std::fs::create_dir_all(&config_dir)
        .map_err(|e| format!("Failed to create .kiro/settings: {e}"))?;

    let config_path = config_dir.join("mcp.json");

    let mut config: serde_json::Value = std::fs::read_to_string(&config_path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(|| serde_json::json!({}));

    let servers = config
        .as_object_mut()
        .ok_or("Invalid mcp.json: not an object")?
        .entry("mcpServers")
        .or_insert_with(|| serde_json::json!({}));

    servers["tolaria"] = serde_json::json!({
        "command": "node",
        "args": [mcp_server_path],
        "env": { "VAULT_PATH": vault_path },
        "disabled": false
    });

    std::fs::write(
        &config_path,
        serde_json::to_string_pretty(&config).map_err(|e| format!("JSON serialize error: {e}"))?,
    )
    .map_err(|e| format!("Failed to write mcp.json: {e}"))?;

    Ok(())
}

fn strip_ansi_codes(input: &str) -> String {
    static RE: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
    let re = RE.get_or_init(|| Regex::new(r"\x1b\[[0-9;]*m").unwrap());
    re.replace_all(input, "").to_string()
}

fn format_kiro_error(stderr_output: String, status: String) -> String {
    let lower = stderr_output.to_ascii_lowercase();
    if lower.contains("auth") || lower.contains("login") || lower.contains("token") {
        return "Kiro CLI is not authenticated. Run `kiro-cli login` in your terminal to sign in.".into();
    }
    if stderr_output.trim().is_empty() {
        format!("kiro-cli exited with status {status}")
    } else {
        stderr_output.lines().take(3).collect::<Vec<_>>().join("\n")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strip_ansi_codes_removes_terminal_colors() {
        assert_eq!(
            strip_ansi_codes("\x1b[38;5;141m>  \x1b[0mHello! \x1b[0m"),
            ">  Hello! "
        );
        assert_eq!(strip_ansi_codes("plain text"), "plain text");
    }

    #[test]
    fn format_kiro_error_detects_auth_errors() {
        let result = format_kiro_error("Error: auth token expired".into(), "1".into());
        assert!(result.contains("kiro-cli login"));
    }

    #[test]
    fn format_kiro_error_returns_status_for_empty_stderr() {
        let result = format_kiro_error("".into(), "1".into());
        assert!(result.contains("status 1"));
    }

    #[test]
    fn write_mcp_json_creates_config() {
        let dir = tempfile::tempdir().unwrap();
        let vault_path = dir.path().to_str().unwrap();
        write_mcp_json(vault_path, "/opt/mcp/index.js").unwrap();

        let config_path = dir.path().join(".kiro/settings/mcp.json");
        let content: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(&config_path).unwrap()).unwrap();
        assert_eq!(content["mcpServers"]["tolaria"]["command"], "node");
        assert_eq!(content["mcpServers"]["tolaria"]["args"][0], "/opt/mcp/index.js");
    }

    #[test]
    fn write_mcp_json_merges_preserving_existing_servers() {
        let dir = tempfile::tempdir().unwrap();
        let vault_path = dir.path().to_str().unwrap();
        let config_dir = dir.path().join(".kiro/settings");
        std::fs::create_dir_all(&config_dir).unwrap();
        std::fs::write(
            config_dir.join("mcp.json"),
            r#"{"mcpServers":{"other":{"command":"python","args":["server.py"]}}}"#,
        ).unwrap();

        write_mcp_json(vault_path, "/new/index.js").unwrap();

        let content: serde_json::Value = serde_json::from_str(
            &std::fs::read_to_string(dir.path().join(".kiro/settings/mcp.json")).unwrap(),
        ).unwrap();
        assert_eq!(content["mcpServers"]["tolaria"]["args"][0], "/new/index.js");
        assert_eq!(content["mcpServers"]["other"]["command"], "python");
    }
}
