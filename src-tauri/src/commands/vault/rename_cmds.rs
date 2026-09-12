use crate::vault::{self, RenameResult};
use serde::Deserialize;
use std::path::Path;

use super::boundary::{
    with_existing_path_in_requested_vault, with_validated_path, ValidatedPathMode,
};

struct RequestedNotePath<'a> {
    vault_path: &'a str,
    note_path: &'a str,
}

struct ValidatedNotePath<'a> {
    vault_path: &'a str,
    note_path: &'a str,
}

impl<'a> RequestedNotePath<'a> {
    fn new(vault_path: &'a str, note_path: &'a str) -> Self {
        Self {
            vault_path,
            note_path,
        }
    }
}

fn with_note_path_in_vault<T>(
    request: RequestedNotePath<'_>,
    action: impl FnOnce(ValidatedNotePath<'_>) -> Result<T, String>,
) -> Result<T, String> {
    with_existing_path_in_requested_vault(
        request.vault_path,
        request.note_path,
        |requested_root, validated_path| {
            action(ValidatedNotePath {
                vault_path: requested_root,
                note_path: validated_path,
            })
        },
    )
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameNoteFilenameCommandArgs {
    vault_path: String,
    old_path: String,
    new_filename_stem: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameVaultFileCommandArgs {
    vault_path: String,
    old_path: String,
    new_stem: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveNoteToFolderCommandArgs {
    vault_path: String,
    old_path: String,
    folder_path: String,
}

#[tauri::command]
pub fn rename_note_filename(args: RenameNoteFilenameCommandArgs) -> Result<RenameResult, String> {
    let request = RequestedNotePath::new(&args.vault_path, &args.old_path);
    with_note_path_in_vault(request, |note| {
        vault::rename_note_filename(vault::RenameNoteFilenameRequest {
            vault_path: note.vault_path,
            old_path: note.note_path,
            new_filename_stem: &args.new_filename_stem,
        })
    })
}

/// The Explorer's Rename…: a Document or an Image file keeps its folder and
/// its extension, and only the stem changes.
#[tauri::command]
pub fn rename_vault_file(args: RenameVaultFileCommandArgs) -> Result<RenameResult, String> {
    let request = RequestedNotePath::new(&args.vault_path, &args.old_path);
    with_note_path_in_vault(request, |file| {
        vault::rename_vault_file(vault::RenameVaultFileRequest {
            old_path: file.note_path,
            new_stem: &args.new_stem,
        })
    })
}

fn run_folder_move(args: MoveNoteToFolderCommandArgs) -> Result<RenameResult, String> {
    let request = RequestedNotePath::new(&args.vault_path, &args.old_path);
    with_note_path_in_vault(request, |note| {
        let trimmed_folder_path = args.folder_path.trim();
        let folder_absolute_path = Path::new(note.vault_path).join(trimmed_folder_path);
        with_validated_path(
            folder_absolute_path.to_string_lossy().as_ref(),
            Some(args.vault_path.as_str()),
            ValidatedPathMode::Existing,
            |validated_folder_path| {
                let validated_folder = Path::new(validated_folder_path);
                if !validated_folder.is_dir() {
                    return Err(format!("Folder does not exist: {}", trimmed_folder_path));
                }
                vault::move_note_to_folder(vault::MoveNoteToFolderRequest {
                    vault_path: note.vault_path,
                    old_path: note.note_path,
                    destination_folder_path: validated_folder_path,
                })
            },
        )
    })
}

#[tauri::command]
pub fn move_note_to_folder(args: MoveNoteToFolderCommandArgs) -> Result<RenameResult, String> {
    run_folder_move(args)
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
    fn filename_and_folder_commands_preserve_note_content() {
        let dir = TempDir::new().unwrap();
        let vault = vault_path(&dir);
        let old_path = write_note(
            &dir,
            "draft.md",
            "---\ntitle: Draft Title\n---\n# Draft Title\n",
        );

        let renamed = rename_note_filename(RenameNoteFilenameCommandArgs {
            vault_path: vault.clone(),
            old_path,
            new_filename_stem: "custom-name".to_string(),
        })
        .unwrap();
        assert!(renamed.new_path.ends_with("custom-name.md"));

        fs::create_dir(dir.path().join("Projects")).unwrap();
        let moved = move_note_to_folder(MoveNoteToFolderCommandArgs {
            vault_path: vault.clone(),
            old_path: renamed.new_path.clone(),
            folder_path: "Projects".to_string(),
        })
        .unwrap();

        assert!(moved.new_path.ends_with("Projects/custom-name.md"));
        assert!(fs::read_to_string(moved.new_path)
            .unwrap()
            .contains("Draft Title"));
    }

    #[test]
    fn rename_vault_file_renames_an_image_inside_the_vault() {
        let dir = TempDir::new().unwrap();
        let vault = vault_path(&dir);
        let old_path = write_note(&dir, "Attachments/lake.png", "PNG");

        let renamed = rename_vault_file(RenameVaultFileCommandArgs {
            vault_path: vault,
            old_path,
            new_stem: "Lake".to_string(),
        })
        .unwrap();

        assert!(renamed.new_path.ends_with("Attachments/Lake.png"));
    }

    #[test]
    fn rename_vault_file_rejects_files_outside_the_vault() {
        let dir = TempDir::new().unwrap();
        let outside = TempDir::new().unwrap();
        let outside_file = write_note(&outside, "outside.png", "PNG");

        let error = rename_vault_file(RenameVaultFileCommandArgs {
            vault_path: vault_path(&dir),
            old_path: outside_file,
            new_stem: "renamed".to_string(),
        })
        .unwrap_err();

        assert_eq!(error, "Path must stay inside the active vault");
    }

    #[test]
    fn rename_commands_reject_notes_outside_the_vault() {
        let dir = TempDir::new().unwrap();
        let outside = TempDir::new().unwrap();
        let outside_note = write_note(&outside, "outside.md", "# Outside\n");

        let error = rename_note_filename(RenameNoteFilenameCommandArgs {
            vault_path: vault_path(&dir),
            old_path: outside_note,
            new_filename_stem: "renamed".to_string(),
        })
        .unwrap_err();

        assert_eq!(error, "Path must stay inside the active vault");
    }

    #[test]
    fn move_note_to_folder_rejects_destination_outside_the_vault() {
        let dir = TempDir::new().unwrap();
        let outside = TempDir::new().unwrap();
        let note = write_note(&dir, "note.md", "# Note\n");
        let sibling = outside.path().file_name().unwrap().to_string_lossy();

        let error = move_note_to_folder(MoveNoteToFolderCommandArgs {
            vault_path: vault_path(&dir),
            old_path: note,
            folder_path: format!("../{sibling}"),
        })
        .unwrap_err();

        assert_eq!(error, "Path must stay inside the active vault");
    }

    #[test]
    fn move_note_to_folder_accepts_empty_folder_as_vault_root() {
        let dir = TempDir::new().unwrap();
        let vault = vault_path(&dir);
        let note = write_note(&dir, "projects/note.md", "# Note\n");

        let result = move_note_to_folder(MoveNoteToFolderCommandArgs {
            vault_path: vault,
            old_path: note,
            folder_path: "  ".to_string(),
        })
        .unwrap();

        assert!(result.new_path.ends_with("note.md"));
        assert!(dir.path().join("note.md").exists());
        assert!(!dir.path().join("projects/note.md").exists());
    }
}
