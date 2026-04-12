use std::path::Path;
use std::process::Command;

/// Clone a git repository to a local path using the system git configuration.
pub fn clone_repo(url: &str, local_path: &str) -> Result<String, String> {
    let dest = Path::new(local_path);
    prepare_clone_destination(dest)?;

    if let Err(err) = run_clone(url, dest) {
        cleanup_failed_clone(dest);
        return Err(err);
    }

    Ok(format!("Cloned to {}", dest.display()))
}

fn prepare_clone_destination(dest: &Path) -> Result<(), String> {
    if !dest.exists() {
        return ensure_parent_directory(dest);
    }

    ensure_empty_directory(dest)
}

fn ensure_empty_directory(dest: &Path) -> Result<(), String> {
    if !dest.is_dir() {
        return Err(format!(
            "Destination '{}' already exists and is not a directory",
            dest.display()
        ));
    }

    if directory_has_entries(dest)? {
        return Err(format!(
            "Destination '{}' already exists and is not empty",
            dest.display()
        ));
    }

    Ok(())
}

fn ensure_parent_directory(dest: &Path) -> Result<(), String> {
    let Some(parent) = dest.parent() else {
        return Ok(());
    };

    if parent.as_os_str().is_empty() {
        return Ok(());
    }

    std::fs::create_dir_all(parent).map_err(|e| {
        format!(
            "Failed to create parent directory for '{}': {}",
            dest.display(),
            e
        )
    })
}

fn directory_has_entries(dest: &Path) -> Result<bool, String> {
    dest.read_dir()
        .map_err(|e| format!("Failed to inspect destination '{}': {}", dest.display(), e))
        .map(|mut entries| entries.next().is_some())
}

fn run_clone(url: &str, dest: &Path) -> Result<(), String> {
    let destination = dest
        .to_str()
        .ok_or_else(|| format!("Destination '{}' is not valid UTF-8", dest.display()))?;
    let output = Command::new("git")
        .args(["clone", "--progress", url, destination])
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::Path;
    use std::process::Command as StdCommand;

    fn init_source_repo(path: &Path) {
        fs::create_dir_all(path).unwrap();
        fs::write(path.join("welcome.md"), "# Welcome\n").unwrap();

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
            .args(["commit", "-m", "Initial commit"])
            .current_dir(path)
            .output()
            .unwrap();
    }

    #[test]
    fn test_clone_repo_clones_local_repository() {
        let dir = tempfile::TempDir::new().unwrap();
        let source = dir.path().join("source");
        let dest = dir.path().join("dest");
        init_source_repo(&source);

        let result = clone_repo(source.to_str().unwrap(), dest.to_str().unwrap()).unwrap();

        assert_eq!(result, format!("Cloned to {}", dest.to_string_lossy()));
        assert!(dest.join(".git").exists());
        assert!(dest.join("welcome.md").exists());
    }

    #[test]
    fn test_clone_repo_nonempty_dest() {
        let dir = tempfile::TempDir::new().unwrap();
        fs::write(dir.path().join("existing.txt"), "data").unwrap();

        let result = clone_repo("https://example.com/repo.git", dir.path().to_str().unwrap());
        assert!(result.unwrap_err().contains("not empty"));
    }

    #[test]
    fn test_clone_repo_empty_dest_allowed() {
        let dir = tempfile::TempDir::new().unwrap();
        let dest = dir.path().join("empty-dir");
        fs::create_dir(&dest).unwrap();

        let result = clone_repo(
            "https://example.com/nonexistent/repo.git",
            dest.to_str().unwrap(),
        );
        assert!(result.unwrap_err().contains("git clone failed"));
    }
}
