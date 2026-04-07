use std::path::Path;
use std::process::Command;

/// Clones a GitHub repo to a local path using HTTPS + token auth.
pub fn clone_repo(url: &str, token: &str, local_path: &str) -> Result<String, String> {
    let dest = Path::new(local_path);
    prepare_clone_destination(dest, local_path)?;

    // Inject token into HTTPS URL: https://github.com/... → https://oauth2:TOKEN@github.com/...
    let auth_url = inject_token_into_url(url, token)?;

    if let Err(err) = run_clone(&auth_url, local_path) {
        cleanup_failed_clone(dest);
        return Err(err);
    }

    // Configure the remote to use token auth for future pushes
    if let Err(err) = configure_remote_auth(local_path, url, token) {
        cleanup_failed_clone(dest);
        return Err(err);
    }

    // Ensure sensible .gitignore defaults (especially .DS_Store on macOS)
    crate::git::ensure_gitignore(local_path)?;

    Ok(format!("Cloned to {}", local_path))
}

/// Clones a public repo to a local path without modifying the remote URL.
pub fn clone_public_repo(url: &str, local_path: &str) -> Result<String, String> {
    let dest = Path::new(local_path);
    prepare_clone_destination(dest, local_path)?;

    if let Err(err) = run_clone(url, local_path) {
        cleanup_failed_clone(dest);
        return Err(err);
    }

    Ok(format!("Cloned to {}", local_path))
}

/// Injects an OAuth token into an HTTPS GitHub URL.
fn inject_token_into_url(url: &str, token: &str) -> Result<String, String> {
    if let Some(rest) = url.strip_prefix("https://github.com/") {
        Ok(format!("https://oauth2:{}@github.com/{}", token, rest))
    } else if let Some(rest) = url.strip_prefix("https://") {
        // Handle URLs that already have a host
        Ok(format!("https://oauth2:{}@{}", token, rest))
    } else {
        Err(format!(
            "Unsupported URL format: {}. Use an HTTPS URL.",
            url
        ))
    }
}

fn prepare_clone_destination(dest: &Path, local_path: &str) -> Result<(), String> {
    if dest.exists() {
        if !dest.is_dir() {
            return Err(format!(
                "Destination '{}' already exists and is not a directory",
                local_path
            ));
        }
        let has_entries = dest
            .read_dir()
            .map_err(|e| format!("Failed to inspect destination '{}': {}", local_path, e))?
            .next()
            .is_some();
        if has_entries {
            return Err(format!(
                "Destination '{}' already exists and is not empty",
                local_path
            ));
        }
        return Ok(());
    }

    if let Some(parent) = dest.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent).map_err(|e| {
                format!(
                    "Failed to create parent directory for '{}': {}",
                    local_path, e
                )
            })?;
        }
    }

    Ok(())
}

fn run_clone(url: &str, local_path: &str) -> Result<(), String> {
    let output = Command::new("git")
        .args(["clone", "--progress", url, local_path])
        .output()
        .map_err(|e| format!("Failed to run git clone: {}", e))?;

    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    Err(format!("git clone failed: {}", stderr.trim()))
}

fn cleanup_failed_clone(dest: &Path) {
    if dest.exists() && dest.is_dir() {
        let _ = std::fs::remove_dir_all(dest);
    }
}

