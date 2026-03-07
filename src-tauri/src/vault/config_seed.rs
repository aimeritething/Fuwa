use std::fs;
use std::path::Path;

use super::getting_started::AGENTS_MD;

/// Content for `type/config.md` — gives the Config type a sidebar icon and label.
const CONFIG_TYPE_DEFINITION: &str = "\
---
Is A: Type
icon: gear-six
color: gray
order: 90
sidebar label: Config
---

# Config

Vault configuration files. These control how AI agents, tools, and other integrations interact with this vault.
";

/// Minimal root `AGENTS.md` stub that redirects to `config/agents.md`.
const AGENTS_MD_STUB: &str = "\
# Agent Instructions

See config/agents.md for vault instructions.
";

/// Seed `config/agents.md` if missing or empty (idempotent, per-file).
/// Also seeds `type/config.md` for sidebar visibility.
pub fn seed_config_files(vault_path: &str) {
    let vault = Path::new(vault_path);
    let config_dir = vault.join("config");
    if fs::create_dir_all(&config_dir).is_err() {
        return;
    }

    let agents_path = config_dir.join("agents.md");
    let needs_write =
        !agents_path.exists() || fs::metadata(&agents_path).map_or(true, |m| m.len() == 0);
    if needs_write {
        let _ = fs::write(&agents_path, AGENTS_MD);
        log::info!("Seeded config/agents.md");
    }

    ensure_config_type_definition(vault_path);
}

/// Ensure `type/config.md` exists (gives Config type a sidebar icon/color).
fn ensure_config_type_definition(vault_path: &str) {
    let type_dir = Path::new(vault_path).join("type");
    if fs::create_dir_all(&type_dir).is_err() {
        return;
    }
    let path = type_dir.join("config.md");
    let needs_write = !path.exists() || fs::metadata(&path).map_or(true, |m| m.len() == 0);
    if needs_write {
        let _ = fs::write(&path, CONFIG_TYPE_DEFINITION);
    }
}

/// Migrate root `AGENTS.md` → `config/agents.md` for existing vaults.
///
/// - If root `AGENTS.md` exists and `config/agents.md` does not: move content, write stub.
/// - If root `AGENTS.md` exists and `config/agents.md` also exists: just replace root with stub.
/// - If root `AGENTS.md` doesn't exist: write the stub anyway (for Codex discoverability).
///
/// Always idempotent and silent.
pub fn migrate_agents_md(vault_path: &str) {
    let vault = Path::new(vault_path);
    let root_agents = vault.join("AGENTS.md");
    let config_dir = vault.join("config");
    let config_agents = config_dir.join("agents.md");

    // Ensure config/ directory exists
    if fs::create_dir_all(&config_dir).is_err() {
        return;
    }

    // If root AGENTS.md has real content (not already a stub), migrate it
    if root_agents.exists() {
        let content = fs::read_to_string(&root_agents).unwrap_or_default();
        let is_stub = content.contains("See config/agents.md");

        if !is_stub {
            // Only move content if config/agents.md doesn't exist yet
            let config_needs_write = !config_agents.exists()
                || fs::metadata(&config_agents).map_or(true, |m| m.len() == 0);
            if config_needs_write {
                let _ = fs::write(&config_agents, &content);
                log::info!("Migrated AGENTS.md content to config/agents.md");
            }
            // Replace root with stub
            let _ = fs::write(&root_agents, AGENTS_MD_STUB);
            log::info!("Replaced root AGENTS.md with stub pointing to config/agents.md");
        }
    } else {
        // No root AGENTS.md — write stub for Codex discoverability
        let _ = fs::write(&root_agents, AGENTS_MD_STUB);
    }
}

