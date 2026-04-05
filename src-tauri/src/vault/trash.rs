use gray_matter::engine::YAML;
use gray_matter::Matter;
use std::fs;
use std::io::Write as IoWrite;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

/// Check if a file path points to a markdown file.
fn is_markdown_file(path: &Path) -> bool {
    path.is_file() && path.extension().is_some_and(|ext| ext == "md")
}

/// Extract the "Trashed at" date string from parsed gray_matter data.
fn extract_trashed_at_string(data: &Option<gray_matter::Pod>) -> Option<String> {
    let gray_matter::Pod::Hash(ref map) = data.as_ref()? else {
        return None;
    };
    let pod = map
        .get("_trashed_at")
        .or_else(|| map.get("Trashed at"))
        .or_else(|| map.get("trashed_at"))?;
    match pod {
        gray_matter::Pod::String(s) => Some(s.clone()),
        _ => None,
    }
}

/// Parse a "Trashed at" date string into a NaiveDate. Supports "2026-01-01" and "2026-01-01T..." formats.
fn parse_trashed_date(date_str: &str) -> Option<chrono::NaiveDate> {
    let trimmed = date_str.trim().trim_matches('"');
    let date_part = trimmed.split('T').next().unwrap_or(trimmed);
    chrono::NaiveDate::parse_from_str(date_part, "%Y-%m-%d").ok()
}

/// Check if `_trashed` (or aliases) is set to a truthy value in gray_matter data.
fn is_trashed_flag_set(data: &Option<gray_matter::Pod>) -> bool {
    let gray_matter::Pod::Hash(ref map) = data.as_ref().unwrap_or(&gray_matter::Pod::Null) else {
        return false;
    };
    let Some(pod) = map
        .get("_trashed")
        .or_else(|| map.get("Trashed"))
        .or_else(|| map.get("trashed"))
    else {
        return false;
    };
    match pod {
        gray_matter::Pod::Boolean(b) => *b,
        gray_matter::Pod::String(s) => {
            matches!(s.to_ascii_lowercase().as_str(), "yes" | "true" | "1")
        }
        _ => false,
    }
}

/// Check whether a file path is strictly inside the given vault root.
fn is_inside_vault(file_path: &Path, vault_root: &Path) -> bool {
    match (file_path.canonicalize(), vault_root.canonicalize()) {
        (Ok(fp), Ok(vr)) => fp.starts_with(&vr),
        _ => false,
    }
}

/// Move a file to OS trash. Falls back to fs::remove_file if OS trash fails.
fn trash_or_remove(path: &Path) -> Result<(), String> {
    match trash::delete(path) {
        Ok(()) => Ok(()),
        Err(trash_err) => {
            log::warn!(
                "OS trash failed for {}: {} — falling back to fs::remove_file",
                path.display(),
                trash_err
            );
            fs::remove_file(path).map_err(|e| format!("Failed to delete {}: {}", path.display(), e))
        }
    }
}

/// Delete a file (move to OS trash) and log the result. Returns the path string if successful.
fn try_purge_file(path: &Path) -> Option<String> {
    match trash_or_remove(path) {
        Ok(()) => {
            log::info!("Purged trashed file: {}", path.display());
            Some(path.to_string_lossy().to_string())
        }
        Err(e) => {
            log::warn!("Failed to purge {}: {}", path.display(), e);
            None
        }
    }
}

/// Append a purge run summary to `.laputa/purge.log`.
fn write_purge_log(vault_path: &Path, checked: usize, purged: &[String], dry_run: bool) {
    let log_dir = vault_path.join(".laputa");
    if fs::create_dir_all(&log_dir).is_err() {
        log::warn!("Could not create .laputa/ directory for purge log");
        return;
    }
    let log_path = log_dir.join("purge.log");
    let mut file = match fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
    {
        Ok(f) => f,
        Err(e) => {
            log::warn!("Could not open purge.log: {}", e);
            return;
        }
    };
    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ");
    let mode = if dry_run { " [DRY-RUN]" } else { "" };
    let _ = writeln!(
        file,
        "[{}]{} checked={}, purged={}",
        now,
        mode,
        checked,
        purged.len()
    );
    for path in purged {
        let _ = writeln!(file, "  - {}", path);
    }
}

