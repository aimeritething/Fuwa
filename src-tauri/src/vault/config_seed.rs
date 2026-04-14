use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

use super::getting_started::{AGENTS_MD, LEGACY_AGENTS_MD};

/// Content for `config.md` — gives the Config type a sidebar icon and label.
const CONFIG_TYPE_DEFINITION: &str = "\
---
type: Type
icon: gear-six
color: gray
order: 90
sidebar label: Config
---

# Config

Vault configuration files. These control how AI agents, tools, and other integrations interact with this vault.
";

const CLAUDE_MD_SHIM: &str = "@AGENTS.md

This file is a Claude Code compatibility shim. Keep shared agent instructions in `AGENTS.md`.
";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AiGuidanceFileState {
    Managed,
    Missing,
    Broken,
    Custom,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct VaultAiGuidanceStatus {
    pub agents_state: AiGuidanceFileState,
    pub claude_state: AiGuidanceFileState,
    pub can_restore: bool,
}

#[derive(Debug, Default)]
struct LegacyAgentsMigrationOutcome {
    copied_to_root: bool,
    removed_legacy: bool,
}

/// Write a file if it doesn't exist or is empty (corrupt). Returns true if written.
fn write_if_missing(path: &Path, content: &str) -> Result<bool, String> {
    let needs_write = !path.exists() || fs::metadata(path).map_or(true, |m| m.len() == 0);
    if needs_write {
        fs::write(path, content).map_err(|e| format!("Failed to write {}: {e}", path.display()))?;
    }
    Ok(needs_write)
}

fn read_file_or_empty(path: &Path) -> String {
    fs::read_to_string(path).unwrap_or_default()
}

fn agents_content_can_be_replaced(content: &str) -> bool {
    content.is_empty()
        || content.contains("See config/agents.md")
        || content == LEGACY_AGENTS_MD
        || content.contains("Do not add `title:` frontmatter.")
}

fn root_agents_can_be_replaced(path: &Path) -> bool {
    !path.exists() || agents_content_can_be_replaced(&read_file_or_empty(path))
}

fn matches_claude_shim(content: &str) -> bool {
    let trimmed = content.trim();
    trimmed == "@AGENTS.md" || trimmed == CLAUDE_MD_SHIM.trim()
}

fn claude_shim_can_be_replaced(path: &Path) -> bool {
    !path.exists() || {
        let content = read_file_or_empty(path);
        content.trim().is_empty() || matches_claude_shim(&content)
    }
}

fn sync_managed_file(
    path: &Path,
    content: &str,
    can_replace: fn(&Path) -> bool,
) -> Result<bool, String> {
    if !can_replace(path) {
        return Ok(false);
    }

    fs::write(path, content).map_err(|e| format!("Failed to write {}: {e}", path.display()))?;
    Ok(true)
}

fn classify_guidance_file(
    path: &Path,
    matches_managed: fn(&str) -> bool,
    can_replace: fn(&Path) -> bool,
) -> AiGuidanceFileState {
    if !path.exists() {
        return AiGuidanceFileState::Missing;
    }

    let content = read_file_or_empty(path);
    if matches_managed(&content) {
        return AiGuidanceFileState::Managed;
    }

    if can_replace(path) {
        return AiGuidanceFileState::Broken;
    }

    AiGuidanceFileState::Custom
}

fn guidance_paths(vault_path: &str) -> (PathBuf, PathBuf) {
    let vault = Path::new(vault_path);
    (vault.join("AGENTS.md"), vault.join("CLAUDE.md"))
}

fn classify_agents_file(path: &Path) -> AiGuidanceFileState {
    classify_guidance_file(
        path,
        |content| content == AGENTS_MD,
        root_agents_can_be_replaced,
    )
}

fn classify_claude_file(path: &Path) -> AiGuidanceFileState {
    classify_guidance_file(path, matches_claude_shim, claude_shim_can_be_replaced)
}

fn guidance_file_needs_restore(state: AiGuidanceFileState) -> bool {
    matches!(
        state,
        AiGuidanceFileState::Missing | AiGuidanceFileState::Broken
    )
}

fn build_ai_guidance_status(vault_path: &str) -> VaultAiGuidanceStatus {
    let (agents_path, claude_path) = guidance_paths(vault_path);
    let agents_state = classify_agents_file(&agents_path);
    let claude_state = classify_claude_file(&claude_path);

    VaultAiGuidanceStatus {
        agents_state,
        claude_state,
        can_restore: guidance_file_needs_restore(agents_state)
            || guidance_file_needs_restore(claude_state),
    }
}

fn sync_claude_shim_file(vault_path: &str) -> Result<bool, String> {
    let (_, claude_path) = guidance_paths(vault_path);
    sync_managed_file(&claude_path, CLAUDE_MD_SHIM, claude_shim_can_be_replaced)
}

