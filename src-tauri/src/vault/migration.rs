use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

fn has_legacy_is_a(fm_content: &str) -> bool {
    fm_content.lines().any(|line| {
        let t = line.trim_start();
        t.starts_with("is_a:")
            || t.starts_with("\"Is A\":")
            || t.starts_with("'Is A':")
            || t.starts_with("Is A:")
    })
}

/// Extract the value from a legacy `is_a` / `Is A` line.
fn extract_is_a_value(line: &str) -> Option<&str> {
    let t = line.trim_start();
    for prefix in &["is_a:", "\"Is A\":", "'Is A':", "Is A:"] {
        if let Some(rest) = t.strip_prefix(prefix) {
            let v = rest.trim();
            return Some(v);
        }
    }
    None
}

/// Migrate a single file's frontmatter from `is_a`/`Is A` to `type`.
/// Returns Ok(true) if the file was modified, Ok(false) if no migration needed.
fn migrate_file_is_a_to_type(path: &Path) -> Result<bool, String> {
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;

    if !content.starts_with("---\n") {
        return Ok(false);
    }
    let fm_end = match content[4..].find("\n---") {
        Some(i) => i + 4,
        None => return Ok(false),
    };
    let fm_content = &content[4..fm_end];

    if !has_legacy_is_a(fm_content) {
        return Ok(false);
    }

    // Check if `type:` already exists
    let has_type = fm_content.lines().any(|line| {
        let t = line.trim_start();
        t.starts_with("type:")
    });

    let mut new_lines: Vec<String> = Vec::new();
    let mut is_a_value: Option<String> = None;

    for line in fm_content.lines() {
        if let Some(val) = extract_is_a_value(line) {
            is_a_value = Some(val.to_string());
            // Skip list continuations after is_a
            continue;
        }
        new_lines.push(line.to_string());
    }

    // If type: doesn't exist and we found an is_a value, add type:
    if !has_type {
        if let Some(ref val) = is_a_value {
            // Insert type: at the beginning (after other keys is fine too, but beginning is clean)
            new_lines.insert(0, format!("type: {}", val));
        }
    }

    let rest = &content[fm_end + 4..];
    let new_content = format!("---\n{}\n---{}", new_lines.join("\n"), rest);

    fs::write(path, &new_content)
        .map_err(|e| format!("Failed to write {}: {}", path.display(), e))?;

    Ok(true)
}

/// Migrate all markdown files in the vault from `is_a`/`Is A` to `type`.
/// Returns the number of files migrated.
pub fn migrate_is_a_to_type(vault_path: &str) -> Result<usize, String> {
    let vault = Path::new(vault_path);
    if !vault.exists() || !vault.is_dir() {
        return Err(format!(
            "Vault path does not exist or is not a directory: {}",
            vault_path
        ));
    }

    let mut migrated = 0;
    for entry in WalkDir::new(vault)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if !path.is_file() || path.extension().map(|ext| ext != "md").unwrap_or(true) {
            continue;
        }

        match migrate_file_is_a_to_type(path) {
            Ok(true) => {
                log::info!("Migrated is_a → type: {}", path.display());
                migrated += 1;
            }
            Ok(false) => {}
            Err(e) => {
                log::warn!("Failed to migrate {}: {}", path.display(), e);
            }
        }
    }

    Ok(migrated)
}

/// Folders that are system folders and should NOT be migrated (notes stay there).
const SYSTEM_FOLDERS: &[&str] = &["type", "config", "theme"];

/// Result of the flat vault migration.
#[derive(Debug, Serialize, Deserialize)]
pub struct MigrationResult {
    /// Number of files moved to the vault root.
    pub moved: usize,
    /// Number of files skipped (already at root, or in system folders).
    pub skipped: usize,
    /// Files that could not be moved (collision, error).
    pub errors: Vec<String>,
}

/// Determine a unique destination path at vault root, appending -2, -3, etc. if needed.
fn unique_root_path(vault: &Path, filename: &str) -> std::path::PathBuf {
    let dest = vault.join(filename);
    if !dest.exists() {
        return dest;
    }
    let stem = Path::new(filename)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();
    let ext = Path::new(filename)
        .extension()
        .map(|s| format!(".{}", s.to_string_lossy()))
        .unwrap_or_default();
    let mut counter = 2;
    loop {
        let candidate = vault.join(format!("{}-{}{}", stem, counter, ext));
        if !candidate.exists() {
            return candidate;
        }
        counter += 1;
    }
}

/// Check if a directory entry is inside a system folder.
fn is_in_system_folder(path: &Path, vault: &Path) -> bool {
    let rel = path
        .strip_prefix(vault)
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
    SYSTEM_FOLDERS
        .iter()
        .any(|sf| rel.starts_with(&format!("{}/", sf)) || rel == *sf)
}

