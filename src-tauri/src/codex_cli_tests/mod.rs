use super::*;
use crate::ai_agents::AiAgentPermissionMode;
use std::ffi::OsStr;

#[cfg(target_os = "linux")]
fn current_test_binary() -> PathBuf {
    std::fs::read_link("/proc/self/exe").unwrap()
}

#[cfg(target_os = "macos")]
fn current_test_binary() -> PathBuf {
    let pid = std::process::id().to_string();
    let output = std::process::Command::new("/bin/ps")
        .args(["-p", pid.as_str(), "-o", "comm="])
        .output()
        .unwrap();
    let path = String::from_utf8(output.stdout).unwrap();
    PathBuf::from(path.trim())
}

#[cfg(unix)]
fn executable_script(dir: &Path, name: &str, body: &str) -> PathBuf {
    use std::os::unix::fs::PermissionsExt;

    let script = dir.join(name);
    std::fs::write(&script, format!("#!/bin/sh\n{body}")).unwrap();
    std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o755)).unwrap();
    script
}

fn codex_request(vault_path: &Path, permission_mode: AiAgentPermissionMode) -> AgentStreamRequest {
    AgentStreamRequest {
        message: "Summarize".into(),
        model: None,
        system_prompt: None,
        vault_path: vault_path.to_string_lossy().into_owned(),
        vault_paths: Vec::new(),
        permission_mode,
    }
}

fn assert_codex_permission_contract(args: &[String], permission_mode: AiAgentPermissionMode) {
    let sandbox = codex_sandbox(permission_mode);
    let approval = codex_approval_policy(permission_mode);
    let prefix = ["--sandbox", sandbox, "--ask-for-approval", approval];

    assert_eq!(&args[..prefix.len()], prefix);
    assert!(!args.iter().any(|arg| arg == "danger-full-access"));
    assert!(!args
        .iter()
        .any(|arg| arg == "--dangerously-bypass-approvals-and-sandbox"));
}

#[cfg(unix)]
fn run_codex_script(body: &str) -> (String, Vec<AiAgentStreamEvent>) {
    let dir = tempfile::tempdir().unwrap();
    let vault = tempfile::tempdir().unwrap();
    let binary = executable_script(dir.path(), "codex", body);
    let mut events = Vec::new();
    let thread_id = run_agent_stream_with_binary(
        &binary,
        codex_request(vault.path(), AiAgentPermissionMode::Safe),
        |event| events.push(event),
    )
    .unwrap();

    (thread_id, events)
}

fn assert_codex_text_flow(events: &[AiAgentStreamEvent], session: &str, text_delta: &str) {
    assert!(matches!(
        &events[0],
        AiAgentStreamEvent::Init { session_id } if session_id == session
    ));
    assert!(matches!(
        &events[1],
        AiAgentStreamEvent::TextDelta { text } if text == text_delta
    ));
    assert!(matches!(events.last(), Some(AiAgentStreamEvent::Done)));
}

mod command_tests;
mod event_tests;
mod stream_and_discovery_tests;
