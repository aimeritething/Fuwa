use regex::{Captures, Regex};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::{DirEntry, WalkDir};

use super::filename_rules::validate_filename_stem;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AttachmentRenameResult {
    pub new_path: String,
    pub new_name: String,
    pub updated_files: usize,
    pub failed_updates: usize,
}

pub struct AttachmentRenameRequest<'a> {
    pub requested_name: &'a str,
    pub source_path: &'a str,
    pub vault_path: &'a str,
}

struct ReferenceRewrite<'a> {
    new_name: &'a str,
    new_path: &'a str,
    old_name: &'a str,
    old_path: &'a str,
}

struct NameRequest<'a> {
    extension: &'a str,
    requested: &'a str,
}

struct LinkTargetRewrite<'a> {
    new_target: &'a str,
    old_target: &'a str,
}

struct AttachmentRenamePlan {
    destination: PathBuf,
    new_name: String,
    new_vault_path: String,
    old_name: String,
    old_vault_path: String,
    source: PathBuf,
    vault: PathBuf,
}

fn requested_stem(request: &NameRequest<'_>) -> String {
    let trimmed = request.requested.trim();
    let suffix_length = request.extension.len() + 1;
    if trimmed.len() > suffix_length
        && trimmed[trimmed.len() - suffix_length..]
            .eq_ignore_ascii_case(&format!(".{}", request.extension))
    {
        return trimmed[..trimmed.len() - suffix_length].to_string();
    }
    trimmed
        .rsplit_once('.')
        .map_or(trimmed, |(stem, _)| stem)
        .to_string()
}

fn portable_stem(request: &NameRequest<'_>) -> Result<String, String> {
    let normalized = requested_stem(request)
        .chars()
        .map(|character| {
            if character.is_control()
                || matches!(
                    character,
                    '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'
                )
            {
                '_'
            } else {
                character
            }
        })
        .collect::<String>();
    let normalized = normalized.trim().trim_end_matches(['.', ' ']);
    let candidate = if normalized.is_empty() {
        "image"
    } else {
        normalized
    };
    let portable = if validate_filename_stem(candidate).is_ok() {
        candidate.to_string()
    } else {
        format!("_{candidate}")
    };
    validate_filename_stem(&portable)?;
    Ok(portable)
}

fn canonical_paths(vault: &Path, source: &Path) -> Result<(PathBuf, PathBuf), String> {
    let vault = vault
        .canonicalize()
        .map_err(|error| format!("Failed to resolve vault path: {error}"))?;
    let attachments = vault
        .join("attachments")
        .canonicalize()
        .map_err(|error| format!("Failed to resolve attachments folder: {error}"))?;
    let source = source
        .canonicalize()
        .map_err(|error| format!("Failed to resolve attachment: {error}"))?;
    if !source.is_file() || !source.starts_with(attachments) {
        return Err("Attachment path must stay inside the vault attachments folder".to_string());
    }
    Ok((vault, source))
}

fn available_destination(source: &Path, stem: &str, extension: &str) -> Result<PathBuf, String> {
    let parent = source.parent().ok_or("Attachment has no parent folder")?;
    let desired = parent.join(format!("{stem}.{extension}"));
    if desired == source || !desired.exists() {
        return Ok(desired);
    }
    (2..=10_000)
        .map(|suffix| parent.join(format!("{stem}-{suffix}.{extension}")))
        .find(|candidate| !candidate.exists())
        .ok_or_else(|| "Could not find an available attachment filename".to_string())
}

fn portable_vault_path(vault: &Path, path: &Path) -> Result<String, String> {
    path.strip_prefix(vault)
        .map_err(|_| "Attachment path must stay inside the vault".to_string())
        .map(|relative| {
            relative
                .components()
                .map(|component| component.as_os_str().to_string_lossy())
                .collect::<Vec<_>>()
                .join("/")
        })
}

fn markdown_destination(rewrite: &ReferenceRewrite<'_>) -> String {
    if needs_markdown_delimiters(rewrite) {
        format!("<{}>", rewrite.new_path.replace('>', "%3E"))
    } else {
        rewrite.new_path.to_string()
    }
}

fn needs_markdown_delimiters(rewrite: &ReferenceRewrite<'_>) -> bool {
    if rewrite.new_path.chars().any(char::is_whitespace) {
        return true;
    }
    if rewrite.new_path.contains('<') {
        return true;
    }
    rewrite.new_path.contains('>')
}

