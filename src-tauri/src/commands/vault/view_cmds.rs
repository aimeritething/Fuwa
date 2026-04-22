use crate::vault::{self, ViewDefinition, ViewFile};
use std::path::Path;

use super::boundary::{with_boundary, with_view_file};

#[tauri::command]
pub fn list_views(vault_path: String) -> Result<Vec<ViewFile>, String> {
    with_boundary(Some(vault_path.as_str()), |boundary| {
        Ok(vault::scan_views(boundary.requested_root()))
    })
}

#[tauri::command]
pub fn save_view_cmd(
    vault_path: String,
    filename: String,
    definition: ViewDefinition,
) -> Result<(), String> {
    with_view_file(
        &vault_path,
        &filename,
        |requested_root, validated_filename| {
            vault::save_view(Path::new(requested_root), validated_filename, &definition)
        },
    )
}

#[tauri::command]
pub fn delete_view_cmd(vault_path: String, filename: String) -> Result<(), String> {
    with_view_file(
        &vault_path,
        &filename,
        |requested_root, validated_filename| {
            vault::delete_view(Path::new(requested_root), validated_filename)
        },
    )
}