fn sync_ai_guidance_files(vault_path: &str) -> Result<bool, String> {
    let wrote_agents = sync_default_agents_file(vault_path)?;
    let wrote_claude = sync_claude_shim_file(vault_path)?;
    Ok(wrote_agents || wrote_claude)
}

fn migrate_legacy_agents_file(
    root_agents: &Path,
    config_agents: &Path,
) -> Result<LegacyAgentsMigrationOutcome, String> {
    let mut outcome = LegacyAgentsMigrationOutcome::default();
    if !config_agents.exists() {
        return Ok(outcome);
    }

    let config_content = read_file_or_empty(config_agents);
    if !config_content.is_empty() && root_agents_can_be_replaced(root_agents) {
        fs::write(root_agents, &config_content)
            .map_err(|e| format!("Failed to write AGENTS.md: {e}"))?;
        outcome.copied_to_root = true;
    }

    fs::remove_file(config_agents)
        .map_err(|e| format!("Failed to remove config/agents.md: {e}"))?;
    outcome.removed_legacy = true;

    Ok(outcome)
}

fn cleanup_empty_config_dir(vault: &Path) -> Result<bool, String> {
    let config_dir = vault.join("config");
    if !config_dir.is_dir() {
        return Ok(false);
    }

    let is_empty = fs::read_dir(&config_dir)
        .map_err(|e| format!("Failed to inspect {}: {e}", config_dir.display()))?
        .next()
        .is_none();
    if !is_empty {
        return Ok(false);
    }

    fs::remove_dir(&config_dir)
        .map_err(|e| format!("Failed to remove {}: {e}", config_dir.display()))?;
    Ok(true)
}

pub(super) fn sync_default_agents_file(vault_path: &str) -> Result<bool, String> {
    let (agents_path, _) = guidance_paths(vault_path);
    sync_managed_file(&agents_path, AGENTS_MD, root_agents_can_be_replaced)
}

pub fn get_ai_guidance_status(vault_path: &str) -> Result<VaultAiGuidanceStatus, String> {
    Ok(build_ai_guidance_status(vault_path))
}

pub fn restore_ai_guidance_files(vault_path: &str) -> Result<VaultAiGuidanceStatus, String> {
    sync_ai_guidance_files(vault_path)?;
    get_ai_guidance_status(vault_path)
}

/// Seed `AGENTS.md` at vault root if missing or empty (idempotent, per-file).
/// Also seeds `config.md` type definition for sidebar visibility.
pub fn seed_config_files(vault_path: &str) {
    if sync_ai_guidance_files(vault_path).unwrap_or(false) {
        log::info!("Seeded vault AI guidance files at vault root");
    }

    ensure_config_type_definition(vault_path);
}

/// Ensure `config.md` exists at vault root (gives Config type a sidebar icon/color).
fn ensure_config_type_definition(vault_path: &str) {
    let path = Path::new(vault_path).join("config.md");
    let _ = write_if_missing(&path, CONFIG_TYPE_DEFINITION);
}

/// Migrate legacy `config/agents.md` → root `AGENTS.md` for existing vaults.
///
/// - If `config/agents.md` has real content and root `AGENTS.md` is missing/empty/stub:
///   move content to root, remove legacy file.
/// - If root `AGENTS.md` doesn't exist: write defaults.
/// - Cleans up empty `config/` directory after migration.
///
/// Always idempotent and silent.
pub fn migrate_agents_md(vault_path: &str) {
    let vault = Path::new(vault_path);
    let root_agents = vault.join("AGENTS.md");
    let config_agents = vault.join("config").join("agents.md");

    if let Ok(outcome) = migrate_legacy_agents_file(&root_agents, &config_agents) {
        if outcome.copied_to_root {
            log::info!("Migrated config/agents.md content to root AGENTS.md");
        }
        if outcome.removed_legacy {
            log::info!("Removed legacy config/agents.md");
        }
    }

    if cleanup_empty_config_dir(vault).unwrap_or(false) {
        log::info!("Removed empty config/ directory");
    }

    let _ = sync_ai_guidance_files(vault_path);
}

