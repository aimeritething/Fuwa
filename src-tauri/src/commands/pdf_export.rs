#[tauri::command]
pub fn export_current_webview_pdf(
    _window: tauri::WebviewWindow,
    _output_path: String,
) -> Result<(), String> {
    Err("Direct PDF saving is unavailable; use the native print dialog".to_string())
}

#[tauri::command]
pub fn can_export_current_webview_pdf() -> bool {
    false
}
