use crate::vault;

use super::vault::VaultBoundary;

#[tauri::command]
pub async fn batch_delete_notes_async(
    paths: Vec<String>,
    vault_path: Option<String>,
) -> Result<Vec<String>, String> {
    let boundary = VaultBoundary::from_request(vault_path.as_deref())?;
    let validated_paths = boundary.validate_existing_paths(&paths)?;
    tokio::task::spawn_blocking(move || vault::batch_delete_notes(&validated_paths))
        .await
        .map_err(|e| format!("Task panicked: {e}"))?
}
