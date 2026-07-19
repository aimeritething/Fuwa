use serde::Serialize;
use std::path::{Component, Path, PathBuf};

use super::git_command_at;

const RELATION_NONE: &str = "none";
const RELATION_PARENT: &str = "parent";
const RELATION_VAULT: &str = "vault";

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct GitWorkspace {
    vault_root: PathBuf,
    git_root: PathBuf,
    vault_pathspec: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct GitWorkspaceInfo {
    #[serde(rename = "vaultRoot")]
    pub vault_root: String,
    #[serde(rename = "gitRoot")]
    pub git_root: Option<String>,
    #[serde(rename = "vaultPathspec")]
    pub vault_pathspec: Option<String>,
    #[serde(rename = "gitRootRelation")]
    pub git_root_relation: String,
    #[serde(rename = "resolutionFailure")]
    pub resolution_failure: Option<String>,
}

impl GitWorkspace {
    pub(crate) fn resolve(vault_root: &Path) -> Result<Option<Self>, String> {
        if !vault_root.is_dir() {
            return Err("invalid_vault".to_string());
        }

        let output = git_command_at(vault_root)
            .and_then(|mut command| command.args(["rev-parse", "--show-prefix"]).output())
            .map_err(|_| "provider_unavailable".to_string())?;
        if !output.status.success() {
            return Ok(None);
        }

        let resolved_vault_root = vault_root
            .canonicalize()
            .map_err(|_| "vault_resolution_failed".to_string())?;
        let vault_pathspec = normalize_prefix(&String::from_utf8_lossy(&output.stdout))?;
        let git_root = ancestor_for_prefix(&resolved_vault_root, &vault_pathspec)?;

        Ok(Some(Self {
            vault_root: vault_root.to_path_buf(),
            git_root,
            vault_pathspec,
        }))
    }

    pub(crate) fn git_root(&self) -> &Path {
        &self.git_root
    }

    pub(crate) fn vault_root(&self) -> &Path {
        &self.vault_root
    }

    pub(crate) fn vault_pathspec(&self) -> &str {
        if self.vault_pathspec.is_empty() {
            "."
        } else {
            &self.vault_pathspec
        }
    }

    pub(crate) fn uses_parent_repository(&self) -> bool {
        !self.vault_pathspec.is_empty()
    }

    pub(crate) fn repo_relative_path(&self, vault_relative_path: &Path) -> String {
        let suffix = path_to_git_string(vault_relative_path);
        if self.vault_pathspec.is_empty() {
            return suffix;
        }
        if suffix.is_empty() {
            return self.vault_pathspec.clone();
        }
        format!("{}/{}", self.vault_pathspec, suffix)
    }

    pub(crate) fn vault_relative_path(&self, repo_relative_path: &str) -> Option<String> {
        let repo_path = normalize_git_path(repo_relative_path);
        if self.vault_pathspec.is_empty() {
            return Some(repo_path);
        }
        repo_path
            .strip_prefix(&self.vault_pathspec)
            .and_then(|suffix| suffix.strip_prefix('/'))
            .map(ToOwned::to_owned)
    }

    fn relation(&self) -> &'static str {
        if self.vault_pathspec.is_empty() {
            RELATION_VAULT
        } else {
            RELATION_PARENT
        }
    }
}

pub fn git_workspace_info(vault_root: impl AsRef<Path>) -> GitWorkspaceInfo {
    let vault_root = vault_root.as_ref();
    match GitWorkspace::resolve(vault_root) {
        Ok(Some(workspace)) => GitWorkspaceInfo {
            vault_root: display_path(workspace.vault_root()),
            git_root: Some(display_path(workspace.git_root())),
            vault_pathspec: Some(workspace.vault_pathspec.clone()),
            git_root_relation: workspace.relation().to_string(),
            resolution_failure: None,
        },
        Ok(None) => GitWorkspaceInfo {
            vault_root: display_path(vault_root),
            git_root: None,
            vault_pathspec: None,
            git_root_relation: RELATION_NONE.to_string(),
            resolution_failure: None,
        },
        Err(category) => GitWorkspaceInfo {
            vault_root: display_path(vault_root),
            git_root: None,
            vault_pathspec: None,
            git_root_relation: RELATION_NONE.to_string(),
            resolution_failure: Some(category),
        },
    }
}

