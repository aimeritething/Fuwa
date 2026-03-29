use crate::frontmatter::FrontmatterValue;
use crate::search::SearchResponse;
use crate::vault::{RenameResult, VaultEntry};
use crate::{frontmatter, git, search, vault};

use super::expand_tilde;

// ── Vault commands ──────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_vault(path: String) -> Result<Vec<VaultEntry>, String> {
    let path = expand_tilde(&path);
    vault::scan_vault_cached(std::path::Path::new(path.as_ref()))
}

#[tauri::command]
pub fn get_note_content(path: String) -> Result<String, String> {
    let path = expand_tilde(&path);
    vault::get_note_content(std::path::Path::new(path.as_ref()))
}

#[tauri::command]
pub fn save_note_content(path: String, content: String) -> Result<(), String> {
    let path = expand_tilde(&path);
    vault::save_note_content(&path, &content)
}

#[tauri::command]
pub fn rename_note(
    vault_path: String,
    old_path: String,
    new_title: String,
    old_title: Option<String>,
) -> Result<RenameResult, String> {
    let vault_path = expand_tilde(&vault_path);
    let old_path = expand_tilde(&old_path);
    vault::rename_note(&vault_path, &old_path, &new_title, old_title.as_deref())
}

#[tauri::command]
pub fn purge_trash(vault_path: String) -> Result<Vec<String>, String> {
    let vault_path = expand_tilde(&vault_path);
    vault::purge_trash(&vault_path)
}

#[tauri::command]
pub fn delete_note(path: String) -> Result<String, String> {
    let path = expand_tilde(&path);
    vault::delete_note(&path)
}

#[tauri::command]
pub fn batch_delete_notes(paths: Vec<String>) -> Result<Vec<String>, String> {
    let expanded: Vec<String> = paths.iter().map(|p| expand_tilde(p).into_owned()).collect();
    vault::batch_delete_notes(&expanded)
}

#[tauri::command]
pub fn empty_trash(vault_path: String) -> Result<Vec<String>, String> {
    let vault_path = expand_tilde(&vault_path);
    vault::empty_trash(&vault_path)
}

#[tauri::command]
pub fn migrate_is_a_to_type(vault_path: String) -> Result<usize, String> {
    let vault_path = expand_tilde(&vault_path);
    vault::migrate_is_a_to_type(&vault_path)
}

#[tauri::command]
pub fn flatten_vault(vault_path: String) -> Result<usize, String> {
    let vault_path = expand_tilde(&vault_path);
    vault::flatten_vault(&vault_path)
}

#[tauri::command]
pub fn vault_health_check(vault_path: String) -> Result<vault::VaultHealthReport, String> {
    let vault_path = expand_tilde(&vault_path);
    vault::vault_health_check(&vault_path)
}

#[tauri::command]
pub fn create_getting_started_vault(target_path: Option<String>) -> Result<String, String> {
    let path = match target_path {
        Some(p) if !p.is_empty() => expand_tilde(&p).into_owned(),
        _ => vault::default_vault_path()?.to_string_lossy().to_string(),
    };
    vault::create_getting_started_vault(&path)
}

#[tauri::command]
pub fn check_vault_exists(path: String) -> bool {
    let path = expand_tilde(&path);
    vault::vault_exists(&path)
}

#[tauri::command]
pub fn get_default_vault_path() -> Result<String, String> {
    vault::default_vault_path().map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn reload_vault(path: String) -> Result<Vec<VaultEntry>, String> {
    let path = expand_tilde(&path).into_owned();
    tokio::task::spawn_blocking(move || {
        vault::invalidate_cache(std::path::Path::new(&path));
        vault::scan_vault_cached(std::path::Path::new(&path))
    })
    .await
    .map_err(|e| format!("Task panicked: {e}"))?
}

#[tauri::command]
pub fn reload_vault_entry(path: String) -> Result<VaultEntry, String> {
    let path = expand_tilde(&path);
    vault::reload_entry(std::path::Path::new(path.as_ref()))
}

/// Sync the `title` frontmatter field with the filename on note open.
/// Returns `true` if the file was modified (title was absent or desynced).
#[tauri::command]
pub fn sync_note_title(path: String) -> Result<bool, String> {
    use vault::SyncAction;
    let path = expand_tilde(&path);
    let action = vault::sync_title_on_open(std::path::Path::new(path.as_ref()))?;
    Ok(matches!(action, SyncAction::Updated { .. }))
}

#[tauri::command]
pub fn save_image(vault_path: String, filename: String, data: String) -> Result<String, String> {
    let vault_path = expand_tilde(&vault_path);
    vault::save_image(&vault_path, &filename, &data)
}

#[tauri::command]
pub fn copy_image_to_vault(vault_path: String, source_path: String) -> Result<String, String> {
    let vault_path = expand_tilde(&vault_path);
    vault::copy_image_to_vault(&vault_path, &source_path)
}

// ── Frontmatter commands ────────────────────────────────────────────────────

#[tauri::command]
pub fn update_frontmatter(
    path: String,
    key: String,
    value: FrontmatterValue,
) -> Result<String, String> {
    let path = expand_tilde(&path);
    frontmatter::update_frontmatter(&path, &key, value)
}

#[tauri::command]
pub fn delete_frontmatter_property(path: String, key: String) -> Result<String, String> {
    let path = expand_tilde(&path);
    frontmatter::delete_frontmatter_property(&path, &key)
}

#[tauri::command]
pub fn batch_archive_notes(paths: Vec<String>) -> Result<usize, String> {
    let mut count = 0;
    for path in &paths {
        let path = expand_tilde(path);
        frontmatter::update_frontmatter(&path, "Archived", FrontmatterValue::Bool(true))?;
        count += 1;
    }
    Ok(count)
}

#[tauri::command]
pub fn batch_trash_notes(paths: Vec<String>) -> Result<usize, String> {
    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    let mut count = 0;
    for path in &paths {
        let path = expand_tilde(path);
        frontmatter::update_frontmatter(&path, "Trashed", FrontmatterValue::Bool(true))?;
        frontmatter::update_frontmatter(
            &path,
            "Trashed at",
            FrontmatterValue::String(now.clone()),
        )?;
        count += 1;
    }
    Ok(count)
}

// ── Search commands ─────────────────────────────────────────────────────────

#[tauri::command]
pub async fn search_vault(
    vault_path: String,
    query: String,
    mode: String,
    limit: Option<usize>,
) -> Result<SearchResponse, String> {
    let vault_path = expand_tilde(&vault_path).into_owned();
    let limit = limit.unwrap_or(20);
    tokio::task::spawn_blocking(move || search::search_vault(&vault_path, &query, &mode, limit))
        .await
        .map_err(|e| format!("Search task failed: {}", e))?
}

// ── Repair command ──────────────────────────────────────────────────────────

#[tauri::command]
pub fn repair_vault(vault_path: String) -> Result<String, String> {
    let vault_path = expand_tilde(&vault_path);
    vault::migrate_is_a_to_type(&vault_path)?;
    vault::flatten_vault(&vault_path)?;
    vault::repair_config_files(&vault_path)?;
    git::ensure_gitignore(&vault_path)?;
    Ok("Vault repaired".to_string())
}
