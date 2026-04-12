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
    let parts: Vec<&str> = version.split('.').collect();
    match parts.as_slice() {
        [_, minor, patch] if minor.len() >= 6 => format!("b{}", patch),
        [_, _, _] => "dev".to_string(),
        _ => "b?".to_string(),
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
