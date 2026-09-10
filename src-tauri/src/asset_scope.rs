use std::path::{Path, PathBuf};
use std::sync::Mutex;

pub(crate) struct AllowedAssetScopeRoots(pub(crate) Mutex<Vec<PathBuf>>);

pub(crate) fn vault_asset_scope_roots(vault_path: &Path) -> Result<Vec<PathBuf>, String> {
    let canonical_vault_path = std::fs::canonicalize(vault_path).map_err(|error| {
        format!(
            "Failed to resolve asset scope for {}: {error}",
            vault_path.display()
        )
    })?;
    let mut roots = vec![canonical_vault_path.clone()];
    let requested_vault_path = vault_path.to_path_buf();
    if requested_vault_path != canonical_vault_path {
        roots.push(requested_vault_path);
    }
    Ok(roots)
}

pub(crate) fn missing_asset_scope_roots(
    allowed_roots: &[PathBuf],
    requested_roots: &[PathBuf],
) -> Vec<PathBuf> {
    requested_roots
        .iter()
        .filter(|root| !allowed_roots.contains(root))
        .cloned()
        .collect()
}

pub(crate) fn sync_vault_asset_scope(
    app_handle: &tauri::AppHandle,
    vault_path: &Path,
) -> Result<(), String> {
    use tauri::Manager;

    let requested_roots = vault_asset_scope_roots(vault_path)?;
    let scope = app_handle.asset_protocol_scope();
    let state: tauri::State<'_, AllowedAssetScopeRoots> = app_handle.state();
    let mut allowed_roots = state
        .0
        .lock()
        .map_err(|_| "Failed to lock asset scope state".to_string())?;
    let roots_to_allow = missing_asset_scope_roots(&allowed_roots, &requested_roots);

    for root in &roots_to_allow {
        scope.allow_directory(root, true).map_err(|error| {
            format!(
                "Failed to allow asset access for {}: {error}",
                root.display()
            )
        })?;
    }

    allowed_roots.extend(roots_to_allow);
    Ok(())
}
