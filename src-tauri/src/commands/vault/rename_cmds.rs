use crate::commands::expand_tilde;
use crate::vault::{self, DetectedRename, RenameResult};
use std::path::Path;

use super::boundary::{
    with_existing_path_in_requested_vault, with_validated_path, ValidatedPathMode,
};

#[tauri::command]
pub fn rename_note(
    vault_path: String,
    old_path: String,
    new_title: String,
    old_title: Option<String>,
) -> Result<RenameResult, String> {
    with_existing_path_in_requested_vault(
        &vault_path,
        &old_path,
        |requested_root, validated_path| {
            vault::rename_note(vault::RenameNoteRequest {
                vault_path: requested_root,
                old_path: validated_path,
                new_title: &new_title,
                old_title_hint: old_title.as_deref(),
            })
        },
    )
}

#[tauri::command]
pub fn rename_note_filename(
    vault_path: String,
    old_path: String,
    new_filename_stem: String,
) -> Result<RenameResult, String> {
    with_existing_path_in_requested_vault(
        &vault_path,
        &old_path,
        |requested_root, validated_path| {
            vault::rename_note_filename(vault::RenameNoteFilenameRequest {
                vault_path: requested_root,
                old_path: validated_path,
                new_filename_stem: &new_filename_stem,
            })
        },
    )
}

#[tauri::command]
pub fn move_note_to_folder(
    vault_path: String,
    old_path: String,
    folder_path: String,
) -> Result<RenameResult, String> {
    with_existing_path_in_requested_vault(
        &vault_path,
        &old_path,
        |requested_root, validated_path| {
            let trimmed_folder_path = folder_path.trim();
            if trimmed_folder_path.is_empty() {
                return Err("Folder path cannot be empty".to_string());
            }

            let folder_absolute_path = Path::new(requested_root).join(trimmed_folder_path);
            with_validated_path(
                folder_absolute_path.to_string_lossy().as_ref(),
                Some(&vault_path),
                ValidatedPathMode::Existing,
                |validated_folder_path| {
                    let validated_folder = Path::new(validated_folder_path);
                    if !validated_folder.is_dir() {
                        return Err(format!("Folder does not exist: {}", trimmed_folder_path));
                    }
                    vault::move_note_to_folder(vault::MoveNoteToFolderRequest {
                        vault_path: requested_root,
                        old_path: validated_path,
                        destination_folder_path: validated_folder_path,
                    })
                },
            )
        },
    )
}

#[tauri::command]
pub fn auto_rename_untitled(
    vault_path: String,
    note_path: String,
) -> Result<Option<RenameResult>, String> {
    with_existing_path_in_requested_vault(
        &vault_path,
        &note_path,
        |requested_root, validated_path| {
            vault::auto_rename_untitled(vault::AutoRenameUntitledRequest {
                vault_path: requested_root,
                note_path: validated_path,
            })
        },
    )
}

#[tauri::command]
pub fn detect_renames(vault_path: String) -> Result<Vec<DetectedRename>, String> {
    let vault_path = expand_tilde(&vault_path);
    vault::detect_renames(Path::new(vault_path.as_ref()))
}

#[tauri::command]
pub fn update_wikilinks_for_renames(
    vault_path: String,
    renames: Vec<DetectedRename>,
) -> Result<usize, String> {
    let vault_path = expand_tilde(&vault_path);
    vault::update_wikilinks_for_renames(Path::new(vault_path.as_ref()), &renames)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn vault_path(dir: &TempDir) -> String {
        dir.path().to_string_lossy().into_owned()
    }

    fn write_note(dir: &TempDir, relative_path: &str, content: &str) -> String {
        let path = dir.path().join(relative_path);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(&path, content).unwrap();
        path.to_string_lossy().into_owned()
    }

    #[test]
    fn rename_note_command_updates_title_file_and_links() {
        let dir = TempDir::new().unwrap();
        let vault = vault_path(&dir);
        let old_path = write_note(
            &dir,
            "old-title.md",
            "---\ntitle: Old Title\n---\n# Old Title\n",
        );
        let linked_path = write_note(&dir, "linked.md", "See [[Old Title]].\n");

        let result = rename_note(
            vault.clone(),
            old_path.clone(),
            "New Title".to_string(),
            None,
        )
        .unwrap();

        assert!(result.new_path.ends_with("new-title.md"));
        assert!(!Path::new(&old_path).exists());
        assert!(Path::new(&result.new_path).exists());
        assert!(fs::read_to_string(linked_path)
            .unwrap()
            .contains("[[new-title]]"));
        assert_eq!(result.failed_updates, 0);
    }

    #[test]
    fn filename_and_folder_commands_preserve_note_content() {
        let dir = TempDir::new().unwrap();
        let vault = vault_path(&dir);
        let old_path = write_note(
            &dir,
            "draft.md",
            "---\ntitle: Draft Title\n---\n# Draft Title\n",
        );

        let renamed =
            rename_note_filename(vault.clone(), old_path, "custom-name".to_string()).unwrap();
        assert!(renamed.new_path.ends_with("custom-name.md"));

        fs::create_dir(dir.path().join("Projects")).unwrap();
        let moved = move_note_to_folder(
            vault.clone(),
            renamed.new_path.clone(),
            "Projects".to_string(),
        )
        .unwrap();

        assert!(moved.new_path.ends_with("Projects/custom-name.md"));
        assert!(fs::read_to_string(moved.new_path)
            .unwrap()
            .contains("Draft Title"));
    }

    #[test]
    fn auto_rename_and_detected_rename_commands_route_through_vault() {
        let dir = TempDir::new().unwrap();
        let vault = vault_path(&dir);
        let untitled = write_note(&dir, "untitled-note-123.md", "# Project Plan\n");

        let auto = auto_rename_untitled(vault.clone(), untitled)
            .unwrap()
            .unwrap();
        assert!(auto.new_path.ends_with("project-plan.md"));

        crate::git::init_repo(&vault).unwrap();
        let old_path = dir.path().join("project-plan.md");
        let new_path = dir.path().join("plans.md");
        fs::rename(&old_path, &new_path).unwrap();
        crate::hidden_command("git")
            .args(["add", "-A"])
            .current_dir(dir.path())
            .output()
            .unwrap();

        let renames = detect_renames(vault.clone()).unwrap();
        assert_eq!(renames.len(), 1);
        assert_eq!(renames[0].old_path, "project-plan.md");
        assert_eq!(renames[0].new_path, "plans.md");

        assert_eq!(update_wikilinks_for_renames(vault, renames).unwrap(), 0);
    }

    #[test]
    fn move_note_to_folder_rejects_empty_folder() {
        let dir = TempDir::new().unwrap();
        let vault = vault_path(&dir);
        let note = write_note(&dir, "note.md", "# Note\n");

        let error = move_note_to_folder(vault, note, "  ".to_string()).unwrap_err();
        assert!(error.contains("Folder path cannot be empty"));
    }
}
