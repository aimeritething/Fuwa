use crate::vault;

use super::expand_tilde;

#[tauri::command]
pub async fn batch_delete_notes_async(paths: Vec<String>) -> Result<Vec<String>, String> {
    let expanded: Vec<String> = paths
        .iter()
        .map(|path| expand_tilde(path).into_owned())
        .collect();
    tokio::task::spawn_blocking(move || vault::batch_delete_notes(&expanded))
        .await
        .map_err(|e| format!("Task panicked: {e}"))?
}