fn replace_markdown_destinations(content: &str, rewrite: &ReferenceRewrite<'_>) -> String {
    let pattern = format!(
        "(?P<prefix>\\]\\()<?{}>?(?P<suffix>[ \\t]*(?:\"(?:\\\\\\\\.|[^\"\\n])*\")?[ \\t]*\\))",
        regex::escape(rewrite.old_path),
    );
    let Ok(regex) = Regex::new(&pattern) else {
        return content.to_string();
    };
    let destination = markdown_destination(rewrite);
    regex
        .replace_all(content, |captures: &Captures| {
            format!(
                "{}{}{}",
                &captures["prefix"], destination, &captures["suffix"]
            )
        })
        .into_owned()
}

fn replace_wikilink_target(content: &str, rewrite: &LinkTargetRewrite<'_>) -> String {
    let pattern = format!(
        r"!\[\[{}(?P<display>\|[^\]\n]*)?\]\]",
        regex::escape(rewrite.old_target),
    );
    let Ok(regex) = Regex::new(&pattern) else {
        return content.to_string();
    };
    regex
        .replace_all(content, |captures: &Captures| {
            let display = captures.name("display").map_or("", |value| value.as_str());
            format!("![[{}{display}]]", rewrite.new_target)
        })
        .into_owned()
}

fn rewrite_references(content: &str, rewrite: &ReferenceRewrite<'_>) -> String {
    let destinations = replace_markdown_destinations(content, rewrite);
    let default_alt = destinations.replace(
        &format!("![{}](", rewrite.old_name),
        &format!("![{}](", rewrite.new_name),
    );
    let path_wikilinks = replace_wikilink_target(
        &default_alt,
        &LinkTargetRewrite {
            new_target: rewrite.new_path,
            old_target: rewrite.old_path,
        },
    );
    replace_wikilink_target(
        &path_wikilinks,
        &LinkTargetRewrite {
            new_target: rewrite.new_name,
            old_target: rewrite.old_name,
        },
    )
}

fn visible_entry(entry: &DirEntry) -> bool {
    entry.depth() == 0
        || !entry.file_type().is_dir()
        || !entry.file_name().to_string_lossy().starts_with('.')
}

fn markdown_files(vault: &Path) -> impl Iterator<Item = PathBuf> {
    WalkDir::new(vault)
        .follow_links(false)
        .into_iter()
        .filter_entry(visible_entry)
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_file())
        .filter(|entry| {
            entry
                .path()
                .extension()
                .is_some_and(|extension| extension == "md")
        })
        .map(|entry| entry.into_path())
}

fn update_references(vault: &Path, rewrite: &ReferenceRewrite<'_>) -> (usize, usize) {
    let mut updated = 0;
    let mut failed = 0;
    for path in markdown_files(vault) {
        let Ok(content) = fs::read_to_string(&path) else {
            failed += 1;
            continue;
        };
        let rewritten = rewrite_references(&content, rewrite);
        if rewritten != content {
            match fs::write(path, rewritten) {
                Ok(()) => updated += 1,
                Err(_) => failed += 1,
            }
        }
    }
    (updated, failed)
}

fn attachment_extension(source: &Path) -> Result<&str, String> {
    source
        .extension()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "Attachment must have a file extension".to_string())
}

fn attachment_name(path: &Path) -> Result<&str, String> {
    path.file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "Invalid attachment filename".to_string())
}

fn resolve_destination(
    request: &AttachmentRenameRequest<'_>,
) -> Result<(PathBuf, PathBuf, PathBuf), String> {
    let (vault, source) = canonical_paths(
        Path::new(request.vault_path),
        Path::new(request.source_path),
    )?;
    let extension = attachment_extension(&source)?;
    let stem = portable_stem(&NameRequest {
        extension,
        requested: request.requested_name,
    })?;
    let destination = available_destination(&source, &stem, extension)?;
    Ok((vault, source, destination))
}

fn build_rename_plan(
    request: &AttachmentRenameRequest<'_>,
) -> Result<AttachmentRenamePlan, String> {
    let (vault, source, destination) = resolve_destination(request)?;
    let old_name = attachment_name(&source)?.to_string();
    let new_name = attachment_name(&destination)?.to_string();
    let old_vault_path = portable_vault_path(&vault, &source)?;
    let new_vault_path = portable_vault_path(&vault, &destination)?;
    Ok(AttachmentRenamePlan {
        destination,
        new_name,
        new_vault_path,
        old_name,
        old_vault_path,
        source,
        vault,
    })
}

