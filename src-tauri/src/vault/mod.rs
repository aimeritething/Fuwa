mod entry;
mod file;
pub(crate) mod filename_rules;
mod folders;
mod image;
pub(crate) mod path_identity;
mod rename;
mod trash;

pub use entry::FolderNode;
pub use file::{create_note_content, get_note_content, note_content_matches, save_note_content};
pub use folders::{delete_folder, rename_folder, FolderRenameResult};
pub use image::{copy_image_to_vault, save_image};
pub use rename::{
    move_note_to_folder, rename_note_filename, rename_vault_file, MoveNoteToFolderRequest,
    RenameNoteFilenameRequest, RenameResult, RenameVaultFileRequest,
};
pub use trash::{batch_delete_notes, delete_note};

use std::fs;
use std::path::Path;

/// Directories hidden from user-facing vault scans.
const HIDDEN_DIRS: &[&str] = &[".git", ".laputa", ".DS_Store"];

fn is_hidden_dir(name: &str) -> bool {
    name.starts_with('.') || HIDDEN_DIRS.contains(&name)
}

fn is_folder_tree_hidden_dir(name: &str) -> bool {
    is_hidden_dir(name)
}

/// Build a tree of user-created folders in the vault.
pub fn scan_vault_folders(vault_path: &Path) -> Result<Vec<FolderNode>, String> {
    if !vault_path.is_dir() {
        return Err(format!("Not a directory: {}", vault_path.display()));
    }
    fn build_tree(dir: &Path, vault_root: &Path) -> Vec<FolderNode> {
        let mut nodes: Vec<FolderNode> = Vec::new();
        let entries = match fs::read_dir(dir) {
            Ok(d) => d,
            Err(_) => return nodes,
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let name = entry.file_name().to_string_lossy().to_string();
            if is_folder_tree_hidden_dir(&name) {
                continue;
            }
            let rel_path = path_identity::vault_relative_path_string(vault_root, &path)
                .unwrap_or_else(|_| {
                    path_identity::normalize_path_for_identity(&path.to_string_lossy())
                });
            let children = build_tree(&path, vault_root);
            nodes.push(FolderNode {
                name,
                path: rel_path,
                children,
            });
        }
        nodes.sort_by_key(|node| node.name.to_lowercase());
        nodes
    }
    Ok(build_tree(vault_path, vault_path))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn scan_vault_folders_builds_a_sorted_tree_of_visible_directories() {
        let dir = TempDir::new().unwrap();
        for folder in ["projects/laputa", "areas", ".git/objects", ".hidden"] {
            fs::create_dir_all(dir.path().join(folder)).unwrap();
        }
        fs::write(dir.path().join("note.md"), "# Note\n").unwrap();

        let folders = scan_vault_folders(dir.path()).unwrap();

        let names: Vec<&str> = folders.iter().map(|node| node.name.as_str()).collect();
        assert_eq!(names, vec!["areas", "projects"]);
        assert_eq!(folders[1].path, "projects");
        assert_eq!(folders[1].children.len(), 1);
        assert_eq!(folders[1].children[0].name, "laputa");
        assert_eq!(folders[1].children[0].path, "projects/laputa");
    }

    #[test]
    fn scan_vault_folders_rejects_a_missing_root() {
        let dir = TempDir::new().unwrap();

        let error = scan_vault_folders(&dir.path().join("missing")).unwrap_err();

        assert!(error.starts_with("Not a directory: "));
    }
}
