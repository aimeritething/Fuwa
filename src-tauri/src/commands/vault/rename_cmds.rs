use crate::commands::expand_tilde;
use crate::vault::{self, DetectedRename, RenameResult};

use super::boundary::with_existing_path_in_requested_vault;

#[tauri::command]
pub fn rename_note(
    vault_path: String,
    old_path: String,
    new_title: String,
    old_title: Option<String>,
) -> Result<RenameResult, String> {
    with_existing_path_in_requested_vault(
        &vault_path,
        &old_path,
        |requested_root, validated_path| {
            vault::rename_note(
                requested_root,
                validated_path,
                &new_title,
                old_title.as_deref(),
            )
        },
    )
}

#[tauri::command]
pub fn rename_note_filename(
    vault_path: String,
    old_path: String,
    new_filename_stem: String,
) -> Result<RenameResult, String> {
    with_existing_path_in_requested_vault(
        &vault_path,
        &old_path,
        |requested_root, validated_path| {
            vault::rename_note_filename(requested_root, validated_path, &new_filename_stem)
        },
    )
}

#[tauri::command]
pub fn auto_rename_untitled(
    vault_path: String,
    note_path: String,
) -> Result<Option<RenameResult>, String> {
    with_existing_path_in_requested_vault(
        &vault_path,
        &note_path,
        |requested_root, validated_path| {
            vault::auto_rename_untitled(requested_root, validated_path)
        },
    )
}

#[tauri::command]
pub fn detect_renames(vault_path: String) -> Result<Vec<DetectedRename>, String> {
    let vault_path = expand_tilde(&vault_path);
    vault::detect_renames(&vault_path)
}

#[tauri::command]
pub fn update_wikilinks_for_renames(
    vault_path: String,
    renames: Vec<DetectedRename>,
) -> Result<usize, String> {
    let vault_path = expand_tilde(&vault_path);
    vault::update_wikilinks_for_renames(&vault_path, &renames)
}