/// Permanently delete a single note file.
/// Returns the deleted path on success, or an error if the file doesn't exist.
pub fn delete_note(path: &str) -> Result<String, String> {
    let file = Path::new(path);
    if !file.exists() {
        return Err(format!("File does not exist: {}", path));
    }
    if !file.is_file() {
        return Err(format!("Path is not a file: {}", path));
    }
    fs::remove_file(file).map_err(|e| format!("Failed to delete {}: {}", path, e))?;
    log::info!("Permanently deleted note: {}", path);
    Ok(path.to_string())
}

/// Check whether a file's frontmatter marks it as trashed.
/// Returns `true` if `Trashed: true` or `Trashed at` is present.
pub fn is_file_trashed(path: &Path) -> bool {
    let content = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return false,
    };
    let matter = Matter::<YAML>::new();
    let parsed = matter.parse(&content);

    // Check for "Trashed at" field — its presence implies trashed
    if extract_trashed_at_string(&parsed.data).is_some() {
        return true;
    }

    // Check for "Trashed: true"
    if let Some(gray_matter::Pod::Hash(ref map)) = parsed.data {
        if let Some(pod) = map
            .get("_trashed")
            .or_else(|| map.get("Trashed"))
            .or_else(|| map.get("trashed"))
        {
            return match pod {
                gray_matter::Pod::Boolean(b) => *b,
                gray_matter::Pod::String(s) => {
                    matches!(s.to_ascii_lowercase().as_str(), "yes" | "true")
                }
                _ => false,
            };
        }
    }

    false
}

/// Delete multiple note files from disk.
/// Returns the list of successfully deleted paths.
/// Skips files that don't exist or fail to delete (logs warnings).
pub fn batch_delete_notes(paths: &[String]) -> Result<Vec<String>, String> {
    let mut deleted = Vec::new();
    for path in paths {
        let file = Path::new(path.as_str());
        match try_purge_file(file) {
            Some(p) => deleted.push(p),
            None if !file.exists() => {
                log::warn!("File does not exist, skipping: {}", path);
            }
            None => {} // try_purge_file already logged the warning
        }
    }
    Ok(deleted)
}

/// Scan all markdown files in the vault and delete ALL trashed notes
/// (regardless of age). Returns the list of deleted file paths.
pub fn empty_trash(vault_path: &str) -> Result<Vec<String>, String> {
    let vault = Path::new(vault_path);
    if !vault.exists() || !vault.is_dir() {
        return Err(format!(
            "Vault path does not exist or is not a directory: {}",
            vault_path
        ));
    }

    let mut deleted = Vec::new();
    for entry in WalkDir::new(vault)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| is_markdown_file(e.path()))
        .filter(|e| is_file_trashed(e.path()))
    {
        if let Some(p) = try_purge_file(entry.path()) {
            deleted.push(p);
        }
    }

    Ok(deleted)
}

