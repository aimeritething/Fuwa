use crate::vault::{self, FolderRenameResult};

use super::expand_tilde;

#[tauri::command]
pub fn rename_vault_folder(
    vault_path: String,
    folder_path: String,
    new_name: String,
) -> Result<FolderRenameResult, String> {
    let vault_path = expand_tilde(&vault_path);
    vault::rename_folder(
        std::path::Path::new(vault_path.as_ref()),
        &folder_path,
        &new_name,
    )
}

#[tauri::command]
pub fn delete_vault_folder(vault_path: String, folder_path: String) -> Result<String, String> {
    let vault_path = expand_tilde(&vault_path);
    vault::delete_folder(std::path::Path::new(vault_path.as_ref()), &folder_path)
}
