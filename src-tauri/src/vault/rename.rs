use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

use super::filename_rules::validate_filename_stem;

/// Result of a rename operation
#[derive(Debug, Serialize, Deserialize)]
pub struct RenameResult {
    /// New absolute file path after rename
    pub new_path: String,
    /// Number of other files updated. Fuwa never rewrites links in other
    /// notes, so this is always 0; the field is kept for the frontend type.
    pub updated_files: usize,
    /// Number of linked-note rewrites that failed. Always 0 (see `updated_files`).
    pub failed_updates: usize,
}

#[derive(Clone, Copy)]
pub struct RenameNoteFilenameRequest<'a> {
    pub vault_path: &'a str,
    pub old_path: &'a str,
    pub new_filename_stem: &'a str,
}

#[derive(Clone, Copy)]
pub struct RenameVaultFileRequest<'a> {
    pub old_path: &'a str,
    pub new_stem: &'a str,
}

#[derive(Clone, Copy)]
pub struct MoveNoteToFolderRequest<'a> {
    pub vault_path: &'a str,
    pub old_path: &'a str,
    pub destination_folder_path: &'a str,
}

fn finalize_rename(new_file: &Path) -> RenameResult {
    RenameResult {
        new_path: new_file.to_string_lossy().to_string(),
        updated_files: 0,
        failed_updates: 0,
    }
}

fn normalize_filename_stem(new_filename_stem: &str) -> Result<String, String> {
    let trimmed = new_filename_stem.trim();
    let stem = trimmed.strip_suffix(".md").unwrap_or(trimmed).trim();
    if stem.is_empty() {
        return Err("New filename cannot be empty".to_string());
    }
    validate_filename_stem(stem)?;
    Ok(stem.to_string())
}

fn unchanged_result(path: &Path) -> RenameResult {
    RenameResult {
        new_path: path.to_string_lossy().to_string(),
        updated_files: 0,
        failed_updates: 0,
    }
}

fn ensure_existing_note(old_file: &Path) -> Result<(), String> {
    if old_file.exists() {
        return Ok(());
    }
    Err(format!("File does not exist: {}", old_file.display()))
}

fn file_name_string(file: &Path) -> String {
    file.file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_default()
}

/// Whether two paths name the same file on disk. Lets a case-only rename on a
/// case-insensitive filesystem (`note.md` → `Note.md`) through the
/// "destination already exists" check.
#[cfg(unix)]
fn is_same_file(a: &Path, b: &Path) -> bool {
    use std::os::unix::fs::MetadataExt;

    match (fs::metadata(a), fs::metadata(b)) {
        (Ok(a), Ok(b)) => a.dev() == b.dev() && a.ino() == b.ino(),
        _ => false,
    }
}

#[cfg(not(unix))]
fn is_same_file(_a: &Path, _b: &Path) -> bool {
    false
}

/// A rename or move is one `fs::rename`; the destination must not already
/// hold a different file (`fs::rename` would silently replace it).
fn rename_note_file(old_path: &str, old_file: &Path, new_file: &Path) -> Result<(), String> {
    if new_file.exists() && !is_same_file(old_file, new_file) {
        return Err("A note with that name already exists".to_string());
    }
    fs::rename(old_file, new_file).map_err(|e| {
        format!(
            "Failed to rename {} to {}: {}",
            old_path,
            new_file.to_string_lossy(),
            e
        )
    })
}

/// Rename a note's file in place, keeping its folder and content.
pub fn rename_note_filename(
    request: RenameNoteFilenameRequest<'_>,
) -> Result<RenameResult, String> {
    let old_file = Path::new(request.old_path);
    ensure_existing_note(old_file)?;

    let normalized_stem = normalize_filename_stem(request.new_filename_stem)?;
    let old_filename = file_name_string(old_file);
    let new_filename = format!("{}.md", normalized_stem);

    if old_filename == new_filename {
        return Ok(unchanged_result(old_file));
    }

    let parent_dir = old_file
        .parent()
        .ok_or("Cannot determine parent directory")?;
    let new_file = parent_dir.join(&new_filename);
    rename_note_file(request.old_path, old_file, &new_file)?;
    Ok(finalize_rename(&new_file))
}