/// Scan all markdown files in the vault and delete those where
/// `_trashed_at` frontmatter is more than 30 days ago.
///
/// Safety checks enforced per file (all must pass):
/// 1. `_trashed: true` present in frontmatter
/// 2. `_trashed_at` present and parseable as a date
/// 3. Date is strictly more than 30 days ago
/// 4. File exists on disk
/// 5. File path is inside the vault root
///
/// When `dry_run` is true, no files are deleted — only the list of candidates is returned.
/// Returns the list of purged (or would-be-purged) file paths.
pub fn purge_old_trash(vault_path: &Path, dry_run: bool) -> Result<Vec<PathBuf>, String> {
    if !vault_path.exists() || !vault_path.is_dir() {
        return Err(format!(
            "Vault path does not exist or is not a directory: {}",
            vault_path.display()
        ));
    }

    let today = chrono::Utc::now().date_naive();
    let matter = Matter::<YAML>::new();
    let max_age_days = 30;
    let mut checked = 0usize;
    let mut purged: Vec<String> = Vec::new();
    let mut purged_paths: Vec<PathBuf> = Vec::new();

    for entry in WalkDir::new(vault_path)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| is_markdown_file(e.path()))
    {
        let path = entry.path();

        // Safety check 4: file exists
        if !path.exists() {
            continue;
        }

        // Safety check 5: file is inside vault root
        if !is_inside_vault(path, vault_path) {
            log::warn!("Skipping file outside vault: {}", path.display());
            continue;
        }

        let content = match fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => continue,
        };
        let parsed = matter.parse(&content);

        // Safety check 1: _trashed: true
        if !is_trashed_flag_set(&parsed.data) {
            continue;
        }

        // Safety check 2: _trashed_at present and parseable
        let date_str = match extract_trashed_at_string(&parsed.data) {
            Some(s) => s,
            None => {
                log::warn!(
                    "Trashed file missing _trashed_at, skipping: {}",
                    path.display()
                );
                continue;
            }
        };
        let trashed_date = match parse_trashed_date(&date_str) {
            Some(d) => d,
            None => {
                log::warn!(
                    "Unparseable _trashed_at '{}', skipping: {}",
                    date_str,
                    path.display()
                );
                continue;
            }
        };

        // Safety check 3: strictly more than 30 days old
        let age = today.signed_duration_since(trashed_date);
        if age.num_days() <= max_age_days {
            continue;
        }

        checked += 1;

        if dry_run {
            log::info!(
                "[DRY-RUN] Would purge: {} (trashed {} days ago)",
                path.display(),
                age.num_days()
            );
            purged.push(path.to_string_lossy().to_string());
            purged_paths.push(path.to_path_buf());
        } else if let Some(p) = try_purge_file(path) {
            purged.push(p);
            purged_paths.push(path.to_path_buf());
        }
    }

    write_purge_log(vault_path, checked, &purged, dry_run);

    Ok(purged_paths)
}

