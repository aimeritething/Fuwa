use crate::session::{self, SessionState};
use serde_json::Value;
use tauri::Manager;

/// The Session file as it is on disk, or null when there is none to restore.
/// The renderer validates the schema (an unknown `version` is ignored and
/// rewritten on its side).
#[tauri::command]
pub fn read_session(app_handle: tauri::AppHandle) -> Option<Value> {
    session::read_session_file(app_handle.state::<SessionState>().path())
}

/// The renderer's part of the Session changed; the file follows after the debounce.
#[tauri::command]
pub fn update_session(app_handle: tauri::AppHandle, session: Value) -> Result<(), String> {
    if !session.is_object() {
        return Err("Session must be an object".to_owned());
    }
    session::update_renderer_session(&app_handle, session);
    Ok(())
}