/// Repair config files: re-create missing `config/agents.md` and `type/config.md`.
/// Called by the "Repair Vault" command. Returns a status message.
pub fn repair_config_files(vault_path: &str) -> Result<String, String> {
    let vault = Path::new(vault_path);

    // Ensure config/ directory
    let config_dir = vault.join("config");
    fs::create_dir_all(&config_dir)
        .map_err(|e| format!("Failed to create config directory: {e}"))?;

    let agents_path = config_dir.join("agents.md");
    let root_agents = vault.join("AGENTS.md");

    // Step 1: Migrate root AGENTS.md content → config/agents.md if needed
    if root_agents.exists() {
        let root_content = fs::read_to_string(&root_agents).unwrap_or_default();
        let is_stub = root_content.contains("See config/agents.md");
        if !is_stub && !root_content.is_empty() {
            let config_needs_write = !agents_path.exists()
                || fs::metadata(&agents_path).map_or(true, |m| m.len() == 0);
            if config_needs_write {
                fs::write(&agents_path, &root_content)
                    .map_err(|e| format!("Failed to migrate AGENTS.md: {e}"))?;
            }
            fs::write(&root_agents, AGENTS_MD_STUB)
                .map_err(|e| format!("Failed to write AGENTS.md stub: {e}"))?;
        }
    }

    // Step 2: Seed config/agents.md with defaults if still missing or empty
    let needs_write =
        !agents_path.exists() || fs::metadata(&agents_path).map_or(true, |m| m.len() == 0);
    if needs_write {
        fs::write(&agents_path, AGENTS_MD)
            .map_err(|e| format!("Failed to write config/agents.md: {e}"))?;
    }

    // Step 3: Ensure type/config.md
    let type_dir = vault.join("type");
    fs::create_dir_all(&type_dir)
        .map_err(|e| format!("Failed to create type directory: {e}"))?;
    let config_type_path = type_dir.join("config.md");
    let type_needs_write = !config_type_path.exists()
        || fs::metadata(&config_type_path).map_or(true, |m| m.len() == 0);
    if type_needs_write {
        fs::write(&config_type_path, CONFIG_TYPE_DEFINITION)
            .map_err(|e| format!("Failed to write type/config.md: {e}"))?;
    }

    // Step 4: Ensure root AGENTS.md stub exists
    let stub_needs_write = !root_agents.exists()
        || fs::read_to_string(&root_agents)
            .map_or(true, |c| !c.contains("See config/agents.md"));
    if stub_needs_write {
        fs::write(&root_agents, AGENTS_MD_STUB)
            .map_err(|e| format!("Failed to write AGENTS.md stub: {e}"))?;
    }

    Ok("Config files repaired".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_seed_config_files_creates_dir_and_agents() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();

        seed_config_files(vault.to_str().unwrap());

        assert!(vault.join("config").is_dir());
        assert!(vault.join("config/agents.md").exists());
        let content = fs::read_to_string(vault.join("config/agents.md")).unwrap();
        assert!(content.contains("Vault Instructions for AI Agents"));
    }

    #[test]
    fn test_seed_config_files_creates_type_definition() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();

        seed_config_files(vault.to_str().unwrap());

        assert!(vault.join("type/config.md").exists());
        let content = fs::read_to_string(vault.join("type/config.md")).unwrap();
        assert!(content.contains("Is A: Type"));
        assert!(content.contains("icon: gear-six"));
    }

    #[test]
    fn test_seed_config_files_is_idempotent() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();

        seed_config_files(vault.to_str().unwrap());
        // Customize the file
        let custom = "---\nIs A: Config\n---\n# Custom Agents\nMy custom instructions\n";
        fs::write(vault.join("config/agents.md"), custom).unwrap();

        seed_config_files(vault.to_str().unwrap());
        let content = fs::read_to_string(vault.join("config/agents.md")).unwrap();
        assert!(
            content.contains("Custom Agents"),
            "must preserve existing content"
        );
    }

    #[test]
    fn test_seed_config_files_reseeds_empty() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        let config_dir = vault.join("config");
        fs::create_dir_all(&config_dir).unwrap();
        fs::write(config_dir.join("agents.md"), "").unwrap();

        seed_config_files(vault.to_str().unwrap());
        let content = fs::read_to_string(config_dir.join("agents.md")).unwrap();
        assert!(content.contains("Vault Instructions for AI Agents"));
    }

    #[test]
    fn test_migrate_agents_md_moves_content() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();
        fs::write(vault.join("AGENTS.md"), AGENTS_MD).unwrap();

        migrate_agents_md(vault.to_str().unwrap());

        // config/agents.md should have the original content
        let config_content = fs::read_to_string(vault.join("config/agents.md")).unwrap();
        assert!(config_content.contains("Vault Instructions for AI Agents"));

        // Root AGENTS.md should be a stub
        let root_content = fs::read_to_string(vault.join("AGENTS.md")).unwrap();
        assert!(root_content.contains("See config/agents.md"));
        assert!(!root_content.contains("## Structure"));
    }

    #[test]
    fn test_migrate_agents_md_preserves_existing_config() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        let config_dir = vault.join("config");
        fs::create_dir_all(&config_dir).unwrap();
        let custom = "# Custom agent instructions\n";
        fs::write(config_dir.join("agents.md"), custom).unwrap();
        fs::write(vault.join("AGENTS.md"), AGENTS_MD).unwrap();

        migrate_agents_md(vault.to_str().unwrap());

        // config/agents.md should preserve custom content
        let content = fs::read_to_string(config_dir.join("agents.md")).unwrap();
        assert!(content.contains("Custom agent instructions"));

        // Root should be a stub
        let root = fs::read_to_string(vault.join("AGENTS.md")).unwrap();
        assert!(root.contains("See config/agents.md"));
    }

    #[test]
    fn test_migrate_agents_md_idempotent_on_stub() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();
        fs::write(vault.join("AGENTS.md"), AGENTS_MD_STUB).unwrap();

        migrate_agents_md(vault.to_str().unwrap());

        // Stub should remain unchanged
        let root = fs::read_to_string(vault.join("AGENTS.md")).unwrap();
        assert!(root.contains("See config/agents.md"));
    }

    #[test]
    fn test_migrate_agents_md_writes_stub_when_no_root() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();

        migrate_agents_md(vault.to_str().unwrap());

        assert!(vault.join("AGENTS.md").exists());
        let root = fs::read_to_string(vault.join("AGENTS.md")).unwrap();
        assert!(root.contains("See config/agents.md"));
    }

    #[test]
    fn test_repair_config_files_creates_all() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();

        let msg = repair_config_files(vault.to_str().unwrap()).unwrap();
        assert_eq!(msg, "Config files repaired");

        assert!(vault.join("config/agents.md").exists());
        assert!(vault.join("type/config.md").exists());
        assert!(vault.join("AGENTS.md").exists());

        let agents = fs::read_to_string(vault.join("config/agents.md")).unwrap();
        assert!(agents.contains("Vault Instructions for AI Agents"));

        let stub = fs::read_to_string(vault.join("AGENTS.md")).unwrap();
        assert!(stub.contains("See config/agents.md"));
    }

    #[test]
    fn test_repair_config_files_preserves_custom_content() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        let config_dir = vault.join("config");
        fs::create_dir_all(&config_dir).unwrap();
        let custom = "# My custom agent config\nDo not overwrite me\n";
        fs::write(config_dir.join("agents.md"), custom).unwrap();
        fs::write(
            vault.join("AGENTS.md"),
            "# Agent Instructions\nSee config/agents.md for vault instructions.\n",
        )
        .unwrap();

        repair_config_files(vault.to_str().unwrap()).unwrap();

        let content = fs::read_to_string(config_dir.join("agents.md")).unwrap();
        assert!(
            content.contains("My custom agent config"),
            "must preserve existing content"
        );
    }

    #[test]
    fn test_repair_config_files_migrates_root_agents() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();
        let original = "# My vault agents instructions\nCustom content here\n";
        fs::write(vault.join("AGENTS.md"), original).unwrap();

        repair_config_files(vault.to_str().unwrap()).unwrap();

        // Root should be a stub
        let root = fs::read_to_string(vault.join("AGENTS.md")).unwrap();
        assert!(root.contains("See config/agents.md"));

        // config/agents.md should have the original content
        let config = fs::read_to_string(vault.join("config/agents.md")).unwrap();
        assert!(config.contains("My vault agents instructions"));
    }
}
