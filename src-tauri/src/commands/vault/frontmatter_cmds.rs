use crate::frontmatter;
use crate::frontmatter::FrontmatterValue;

use super::boundary::{with_existing_paths, with_validated_path, ValidatedPathMode};

#[tauri::command]
pub fn update_frontmatter(
    path: String,
    key: String,
    value: FrontmatterValue,
    vault_path: Option<String>,
) -> Result<String, String> {
    with_validated_path(
        &path,
        vault_path.as_deref(),
        ValidatedPathMode::Existing,
        |validated_path| frontmatter::update_frontmatter(validated_path, &key, value),
    )
}

#[tauri::command]
pub fn delete_frontmatter_property(
    path: String,
    key: String,
    vault_path: Option<String>,
) -> Result<String, String> {
    with_validated_path(
        &path,
        vault_path.as_deref(),
        ValidatedPathMode::Existing,
        |validated_path| frontmatter::delete_frontmatter_property(validated_path, &key),
    )
}

#[tauri::command]
pub fn batch_archive_notes(
    paths: Vec<String>,
    vault_path: Option<String>,
) -> Result<usize, String> {
    with_existing_paths(&paths, vault_path.as_deref(), |validated_paths| {
        let mut count = 0;
        for path in &validated_paths {
            frontmatter::update_frontmatter(path, "_archived", FrontmatterValue::Bool(true))?;
            count += 1;
        }
        Ok(count)
    })
}
