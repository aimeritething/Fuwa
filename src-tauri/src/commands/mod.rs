mod ai;
mod git;
mod system;
mod vault;

use std::borrow::Cow;

pub use ai::*;
pub use git::*;
pub use system::*;
pub use vault::*;

/// Expand a leading `~` or `~/` in a path string to the user's home directory.
/// Returns the original string unchanged if it doesn't start with `~` or if the
/// home directory cannot be determined.
pub fn expand_tilde(path: &str) -> Cow<'_, str> {
    let Some(home) = dirs::home_dir() else {
        return Cow::Borrowed(path);
    };

    match path {
        "~" => Cow::Owned(home.to_string_lossy().into_owned()),
        _ => path
            .strip_prefix("~/")
            .map(|rest| Cow::Owned(home.join(rest).to_string_lossy().into_owned()))
            .unwrap_or(Cow::Borrowed(path)),
    }
}

pub fn parse_build_label(version: &str) -> String {
    let version = version.trim();
    if version.is_empty() {
        return "b?".to_string();
    }

    parse_legacy_build_label(version)
        .or_else(|| parse_semver_build_label(version))
        .unwrap_or_else(|| "b?".to_string())
}

fn is_numeric_version_part(part: &str) -> bool {
    !part.is_empty() && part.chars().all(|ch| ch.is_ascii_digit())
}

fn is_legacy_build_version(minor: &str, patch: &str) -> bool {
    minor.len() >= 6 && is_numeric_version_part(minor) && is_numeric_version_part(patch)
}

fn parse_legacy_build_label(version: &str) -> Option<String> {
    let parts: Vec<&str> = version.split('.').collect();
    match parts.as_slice() {
        [_, minor, patch] if is_legacy_build_version(minor, patch) => {
            Some(format!("b{}", patch))
        }
        _ => None,
    }
}

fn parse_semver_build_label(version: &str) -> Option<String> {
    let semver = version.split_once('+').map_or(version, |(base, _)| base);
    let (core, prerelease) = semver
        .split_once('-')
        .map_or((semver, None), |(base, suffix)| (base, Some(suffix)));
    let parts: Vec<&str> = core.split('.').collect();
    let [major, minor, patch] = parts.as_slice() else {
        return None;
    };
    if ![major, minor, patch]
        .iter()
        .all(|part| is_numeric_version_part(part))
    {
        return None;
    }

    match prerelease {
        Some(suffix) if suffix.starts_with("alpha.") => Some(format!("alpha {}", version)),
        Some(_) => Some(format!("v{}", version)),
        None if version == "0.1.0" || version == "0.0.0" => Some("dev".to_string()),
        None => Some(format!("v{}", version)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn expand_tilde_with_subpath() {
        let home = dirs::home_dir().unwrap();
        let result = expand_tilde("~/Documents/vault");
        assert_eq!(result, format!("{}/Documents/vault", home.display()));
    }

    #[test]
    fn expand_tilde_alone() {
        let home = dirs::home_dir().unwrap();
        let result = expand_tilde("~");
        assert_eq!(result, home.to_string_lossy());
    }

    #[test]
    fn expand_tilde_noop_for_absolute_path() {
        let result = expand_tilde("/usr/local/bin");
        assert_eq!(result, "/usr/local/bin");
    }

    #[test]
    fn expand_tilde_noop_for_relative_path() {
        let result = expand_tilde("some/relative/path");
        assert_eq!(result, "some/relative/path");
    }

    #[test]
    fn expand_tilde_noop_for_tilde_in_middle() {
        let result = expand_tilde("/home/~user/path");
        assert_eq!(result, "/home/~user/path");
    }

    #[test]
    fn parse_build_label_release_version() {
        assert_eq!(parse_build_label("0.20260303.281"), "b281");
        assert_eq!(parse_build_label("0.20251215.42"), "b42");
    }

    #[test]
    fn parse_build_label_semver_releases() {
        assert_eq!(parse_build_label("1.2.3"), "v1.2.3");
        assert_eq!(
            parse_build_label("1.2.4-alpha.202604122135.7"),
            "alpha 1.2.4-alpha.202604122135.7"
        );
        assert_eq!(
            parse_build_label("1.2.4-alpha.202604122135.7+darwin"),
            "alpha 1.2.4-alpha.202604122135.7+darwin"
        );
    }

    #[test]
    fn parse_build_label_dev_version() {
        assert_eq!(parse_build_label("0.1.0"), "dev");
        assert_eq!(parse_build_label("0.0.0"), "dev");
    }

    #[test]
    fn parse_build_label_malformed() {
        assert_eq!(parse_build_label("invalid"), "b?");
        assert_eq!(parse_build_label(""), "b?");
    }
}
