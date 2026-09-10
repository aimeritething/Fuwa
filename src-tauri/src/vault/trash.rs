use std::path::Path;

/// Move `path` (a file or a whole folder) to the user's Trash.
///
/// Fuwa never destroys a user's file: every delete in the app is a move to the
/// macOS Trash, where Tolaria removed the file permanently (its ADR-0045). On
/// macOS the `NSFileManager` route is used instead of the crate's default
/// Finder AppleScript route, so deleting never triggers a "wants to control
/// Finder" automation prompt.
pub(super) fn move_to_trash(path: &Path) -> Result<(), String> {
    trash_context()
        .delete(path)
        .map_err(|error| format!("Failed to move {} to the Trash: {}", path.display(), error))
}

#[cfg(target_os = "macos")]
fn trash_context() -> trash::TrashContext {
    use trash::macos::{DeleteMethod, TrashContextExtMacos};

    let mut context = trash::TrashContext::new();
    context.set_delete_method(DeleteMethod::NsFileManager);
    context
}

#[cfg(not(target_os = "macos"))]
fn trash_context() -> trash::TrashContext {
    trash::TrashContext::new()
}

/// Move a single note file to the Trash.
/// Returns the deleted path on success, or an error if the file doesn't exist.
pub fn delete_note(path: &str) -> Result<String, String> {
    let file = Path::new(path);
    if !file.exists() {
        return Err(format!("File does not exist: {}", path));
    }
    if !file.is_file() {
        return Err(format!("Path is not a file: {}", path));
    }
    move_to_trash(file)?;
    log::info!("Moved note to the Trash: {}", path);
    Ok(path.to_string())
}

/// Move multiple note files to the Trash.
/// Returns the list of successfully deleted paths.
/// Skips files that don't exist or fail to delete (logs warnings).
pub fn batch_delete_notes(paths: &[String]) -> Result<Vec<String>, String> {
    let mut deleted = Vec::new();
    for path in paths {
        let file = Path::new(path.as_str());
        if !file.exists() {
            log::warn!("File does not exist, skipping: {}", path);
            continue;
        }
        match move_to_trash(file) {
            Ok(()) => {
                log::info!("Moved note to the Trash: {}", path);
                deleted.push(path.clone());
            }
            Err(e) => {
                log::warn!("{}", e);
            }
        }
    }
    Ok(deleted)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
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
}