/// Rename a Document or an Image file in place, keeping its folder and its
/// extension. The Explorer edits the stem only (spec section 4), so the
/// extension the file arrived with is the extension it leaves with; a name
/// with no extension (a dotfile, or a bare name) keeps having none.
pub fn rename_vault_file(request: RenameVaultFileRequest<'_>) -> Result<RenameResult, String> {
    let old_file = Path::new(request.old_path);
    ensure_existing_note(old_file)?;

    let stem = request.new_stem.trim();
    if stem.is_empty() {
        return Err("New filename cannot be empty".to_string());
    }
    validate_filename_stem(stem)?;

    let new_filename = match old_file.extension() {
        Some(extension) => format!("{}.{}", stem, extension.to_string_lossy()),
        None => stem.to_string(),
    };
    if file_name_string(old_file) == new_filename {
        return Ok(unchanged_result(old_file));
    }

    let parent_dir = old_file
        .parent()
        .ok_or("Cannot determine parent directory")?;
    let new_file = parent_dir.join(&new_filename);
    if new_file.exists() && !is_same_file(old_file, &new_file) {
        return Err("A file with that name already exists".to_string());
    }
    fs::rename(old_file, &new_file).map_err(|e| {
        format!(
            "Failed to rename {} to {}: {}",
            request.old_path,
            new_file.to_string_lossy(),
            e
        )
    })?;
    Ok(finalize_rename(&new_file))
}