/// Sets up the git remote to use token-based HTTPS auth.
fn configure_remote_auth(local_path: &str, original_url: &str, token: &str) -> Result<(), String> {
    let auth_url = inject_token_into_url(original_url, token)?;
    let vault = Path::new(local_path);

    let output = Command::new("git")
        .args(["remote", "set-url", "origin", &auth_url])
        .current_dir(vault)
        .output()
        .map_err(|e| format!("Failed to configure remote: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to set remote URL: {}", stderr));
    }

    // Also configure git user if not set
    let _ = Command::new("git")
        .args(["config", "user.email", "laputa@app.local"])
        .current_dir(vault)
        .output();
    let _ = Command::new("git")
        .args(["config", "user.name", "Laputa App"])
        .current_dir(vault)
        .output();

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command as StdCommand;

    fn clone_err_contains(url: &str, expected: &str) {
        let dir = tempfile::TempDir::new().unwrap();
        let dest = dir.path().join("dest");
        let result = clone_repo(url, "token", dest.to_str().unwrap());
        assert!(result.unwrap_err().contains(expected));
    }

    #[test]
    fn test_inject_token_basic_github_url() {
        let result = inject_token_into_url("https://github.com/user/repo.git", "gho_abc123");
        assert_eq!(
            result.unwrap(),
            "https://oauth2:gho_abc123@github.com/user/repo.git"
        );
    }

    #[test]
    fn test_inject_token_generic_https_url() {
        let result = inject_token_into_url("https://gitlab.com/user/repo.git", "glpat-abc");
        assert_eq!(
            result.unwrap(),
            "https://oauth2:glpat-abc@gitlab.com/user/repo.git"
        );
    }

    #[test]
    fn test_inject_token_ssh_url_rejected() {
        let err = inject_token_into_url("git@github.com:user/repo.git", "token").unwrap_err();
        assert!(err.contains("Unsupported URL format"));
    }

    #[test]
    fn test_inject_token_http_url_rejected() {
        assert!(inject_token_into_url("http://github.com/user/repo.git", "token").is_err());
    }

    #[test]
    fn test_inject_token_github_without_dot_git() {
        let result = inject_token_into_url("https://github.com/user/repo", "tok");
        assert_eq!(result.unwrap(), "https://oauth2:tok@github.com/user/repo");
    }

    #[test]
    fn test_clone_repo_nonempty_dest() {
        let dir = tempfile::TempDir::new().unwrap();
        std::fs::write(dir.path().join("existing.txt"), "data").unwrap();

        let result = clone_repo(
            "https://github.com/test/repo.git",
            "token",
            dir.path().to_str().unwrap(),
        );
        assert!(result.unwrap_err().contains("not empty"));
    }

    #[test]
    fn test_clone_repo_ssh_url_rejected() {
        clone_err_contains("git@github.com:user/repo.git", "Unsupported URL format");
    }

    #[test]
    fn test_clone_repo_empty_dest_allowed() {
        let dir = tempfile::TempDir::new().unwrap();
        let dest = dir.path().join("empty-dir");
        std::fs::create_dir(&dest).unwrap();

        let result = clone_repo(
            "https://github.com/nonexistent/repo.git",
            "token",
            dest.to_str().unwrap(),
        );
        // Should fail at git clone, not at directory check
        assert!(result.unwrap_err().contains("git clone failed"));
    }

    #[test]
    fn test_configure_remote_auth_on_git_repo() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path();

        StdCommand::new("git")
            .args(["init"])
            .current_dir(path)
            .output()
            .unwrap();
        StdCommand::new("git")
            .args([
                "remote",
                "add",
                "origin",
                "https://github.com/user/repo.git",
            ])
            .current_dir(path)
            .output()
            .unwrap();

        configure_remote_auth(
            path.to_str().unwrap(),
            "https://github.com/user/repo.git",
            "gho_test123",
        )
        .unwrap();

        let output = StdCommand::new("git")
            .args(["remote", "get-url", "origin"])
            .current_dir(path)
            .output()
            .unwrap();
        let url = String::from_utf8_lossy(&output.stdout).trim().to_string();
        assert_eq!(url, "https://oauth2:gho_test123@github.com/user/repo.git");
    }

    fn init_local_repo(path: &Path) {
        std::fs::create_dir_all(path).unwrap();
        std::fs::write(path.join("welcome.md"), "# Welcome\n").unwrap();

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
            .args(["commit", "-m", "Initial vault"])
            .current_dir(path)
            .output()
            .unwrap();
    }

    #[test]
    fn test_clone_public_repo_clones_local_repo() {
        let dir = tempfile::TempDir::new().unwrap();
        let source = dir.path().join("source");
        let dest = dir.path().join("dest");
        init_local_repo(&source);

        let result = clone_public_repo(source.to_str().unwrap(), dest.to_str().unwrap());

        assert_eq!(
            result.unwrap(),
            format!("Cloned to {}", dest.to_string_lossy())
        );
        assert!(dest.join("welcome.md").exists());

        let status = StdCommand::new("git")
            .args(["status", "--porcelain"])
            .current_dir(&dest)
            .output()
            .unwrap();
        assert!(String::from_utf8_lossy(&status.stdout).trim().is_empty());
    }

    #[test]
    fn test_clone_public_repo_cleans_failed_clone_destination() {
        let dir = tempfile::TempDir::new().unwrap();
        let dest = dir.path().join("dest");
        let missing = dir.path().join("missing-repo");

        let result = clone_public_repo(missing.to_str().unwrap(), dest.to_str().unwrap());

        assert!(result.unwrap_err().contains("git clone failed"));
        assert!(!dest.exists());
    }
}
