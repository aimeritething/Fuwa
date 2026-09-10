use std::path::Path;

type PathText = str;
type RelativePathText = str;

fn normalize_tmp_alias(path: &PathText) -> String {
    if path == "/private/tmp" {
        return "/tmp".to_string();
    }
    if let Some(rest) = path.strip_prefix("/private/tmp/") {
        return format!("/tmp/{rest}");
    }
    path.to_string()
}

fn trim_trailing_slashes(path: String) -> String {
    let trimmed = path.trim_end_matches('/');
    if trimmed.is_empty() && path.starts_with('/') {
        "/".to_string()
    } else {
        trimmed.to_string()
    }
}

pub(crate) fn normalize_path_for_identity(path: &PathText) -> String {
    trim_trailing_slashes(normalize_tmp_alias(&path.replace('\\', "/")))
}

fn normalize_relative_path(path: &RelativePathText) -> String {
    path.replace('\\', "/").trim_matches('/').to_string()
}

pub(crate) fn vault_relative_path_string(vault: &Path, file: &Path) -> Result<String, String> {
    let vault_path = normalize_path_for_identity(&vault.to_string_lossy());
    let file_path = normalize_path_for_identity(&file.to_string_lossy());
    if file_path == vault_path {
        return Ok(String::new());
    }

    let prefix = format!("{vault_path}/");
    file_path
        .strip_prefix(&prefix)
        .map(normalize_relative_path)
        .ok_or_else(|| {
            format!(
                "File {} is not inside vault {}",
                file.display(),
                vault.display()
            )
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vault_relative_path_string_normalizes_tmp_alias_and_backslashes() {
        assert_eq!(
            vault_relative_path_string(
                Path::new("/private/tmp/tolaria-vault"),
                Path::new("/tmp/tolaria-vault/projects\\active.md"),
            )
            .unwrap(),
            "projects/active.md"
        );
    }
}