/// Move a note into a different folder while preserving its filename and content.
pub fn move_note_to_folder(request: MoveNoteToFolderRequest<'_>) -> Result<RenameResult, String> {
    let old_file = Path::new(request.old_path);
    let destination_dir = Path::new(request.destination_folder_path);

    ensure_existing_note(old_file)?;

    if !destination_dir.exists() {
        return Err(format!(
            "Folder does not exist: {}",
            request.destination_folder_path
        ));
    }
    if !destination_dir.is_dir() {
        return Err(format!(
            "Folder is not a directory: {}",
            request.destination_folder_path
        ));
    }

    let new_file = destination_dir.join(file_name_string(old_file));

    if new_file == old_file || is_same_file(old_file, &new_file) {
        return Ok(unchanged_result(old_file));
    }

    rename_note_file(request.old_path, old_file, &new_file)?;
    Ok(finalize_rename(&new_file))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::TempDir;

    fn create_test_file(dir: &Path, name: impl AsRef<Path>, content: impl AsRef<[u8]>) {
        let file_path = dir.join(name);
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        let mut file = fs::File::create(file_path).unwrap();
        file.write_all(content.as_ref()).unwrap();
    }

    fn create_current_note(vault: &Path, relative_path: impl AsRef<Path>) -> std::path::PathBuf {
        let relative_path = relative_path.as_ref();
        create_test_file(vault, relative_path, "# Current\n");
        vault.join(relative_path)
    }

    fn assert_rename_note_filename_error<P>(
        new_filename_stem: impl AsRef<str>,
        existing_destination: Option<P>,
        expected_error: impl AsRef<str>,
    ) where
        P: AsRef<Path>,
    {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        let current_path = create_current_note(vault, "note/current.md");
        if let Some(existing_path) = existing_destination {
            create_test_file(vault, existing_path.as_ref(), "# Existing\n");
        }

        let result = rename_note_filename(RenameNoteFilenameRequest {
            vault_path: vault.to_str().unwrap(),
            old_path: current_path.to_str().unwrap(),
            new_filename_stem: new_filename_stem.as_ref(),
        });

        assert_eq!(result.unwrap_err(), expected_error.as_ref());
    }

    fn assert_move_note_to_folder_error(expected_error: impl AsRef<str>) {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        create_test_file(vault, "projects/weekly-review.md", "# Weekly Review\n");
        create_test_file(vault, "areas/weekly-review.md", "# Existing\n");

        let result = move_note_to_folder(MoveNoteToFolderRequest {
            vault_path: vault.to_str().unwrap(),
            old_path: vault.join("projects/weekly-review.md").to_str().unwrap(),
            destination_folder_path: vault.join("areas").to_str().unwrap(),
        });

        assert_eq!(result.unwrap_err(), expected_error.as_ref());
    }

    #[test]
    fn test_rename_note_filename_preserves_content_and_leaves_other_notes_alone() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        create_test_file(
            vault,
            "note/project-kickoff.md",
            "---\ntitle: Project Kickoff\ntype: Note\n---\n\n# Project Kickoff\n\nBody.\n",
        );
        let ref_content = "# Ref\n\nSee [[note/project-kickoff]] and [[Project Kickoff]].\n";
        create_test_file(vault, "note/ref.md", ref_content);

        let old_path = vault.join("note/project-kickoff.md");
        let result = rename_note_filename(RenameNoteFilenameRequest {
            vault_path: vault.to_str().unwrap(),
            old_path: old_path.to_str().unwrap(),
            new_filename_stem: "manual-name",
        })
        .unwrap();

        assert!(result.new_path.ends_with("manual-name.md"));
        assert_eq!(result.updated_files, 0);
        assert_eq!(result.failed_updates, 0);
        assert!(!old_path.exists());

        let renamed = fs::read_to_string(&result.new_path).unwrap();
        assert!(renamed.contains("title: Project Kickoff"));
        assert!(renamed.contains("# Project Kickoff"));

        assert_eq!(
            fs::read_to_string(vault.join("note/ref.md")).unwrap(),
            ref_content
        );
    }

    #[test]
    fn test_rename_note_filename_strips_md_suffix_and_whitespace() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        let current_path = create_current_note(vault, "note/current.md");

        let result = rename_note_filename(RenameNoteFilenameRequest {
            vault_path: vault.to_str().unwrap(),
            old_path: current_path.to_str().unwrap(),
            new_filename_stem: "  renamed.md ",
        })
        .unwrap();

        assert!(result.new_path.ends_with("note/renamed.md"));
        assert!(vault.join("note/renamed.md").exists());
    }

    #[test]
    fn test_rename_note_filename_noop_when_stem_is_unchanged() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        let current_path = create_current_note(vault, "note/current.md");

        let result = rename_note_filename(RenameNoteFilenameRequest {
            vault_path: vault.to_str().unwrap(),
            old_path: current_path.to_str().unwrap(),
            new_filename_stem: "current",
        })
        .unwrap();

        assert_eq!(result.new_path, current_path.to_string_lossy());
        assert!(current_path.exists());
    }

    #[test]
    fn test_rename_note_filename_allows_case_only_change() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        let current_path = create_current_note(vault, "note/current.md");

        let result = rename_note_filename(RenameNoteFilenameRequest {
            vault_path: vault.to_str().unwrap(),
            old_path: current_path.to_str().unwrap(),
            new_filename_stem: "Current",
        })
        .unwrap();

        assert!(result.new_path.ends_with("note/Current.md"));
        let names: Vec<String> = fs::read_dir(vault.join("note"))
            .unwrap()
            .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(names, vec!["Current.md"]);
    }

    #[test]
    fn test_rename_note_filename_rejects_missing_source() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        let missing = vault.join("missing.md");

        let result = rename_note_filename(RenameNoteFilenameRequest {
            vault_path: vault.to_str().unwrap(),
            old_path: missing.to_str().unwrap(),
            new_filename_stem: "renamed",
        });

        assert_eq!(
            result.unwrap_err(),
            format!("File does not exist: {}", missing.display())
        );
    }

    #[test]
    fn test_rename_note_filename_rejects_empty_stem() {
        assert_rename_note_filename_error("  .md ", None::<&str>, "New filename cannot be empty");
    }

    #[test]
    fn test_rename_note_filename_rejects_existing_destination() {
        assert_rename_note_filename_error(
            "manual-name",
            Some("note/manual-name.md"),
            "A note with that name already exists",
        );
    }

    #[test]
    fn test_rename_note_filename_rejects_windows_invalid_names() {
        assert_rename_note_filename_error("quarterly:plan", None::<&str>, "Invalid filename");
    }

    #[test]
    fn test_rename_vault_file_keeps_an_image_extension() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        create_test_file(vault, "Attachments/lake.png", b"PNG");

        let result = rename_vault_file(RenameVaultFileRequest {
            old_path: vault.join("Attachments/lake.png").to_str().unwrap(),
            new_stem: "Lake Kawaguchi",
        })
        .unwrap();

        assert!(result.new_path.ends_with("Attachments/Lake Kawaguchi.png"));
        assert_eq!(
            fs::read(vault.join("Attachments/Lake Kawaguchi.png")).unwrap(),
            b"PNG"
        );
    }

    #[test]
    fn test_rename_vault_file_keeps_only_the_last_extension() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        let current_path = create_current_note(vault, "note/current.md");

        let result = rename_vault_file(RenameVaultFileRequest {
            old_path: current_path.to_str().unwrap(),
            new_stem: "release.v2",
        })
        .unwrap();

        assert!(result.new_path.ends_with("note/release.v2.md"));
    }

    #[test]
    fn test_rename_vault_file_leaves_an_extensionless_name_bare() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        create_test_file(vault, "LICENSE", "text");

        let result = rename_vault_file(RenameVaultFileRequest {
            old_path: vault.join("LICENSE").to_str().unwrap(),
            new_stem: "COPYING",
        })
        .unwrap();

        assert!(result.new_path.ends_with("COPYING"));
        assert!(vault.join("COPYING").exists());
    }

    #[test]
    fn test_rename_vault_file_noop_when_the_stem_is_unchanged() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        let current_path = create_current_note(vault, "note/current.md");

        let result = rename_vault_file(RenameVaultFileRequest {
            old_path: current_path.to_str().unwrap(),
            new_stem: "current",
        })
        .unwrap();

        assert_eq!(result.new_path, current_path.to_string_lossy());
        assert!(current_path.exists());
    }

    #[test]
    fn test_rename_vault_file_allows_a_case_only_change() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        let current_path = create_current_note(vault, "note/current.md");

        let result = rename_vault_file(RenameVaultFileRequest {
            old_path: current_path.to_str().unwrap(),
            new_stem: "Current",
        })
        .unwrap();

        assert!(result.new_path.ends_with("note/Current.md"));
    }

    #[test]
    fn test_rename_vault_file_refuses_an_occupied_name() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        let current_path = create_current_note(vault, "note/current.md");
        create_test_file(vault, "note/taken.md", "# Taken\n");

        let error = rename_vault_file(RenameVaultFileRequest {
            old_path: current_path.to_str().unwrap(),
            new_stem: "taken",
        })
        .unwrap_err();

        assert_eq!(error, "A file with that name already exists");
        assert!(current_path.exists());
    }

    #[test]
    fn test_rename_vault_file_rejects_an_empty_or_invalid_stem() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        let current_path = create_current_note(vault, "note/current.md");
        let old_path = current_path.to_str().unwrap();

        assert_eq!(
            rename_vault_file(RenameVaultFileRequest {
                old_path,
                new_stem: "   ",
            })
            .unwrap_err(),
            "New filename cannot be empty"
        );
        assert_eq!(
            rename_vault_file(RenameVaultFileRequest {
                old_path,
                new_stem: "quarterly:plan",
            })
            .unwrap_err(),
            "Invalid filename"
        );
    }

    #[test]
    fn test_rename_vault_file_rejects_a_missing_source() {
        let dir = TempDir::new().unwrap();
        let missing = dir.path().join("missing.md");

        let error = rename_vault_file(RenameVaultFileRequest {
            old_path: missing.to_str().unwrap(),
            new_stem: "renamed",
        })
        .unwrap_err();

        assert_eq!(error, format!("File does not exist: {}", missing.display()));
    }

    #[test]
    fn test_move_note_to_folder_preserves_filename_and_content() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        let content = "---\ntitle: Weekly Review\n---\n# Weekly Review\nBody\n";
        create_test_file(vault, "projects/weekly-review.md", content);
        create_test_file(
            vault,
            "areas/linked.md",
            "Reference [[projects/weekly-review]]\n",
        );

        let result = move_note_to_folder(MoveNoteToFolderRequest {
            vault_path: vault.to_str().unwrap(),
            old_path: vault.join("projects/weekly-review.md").to_str().unwrap(),
            destination_folder_path: vault.join("areas").to_str().unwrap(),
        })
        .expect("move should succeed");

        assert!(result.new_path.ends_with("areas/weekly-review.md"));
        assert_eq!(result.updated_files, 0);
        assert!(!vault.join("projects/weekly-review.md").exists());
        assert_eq!(
            fs::read_to_string(vault.join("areas/weekly-review.md")).unwrap(),
            content
        );
        assert_eq!(
            fs::read_to_string(vault.join("areas/linked.md")).unwrap(),
            "Reference [[projects/weekly-review]]\n"
        );
    }

    #[test]
    fn test_move_note_to_folder_noop_when_destination_matches_current_parent() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        create_test_file(vault, "projects/weekly-review.md", "# Weekly Review\n");

        let source = vault.join("projects/weekly-review.md");
        let result = move_note_to_folder(MoveNoteToFolderRequest {
            vault_path: vault.to_str().unwrap(),
            old_path: source.to_str().unwrap(),
            destination_folder_path: vault.join("projects").to_str().unwrap(),
        })
        .expect("move should noop");

        assert_eq!(result.new_path, source.to_string_lossy());
        assert!(source.exists());
        assert_eq!(result.updated_files, 0);
    }

    #[test]
    fn test_move_note_to_folder_rejects_existing_destination() {
        assert_move_note_to_folder_error("A note with that name already exists");
    }

    #[test]
    fn test_move_note_to_folder_rejects_missing_destination_folder() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        create_test_file(vault, "projects/weekly-review.md", "# Weekly Review\n");
        let missing = vault.join("missing");

        let result = move_note_to_folder(MoveNoteToFolderRequest {
            vault_path: vault.to_str().unwrap(),
            old_path: vault.join("projects/weekly-review.md").to_str().unwrap(),
            destination_folder_path: missing.to_str().unwrap(),
        });

        assert_eq!(
            result.unwrap_err(),
            format!("Folder does not exist: {}", missing.display())
        );
    }
}
