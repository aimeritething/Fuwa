/// ⌘Q's last step (AIM-385). The renderer owns the quit sequence: it writes
/// every pending edit first and, when one is refused, keeps the app open and
/// asks. Only once every write has landed, or the user chose Discard and
/// quit, does it call this; exiting through `ExitRequested` flushes the
/// Session file once more on the way out (ADR-0004).
#[tauri::command]
pub fn quit_app(app_handle: tauri::AppHandle) {
    app_handle.exit(0);
}