pub fn rename_attachment(
    request: AttachmentRenameRequest<'_>,
) -> Result<AttachmentRenameResult, String> {
    let plan = build_rename_plan(&request)?;
    if plan.destination == plan.source {
        return Ok(AttachmentRenameResult {
            new_path: plan.source.to_string_lossy().into_owned(),
            new_name: plan.new_name,
            updated_files: 0,
            failed_updates: 0,
        });
    }
    fs::rename(&plan.source, &plan.destination)
        .map_err(|error| format!("Failed to rename attachment: {error}"))?;
    let rewrite = ReferenceRewrite {
        new_name: &plan.new_name,
        new_path: &plan.new_vault_path,
        old_name: &plan.old_name,
        old_path: &plan.old_vault_path,
    };
    let (updated_files, failed_updates) = update_references(&plan.vault, &rewrite);
    Ok(AttachmentRenameResult {
        new_path: plan.destination.to_string_lossy().into_owned(),
        new_name: plan.new_name,
        updated_files,
        failed_updates,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn attachment_fixture(name: &str) -> (TempDir, PathBuf) {
        let dir = TempDir::new().unwrap();
        let attachments = dir.path().join("attachments");
        fs::create_dir_all(&attachments).unwrap();
        let source = attachments.join(name);
        fs::write(&source, b"image data").unwrap();
        (dir, source)
    }

    #[test]
    fn moves_file_and_updates_shared_references() {
        let (dir, source) = attachment_fixture("171-photo.png");
        fs::write(
            dir.path().join("first.md"),
            "![171-photo.png](attachments/171-photo.png)\n",
        )
        .unwrap();
        fs::write(
            dir.path().join("second.md"),
            "![[attachments/171-photo.png]]\n",
        )
        .unwrap();

        let result = rename_attachment(AttachmentRenameRequest {
            requested_name: "旅行.png",
            source_path: source.to_str().unwrap(),
            vault_path: dir.path().to_str().unwrap(),
        })
        .unwrap();

        assert_eq!(result.new_name, "旅行.png");
        assert_eq!((result.updated_files, result.failed_updates), (2, 0));
        assert!(!source.exists());
        assert_eq!(
            fs::read(dir.path().join("attachments/旅行.png")).unwrap(),
            b"image data"
        );
        assert_eq!(
            fs::read_to_string(dir.path().join("first.md")).unwrap(),
            "![旅行.png](attachments/旅行.png)\n"
        );
        assert_eq!(
            fs::read_to_string(dir.path().join("second.md")).unwrap(),
            "![[attachments/旅行.png]]\n"
        );
    }

    #[test]
    fn normalizes_windows_invalid_characters_and_preserves_unicode() {
        let (dir, source) = attachment_fixture("photo.PNG");

        let result = rename_attachment(AttachmentRenameRequest {
            requested_name: "旅行?.png",
            source_path: source.to_str().unwrap(),
            vault_path: dir.path().to_str().unwrap(),
        })
        .unwrap();

        assert_eq!(result.new_name, "旅行_.PNG");
        assert!(dir.path().join("attachments/旅行_.PNG").exists());
    }

    #[test]
    fn prefixes_windows_reserved_names_and_avoids_collisions() {
        let (dir, source) = attachment_fixture("photo.PNG");
        fs::write(dir.path().join("attachments/_CON.PNG"), b"existing").unwrap();

        let result = rename_attachment(AttachmentRenameRequest {
            requested_name: "CON.png",
            source_path: source.to_str().unwrap(),
            vault_path: dir.path().to_str().unwrap(),
        })
        .unwrap();

        assert_eq!(result.new_name, "_CON-2.PNG");
        assert!(dir.path().join("attachments/_CON-2.PNG").exists());
    }

    #[test]
    fn rejects_files_outside_the_attachment_folder() {
        let (dir, _) = attachment_fixture("inside.png");
        let outside = dir.path().join("outside.png");
        fs::write(&outside, b"outside").unwrap();

        let error = rename_attachment(AttachmentRenameRequest {
            requested_name: "renamed.png",
            source_path: outside.to_str().unwrap(),
            vault_path: dir.path().to_str().unwrap(),
        })
        .unwrap_err();

        assert!(error.contains("inside the vault attachments folder"));
    }
}
