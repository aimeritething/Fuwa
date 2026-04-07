use std::path::{Path, PathBuf};

/// Public starter vault cloned when the user chooses Getting Started.
pub const GETTING_STARTED_REPO_URL: &str =
    "https://github.com/refactoringhq/laputa-getting-started.git";

/// Default location for the Getting Started vault.
pub fn default_vault_path() -> Result<PathBuf, String> {
    dirs::document_dir()
        .map(|d| d.join("Getting Started"))
        .ok_or_else(|| "Could not determine Documents directory".to_string())
}

/// Check whether a vault path exists on disk.
pub fn vault_exists(path: &str) -> bool {
    Path::new(path).is_dir()
}

/// Default AGENTS.md content — vault instructions for AI agents.
/// Describes Laputa vault mechanics only; no vault-specific structure.
/// The vault scanner will pick this up as a regular entry.
pub(super) const AGENTS_MD: &str = r##"# AGENTS.md — Laputa Vault

This is a [Laputa](https://github.com/refactoringhq/laputa-app) vault — a folder of markdown files with YAML frontmatter forming a personal knowledge graph.

## Note structure

Every note is a markdown file. The **first H1 heading in the body is the title** — there is no `title:` frontmatter field.

```yaml
---
is_a: TypeName        # the note's type (must match the title of a type file in the vault)
url: https://...      # example property
belongs_to: "[[other-note]]"
related_to:
  - "[[note-a]]"
  - "[[note-b]]"
---

# Note Title

Body content in markdown.
```

System properties are prefixed with `_` (e.g. `_organized`, `_pinned`, `_icon`) — these are app-managed, do not set or show them to users unless specifically asked.

## Types

A type is a note with `is_a: Type`. Type files live in the vault root:

```yaml
---
is_a: Type
_icon: books          # Phosphor icon name in kebab-case
_color: "#8b5cf6"     # hex color
---

# TypeName
```

To find what types exist: look for files with `is_a: Type` in the vault root.

## Relationships

Any frontmatter property whose value is a wikilink is a relationship. Backlinks are computed automatically.

Standard names: `belongs_to`, `related_to`, `has`. Custom names are valid.

## Wikilinks

- `[[filename]]` or `[[Note Title]]` — link by filename or title
- `[[filename|display text]]` — with custom display text
- Works in frontmatter values and markdown body

## Views

Saved filters live in `views/` as `.view.json` files:

```json
{
  "title": "Active Notes",
  "filters": [
    {"property": "is_a", "operator": "equals", "value": "Note"},
    {"property": "status", "operator": "equals", "value": "Active"}
  ],
  "sort": {"property": "title", "direction": "asc"}
}
```

## Filenames

Use kebab-case: `my-note-title.md`. One note per file.

## What you can do

- Create/edit notes with correct frontmatter and H1 title
- Create new type files
- Add or modify relationships
- Create/edit views in `views/`
- Edit `AGENTS.md` (this file)

Do not modify app configuration files — those are local to each installation.
"##;

/// Clone the public starter vault into the requested path.
pub fn create_getting_started_vault(target_path: &str) -> Result<String, String> {
    create_getting_started_vault_from_repo(target_path, &getting_started_repo_url())
}

fn create_getting_started_vault_from_repo(
    target_path: &str,
    repo_url: &str,
) -> Result<String, String> {
    if target_path.trim().is_empty() {
        return Err("Target path is required".to_string());
    }

    crate::github::clone_public_repo(repo_url, target_path)?;
    canonical_vault_path(target_path)
}

fn getting_started_repo_url() -> String {
    std::env::var("LAPUTA_GETTING_STARTED_REPO_URL")
        .unwrap_or_else(|_| GETTING_STARTED_REPO_URL.to_string())
}

fn canonical_vault_path(target_path: &str) -> Result<String, String> {
    let path = Path::new(target_path);
    let canonical = path
        .canonicalize()
        .map_err(|e| format!("Failed to resolve vault path '{}': {}", target_path, e))?;
    Ok(canonical.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::Path;
    use std::process::Command as StdCommand;

    fn init_source_repo(path: &Path) {
        fs::create_dir_all(path.join("views")).unwrap();
        fs::write(
            path.join("welcome.md"),
            "# Welcome to Laputa\n\nThis is the starter vault.\n",
        )
        .unwrap();
        fs::write(
            path.join("views").join("active-projects.yml"),
            "title: Active Projects\nfilters: []\n",
        )
        .unwrap();

        StdCommand::new("git")
            .args(["init"])
            .current_dir(path)
            .output()
            .unwrap();
        StdCommand::new("git")
            .args(["config", "user.email", "laputa@app.local"])
            .current_dir(path)
            .output()
            .unwrap();
        StdCommand::new("git")
            .args(["config", "user.name", "Laputa App"])
            .current_dir(path)
            .output()
            .unwrap();
        StdCommand::new("git")
            .args(["add", "."])
            .current_dir(path)
            .output()
            .unwrap();
        StdCommand::new("git")
            .args(["commit", "-m", "Initial starter vault"])
            .current_dir(path)
            .output()
            .unwrap();
    }

    #[test]
    fn test_default_vault_path_appends_getting_started() {
        let path = default_vault_path().unwrap();
        let path_str = path.to_string_lossy();
        assert!(path_str.ends_with("Getting Started"));
    }

    #[test]
    fn test_create_getting_started_vault_clones_repo() {
        let dir = tempfile::TempDir::new().unwrap();
        let source = dir.path().join("starter");
        let dest = dir.path().join("Getting Started");
        init_source_repo(&source);

        let result = create_getting_started_vault_from_repo(
            dest.to_str().unwrap(),
            source.to_str().unwrap(),
        )
        .unwrap();

        assert_eq!(result, dest.canonicalize().unwrap().to_string_lossy());
        assert!(dest.join("welcome.md").exists());
        assert!(dest.join("views").join("active-projects.yml").exists());
        assert!(dest.join(".git").exists());
    }

    #[test]
    fn test_create_getting_started_vault_rejects_nonempty_destination() {
        let dir = tempfile::TempDir::new().unwrap();
        let source = dir.path().join("starter");
        let dest = dir.path().join("Getting Started");
        init_source_repo(&source);
        fs::create_dir_all(&dest).unwrap();
        fs::write(dest.join("existing.md"), "# Existing\n").unwrap();

        let err = create_getting_started_vault_from_repo(
            dest.to_str().unwrap(),
            source.to_str().unwrap(),
        )
        .unwrap_err();

        assert!(err.contains("already exists and is not empty"));
    }

    #[test]
    fn test_create_getting_started_vault_cleans_partial_clone_on_failure() {
        let dir = tempfile::TempDir::new().unwrap();
        let missing_repo = dir.path().join("missing");
        let dest = dir.path().join("Getting Started");

        let err = create_getting_started_vault_from_repo(
            dest.to_str().unwrap(),
            missing_repo.to_str().unwrap(),
        )
        .unwrap_err();

        assert!(err.contains("git clone failed"));
        assert!(!dest.exists());
    }

    #[test]
    fn test_create_getting_started_vault_leaves_clean_worktree() {
        let dir = tempfile::TempDir::new().unwrap();
        let source = dir.path().join("starter");
        let dest = dir.path().join("Getting Started");
        init_source_repo(&source);

        create_getting_started_vault_from_repo(dest.to_str().unwrap(), source.to_str().unwrap())
            .unwrap();

        let output = StdCommand::new("git")
            .args(["status", "--porcelain"])
            .current_dir(&dest)
            .output()
            .unwrap();
        assert!(String::from_utf8_lossy(&output.stdout).trim().is_empty());
    }
}
