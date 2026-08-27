use crate::vault::{self, AttachmentRenameRequest, AttachmentRenameResult};

use super::VaultBoundary;

#[tauri::command]
pub fn rename_attachment(
    vault_path: String,
    source_path: String,
    requested_name: String,
) -> Result<AttachmentRenameResult, String> {
    let boundary = VaultBoundary::from_request(Some(&vault_path))?;
    let validated = boundary.validate_existing_paths(&[source_path])?;
    vault::rename_attachment(AttachmentRenameRequest {
        requested_name: &requested_name,
        source_path: &validated[0],
        vault_path: boundary.requested_root().to_string_lossy().as_ref(),
    })
}
