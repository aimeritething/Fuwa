#[cfg(desktop)]
use crate::menu;
use crate::settings::Settings;
use crate::vault_list;
use crate::vault_list::VaultList;
use serde::Deserialize;
#[cfg(desktop)]
use tauri::ipc::Channel;
#[cfg(desktop)]
use tauri::LogicalSize;
#[cfg(desktop)]
use tauri::Window;

use super::parse_build_label;

// ── MCP commands (desktop) ──────────────────────────────────────────────────

#[cfg(desktop)]
#[tauri::command]
pub async fn register_mcp_tools(vault_path: String) -> Result<String, String> {
    let vault_path = super::expand_tilde(&vault_path).into_owned();
    tokio::task::spawn_blocking(move || crate::mcp::register_mcp(&vault_path))
        .await
        .map_err(|e| format!("Registration task failed: {e}"))?
}

#[cfg(desktop)]
#[tauri::command]
pub async fn check_mcp_status() -> Result<crate::mcp::McpStatus, String> {
    tokio::task::spawn_blocking(crate::mcp::check_mcp_status)
        .await
        .map_err(|e| format!("MCP status check failed: {e}"))
}

// ── MCP commands (mobile stubs) ─────────────────────────────────────────────

#[cfg(mobile)]
#[tauri::command]
pub async fn register_mcp_tools(_vault_path: String) -> Result<String, String> {
    Err("MCP is not available on mobile".into())
}

#[cfg(mobile)]
#[tauri::command]
pub async fn check_mcp_status() -> Result<crate::mcp::McpStatus, String> {
    Ok(crate::mcp::McpStatus::NotInstalled)
}

// ── Menu commands ───────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MenuStateUpdate {
    has_active_note: bool,
    has_modified_files: Option<bool>,
    has_conflicts: Option<bool>,
    has_restorable_deleted_note: Option<bool>,
    has_no_remote: Option<bool>,
}

#[cfg(desktop)]
#[tauri::command]
pub fn update_menu_state(
    app_handle: tauri::AppHandle,
    state: MenuStateUpdate,
) -> Result<(), String> {
    menu::set_note_items_enabled(&app_handle, state.has_active_note);
    if let Some(v) = state.has_modified_files {
        menu::set_git_commit_items_enabled(&app_handle, v);
    }
    if let Some(v) = state.has_conflicts {
        menu::set_git_conflict_items_enabled(&app_handle, v);
    }
    if let Some(v) = state.has_restorable_deleted_note {
        menu::set_restore_deleted_item_enabled(&app_handle, v);
    }
    if let Some(v) = state.has_no_remote {
        menu::set_git_no_remote_items_enabled(&app_handle, v);
    }
    Ok(())
}

#[cfg(mobile)]
#[tauri::command]
pub fn update_menu_state(
    _app_handle: tauri::AppHandle,
    _state: MenuStateUpdate,
) -> Result<(), String> {
    Ok(())
}

#[cfg(desktop)]
#[tauri::command]
pub fn trigger_menu_command(app_handle: tauri::AppHandle, id: String) -> Result<(), String> {
    menu::emit_custom_menu_event(&app_handle, &id)
}

#[cfg(mobile)]
#[tauri::command]
pub fn trigger_menu_command(_app_handle: tauri::AppHandle, _id: String) -> Result<(), String> {
    Err("Native menu commands are not available on mobile".into())
}

#[cfg(desktop)]
#[tauri::command]
pub fn update_current_window_min_size(
    window: Window,
    min_width: f64,
    min_height: f64,
    grow_to_fit: bool,
) -> Result<(), String> {
    window
        .set_min_size(Some(LogicalSize::new(min_width, min_height)))
        .map_err(|e| e.to_string())?;

    if !grow_to_fit {
        return Ok(());
    }

    let scale_factor = window.scale_factor().map_err(|e| e.to_string())?;
    let current_size = window
        .inner_size()
        .map_err(|e| e.to_string())?
        .to_logical::<f64>(scale_factor);

    let next_width = current_size.width.max(min_width);
    let next_height = current_size.height.max(min_height);
    if next_width == current_size.width && next_height == current_size.height {
        return Ok(());
    }

    window
        .set_size(LogicalSize::new(next_width, next_height))
        .map_err(|e| e.to_string())
}

#[cfg(mobile)]
#[tauri::command]
pub fn update_current_window_min_size(
    _window: tauri::Window,
    _min_width: f64,
    _min_height: f64,
    _grow_to_fit: bool,
) -> Result<(), String> {
    Ok(())
}

// ── Settings & config commands ──────────────────────────────────────────────

#[tauri::command]
pub fn get_build_number(app_handle: tauri::AppHandle) -> String {
    let version = app_handle.package_info().version.to_string();
    parse_build_label(&version)
}

#[tauri::command]
pub fn get_settings() -> Result<Settings, String> {
    crate::settings::get_settings()
}

#[tauri::command]
pub fn save_settings(settings: Settings) -> Result<(), String> {
    crate::settings::save_settings(settings)
}

#[cfg(desktop)]
#[tauri::command]
pub async fn check_for_app_update(
    app_handle: tauri::AppHandle,
    release_channel: Option<String>,
) -> Result<Option<crate::app_updater::AppUpdateMetadata>, String> {
    crate::app_updater::check_for_app_update(app_handle, release_channel).await
}

#[cfg(mobile)]
#[tauri::command]
pub async fn check_for_app_update(
    _app_handle: tauri::AppHandle,
    _release_channel: Option<String>,
) -> Result<Option<crate::app_updater::AppUpdateMetadata>, String> {
    Ok(None)
}

#[cfg(desktop)]
#[tauri::command]
pub async fn download_and_install_app_update(
    app_handle: tauri::AppHandle,
    release_channel: Option<String>,
    expected_version: String,
    on_event: Channel<crate::app_updater::AppUpdateDownloadEvent>,
) -> Result<(), String> {
    crate::app_updater::download_and_install_app_update(
        app_handle,
        release_channel,
        expected_version,
        on_event,
    )
    .await
}

#[cfg(mobile)]
#[tauri::command]
pub async fn download_and_install_app_update(
    _app_handle: tauri::AppHandle,
    _release_channel: Option<String>,
    _expected_version: String,
    _on_event: tauri::ipc::Channel<crate::app_updater::AppUpdateDownloadEvent>,
) -> Result<(), String> {
    Err("App updates are not available on mobile".into())
}

#[tauri::command]
pub fn reinit_telemetry() {
    crate::telemetry::reinit_sentry();
}

#[tauri::command]
pub fn load_vault_list() -> Result<VaultList, String> {
    vault_list::load_vault_list()
}

#[tauri::command]
pub fn save_vault_list(list: VaultList) -> Result<(), String> {
    vault_list::save_vault_list(&list)
}