fn normalize_prefix(prefix: &str) -> Result<String, String> {
    let prefix = normalize_git_path(prefix.trim().trim_end_matches('/'));
    if prefix.is_empty() {
        return Ok(String::new());
    }
    if is_invalid_prefix(&prefix) {
        return Err("invalid_git_prefix".to_string());
    }
    Ok(prefix)
}

fn is_invalid_prefix(prefix: &str) -> bool {
    prefix.starts_with('/') || prefix.split('/').any(is_invalid_prefix_part)
}

fn is_invalid_prefix_part(part: &str) -> bool {
    part.is_empty() || matches!(part, "." | "..")
}

fn ancestor_for_prefix(vault_root: &Path, prefix: &str) -> Result<PathBuf, String> {
    let depth = prefix.split('/').filter(|part| !part.is_empty()).count();
    let mut git_root = vault_root.to_path_buf();
    for _ in 0..depth {
        if !git_root.pop() {
            return Err("invalid_git_prefix".to_string());
        }
    }
    Ok(git_root)
}

fn path_to_git_string(path: &Path) -> String {
    path.components()
        .filter_map(|component| match component {
            Component::Normal(value) => Some(value.to_string_lossy().into_owned()),
            Component::CurDir => None,
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("/")
}

fn normalize_git_path(path: &str) -> String {
    path.replace('\\', "/")
}

fn display_path(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::tests::setup_git_repo;
    use crate::git::{get_modified_files_with_stats, git_command};
    use std::fs;

    #[test]
    fn resolves_repository_root_vault() {
        let dir = setup_git_repo();
        let workspace = GitWorkspace::resolve(dir.path()).unwrap().unwrap();

        assert_eq!(workspace.git_root(), dir.path().canonicalize().unwrap());
        assert_eq!(workspace.vault_pathspec(), ".");
        assert_eq!(workspace.relation(), RELATION_VAULT);
    }

    #[test]
    fn resolves_nested_vault_and_maps_paths_at_one_boundary() {
        let dir = setup_git_repo();
        let vault = dir.path().join("docs").join("user guides");
        fs::create_dir_all(&vault).unwrap();

        let workspace = GitWorkspace::resolve(&vault).unwrap().unwrap();

        assert_eq!(workspace.git_root(), dir.path().canonicalize().unwrap());
        assert_eq!(workspace.vault_pathspec(), "docs/user guides");
        assert_eq!(
            workspace.repo_relative_path(Path::new("intro.md")),
            "docs/user guides/intro.md"
        );
        assert_eq!(
            workspace.vault_relative_path("docs/user guides/intro.md"),
            Some("intro.md".to_string())
        );
        assert_eq!(workspace.vault_relative_path("src/outside.md"), None);
    }

    #[test]
    fn reports_gitless_vault_without_failure() {
        let dir = tempfile::TempDir::new().unwrap();
        let info = git_workspace_info(dir.path());

        assert_eq!(info.git_root_relation, RELATION_NONE);
        assert_eq!(info.git_root, None);
        assert_eq!(info.resolution_failure, None);
    }

    #[test]
    fn nested_vault_status_excludes_parent_repository_changes() {
        let dir = setup_git_repo();
        let repository = dir.path();
        let vault = repository.join("docs");
        fs::create_dir(&vault).unwrap();
        fs::create_dir(repository.join("src")).unwrap();
        fs::write(vault.join("guide.md"), "# Guide\n").unwrap();
        fs::write(repository.join("outside.md"), "# Outside\n").unwrap();
        fs::write(repository.join("src/app.md"), "# Source docs\n").unwrap();
        git_command()
            .args(["add", "-A"])
            .current_dir(repository)
            .output()
            .unwrap();
        git_command()
            .args(["commit", "-m", "initial"])
            .current_dir(repository)
            .output()
            .unwrap();

        fs::write(vault.join("guide.md"), "# Guide\n\nUpdated.\n").unwrap();
        fs::write(vault.join("new note.md"), "# New\n").unwrap();
        fs::write(repository.join("outside.md"), "# Outside changed\n").unwrap();
        fs::write(repository.join("src/app.md"), "# Source docs changed\n").unwrap();

        let files = get_modified_files_with_stats(&vault).unwrap();
        assert_eq!(
            files
                .iter()
                .map(|file| file.relative_path.as_str())
                .collect::<Vec<_>>(),
            vec!["guide.md", "new note.md"]
        );
        assert!(files
            .iter()
            .all(|file| Path::new(&file.path).starts_with(&vault)));
        assert_eq!(files[0].added_lines, Some(2));
        assert_eq!(files[1].added_lines, Some(1));
    }
}
