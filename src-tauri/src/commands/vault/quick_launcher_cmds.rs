use crate::vault;
use serde::Serialize;
use std::path::PathBuf;

use super::boundary::VaultBoundary;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatedQuickLauncherNote {
    absolute_path: PathBuf,
    collided: bool,
    relative_path: String,
}

fn relative_note_path(stem: &str, suffix: usize) -> String {
    match suffix {
        1 => format!("{stem}.md"),
        _ => format!("{stem}-{suffix}.md"),
    }
}

fn create_available_note(
    boundary: &VaultBoundary,
    stem: &str,
    content: &str,
) -> Result<CreatedQuickLauncherNote, String> {
    for suffix in 1.. {
        let relative_path = relative_note_path(stem, suffix);
        let absolute_path = boundary.child_path(&relative_path)?;
        if absolute_path.exists() {
            continue;
        }

        match vault::create_note_content(absolute_path.to_string_lossy().as_ref(), content) {
            Ok(()) => {
                return Ok(CreatedQuickLauncherNote {
                    absolute_path,
                    collided: suffix > 1,
                    relative_path,
                });
            }
            Err(_) if absolute_path.exists() => continue,
            Err(error) => return Err(error),
        }
    }
    unreachable!("an unbounded collision sequence cannot be exhausted")
}

#[tauri::command]
pub fn create_quick_launcher_note(
    vault_path: PathBuf,
    title: String,
) -> Result<CreatedQuickLauncherNote, String> {
    let trimmed_title = title.trim();
    if trimmed_title.is_empty() {
        return Err("Note title cannot be empty".to_string());
    }

    let raw_vault_path = vault_path.to_string_lossy();
    let boundary = VaultBoundary::from_request(Some(raw_vault_path.as_ref()))?;
    let stem = vault::title_to_slug(trimmed_title);
    create_available_note(&boundary, &stem, &format!("# {trimmed_title}\n"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn creation_is_root_scoped_and_collision_safe() {
        let dir = TempDir::new().unwrap();
        let root = dir.path().join("vault");
        fs::create_dir(&root).unwrap();

        let first = create_quick_launcher_note(root.clone(), "Team Sync".to_string()).unwrap();
        let second = create_quick_launcher_note(root, "Team Sync".to_string()).unwrap();

        assert_eq!(first.relative_path, "team-sync.md");
        assert!(!first.collided);
        assert_eq!(second.relative_path, "team-sync-2.md");
        assert!(second.collided);
        assert_eq!(
            fs::read_to_string(first.absolute_path).unwrap(),
            "# Team Sync\n"
        );
        assert_eq!(
            fs::read_to_string(second.absolute_path).unwrap(),
            "# Team Sync\n"
        );
    }
}
