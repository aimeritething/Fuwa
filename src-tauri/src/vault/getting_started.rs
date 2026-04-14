use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

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

/// Previous default AGENTS.md content seeded by Tolaria itself. Existing vaults
/// can still contain this exact text, so Tolaria treats it as managed content
/// that is safe to refresh automatically.
const STALE_AGENTS_MD: &str = r##"# AGENTS.md — Tolaria Vault

This is a [Tolaria](https://github.com/refactoringhq/tolaria) vault - a folder of markdown files with YAML frontmatter forming a personal knowledge graph.

Keep edits compatible with Tolaria's current conventions. Prefer small, human-readable changes over heavy restructuring.

## Core rules

- One markdown note per file.
- The first H1 in the body is the note title. Do not add `title:` frontmatter.
- Most notes live at the vault root as flat `.md` files. Type definitions live in `type/`. Saved views live in `views/`.
- Use wikilinks for note-to-note references, both in frontmatter and in the body.
- Frontmatter properties that start with `_` are usually Tolaria-managed state. Leave them alone unless the user explicitly asks for them to change.

## Notes

```yaml
---
type: Project
status: Active
belongs_to:
  - "[[area-operations]]"
related_to:
  - "[[goal-q2-launch]]"
---

# Q2 Launch Plan

Body content in markdown.
```

Tolaria still understands some legacy aliases such as `Is A`, but prefer `type:` for new or edited notes.

## Types

Type definitions are regular notes stored in `type/`. Use `type: Type` in frontmatter:

```yaml
---
type: Type
icon: books
color: blue
order: 20
sidebar label: Projects
---

# Project
```

Useful type metadata includes `icon`, `color`, `order`, `sidebar label`, `template`, `sort`, `view`, and `visible`.

## Relationships

Any frontmatter property whose value is a wikilink is treated as a relationship. Common names include `belongs_to`, `related_to`, and `has`, but custom relationship names are valid too.

## Wikilinks

- `[[filename]]` or `[[Note Title]]` - link by filename or title
- `[[filename|display text]]` - with custom display text
- Works in frontmatter values and markdown body

## Views

Saved filters live in `views/` as `.view.json` files:

```json
{
  "title": "Active Notes",
  "filters": [
    {"property": "type", "operator": "equals", "value": "Note"},
    {"property": "status", "operator": "equals", "value": "Active"}
  ],
  "sort": {"property": "title", "direction": "asc"}
}
```

## Filenames

Use kebab-case: `my-note-title.md`. One note per file.

## What agents should do

- Create and edit notes using the frontmatter and H1 conventions above.
- Create and edit type documents in `type/`.
- Add or modify relationships without breaking existing wikilinks.
- Create and edit saved views in `views/`.
- Update `AGENTS.md` only when the user asks for agent guidance changes.

## What agents should avoid

- Do not infer note type from folders other than the dedicated `type/` directory for type definitions.
- Do not silently overwrite an existing custom `AGENTS.md`.
- Do not rewrite installation-specific app config unless the user explicitly asks.
"##;

/// Default AGENTS.md content — vault instructions for AI agents.
/// Describes Tolaria vault mechanics only; no user-specific structure.
/// The vault scanner will pick this up as a regular entry.
pub(super) const AGENTS_MD: &str = r##"# AGENTS.md — Tolaria Vault

This is a [Tolaria](https://github.com/refactoringhq/tolaria) vault: a folder of Markdown files with YAML frontmatter forming a personal knowledge graph.

Keep edits compatible with Tolaria's current conventions. Prefer small, human-readable changes over heavy restructuring.

## Core conventions

- One Markdown note per file.
- The first H1 in the body is the preferred display title.
- Legacy `title:` frontmatter is still read as a fallback when a note has no H1. Do not add it to new notes unless you are maintaining an older file.
- `type:` is the preferred type field. Tolaria still understands legacy aliases such as `Is A`.
- Most notes live at the vault root as flat `.md` files. Type definitions live in `type/`. Saved views live in `views/`.
- Any frontmatter field containing `[[wikilinks]]` is treated as a relationship. Common names include `Belongs to:`, `Related to:`, `Workspace:`, and custom relationship names.
- Frontmatter properties that start with `_` are usually Tolaria-managed state. Leave them alone unless the user explicitly asks for them to change.

## Notes

```yaml
---
type: Project
status: Active
icon: target
Workspace: "[[tolaria]]"
Belongs to:
  - "[[25q2]]"
Related to:
  - "[[person-luca-rossi]]"
aliases:
  - Tolaria work
url: https://example.com
---

# Ship Tolaria

Body content in Markdown.
```

## Types

Type definitions are regular notes stored in `type/`. Use `type: Type` for new ones:

```yaml
---
type: Type
icon: shapes
color: blue
sidebar label: Projects
template: |
  ## Outcome

  ## Next actions
---

# Project
```

Useful type metadata includes `icon`, `color`, `order`, `sidebar label`, `template`, `sort`, `view`, and `visible`.

## Wikilinks

- `[[filename]]` or `[[Note Title]]` — link by filename or title
- `[[filename|display text]]` — with custom display text
- Works in frontmatter values and Markdown body

## Views

Saved views live in `views/*.yml` and are written as YAML:

```yaml
name: Active Projects
icon: kanban
color: blue
sort: modified:desc
filters:
  all:
    - field: type
      op: equals
      value: Project
    - field: status
      op: equals
      value: Active
```

## Filenames

Use kebab-case: `my-note-title.md`. One note per file.

## What agents should do

- Create and edit notes using the frontmatter and H1 conventions above.
- Create and edit type documents in `type/`.
- Add or modify relationships without breaking existing wikilinks.
- Create and edit saved views in `views/`.
- Update `AGENTS.md` only when the user asks for vault-level guidance changes.

## What agents should avoid

- Do not infer note type from folders other than the dedicated `type/` directory for type definitions.
- Do not silently overwrite an existing custom `AGENTS.md`.
- Do not overwrite user-authored config or installation-specific app files unless the user explicitly asks.
"##;

pub(super) const LEGACY_AGENTS_MD: &str = r##"# AGENTS.md — Tolaria Vault

This is a [Tolaria](https://github.com/refactoringhq/tolaria) vault — a folder of markdown files with YAML frontmatter forming a personal knowledge graph.

## Note structure

Every note is a markdown file. The **first H1 heading in the body is the title** — there is no `title:` frontmatter field.

```yaml
---
type: TypeName        # the note's type (must match the title of a type file in the vault)
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

A type is a note with `type: Type`. Type files live in the vault root:

```yaml
---
type: Type
_icon: books          # Phosphor icon name in kebab-case
_color: "#8b5cf6"     # hex color
---

# TypeName
```

To find what types exist: look for files with `type: Type` in the vault root.

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
    {"property": "type", "operator": "equals", "value": "Note"},
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

    crate::git::clone_repo(repo_url, target_path)?;
    let vault_path = canonical_vault_path(target_path)?;
    refresh_cloned_vault_config_files(&vault_path)?;
    Ok(vault_path)
}

fn getting_started_repo_url() -> String {
    std::env::var("TOLARIA_GETTING_STARTED_REPO_URL")
        .or_else(|_| std::env::var("LAPUTA_GETTING_STARTED_REPO_URL"))
        .unwrap_or_else(|_| GETTING_STARTED_REPO_URL.to_string())
}

fn canonical_vault_path(target_path: &str) -> Result<String, String> {
    let path = Path::new(target_path);
    let canonical = path
        .canonicalize()
        .map_err(|e| format!("Failed to resolve vault path '{}': {}", target_path, e))?;
    Ok(canonical.to_string_lossy().to_string())
}

fn refresh_cloned_vault_config_files(vault_path: &str) -> Result<(), String> {
    let agents_path = Path::new(vault_path).join("AGENTS.md");
    let refresh_agents = if !agents_path.exists() {
        true
    } else {
        let content = fs::read_to_string(&agents_path)
            .map_err(|e| format!("Failed to read {}: {e}", agents_path.display()))?;
        content.trim().is_empty() || content == LEGACY_AGENTS_MD || content == STALE_AGENTS_MD
    };

    if refresh_agents {
        fs::write(&agents_path, AGENTS_MD)
            .map_err(|e| format!("Failed to write {}: {e}", agents_path.display()))?;
    }

    crate::vault::repair_config_files(vault_path)?;

    if !vault_has_pending_changes(vault_path)? {
        return Ok(());
    }

    ensure_commit_identity(vault_path)?;
    crate::git::git_commit(vault_path, "Initialize Tolaria config files")?;
    Ok(())
}

fn vault_has_pending_changes(vault_path: &str) -> Result<bool, String> {
    let output = Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(vault_path)
        .output()
        .map_err(|e| format!("Failed to inspect cloned vault status: {e}"))?;

    if output.status.success() {
        return Ok(!String::from_utf8_lossy(&output.stdout).trim().is_empty());
    }

    Err(format!(
        "git status failed: {}",
        String::from_utf8_lossy(&output.stderr).trim()
    ))
}

fn ensure_commit_identity(vault_path: &str) -> Result<(), String> {
    for (key, fallback) in [
        ("user.name", "Tolaria"),
        ("user.email", "vault@tolaria.app"),
    ] {
        let output = Command::new("git")
            .args(["config", key])
            .current_dir(vault_path)
            .output()
            .map_err(|e| format!("Failed to inspect git config {key}: {e}"))?;

        if output.status.success() && !String::from_utf8_lossy(&output.stdout).trim().is_empty() {
            continue;
        }

        let set_output = Command::new("git")
            .args(["config", key, fallback])
            .current_dir(vault_path)
            .output()
            .map_err(|e| format!("Failed to set git config {key}: {e}"))?;

        if !set_output.status.success() {
            return Err(format!(
                "git config {key} failed: {}",
                String::from_utf8_lossy(&set_output.stderr).trim()
            ));
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::Path;
    use std::process::Command as StdCommand;

    fn init_source_repo(path: &Path, agents_content: Option<&str>) {
        fs::create_dir_all(path.join("views")).unwrap();
        fs::write(
            path.join("welcome.md"),
            "# Welcome to Tolaria\n\nThis is the starter vault.\n",
        )
        .unwrap();
        fs::write(
            path.join("views").join("active-projects.yml"),
            "title: Active Projects\nfilters: []\n",
        )
        .unwrap();
        if let Some(content) = agents_content {
            fs::write(path.join("AGENTS.md"), content).unwrap();
        }

        StdCommand::new("git")
            .args(["init"])
            .current_dir(path)
            .output()
            .unwrap();
        StdCommand::new("git")
            .args(["config", "user.email", "tolaria@app.local"])
            .current_dir(path)
            .output()
            .unwrap();
        StdCommand::new("git")
            .args(["config", "user.name", "Tolaria App"])
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
        init_source_repo(&source, None);

        let result = create_getting_started_vault_from_repo(
            dest.to_str().unwrap(),
            source.to_str().unwrap(),
        )
        .unwrap();

        assert_eq!(result, dest.canonicalize().unwrap().to_string_lossy());
        assert!(dest.join("welcome.md").exists());
        assert!(dest.join("views").join("active-projects.yml").exists());
        assert!(dest.join(".git").exists());
        assert_eq!(
            fs::read_to_string(dest.join("AGENTS.md")).unwrap(),
            AGENTS_MD
        );
        assert!(dest.join("config.md").exists());
    }

    #[test]
    fn test_create_getting_started_vault_rejects_nonempty_destination() {
        let dir = tempfile::TempDir::new().unwrap();
        let source = dir.path().join("starter");
        let dest = dir.path().join("Getting Started");
        init_source_repo(&source, None);
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
        init_source_repo(&source, None);

        create_getting_started_vault_from_repo(dest.to_str().unwrap(), source.to_str().unwrap())
            .unwrap();

        let output = StdCommand::new("git")
            .args(["status", "--porcelain"])
            .current_dir(&dest)
            .output()
            .unwrap();
        assert!(String::from_utf8_lossy(&output.stdout).trim().is_empty());
    }

    #[test]
    fn test_create_getting_started_vault_replaces_legacy_agents_template() {
        let dir = tempfile::TempDir::new().unwrap();
        let source = dir.path().join("starter");
        let dest = dir.path().join("Getting Started");
        init_source_repo(&source, Some(LEGACY_AGENTS_MD));

        create_getting_started_vault_from_repo(dest.to_str().unwrap(), source.to_str().unwrap())
            .unwrap();

        let content = fs::read_to_string(dest.join("AGENTS.md")).unwrap();
        assert_eq!(content, AGENTS_MD);
        assert!(dest.join("config.md").exists());
    }

    #[test]
    fn test_agents_template_matches_current_tolaria_vault_conventions() {
        assert!(AGENTS_MD.contains("# AGENTS.md — Tolaria Vault"));
        assert!(AGENTS_MD.contains("type/"));
        assert!(AGENTS_MD.contains("views/"));
        assert!(AGENTS_MD.contains("sidebar label"));
        assert!(AGENTS_MD.contains("Legacy `title:` frontmatter is still read as a fallback"));
        assert!(AGENTS_MD.contains("views/*.yml"));
        assert!(AGENTS_MD.contains("Belongs to:"));
        assert!(!AGENTS_MD.contains("Laputa"));
    }
}
