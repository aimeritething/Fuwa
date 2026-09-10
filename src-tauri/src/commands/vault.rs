mod boundary;
mod file_cmds;
mod rename_cmds;

pub use file_cmds::*;
pub use rename_cmds::*;

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    const ACTIVE_VAULT_PATH_ERROR: &str = super::boundary::ACTIVE_VAULT_PATH_ERROR;

    fn vault_path_arg(vault_path: &Path) -> Option<std::path::PathBuf> {
        Some(vault_path.to_path_buf())
    }

    fn assert_note_write_rejects_escape<T: std::fmt::Debug>(
        action: impl FnOnce(std::path::PathBuf, String, Option<std::path::PathBuf>) -> Result<T, String>,
    ) {
        let dir = tempfile::TempDir::new().unwrap();
        let vault_path = dir.path();
        let escape_path = vault_path.join("../outside.md");

        let err = action(
            escape_path,
            "# Outside\n".to_string(),
            vault_path_arg(vault_path),
        )
        .expect_err("expected traversal write to be rejected");

        assert_eq!(err, ACTIVE_VAULT_PATH_ERROR);
    }

    #[test]
    fn test_get_note_content_rejects_path_outside_active_vault() {
        let dir = tempfile::TempDir::new().unwrap();
        let vault_path = dir.path();
        let inside = vault_path.join("inside.md");
        let outside_dir = tempfile::TempDir::new().unwrap();
        let outside = outside_dir.path().join("outside.md");

        std::fs::write(&inside, "# Inside\n").unwrap();
        std::fs::write(&outside, "# Outside\n").unwrap();

        let err = get_note_content(outside, vault_path_arg(vault_path))
            .expect_err("expected out-of-vault read to be rejected");

        assert_eq!(err, ACTIVE_VAULT_PATH_ERROR);
    }

    #[tokio::test]
    async fn test_save_note_content_rejects_traversal_outside_active_vault() {
        let dir = tempfile::TempDir::new().unwrap();
        let vault_path = dir.path();
        let escape_path = vault_path.join("../outside.md");

        let err = save_note_content(
            escape_path,
            "# Outside\n".to_string(),
            vault_path_arg(vault_path),
        )
        .await
        .expect_err("expected traversal write to be rejected");

        assert_eq!(err, ACTIVE_VAULT_PATH_ERROR);
    }

    #[test]
    fn test_create_note_content_rejects_traversal_outside_active_vault() {
        assert_note_write_rejects_escape(create_note_content);
    }

    #[test]
    fn test_create_vault_folder_rejects_escape_path() {
        let dir = tempfile::TempDir::new().unwrap();

        let err = create_vault_folder(dir.path().into(), "../escape".into(), None)
            .expect_err("expected escaping folder path to be rejected");

        assert_eq!(err, ACTIVE_VAULT_PATH_ERROR);
    }

    #[test]
    fn test_create_vault_folder_rejects_windows_invalid_names() {
        let dir = tempfile::TempDir::new().unwrap();

        let err = create_vault_folder(dir.path().into(), "con".into(), None)
            .expect_err("expected Windows-invalid folder name to be rejected");

        assert_eq!(err, "Invalid folder name");
    }

    #[test]
    fn test_create_vault_folder_nests_inside_parent_path() {
        let dir = tempfile::TempDir::new().unwrap();
        std::fs::create_dir_all(dir.path().join("Projects")).unwrap();

        let name = create_vault_folder(
            dir.path().into(),
            "Laputa".into(),
            Some(std::path::PathBuf::from("Projects")),
        )
        .expect("expected nested folder to be created");

        assert_eq!(name, "Laputa");
        assert!(dir.path().join("Projects").join("Laputa").is_dir());
    }

    #[test]
    fn test_create_vault_folder_rejects_escape_via_parent_path() {
        let dir = tempfile::TempDir::new().unwrap();

        let err = create_vault_folder(
            dir.path().into(),
            "Laputa".into(),
            Some(std::path::PathBuf::from("../escape")),
        )
        .expect_err("expected escaping parent path to be rejected");

        assert_eq!(err, ACTIVE_VAULT_PATH_ERROR);
    }

    #[test]
    fn test_create_vault_folder_treats_empty_parent_as_root() {
        let dir = tempfile::TempDir::new().unwrap();

        let name = create_vault_folder(
            dir.path().into(),
            "Inbox".into(),
            Some(std::path::PathBuf::from("")),
        )
        .expect("expected empty parent to fall back to vault root");

        assert_eq!(name, "Inbox");
        assert!(dir.path().join("Inbox").is_dir());
    }
}
