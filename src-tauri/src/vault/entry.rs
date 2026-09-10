use serde::{Deserialize, Serialize};

/// A node in the vault's folder tree. Only contains directories, not files.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FolderNode {
    /// Folder name (last path component).
    pub name: String,
    /// Path relative to the vault root, using `/` separators (e.g. "projects/laputa").
    pub path: String,
    /// Child folders (sorted alphabetically).
    pub children: Vec<FolderNode>,
}
