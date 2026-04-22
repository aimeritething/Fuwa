use crate::commands::expand_tilde;
use crate::search::SearchResponse;
use crate::vault::VaultEntry;
use crate::{search, vault};
use std::path::{Path, PathBuf};

use super::boundary::{with_validated_path, ValidatedPathMode};

#[tauri::command]
pub fn reload_vault_entry(
    path: PathBuf,
    vault_path: Option<PathBuf>,
) -> Result<VaultEntry, String> {
    let raw_path = path.to_string_lossy();
    let raw_vault_path = vault_path.as_ref().map(|value| value.to_string_lossy());
    with_validated_path(
        &raw_path,
        raw_vault_path.as_deref(),
        ValidatedPathMode::Existing,
        |validated_path| vault::reload_entry(Path::new(validated_path)),
    )
}

#[tauri::command]
pub async fn reload_vault(path: String) -> Result<Vec<crate::vault::VaultEntry>, String> {
    let path = expand_tilde(&path).into_owned();
    tokio::task::spawn_blocking(move || {
        vault::invalidate_cache(Path::new(&path));
        vault::scan_vault_cached(Path::new(&path))
    })
    .await
    .map_err(|e| format!("Task panicked: {e}"))?
}

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
