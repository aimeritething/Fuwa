mod ai;
mod git;
mod system;
mod vault;

use std::borrow::Cow;

pub use ai::*;
pub use git::*;
pub use system::*;
pub use vault::*;

/// Expand a leading `~` or `~/` in a path string to the user's home directory.
/// Returns the original string unchanged if it doesn't start with `~` or if the
/// home directory cannot be determined.
pub fn expand_tilde(path: &str) -> Cow<'_, str> {
    if path == "~" {
        if let Some(home) = dirs::home_dir() {
            return Cow::Owned(home.to_string_lossy().into_owned());
        }
    } else if let Some(rest) = path.strip_prefix("~/") {
        if let Some(home) = dirs::home_dir() {
            return Cow::Owned(format!("{}/{}", home.to_string_lossy(), rest));
        }
    }
    Cow::Borrowed(path)
}

pub fn parse_build_label(version: &str) -> String {
    let parts: Vec<&str> = version.split('.').collect();
    match parts.as_slice() {
        [_, minor, patch] if minor.len() >= 6 => format!("b{}", patch),
        [_, _, _] => "dev".to_string(),
        _ => "b?".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn expand_tilde_with_subpath() {
        let home = dirs::home_dir().unwrap();
        let result = expand_tilde("~/Documents/vault");
        assert_eq!(result, format!("{}/Documents/vault", home.display()));
    }

    #[test]
    fn expand_tilde_alone() {
        let home = dirs::home_dir().unwrap();
        let result = expand_tilde("~");
        assert_eq!(result, home.to_string_lossy());
    }

    #[test]
    fn expand_tilde_noop_for_absolute_path() {
        let result = expand_tilde("/usr/local/bin");
        assert_eq!(result, "/usr/local/bin");
    }

    #[test]
    fn expand_tilde_noop_for_relative_path() {
        let result = expand_tilde("some/relative/path");
        assert_eq!(result, "some/relative/path");
    }

    #[test]
    fn expand_tilde_noop_for_tilde_in_middle() {
        let result = expand_tilde("/home/~user/path");
        assert_eq!(result, "/home/~user/path");
    }

    #[test]
    fn parse_build_label_release_version() {
        assert_eq!(parse_build_label("0.20260303.281"), "b281");
        assert_eq!(parse_build_label("0.20251215.42"), "b42");
    }

    #[test]
    fn parse_build_label_dev_version() {
        assert_eq!(parse_build_label("0.1.0"), "dev");
        assert_eq!(parse_build_label("0.0.0"), "dev");
    }

    #[test]
    fn parse_build_label_malformed() {
        assert_eq!(parse_build_label("invalid"), "b?");
        assert_eq!(parse_build_label(""), "b?");
    }

    #[test]
    fn test_batch_archive_notes() {
        let dir = tempfile::TempDir::new().unwrap();
        let note = dir.path().join("note.md");
        std::fs::write(&note, "---\nStatus: Active\n---\n# Note\n").unwrap();

        let result = batch_archive_notes(vec![note.to_str().unwrap().to_string()]);
        assert_eq!(result.unwrap(), 1);

        let content = std::fs::read_to_string(&note).unwrap();
        assert!(content.contains("Archived: true"));
        assert!(content.contains("Status: Active"));
    }

    #[test]
    fn test_batch_trash_notes() {
        let dir = tempfile::TempDir::new().unwrap();
        let note = dir.path().join("note.md");
        std::fs::write(&note, "---\nStatus: Active\n---\n# Note\n").unwrap();

        let result = batch_trash_notes(vec![note.to_str().unwrap().to_string()]);
        assert_eq!(result.unwrap(), 1);

        let content = std::fs::read_to_string(&note).unwrap();
        assert!(content.contains("Trashed: true"));
        assert!(content.contains("Trashed at"));
    }

    #[test]
    fn test_reload_vault_entry_reads_from_disk() {
        let dir = tempfile::TempDir::new().unwrap();
        let note = dir.path().join("test.md");
        std::fs::write(&note, "---\ntitle: Test\nStatus: Active\n---\n# Test\n").unwrap();

        let entry = reload_vault_entry(note.to_str().unwrap().to_string()).unwrap();
        assert_eq!(entry.title, "Test");
        assert_eq!(entry.status, Some("Active".to_string()));

        // Modify file on disk
        std::fs::write(&note, "---\ntitle: Test\nStatus: Done\n---\n# Test\n").unwrap();
        let fresh = reload_vault_entry(note.to_str().unwrap().to_string()).unwrap();
        assert_eq!(fresh.status, Some("Done".to_string()));
    }

    #[test]
    fn test_reload_vault_entry_nonexistent() {
        let result = reload_vault_entry("/nonexistent/path.md".to_string());
        assert!(result.is_err());
    }

    #[test]
    fn test_reload_vault_invalidates_cache_and_rescans() {
        let dir = tempfile::TempDir::new().unwrap();
        let vault_path = dir.path();
        // Init git repo for caching to work
        std::process::Command::new("git")
            .args(["init"])
            .current_dir(vault_path)
            .output()
            .unwrap();
        std::process::Command::new("git")
            .args(["config", "user.email", "t@t.com"])
            .current_dir(vault_path)
            .output()
            .unwrap();
        std::process::Command::new("git")
            .args(["config", "user.name", "T"])
            .current_dir(vault_path)
            .output()
            .unwrap();

        // Set test cache dir to avoid polluting real cache
        let cache_dir = tempfile::TempDir::new().unwrap();
        std::env::set_var(
            "LAPUTA_CACHE_DIR",
            cache_dir.path().to_string_lossy().as_ref(),
        );

        std::fs::write(
            vault_path.join("note.md"),
            "---\nTrashed: false\n---\n# Note\n",
        )
        .unwrap();
        std::process::Command::new("git")
            .args(["add", "."])
            .current_dir(vault_path)
            .output()
            .unwrap();
        std::process::Command::new("git")
            .args(["commit", "-m", "init"])
            .current_dir(vault_path)
            .output()
            .unwrap();

        // Prime cache via list_vault
        let entries = list_vault(vault_path.to_str().unwrap().to_string()).unwrap();
        assert!(!entries[0].trashed);

        // Trash the note on disk
        std::fs::write(
            vault_path.join("note.md"),
            "---\nTrashed: true\n---\n# Note\n",
        )
        .unwrap();

        // reload_vault must return the updated trashed state
        let vp_str = vault_path.to_str().unwrap();
        crate::vault::invalidate_cache(std::path::Path::new(vp_str));
        let fresh = crate::vault::scan_vault_cached(std::path::Path::new(vp_str)).unwrap();
        assert!(
            fresh[0].trashed,
            "reload_vault must reflect disk state after trashing"
        );
    }

    #[test]
    fn test_check_vault_exists_false() {
        assert!(!check_vault_exists("/nonexistent/path/abc123".to_string()));
    }

    #[test]
    fn test_get_default_vault_path_returns_ok() {
        let result = get_default_vault_path();
        assert!(result.is_ok());
    }

    #[test]
    fn test_repair_vault_flattens_type_folders() {
        let dir = tempfile::TempDir::new().unwrap();
        let vault_path = dir.path();
        let note_dir = vault_path.join("note");
        std::fs::create_dir_all(&note_dir).unwrap();
        std::fs::write(
            note_dir.join("hello.md"),
            "---\nis_a: Note\n---\n# Hello\n",
        )
        .unwrap();

        let result = repair_vault(vault_path.to_str().unwrap().to_string());
        assert!(result.is_ok());
        // Note moved from note/ subfolder to root
        assert!(vault_path.join("hello.md").exists());
        assert!(!note_dir.join("hello.md").exists());
        // Legacy is_a migrated to type
        let content = std::fs::read_to_string(vault_path.join("hello.md")).unwrap();
        assert!(content.contains("type: Note"));
        assert!(!content.contains("is_a:"));
    }

    #[test]
    fn test_repair_vault_creates_config_files() {
        let dir = tempfile::TempDir::new().unwrap();
        let vault_path = dir.path();

        let result = repair_vault(vault_path.to_str().unwrap().to_string());
        assert!(result.is_ok());
        // Config files at root
        assert!(vault_path.join("AGENTS.md").exists());
        assert!(vault_path.join("config.md").exists());
        // .gitignore
        assert!(vault_path.join(".gitignore").exists());
    }
}