/// Repair config files: ensure `AGENTS.md` at vault root and `config.md` type definition.
/// Migrates legacy `config/agents.md` to root if present.
/// Called by the "Repair Vault" command. Returns a status message.
pub fn repair_config_files(vault_path: &str) -> Result<String, String> {
    let vault = Path::new(vault_path);
    let root_agents = vault.join("AGENTS.md");
    let config_agents = vault.join("config").join("agents.md");

    migrate_legacy_agents_file(&root_agents, &config_agents)?;
    let _ = cleanup_empty_config_dir(vault)?;
    sync_ai_guidance_files(vault_path)?;

    write_if_missing(&vault.join("config.md"), CONFIG_TYPE_DEFINITION)?;

    Ok("Config files repaired".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn create_vault() -> (TempDir, PathBuf) {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();
        (dir, vault)
    }

    fn config_dir(vault: &Path) -> PathBuf {
        let dir = vault.join("config");
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write_root_agents(vault: &Path, content: &str) {
        fs::write(vault.join("AGENTS.md"), content).unwrap();
    }

    fn write_root_claude(vault: &Path, content: &str) {
        fs::write(vault.join("CLAUDE.md"), content).unwrap();
    }

    fn write_legacy_agents(vault: &Path, content: &str) {
        fs::write(config_dir(vault).join("agents.md"), content).unwrap();
    }

    fn read_root_agents(vault: &Path) -> String {
        fs::read_to_string(vault.join("AGENTS.md")).unwrap()
    }

    fn read_root_claude(vault: &Path) -> String {
        fs::read_to_string(vault.join("CLAUDE.md")).unwrap()
    }

    #[test]
    fn test_seed_config_files_creates_guidance_files_at_root() {
        let (_dir, vault) = create_vault();

        seed_config_files(vault.to_str().unwrap());

        assert!(vault.join("AGENTS.md").exists());
        assert!(read_root_agents(&vault).contains("Tolaria Vault"));
        assert_eq!(read_root_claude(&vault), CLAUDE_MD_SHIM);
    }

    #[test]
    fn test_seed_config_files_creates_type_definition() {
        let (_dir, vault) = create_vault();

        seed_config_files(vault.to_str().unwrap());

        assert!(vault.join("config.md").exists());
        let content = fs::read_to_string(vault.join("config.md")).unwrap();
        assert!(content.contains("type: Type"));
        assert!(content.contains("icon: gear-six"));
        assert!(!vault.join("config").exists());
    }

    #[test]
    fn test_seed_config_files_preserves_custom_agents() {
        let (_dir, vault) = create_vault();

        seed_config_files(vault.to_str().unwrap());
        write_root_agents(&vault, "# Custom Agent Config\nMy custom instructions\n");

        seed_config_files(vault.to_str().unwrap());
        assert!(
            read_root_agents(&vault).contains("Custom Agent Config"),
            "must preserve existing content"
        );
    }

    #[test]
    fn test_seed_config_files_reseeds_empty() {
        let (_dir, vault) = create_vault();
        write_root_agents(&vault, "");

        seed_config_files(vault.to_str().unwrap());
        assert!(read_root_agents(&vault).contains("Tolaria Vault"));
    }

    #[test]
    fn test_seed_config_files_refreshes_stale_default_agents() {
        let (_dir, vault) = create_vault();
        write_root_agents(
            &vault,
            "# AGENTS.md — Tolaria Vault\n\n- The first H1 in the body is the note title. Do not add `title:` frontmatter.\n",
        );

        seed_config_files(vault.to_str().unwrap());

        let content = read_root_agents(&vault);
        assert!(content.contains("Legacy `title:` frontmatter is still read as a fallback"));
        assert!(content.contains("views/*.yml"));
        assert!(content.contains("Belongs to:"));
    }

    #[test]
    fn test_seed_config_files_preserves_custom_claude() {
        let (_dir, vault) = create_vault();
        write_root_claude(&vault, "# Custom Claude instructions\nDo not overwrite\n");

        seed_config_files(vault.to_str().unwrap());

        assert!(read_root_claude(&vault).contains("Custom Claude instructions"));
    }

    #[test]
    fn test_migrate_agents_md_moves_config_to_root() {
        let (_dir, vault) = create_vault();
        write_legacy_agents(&vault, "# My vault agent instructions\nCustom content\n");

        migrate_agents_md(vault.to_str().unwrap());

        let config_dir = vault.join("config");
        let root_content = read_root_agents(&vault);
        assert!(root_content.contains("My vault agent instructions"));
        assert!(!config_dir.join("agents.md").exists());
        assert!(!config_dir.exists());
    }

    #[test]
    fn test_migrate_agents_md_preserves_existing_root() {
        let (_dir, vault) = create_vault();
        write_root_agents(&vault, "# My root agent config\nDo not overwrite\n");
        write_legacy_agents(&vault, "Legacy content");

        migrate_agents_md(vault.to_str().unwrap());

        let config_dir = vault.join("config");
        let content = read_root_agents(&vault);
        assert!(content.contains("My root agent config"));
        assert!(!config_dir.join("agents.md").exists());
    }

    #[test]
    fn test_migrate_agents_md_replaces_stub_with_config_content() {
        let (_dir, vault) = create_vault();
        write_root_agents(
            &vault,
            "# Agent Instructions\nSee config/agents.md for vault instructions.\n",
        );
        write_legacy_agents(&vault, "# Real Agent Config\nImportant instructions\n");

        migrate_agents_md(vault.to_str().unwrap());

        let content = read_root_agents(&vault);
        assert!(content.contains("Real Agent Config"));
    }

    #[test]
    fn test_migrate_agents_md_idempotent_when_no_legacy() {
        let (_dir, vault) = create_vault();

        migrate_agents_md(vault.to_str().unwrap());

        assert!(vault.join("AGENTS.md").exists());
        let root = read_root_agents(&vault);
        assert!(root.contains("Tolaria Vault"));
        assert_eq!(read_root_claude(&vault), CLAUDE_MD_SHIM);
    }

    #[test]
    fn test_migrate_agents_md_keeps_nonempty_config_dir() {
        let (_dir, vault) = create_vault();
        let config_dir = config_dir(&vault);
        fs::write(config_dir.join("agents.md"), "Agent content").unwrap();
        fs::write(config_dir.join("other.md"), "Other file").unwrap();

        migrate_agents_md(vault.to_str().unwrap());

        assert!(config_dir.exists());
        assert!(config_dir.join("other.md").exists());
        assert!(!config_dir.join("agents.md").exists());
    }

    #[test]
    fn test_repair_config_files_creates_all() {
        let (_dir, vault) = create_vault();

        let msg = repair_config_files(vault.to_str().unwrap()).unwrap();
        assert_eq!(msg, "Config files repaired");

        assert!(vault.join("AGENTS.md").exists());
        assert!(vault.join("CLAUDE.md").exists());
        assert!(vault.join("config.md").exists());
        assert!(!vault.join("config").exists());

        let agents = read_root_agents(&vault);
        assert!(agents.contains("Tolaria Vault"));
    }

    #[test]
    fn test_repair_config_files_preserves_custom_content() {
        let (_dir, vault) = create_vault();
        write_root_agents(&vault, "# My custom agent config\nDo not overwrite me\n");

        repair_config_files(vault.to_str().unwrap()).unwrap();

        assert!(
            read_root_agents(&vault).contains("My custom agent config"),
            "must preserve existing content"
        );
    }

    #[test]
    fn test_repair_config_files_migrates_legacy_config() {
        let (_dir, vault) = create_vault();
        write_legacy_agents(
            &vault,
            "# My vault agents instructions\nCustom content here\n",
        );

        repair_config_files(vault.to_str().unwrap()).unwrap();

        let config_dir = vault.join("config");
        let root = read_root_agents(&vault);
        assert!(root.contains("My vault agents instructions"));
        assert!(!config_dir.join("agents.md").exists());
    }

    #[test]
    fn test_repair_config_files_replaces_stub_with_legacy() {
        let (_dir, vault) = create_vault();
        write_root_agents(
            &vault,
            "# Agent Instructions\nSee config/agents.md for vault instructions.\n",
        );
        write_legacy_agents(&vault, "# Real Instructions\nImportant stuff\n");

        repair_config_files(vault.to_str().unwrap()).unwrap();

        let content = read_root_agents(&vault);
        assert!(content.contains("Real Instructions"));
    }

    #[test]
    fn test_get_ai_guidance_status_reports_custom_and_repairable_files() {
        let (_dir, vault) = create_vault();
        write_root_agents(&vault, "# Custom Agent Config\nHands off\n");
        write_root_claude(&vault, "");

        let status = get_ai_guidance_status(vault.to_str().unwrap()).unwrap();
        assert_eq!(status.agents_state, AiGuidanceFileState::Custom);
        assert_eq!(status.claude_state, AiGuidanceFileState::Broken);
        assert!(status.can_restore);
    }

    #[test]
    fn test_restore_ai_guidance_files_repairs_without_overwriting_custom_agents() {
        let (_dir, vault) = create_vault();
        write_root_agents(&vault, "# Custom Agent Config\nHands off\n");
        write_root_claude(&vault, "");

        let status = restore_ai_guidance_files(vault.to_str().unwrap()).unwrap();
        assert_eq!(status.agents_state, AiGuidanceFileState::Custom);
        assert_eq!(status.claude_state, AiGuidanceFileState::Managed);
        assert!(!status.can_restore);
        assert!(read_root_agents(&vault).contains("Custom Agent Config"));
        assert_eq!(read_root_claude(&vault), CLAUDE_MD_SHIM);
    }

    #[test]
    fn test_restore_ai_guidance_files_repairs_broken_agents_and_missing_claude() {
        let (_dir, vault) = create_vault();
        write_root_agents(&vault, "");

        let status = restore_ai_guidance_files(vault.to_str().unwrap()).unwrap();
        assert_eq!(status.agents_state, AiGuidanceFileState::Managed);
        assert_eq!(status.claude_state, AiGuidanceFileState::Managed);
        assert!(!status.can_restore);
    }
}
