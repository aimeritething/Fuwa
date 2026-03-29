#[cfg(desktop)]
use crate::claude_cli::ClaudeStreamEvent;
use crate::claude_cli::{AgentStreamRequest, ChatStreamRequest, ClaudeCliStatus};

// ── Claude CLI commands (desktop) ───────────────────────────────────────────

#[cfg(desktop)]
#[tauri::command]
pub fn check_claude_cli() -> ClaudeCliStatus {
    crate::claude_cli::check_cli()
}

#[cfg(desktop)]
#[tauri::command]
pub async fn stream_claude_chat(
    app_handle: tauri::AppHandle,
    request: ChatStreamRequest,
) -> Result<String, String> {
    use tauri::Emitter;
    tokio::task::spawn_blocking(move || {
        crate::claude_cli::run_chat_stream(request, |event: ClaudeStreamEvent| {
            let _ = app_handle.emit("claude-stream", &event);
        })
    })
    .await
    .map_err(|e| format!("Task failed: {e}"))?
}

#[cfg(desktop)]
#[tauri::command]
pub async fn stream_claude_agent(
    app_handle: tauri::AppHandle,
    request: AgentStreamRequest,
) -> Result<String, String> {
    use tauri::Emitter;
    tokio::task::spawn_blocking(move || {
        crate::claude_cli::run_agent_stream(request, |event: ClaudeStreamEvent| {
            let _ = app_handle.emit("claude-agent-stream", &event);
        })
    })
    .await
    .map_err(|e| format!("Task failed: {e}"))?
}

// ── Claude CLI (mobile stubs) ───────────────────────────────────────────────

#[cfg(mobile)]
#[tauri::command]
pub fn check_claude_cli() -> ClaudeCliStatus {
    ClaudeCliStatus {
        installed: false,
        version: None,
    }
}

#[cfg(mobile)]
#[tauri::command]
pub async fn stream_claude_chat(
    _app_handle: tauri::AppHandle,
    _request: ChatStreamRequest,
) -> Result<String, String> {
    Err("Claude CLI is not available on mobile".into())
}

#[cfg(mobile)]
#[tauri::command]
pub async fn stream_claude_agent(
    _app_handle: tauri::AppHandle,
    _request: AgentStreamRequest,
) -> Result<String, String> {
    Err("Claude CLI is not available on mobile".into())
}