/// Migrate an existing vault to flat structure: move all .md files from type-based
/// subfolders to the vault root. System folders (type/, config/, theme/) are skipped.
/// Wikilinks that used path-based references are updated to use the title.
pub fn migrate_to_flat_vault(vault_path: &str) -> Result<MigrationResult, String> {
    let vault = Path::new(vault_path);
    if !vault.exists() || !vault.is_dir() {
        return Err(format!(
            "Vault path does not exist or is not a directory: {}",
            vault_path
        ));
    }

    // Collect all .md files in subfolders (not root, not system folders)
    let mut files_to_move: Vec<std::path::PathBuf> = Vec::new();
    for entry in WalkDir::new(vault)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if !path.is_file() || path.extension().map(|ext| ext != "md").unwrap_or(true) {
            continue;
        }
        // Skip files already at vault root
        if path.parent() == Some(vault) {
            continue;
        }
        // Skip system folders
        if is_in_system_folder(path, vault) {
            continue;
        }
        files_to_move.push(path.to_path_buf());
    }

    let mut result = MigrationResult {
        moved: 0,
        skipped: 0,
        errors: Vec::new(),
    };

    // Build a map of old path stems → titles for wikilink updating
    let mut path_stem_to_title: Vec<(String, String)> = Vec::new();

    for file in &files_to_move {
        let filename = file
            .file_name()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_default();

        // Read content to extract title
        let content = match fs::read_to_string(file) {
            Ok(c) => c,
            Err(e) => {
                result
                    .errors
                    .push(format!("Failed to read {}: {}", file.display(), e));
                continue;
            }
        };

        let title = super::extract_title(&content, &filename);

        // Compute old path stem for wikilink replacement
        let vault_prefix = format!("{}/", vault.to_string_lossy());
        let old_path_stem = file
            .to_string_lossy()
            .strip_prefix(&vault_prefix)
            .unwrap_or(&file.to_string_lossy())
            .strip_suffix(".md")
            .unwrap_or(&file.to_string_lossy())
            .to_string();

        path_stem_to_title.push((old_path_stem, title));

        // Move file to vault root
        let new_path = unique_root_path(vault, &filename);
        match fs::rename(file, &new_path) {
            Ok(()) => result.moved += 1,
            Err(e) => {
                // Try copy+delete for cross-device moves
                match fs::read_to_string(file)
                    .and_then(|c| fs::write(&new_path, c))
                    .and_then(|()| fs::remove_file(file))
                {
                    Ok(()) => result.moved += 1,
                    Err(_) => {
                        result.errors.push(format!(
                            "Failed to move {} → {}: {}",
                            file.display(),
                            new_path.display(),
                            e
                        ));
                    }
                }
            }
        }
    }

    // Update wikilinks: replace path-based wikilinks [[folder/slug]] with [[Title]]
    if !path_stem_to_title.is_empty() {
        update_wikilinks_for_migration(vault, &path_stem_to_title);
    }

    // Clean up empty directories (except system folders)
    cleanup_empty_dirs(vault);

    Ok(result)
}

/// Update wikilinks across all vault .md files, replacing path-based references
/// with title-based ones.
fn update_wikilinks_for_migration(vault: &Path, replacements: &[(String, String)]) {
    let all_md: Vec<std::path::PathBuf> = WalkDir::new(vault)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_file() && e.path().extension().is_some_and(|ext| ext == "md"))
        .map(|e| e.path().to_path_buf())
        .collect();

    for file in &all_md {
        let Ok(mut content) = fs::read_to_string(file) else {
            continue;
        };
        let mut changed = false;
        for (old_stem, title) in replacements {
            // Replace [[old/path/stem]] with [[Title]]
            let old_link = format!("[[{}]]", old_stem);
            if content.contains(&old_link) {
                content = content.replace(&old_link, &format!("[[{}]]", title));
                changed = true;
            }
            // Replace [[old/path/stem|display]] with [[Title|display]]
            let old_prefix = format!("[[{}|", old_stem);
            if content.contains(&old_prefix) {
                content = content.replace(&old_prefix, &format!("[[{}|", title));
                changed = true;
            }
        }
        if changed {
            let _ = fs::write(file, &content);
        }
    }
}

