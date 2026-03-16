mod cache;
mod config_seed;
mod entry;
mod file;
mod frontmatter;
mod getting_started;
mod image;
mod migration;
mod parsing;
mod rename;
mod trash;

pub use cache::{invalidate_cache, scan_vault_cached};
pub use config_seed::{migrate_agents_md, repair_config_files, seed_config_files};
pub use entry::VaultEntry;
pub use file::{get_note_content, save_note_content};
pub use getting_started::{create_getting_started_vault, default_vault_path, vault_exists};
pub use image::{copy_image_to_vault, save_image};
pub use migration::{flatten_vault, migrate_is_a_to_type, vault_health_check, VaultHealthReport};
pub use rename::{rename_note, RenameResult};
pub use trash::{batch_delete_notes, delete_note, empty_trash, is_file_trashed, purge_trash};

use frontmatter::{extract_fm_and_rels, parse_created_at, resolve_is_a};
use parsing::{count_body_words, extract_outgoing_links, extract_snippet, extract_title};

use gray_matter::engine::YAML;
use gray_matter::Matter;
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

/// Parse a single markdown file into a VaultEntry.
pub fn parse_md_file(path: &Path) -> Result<VaultEntry, String> {
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;
    let filename = path
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_default();

    let matter = Matter::<YAML>::new();
    let parsed = matter.parse(&content);
    let (frontmatter, mut relationships, properties) = extract_fm_and_rels(parsed.data);

    let title = extract_title(&parsed.content, &filename);
    let snippet = extract_snippet(&content);
    let word_count = count_body_words(&content);
    let outgoing_links = extract_outgoing_links(&parsed.content);
    let (modified_at, file_size) = file::read_file_metadata(path)?;
    let created_at = parse_created_at(&frontmatter);
    let is_a = resolve_is_a(frontmatter.is_a);

    // Add "Type" relationship: isA becomes a navigable link to the type document.
    // Skip for type documents themselves (isA == "Type") to avoid self-referential links.
    if let Some(ref type_name) = is_a {
        if type_name != "Type" {
            // If isA is already a wikilink (e.g. "[[project]]"), use it directly
            let type_link = if type_name.starts_with("[[") && type_name.ends_with("]]") {
                type_name.clone()
            } else {
                format!("[[{}]]", type_name.to_lowercase())
            };
            relationships.insert("Type".to_string(), vec![type_link]);
        }
    }

    Ok(VaultEntry {
        path: path.to_string_lossy().to_string(),
        filename,
        title,
        is_a,
        snippet,
        relationships,
        aliases: frontmatter
            .aliases
            .map(|a| a.into_vec())
            .unwrap_or_default(),
        belongs_to: frontmatter
            .belongs_to
            .map(|b| b.into_vec())
            .unwrap_or_default(),
        related_to: frontmatter
            .related_to
            .map(|r| r.into_vec())
            .unwrap_or_default(),
        status: frontmatter.status,
        owner: frontmatter
            .owner
            .and_then(|o| o.into_vec().into_iter().next()),
        cadence: frontmatter
            .cadence
            .and_then(|c| c.into_vec().into_iter().next()),
        archived: frontmatter.archived.unwrap_or(false),
        trashed: frontmatter.trashed.unwrap_or(false),
        trashed_at: frontmatter
            .trashed_at
            .as_deref()
            .and_then(parsing::parse_iso_date),
        modified_at,
        created_at,
        file_size,
        icon: frontmatter.icon,
        color: frontmatter.color,
        order: frontmatter.order,
        sidebar_label: frontmatter.sidebar_label,
        template: frontmatter.template,
        sort: frontmatter.sort,
        view: frontmatter.view,
        visible: frontmatter.visible,
        word_count,
        outgoing_links,
        properties,
    })
}

/// Re-read a single file from disk and return a fresh VaultEntry.
/// Used after failed optimistic updates to restore the true filesystem state.
pub fn reload_entry(path: &Path) -> Result<VaultEntry, String> {
    if !path.exists() {
        return Err(format!("File does not exist: {}", path.display()));
    }
    parse_md_file(path)
}

/// Folders that are scanned recursively (themes, attachments, assets).
/// All other subfolders are ignored — notes and type definitions live flat at the vault root.
const PROTECTED_FOLDERS: &[&str] = &["attachments", "_themes", "assets"];

/// Scan a directory recursively for .md files and return VaultEntry for each.
pub fn scan_vault(vault_path: &Path) -> Result<Vec<VaultEntry>, String> {
    if !vault_path.exists() {
        return Err(format!(
            "Vault path does not exist: {}",
            vault_path.display()
        ));
    }
    if !vault_path.is_dir() {
        return Err(format!(
            "Vault path is not a directory: {}",
            vault_path.display()
        ));
    }

    let mut entries = Vec::new();

    // 1. Scan root-level .md files (non-recursive)
    if let Ok(dir_entries) = fs::read_dir(vault_path) {
        for dir_entry in dir_entries.flatten() {
            let path = dir_entry.path();
            if path.is_file() && path.extension().is_some_and(|ext| ext == "md") {
                match parse_md_file(&path) {
                    Ok(vault_entry) => entries.push(vault_entry),
                    Err(e) => log::warn!("Skipping file: {}", e),
                }
            }
        }
    }

    // 2. Scan protected folders recursively
    for folder in PROTECTED_FOLDERS {
        let folder_path = vault_path.join(folder);
        if !folder_path.is_dir() {
            continue;
        }
        for entry in WalkDir::new(&folder_path)
            .follow_links(true)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let entry_path = entry.path();
            if entry_path.is_file() && entry_path.extension().is_some_and(|ext| ext == "md") {
                match parse_md_file(entry_path) {
                    Ok(vault_entry) => entries.push(vault_entry),
                    Err(e) => log::warn!("Skipping file: {}", e),
                }
            }
        }
    }

    // Sort by modified date descending (newest first)
    entries.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));

    Ok(entries)
}

#[cfg(test)]
#[path = "mod_tests.rs"]
mod tests;
