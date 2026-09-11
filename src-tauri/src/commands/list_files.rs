use serde::Serialize;
use std::path::Path;
use std::time::UNIX_EPOCH;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListedFile {
    path: String,
    kind: &'static str,
    modified_at: Option<u64>,
    file_size: u64,
}

/// The Folder listing carries metadata only. Document bytes are read on open.
#[tauri::command]
pub fn list_files(vault_path: String) -> Result<Vec<ListedFile>, String> {
    let expanded = super::expand_tilde(&vault_path);
    let root = Path::new(expanded.as_ref());
    let canonical = root
        .canonicalize()
        .map_err(|_| "Folder not found".to_string())?;
    if !canonical.is_dir() {
        return Err("Folder is not a directory".to_string());
    }
    let mut files = Vec::new();
    scan(root, &canonical, &mut vec![canonical.clone()], &mut files)?;
    Ok(files)
}

fn scan(
    directory: &Path,
    root: &Path,
    ancestors: &mut Vec<std::path::PathBuf>,
    files: &mut Vec<ListedFile>,
) -> Result<(), String> {
    let children = std::fs::read_dir(directory).map_err(|error| error.to_string())?;
    for child in children {
        let child = child.map_err(|error| error.to_string())?;
        let name = child.file_name();
        let name = name.to_string_lossy();
        if name.starts_with('.') || name == "node_modules" {
            continue;
        }
        let path = child.path();
        // Keep the requested spelling, but never traverse an escaping link or a cycle.
        let Ok(canonical) = path.canonicalize() else {
            continue;
        };
        if !canonical.starts_with(root) || ancestors.contains(&canonical) {
            continue;
        }
        let Ok(metadata) = path.metadata() else {
            continue;
        };
        let kind = if metadata.is_dir() {
            "folder"
        } else if metadata.is_file() {
            match path
                .extension()
                .and_then(|ext| ext.to_str())
                .unwrap_or("")
                .to_ascii_lowercase()
                .as_str()
            {
                "md" => "note",
                "apng" | "avif" | "bmp" | "gif" | "ico" | "jpeg" | "jpg" | "png" | "svg"
                | "tif" | "tiff" | "webp" => "image",
                _ => continue,
            }
        } else {
            continue;
        };
        files.push(ListedFile {
            path: path.to_string_lossy().into_owned(),
            kind,
            modified_at: metadata
                .modified()
                .ok()
                .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
                .map(|duration| duration.as_secs()),
            file_size: if metadata.is_file() {
                metadata.len()
            } else {
                0
            },
        });
        if metadata.is_dir() {
            ancestors.push(canonical);
            scan(&path, root, ancestors, files)?;
            ancestors.pop();
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lists_supported_files_and_folders_without_hidden_or_dependency_contents() {
        let dir = tempfile::tempdir().unwrap();
        for folder in ["Nested", ".git", "node_modules", ".hidden"] {
            std::fs::create_dir(dir.path().join(folder)).unwrap();
            std::fs::write(dir.path().join(folder).join("note.md"), "abc").unwrap();
        }
        for name in ["a.MD", "photo.png", "readme.txt", ".secret.md"] {
            std::fs::write(dir.path().join(name), "abc").unwrap();
        }
        let files = list_files(dir.path().to_string_lossy().into_owned()).unwrap();
        let mut paths: Vec<_> = files
            .iter()
            .map(|file| {
                std::path::Path::new(&file.path)
                    .strip_prefix(dir.path())
                    .unwrap()
                    .to_string_lossy()
                    .into_owned()
            })
            .collect();
        paths.sort();
        assert_eq!(paths, ["Nested", "Nested/note.md", "a.MD", "photo.png"]);
        let note = files
            .iter()
            .find(|file| file.path.ends_with("a.MD"))
            .unwrap();
        assert_eq!(note.kind, "note");
        assert_eq!(note.file_size, 3);
        assert!(note.modified_at.is_some());
    }
}