/// Legacy wrapper that calls purge_old_trash with dry_run=false and returns string paths.
/// Used by the Tauri command and startup tasks.
pub fn purge_trash(vault_path: &str) -> Result<Vec<String>, String> {
    let vault = Path::new(vault_path);
    purge_old_trash(vault, false)
        .map(|paths| {
            paths
                .into_iter()
                .map(|p| p.to_string_lossy().to_string())
                .collect()
        })
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::TempDir;

    fn create_test_file(dir: &Path, name: &str, content: &str) {
        let file_path = dir.join(name);
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        let mut file = fs::File::create(file_path).unwrap();
        file.write_all(content.as_bytes()).unwrap();
    }

    #[test]
    fn test_delete_note_removes_file() {
        let dir = TempDir::new().unwrap();
        create_test_file(
            dir.path(),
            "doomed.md",
            "---\ntitle: Doomed\n---\n# Doomed\n",
        );
        let path = dir.path().join("doomed.md");
        assert!(path.exists());
        let result = delete_note(path.to_str().unwrap());
        assert!(result.is_ok());
        assert!(!path.exists());
    }

    #[test]
    fn test_delete_note_nonexistent_file() {
        let result = delete_note("/nonexistent/path/that/does/not/exist.md");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("does not exist"));
    }

    fn old_date(days_ago: i64) -> String {
        (chrono::Utc::now().date_naive() - chrono::Duration::days(days_ago))
            .format("%Y-%m-%d")
            .to_string()
    }

    fn trashed_content(date: &str) -> String {
        format!(
            "---\n_trashed: true\n_trashed_at: \"{}\"\n---\n# Trashed\n",
            date
        )
    }

    #[test]
    fn test_purge_old_trash_deletes_old_trashed_files() {
        let dir = TempDir::new().unwrap();
        create_test_file(dir.path(), "old.md", &trashed_content("2025-01-01"));
        create_test_file(dir.path(), "recent.md", &trashed_content(&old_date(5)));
        create_test_file(dir.path(), "normal.md", "---\ntype: Note\n---\n# Normal\n");

        let purged = purge_old_trash(dir.path(), false).unwrap();
        assert_eq!(purged.len(), 1);
        assert!(!dir.path().join("old.md").exists());
        assert!(dir.path().join("recent.md").exists());
        assert!(dir.path().join("normal.md").exists());
    }

    #[test]
    fn test_purge_old_trash_supports_datetime_format() {
        let dir = TempDir::new().unwrap();
        create_test_file(
            dir.path(),
            "dt.md",
            "---\n_trashed: true\n_trashed_at: \"2025-01-01T10:30:00Z\"\n---\n# DT\n",
        );

        let purged = purge_old_trash(dir.path(), false).unwrap();
        assert_eq!(purged.len(), 1);
    }

    #[test]
    fn test_purge_old_trash_empty_vault() {
        let dir = TempDir::new().unwrap();
        let purged = purge_old_trash(dir.path(), false).unwrap();
        assert!(purged.is_empty());
    }

    #[test]
    fn test_purge_old_trash_nonexistent_path() {
        let result = purge_old_trash(Path::new("/nonexistent/path"), false);
        assert!(result.is_err());
    }

    #[test]
    fn test_purge_old_trash_exactly_30_days_not_deleted() {
        let dir = TempDir::new().unwrap();
        create_test_file(dir.path(), "borderline.md", &trashed_content(&old_date(30)));

        let purged = purge_old_trash(dir.path(), false).unwrap();
        assert!(purged.is_empty());
        assert!(dir.path().join("borderline.md").exists());
    }

    #[test]
    fn test_purge_old_trash_31_days_deleted() {
        let dir = TempDir::new().unwrap();
        create_test_file(dir.path(), "expired.md", &trashed_content(&old_date(31)));

        let purged = purge_old_trash(dir.path(), false).unwrap();
        assert_eq!(purged.len(), 1);
        assert!(!dir.path().join("expired.md").exists());
    }

    #[test]
    fn test_purge_old_trash_nested_directories() {
        let dir = TempDir::new().unwrap();
        create_test_file(
            dir.path(),
            "sub/deep/old.md",
            &trashed_content("2025-01-01"),
        );

        let purged = purge_old_trash(dir.path(), false).unwrap();
        assert_eq!(purged.len(), 1);
    }

    #[test]
    fn test_purge_old_trash_dry_run_does_not_delete() {
        let dir = TempDir::new().unwrap();
        create_test_file(dir.path(), "old.md", &trashed_content("2025-01-01"));

        let purged = purge_old_trash(dir.path(), true).unwrap();
        assert_eq!(purged.len(), 1);
        assert!(
            dir.path().join("old.md").exists(),
            "dry-run must not delete files"
        );
    }

    #[test]
    fn test_purge_old_trash_missing_trashed_flag_skips() {
        let dir = TempDir::new().unwrap();
        // Has _trashed_at but no _trashed: true
        create_test_file(
            dir.path(),
            "no-flag.md",
            "---\n_trashed_at: \"2025-01-01\"\n---\n# No flag\n",
        );

        let purged = purge_old_trash(dir.path(), false).unwrap();
        assert!(purged.is_empty());
        assert!(dir.path().join("no-flag.md").exists());
    }

    #[test]
    fn test_purge_old_trash_missing_trashed_at_skips() {
        let dir = TempDir::new().unwrap();
        // Has _trashed: true but no _trashed_at
        create_test_file(
            dir.path(),
            "no-date.md",
            "---\n_trashed: true\n---\n# No date\n",
        );

        let purged = purge_old_trash(dir.path(), false).unwrap();
        assert!(purged.is_empty());
        assert!(dir.path().join("no-date.md").exists());
    }

    #[test]
    fn test_purge_old_trash_unparseable_date_skips() {
        let dir = TempDir::new().unwrap();
        create_test_file(
            dir.path(),
            "bad-date.md",
            "---\n_trashed: true\n_trashed_at: \"not-a-date\"\n---\n# Bad date\n",
        );

        let purged = purge_old_trash(dir.path(), false).unwrap();
        assert!(purged.is_empty());
        assert!(dir.path().join("bad-date.md").exists());
    }

    #[test]
    fn test_purge_old_trash_trashed_false_skips() {
        let dir = TempDir::new().unwrap();
        create_test_file(
            dir.path(),
            "not-trashed.md",
            "---\n_trashed: false\n_trashed_at: \"2025-01-01\"\n---\n# Not trashed\n",
        );

        let purged = purge_old_trash(dir.path(), false).unwrap();
        assert!(purged.is_empty());
        assert!(dir.path().join("not-trashed.md").exists());
    }

    #[test]
    fn test_purge_old_trash_legacy_field_names() {
        let dir = TempDir::new().unwrap();
        create_test_file(
            dir.path(),
            "legacy.md",
            "---\nTrashed: true\nTrashed at: \"2025-01-01\"\n---\n# Legacy\n",
        );

        let purged = purge_old_trash(dir.path(), false).unwrap();
        assert_eq!(purged.len(), 1);
        assert!(!dir.path().join("legacy.md").exists());
    }

    #[test]
    fn test_purge_old_trash_writes_purge_log() {
        let dir = TempDir::new().unwrap();
        create_test_file(dir.path(), "old.md", &trashed_content("2025-01-01"));

        let _ = purge_old_trash(dir.path(), false).unwrap();
        let log_path = dir.path().join(".laputa/purge.log");
        assert!(log_path.exists(), "purge.log must be created");
        let log_content = fs::read_to_string(&log_path).unwrap();
        assert!(log_content.contains("purged=1"));
        assert!(log_content.contains("old.md"));
    }

    #[test]
    fn test_purge_old_trash_wrapper_returns_strings() {
        let dir = TempDir::new().unwrap();
        create_test_file(dir.path(), "old.md", &trashed_content("2025-01-01"));

        let deleted = purge_trash(dir.path().to_str().unwrap()).unwrap();
        assert_eq!(deleted.len(), 1);
        assert!(deleted[0].contains("old.md"));
    }

    #[test]
    fn test_is_file_trashed_with_trashed_true() {
        let dir = TempDir::new().unwrap();
        create_test_file(
            dir.path(),
            "trashed.md",
            "---\nTrashed: true\n---\n# Gone\n",
        );
        assert!(is_file_trashed(&dir.path().join("trashed.md")));
    }

    #[test]
    fn test_is_file_trashed_with_trashed_at() {
        let dir = TempDir::new().unwrap();
        create_test_file(
            dir.path(),
            "trashed.md",
            "---\nTrashed at: \"2026-01-01\"\n---\n# Gone\n",
        );
        assert!(is_file_trashed(&dir.path().join("trashed.md")));
    }

    #[test]
    fn test_is_file_trashed_with_trashed_yes() {
        let dir = TempDir::new().unwrap();
        create_test_file(dir.path(), "trashed.md", "---\nTrashed: Yes\n---\n# Gone\n");
        assert!(is_file_trashed(&dir.path().join("trashed.md")));
    }

    #[test]
    fn test_is_file_trashed_normal_note() {
        let dir = TempDir::new().unwrap();
        create_test_file(dir.path(), "normal.md", "---\ntype: Note\n---\n# Normal\n");
        assert!(!is_file_trashed(&dir.path().join("normal.md")));
    }

    #[test]
    fn test_is_file_trashed_archived_not_trashed() {
        let dir = TempDir::new().unwrap();
        create_test_file(
            dir.path(),
            "archived.md",
            "---\nArchived: true\n---\n# Archived\n",
        );
        assert!(!is_file_trashed(&dir.path().join("archived.md")));
    }

    #[test]
    fn test_is_file_trashed_nonexistent_file() {
        assert!(!is_file_trashed(Path::new("/nonexistent/path.md")));
    }

    #[test]
    fn test_is_file_trashed_with_underscore_trashed() {
        let dir = TempDir::new().unwrap();
        create_test_file(
            dir.path(),
            "trashed.md",
            "---\n_trashed: true\n---\n# Gone\n",
        );
        assert!(is_file_trashed(&dir.path().join("trashed.md")));
    }

    #[test]
    fn test_is_file_trashed_with_underscore_trashed_at() {
        let dir = TempDir::new().unwrap();
        create_test_file(
            dir.path(),
            "trashed.md",
            "---\n_trashed_at: \"2026-03-15\"\n---\n# Gone\n",
        );
        assert!(is_file_trashed(&dir.path().join("trashed.md")));
    }

    #[test]
    fn test_is_file_trashed_with_trashed_false() {
        let dir = TempDir::new().unwrap();
        create_test_file(
            dir.path(),
            "active.md",
            "---\nTrashed: false\n---\n# Active\n",
        );
        assert!(!is_file_trashed(&dir.path().join("active.md")));
    }

    #[test]
    fn test_batch_delete_notes_removes_files() {
        let dir = TempDir::new().unwrap();
        create_test_file(dir.path(), "a.md", "---\ntitle: A\n---\n# A\n");
        create_test_file(dir.path(), "b.md", "---\ntitle: B\n---\n# B\n");
        create_test_file(dir.path(), "keep.md", "---\ntitle: Keep\n---\n# Keep\n");

        let paths = vec![
            dir.path().join("a.md").to_str().unwrap().to_string(),
            dir.path().join("b.md").to_str().unwrap().to_string(),
        ];
        let deleted = batch_delete_notes(&paths).unwrap();
        assert_eq!(deleted.len(), 2);
        assert!(!dir.path().join("a.md").exists());
        assert!(!dir.path().join("b.md").exists());
        assert!(dir.path().join("keep.md").exists());
    }

    #[test]
    fn test_batch_delete_notes_skips_nonexistent() {
        let dir = TempDir::new().unwrap();
        create_test_file(dir.path(), "exists.md", "---\ntitle: X\n---\n# X\n");

        let paths = vec![
            dir.path().join("exists.md").to_str().unwrap().to_string(),
            "/nonexistent/path.md".to_string(),
        ];
        let deleted = batch_delete_notes(&paths).unwrap();
        assert_eq!(deleted.len(), 1);
        assert!(!dir.path().join("exists.md").exists());
    }

    #[test]
    fn test_empty_trash_deletes_all_trashed() {
        let dir = TempDir::new().unwrap();
        // Recently trashed — should be deleted
        let recent = chrono::Utc::now()
            .date_naive()
            .format("%Y-%m-%d")
            .to_string();
        create_test_file(
            dir.path(),
            "recent.md",
            &format!(
                "---\nTrashed: true\nTrashed at: \"{}\"\n---\n# Recent\n",
                recent
            ),
        );
        // Old trashed — should be deleted
        create_test_file(
            dir.path(),
            "old.md",
            "---\nTrashed: true\nTrashed at: \"2025-01-01\"\n---\n# Old\n",
        );
        // Not trashed — should be kept
        create_test_file(dir.path(), "normal.md", "---\ntype: Note\n---\n# Normal\n");

        let deleted = empty_trash(dir.path().to_str().unwrap()).unwrap();
        assert_eq!(deleted.len(), 2);
        assert!(!dir.path().join("recent.md").exists());
        assert!(!dir.path().join("old.md").exists());
        assert!(dir.path().join("normal.md").exists());
    }

    #[test]
    fn test_empty_trash_empty_vault() {
        let dir = TempDir::new().unwrap();
        let deleted = empty_trash(dir.path().to_str().unwrap()).unwrap();
        assert!(deleted.is_empty());
    }

    #[test]
    fn test_empty_trash_nonexistent_path() {
        let result = empty_trash("/nonexistent/path/that/does/not/exist");
        assert!(result.is_err());
    }
}
