use crate::github::{DeviceFlowPollResult, DeviceFlowStart, GitHubUser, GithubRepo};

use super::expand_tilde;

// ── GitHub commands (desktop) ───────────────────────────────────────────────

#[cfg(desktop)]
#[tauri::command]
pub async fn github_list_repos(token: String) -> Result<Vec<GithubRepo>, String> {
    crate::github::github_list_repos(&token).await
}

#[cfg(desktop)]
#[tauri::command]
pub async fn github_create_repo(
    token: String,
    name: String,
    private: bool,
) -> Result<GithubRepo, String> {
    crate::github::github_create_repo(&token, &name, private).await
}

#[cfg(desktop)]
#[tauri::command]
pub fn clone_repo(url: String, token: String, local_path: String) -> Result<String, String> {
    let local_path = expand_tilde(&local_path);
    crate::github::clone_repo(&url, &token, &local_path)
}

#[cfg(desktop)]
#[tauri::command]
pub async fn github_device_flow_start() -> Result<DeviceFlowStart, String> {
    crate::github::github_device_flow_start().await
}

#[cfg(desktop)]
#[tauri::command]
pub async fn github_device_flow_poll(device_code: String) -> Result<DeviceFlowPollResult, String> {
    crate::github::github_device_flow_poll(&device_code).await
}

#[cfg(desktop)]
#[tauri::command]
pub async fn github_get_user(token: String) -> Result<GitHubUser, String> {
    crate::github::github_get_user(&token).await
}

// ── GitHub commands (mobile stubs) ──────────────────────────────────────────

#[cfg(mobile)]
#[tauri::command]
pub async fn github_list_repos(_token: String) -> Result<Vec<GithubRepo>, String> {
    Err("GitHub integration is not available on mobile".into())
}

#[cfg(mobile)]
#[tauri::command]
pub async fn github_create_repo(
    _token: String,
    _name: String,
    _private: bool,
) -> Result<GithubRepo, String> {
    Err("GitHub integration is not available on mobile".into())
}

#[cfg(mobile)]
#[tauri::command]
pub fn clone_repo(_url: String, _token: String, _local_path: String) -> Result<String, String> {
    Err("Git clone is not available on mobile".into())
}

#[cfg(mobile)]
#[tauri::command]
pub async fn github_device_flow_start() -> Result<DeviceFlowStart, String> {
    Err("GitHub integration is not available on mobile".into())
}

#[cfg(mobile)]
#[tauri::command]
pub async fn github_device_flow_poll(_device_code: String) -> Result<DeviceFlowPollResult, String> {
    Err("GitHub integration is not available on mobile".into())
}

#[cfg(mobile)]
#[tauri::command]
pub async fn github_get_user(_token: String) -> Result<GitHubUser, String> {
    Err("GitHub integration is not available on mobile".into())
}