/// Remove empty directories in the vault (excluding system folders).
fn cleanup_empty_dirs(vault: &Path) {
    let Ok(entries) = fs::read_dir(vault) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        if SYSTEM_FOLDERS.contains(&name.as_str()) {
            continue;
        }
        // Skip hidden directories (e.g., .git)
        if name.starts_with('.') {
            continue;
        }
        // Check if directory is empty
        let is_empty = fs::read_dir(&path)
            .map(|mut d| d.next().is_none())
            .unwrap_or(false);
        if is_empty {
            let _ = fs::remove_dir(&path);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    fn write_file(dir: &std::path::Path, name: &str, content: &str) -> std::path::PathBuf {
        let path = dir.join(name);
        fs::write(&path, content).unwrap();
        path
    }

    // --- has_legacy_is_a ---

    #[test]
    fn test_has_legacy_is_a_detects_is_a_colon() {
        assert!(has_legacy_is_a("is_a: Person\nname: Alice"));
    }

    #[test]
    fn test_has_legacy_is_a_detects_quoted_is_a() {
        assert!(has_legacy_is_a("\"Is A\": Note\nname: Test"));
    }

    #[test]
    fn test_has_legacy_is_a_detects_bare_is_a() {
        assert!(has_legacy_is_a("Is A: Topic\n"));
    }

    #[test]
    fn test_has_legacy_is_a_returns_false_for_clean_frontmatter() {
        assert!(!has_legacy_is_a("type: Person\nname: Alice"));
    }

    // --- extract_is_a_value ---

    #[test]
    fn test_extract_is_a_value_from_is_a_colon() {
        assert_eq!(extract_is_a_value("is_a: Person"), Some("Person"));
    }

    #[test]
    fn test_extract_is_a_value_from_quoted() {
        assert_eq!(extract_is_a_value("\"Is A\": Note"), Some("Note"));
    }

    #[test]
    fn test_extract_is_a_value_returns_none_for_unrelated_line() {
        assert_eq!(extract_is_a_value("name: Alice"), None);
    }

    // --- migrate_file_is_a_to_type ---

    #[test]
    fn test_migrate_file_adds_type_and_removes_is_a() {
        let tmp = tempdir().unwrap();
        let path = write_file(
            tmp.path(),
            "note.md",
            "---\nis_a: Person\nname: Alice\n---\n# Alice\n",
        );
        let result = migrate_file_is_a_to_type(&path).unwrap();
        assert!(result, "file should be migrated");
        let content = fs::read_to_string(&path).unwrap();
        assert!(content.contains("type: Person"), "should have type field");
        assert!(!content.contains("is_a:"), "should not have is_a field");
    }

    #[test]
    fn test_migrate_file_skips_when_no_frontmatter() {
        let tmp = tempdir().unwrap();
        let path = write_file(
            tmp.path(),
            "note.md",
            "# Just a heading\nNo frontmatter here.\n",
        );
        let result = migrate_file_is_a_to_type(&path).unwrap();
        assert!(!result, "file without frontmatter should not be migrated");
    }

    #[test]
    fn test_migrate_file_skips_when_already_has_type() {
        let tmp = tempdir().unwrap();
        let path = write_file(
            tmp.path(),
            "note.md",
            "---\ntype: Person\nname: Alice\n---\n# Alice\n",
        );
        let result = migrate_file_is_a_to_type(&path).unwrap();
        assert!(!result, "file already with type should not be migrated");
    }

    #[test]
    fn test_migrate_file_skips_when_no_is_a_field() {
        let tmp = tempdir().unwrap();
        let path = write_file(
            tmp.path(),
            "note.md",
            "---\nname: Alice\ndate: 2024-01-01\n---\n# Alice\n",
        );
        let result = migrate_file_is_a_to_type(&path).unwrap();
        assert!(!result);
    }

    // --- migrate_is_a_to_type (public function) ---

    #[test]
    fn test_migrate_vault_returns_count_of_migrated_files() {
        let tmp = tempdir().unwrap();
        write_file(
            tmp.path(),
            "note1.md",
            "---\nis_a: Person\nname: Alice\n---\n",
        );
        write_file(tmp.path(), "note2.md", "---\nis_a: Topic\nname: AI\n---\n");
        write_file(
            tmp.path(),
            "note3.md",
            "---\ntype: Event\nname: Conf\n---\n",
        );
        let count = migrate_is_a_to_type(tmp.path().to_str().unwrap()).unwrap();
        assert_eq!(count, 2, "should migrate exactly 2 files");
    }

    #[test]
    fn test_migrate_vault_returns_error_for_nonexistent_path() {
        let result = migrate_is_a_to_type("/tmp/this-path-does-not-exist-laputa-test");
        assert!(result.is_err());
    }

    #[test]
    fn test_migrate_vault_ignores_non_markdown_files() {
        let tmp = tempdir().unwrap();
        write_file(tmp.path(), "image.png", "not a markdown file");
        write_file(tmp.path(), "data.json", "{\"is_a\": \"test\"}");
        let count = migrate_is_a_to_type(tmp.path().to_str().unwrap()).unwrap();
        assert_eq!(count, 0, "non-markdown files should be ignored");
    }

    // --- migrate_to_flat_vault tests ---

    fn write_sub_file(dir: &Path, subdir: &str, name: &str, content: &str) -> std::path::PathBuf {
        let sub = dir.join(subdir);
        fs::create_dir_all(&sub).unwrap();
        let path = sub.join(name);
        fs::write(&path, content).unwrap();
        path
    }

    #[test]
    fn test_flat_migration_moves_files_to_root() {
        let tmp = tempdir().unwrap();
        let vault = tmp.path();
        write_sub_file(vault, "note", "my-note.md", "# My Note\n\nContent.\n");
        write_sub_file(
            vault,
            "project",
            "alpha.md",
            "---\ntype: Project\n---\n# Alpha\n",
        );

        let result = migrate_to_flat_vault(vault.to_str().unwrap()).unwrap();
        assert_eq!(result.moved, 2);
        assert!(vault.join("my-note.md").exists());
        assert!(vault.join("alpha.md").exists());
        assert!(!vault.join("note/my-note.md").exists());
        assert!(!vault.join("project/alpha.md").exists());
    }

    #[test]
    fn test_flat_migration_skips_system_folders() {
        let tmp = tempdir().unwrap();
        let vault = tmp.path();
        write_sub_file(vault, "type", "project.md", "---\ntype: Type\n---\n# Project\n");
        write_sub_file(vault, "config", "agents.md", "# Agents\n");
        write_sub_file(vault, "note", "test.md", "# Test\n");

        let result = migrate_to_flat_vault(vault.to_str().unwrap()).unwrap();
        assert_eq!(result.moved, 1);
        // System files should stay
        assert!(vault.join("type/project.md").exists());
        assert!(vault.join("config/agents.md").exists());
        // Regular file should be moved
        assert!(vault.join("test.md").exists());
    }

    #[test]
    fn test_flat_migration_skips_root_files() {
        let tmp = tempdir().unwrap();
        let vault = tmp.path();
        write_file(vault, "already-at-root.md", "# Already Root\n");
        write_sub_file(vault, "note", "in-sub.md", "# In Sub\n");

        let result = migrate_to_flat_vault(vault.to_str().unwrap()).unwrap();
        assert_eq!(result.moved, 1);
        assert!(vault.join("already-at-root.md").exists());
        assert!(vault.join("in-sub.md").exists());
    }

    #[test]
    fn test_flat_migration_handles_filename_collision() {
        let tmp = tempdir().unwrap();
        let vault = tmp.path();
        write_file(vault, "test.md", "# Root Test\n");
        write_sub_file(vault, "note", "test.md", "# Note Test\n");

        let result = migrate_to_flat_vault(vault.to_str().unwrap()).unwrap();
        assert_eq!(result.moved, 1);
        assert!(vault.join("test.md").exists());
        assert!(vault.join("test-2.md").exists());
    }

    #[test]
    fn test_flat_migration_updates_path_wikilinks() {
        let tmp = tempdir().unwrap();
        let vault = tmp.path();
        write_sub_file(
            vault,
            "person",
            "alice.md",
            "---\ntype: Person\n---\n# Alice\n",
        );
        write_file(
            vault,
            "root-note.md",
            "# Root\n\nSee [[person/alice]] for details.\n",
        );

        let result = migrate_to_flat_vault(vault.to_str().unwrap()).unwrap();
        assert_eq!(result.moved, 1);

        let content = fs::read_to_string(vault.join("root-note.md")).unwrap();
        assert!(
            content.contains("[[Alice]]"),
            "should update path-based wikilink to title: {}",
            content
        );
        assert!(!content.contains("[[person/alice]]"));
    }

    #[test]
    fn test_flat_migration_cleans_up_empty_dirs() {
        let tmp = tempdir().unwrap();
        let vault = tmp.path();
        write_sub_file(vault, "note", "test.md", "# Test\n");

        let _ = migrate_to_flat_vault(vault.to_str().unwrap()).unwrap();
        assert!(!vault.join("note").exists(), "empty note/ dir should be removed");
    }

    #[test]
    fn test_flat_migration_preserves_nonempty_dirs() {
        let tmp = tempdir().unwrap();
        let vault = tmp.path();
        write_sub_file(vault, "custom", "note.md", "# Note\n");
        // Add a non-md file so dir isn't empty after migration
        write_sub_file(vault, "custom", "image.png", "binary data");

        let _ = migrate_to_flat_vault(vault.to_str().unwrap()).unwrap();
        assert!(
            vault.join("custom").exists(),
            "non-empty dir should be preserved"
        );
    }

    #[test]
    fn test_flat_migration_nonexistent_vault() {
        let result = migrate_to_flat_vault("/tmp/nonexistent-vault-flat-test");
        assert!(result.is_err());
    }
}
