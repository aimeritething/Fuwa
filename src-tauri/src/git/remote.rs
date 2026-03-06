use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

use super::conflict::get_conflict_files;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct GitPullResult {
    pub status: String, // "up_to_date" | "updated" | "conflict" | "no_remote" | "error"
    pub message: String,
    #[serde(rename = "updatedFiles")]
    pub updated_files: Vec<String>,
    #[serde(rename = "conflictFiles")]
    pub conflict_files: Vec<String>,
}

/// Check whether the vault repo has at least one remote configured.
pub fn has_remote(vault_path: &str) -> Result<bool, String> {
    let vault = Path::new(vault_path);
    let output = Command::new("git")
        .args(["remote"])
        .current_dir(vault)
        .output()
        .map_err(|e| format!("Failed to run git remote: {}", e))?;

    Ok(!String::from_utf8_lossy(&output.stdout).trim().is_empty())
}

/// Pull latest changes from remote. Uses --no-rebase to merge.
/// Returns a structured result with status and affected files.
pub fn git_pull(vault_path: &str) -> Result<GitPullResult, String> {
    let vault = Path::new(vault_path);

    if !has_remote(vault_path)? {
        return Ok(GitPullResult {
            status: "no_remote".to_string(),
            message: "No remote configured".to_string(),
            updated_files: vec![],
            conflict_files: vec![],
        });
    }

    let output = Command::new("git")
        .args(["pull", "--no-rebase"])
        .current_dir(vault)
        .output()
        .map_err(|e| format!("Failed to run git pull: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if output.status.success() {
        if stdout.contains("Already up to date") || stdout.contains("Already up-to-date") {
            return Ok(GitPullResult {
                status: "up_to_date".to_string(),
                message: "Already up to date".to_string(),
                updated_files: vec![],
                conflict_files: vec![],
            });
        }
        let updated = parse_updated_files(&stdout);
        return Ok(GitPullResult {
            status: "updated".to_string(),
            message: format!("{} file(s) updated", updated.len()),
            updated_files: updated,
            conflict_files: vec![],
        });
    }

    // Check for merge conflicts
    let conflicts = get_conflict_files(vault_path).unwrap_or_default();
    if !conflicts.is_empty() {
        return Ok(GitPullResult {
            status: "conflict".to_string(),
            message: format!("Merge conflict in {} file(s)", conflicts.len()),
            updated_files: vec![],
            conflict_files: conflicts,
        });
    }

    // Network error or other failure — report as error
    let detail = if stderr.trim().is_empty() {
        stdout.trim().to_string()
    } else {
        stderr.trim().to_string()
    };
    Ok(GitPullResult {
        status: "error".to_string(),
        message: detail,
        updated_files: vec![],
        conflict_files: vec![],
    })
}

/// Parse `git pull` output to extract updated file paths.
fn parse_updated_files(stdout: &str) -> Vec<String> {
    stdout
        .lines()
        .filter_map(|line| {
            let trimmed = line.trim();
            // Lines like " path/to/file.md | 5 ++-" in diffstat
            if trimmed.contains('|') {
                let path = trimmed.split('|').next()?.trim();
                if !path.is_empty() {
                    return Some(path.to_string());
                }
            }
            None
        })
        .collect()
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct GitPushResult {
    pub status: String, // "ok" | "rejected" | "auth_error" | "network_error" | "error"
    pub message: String,
}

/// Classify a git push stderr message into a user-friendly status and message.
pub fn classify_push_error(stderr: &str) -> GitPushResult {
    let lower = stderr.to_lowercase();

    if lower.contains("non-fast-forward")
        || lower.contains("[rejected]")
        || lower.contains("fetch first")
        || lower.contains("failed to push some refs")
            && (lower.contains("updates were rejected") || lower.contains("non-fast-forward"))
    {
        return GitPushResult {
            status: "rejected".to_string(),
            message: "Push rejected: remote has new commits. Pull first, then push.".to_string(),
        };
    }

    if lower.contains("authentication failed")
        || lower.contains("could not read username")
        || lower.contains("permission denied")
        || lower.contains("403")
        || lower.contains("invalid credentials")
    {
        return GitPushResult {
            status: "auth_error".to_string(),
            message: "Push failed: authentication error. Check your credentials.".to_string(),
        };
    }

    if lower.contains("could not resolve host")
        || lower.contains("unable to access")
        || lower.contains("connection refused")
        || lower.contains("network is unreachable")
        || lower.contains("timed out")
    {
        return GitPushResult {
            status: "network_error".to_string(),
            message: "Push failed: network error. Check your connection and try again.".to_string(),
        };
    }

    // Fallback: extract the hint line if present, otherwise use the full stderr
    let hint_line = stderr
        .lines()
        .find(|l| l.trim_start().starts_with("hint:"))
        .map(|l| l.trim_start().strip_prefix("hint:").unwrap_or(l).trim())
        .unwrap_or("")
        .to_string();

    let detail = if hint_line.is_empty() {
        stderr.trim().to_string()
    } else {
        hint_line
    };

    GitPushResult {
        status: "error".to_string(),
        message: format!("Push failed: {detail}"),
    }
}

/// Push to remote.
pub fn git_push(vault_path: &str) -> Result<GitPushResult, String> {
    let vault = Path::new(vault_path);

    let output = Command::new("git")
        .args(["push"])
        .current_dir(vault)
        .output()
        .map_err(|e| format!("Failed to run git push: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Ok(classify_push_error(&stderr));
    }

    Ok(GitPushResult {
        status: "ok".to_string(),
        message: "Pushed to remote".to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::git_commit;
    use crate::git::tests::{setup_git_repo, setup_remote_pair};
    use std::fs;
    use std::process::Command;

    #[test]
    fn test_has_remote_returns_false_for_local_repo() {
        let dir = setup_git_repo();
        let vault = dir.path();
        let vp = vault.to_str().unwrap();

        assert!(!has_remote(vp).unwrap());
    }

    #[test]
    fn test_has_remote_returns_true_when_remote_exists() {
        let dir = setup_git_repo();
        let vault = dir.path();
        let vp = vault.to_str().unwrap();

        Command::new("git")
            .args(["remote", "add", "origin", "https://example.com/repo.git"])
            .current_dir(vault)
            .output()
            .unwrap();

        assert!(has_remote(vp).unwrap());
    }

    #[test]
    fn test_git_pull_no_remote_returns_no_remote() {
        let dir = setup_git_repo();
        let vault = dir.path();
        let vp = vault.to_str().unwrap();

        fs::write(vault.join("note.md"), "# Note\n").unwrap();
        git_commit(vp, "initial").unwrap();

        let result = git_pull(vp).unwrap();
        assert_eq!(result.status, "no_remote");
        assert!(result.updated_files.is_empty());
        assert!(result.conflict_files.is_empty());
    }

    #[test]
    fn test_git_pull_up_to_date() {
        let (_bare, clone_a, _clone_b) = setup_remote_pair();
        let vp_a = clone_a.path().to_str().unwrap();

        fs::write(clone_a.path().join("note.md"), "# Note\n").unwrap();
        git_commit(vp_a, "initial").unwrap();
        git_push(vp_a).unwrap();

        let result = git_pull(vp_a).unwrap();
        assert_eq!(result.status, "up_to_date");
    }

    #[test]
    fn test_git_pull_updated_files() {
        let (_bare, clone_a, clone_b) = setup_remote_pair();
        let vp_a = clone_a.path().to_str().unwrap();
        let vp_b = clone_b.path().to_str().unwrap();

        fs::write(clone_a.path().join("note.md"), "# Note\n").unwrap();
        git_commit(vp_a, "initial").unwrap();
        git_push(vp_a).unwrap();

        git_pull(vp_b).unwrap();

        fs::write(clone_a.path().join("note.md"), "# Updated Note\n").unwrap();
        git_commit(vp_a, "update note").unwrap();
        git_push(vp_a).unwrap();

        let result = git_pull(vp_b).unwrap();
        assert_eq!(result.status, "updated");
        assert!(result.conflict_files.is_empty());
    }

    #[test]
    fn test_parse_updated_files_diffstat() {
        let stdout =
            " Fast-forward\n note.md | 2 +-\n project/plan.md | 4 ++--\n 2 files changed\n";
        let files = parse_updated_files(stdout);
        assert_eq!(files, vec!["note.md", "project/plan.md"]);
    }

    #[test]
    fn test_parse_updated_files_empty() {
        let stdout = "Already up to date.\n";
        let files = parse_updated_files(stdout);
        assert!(files.is_empty());
    }

    #[test]
    fn test_classify_push_error_non_fast_forward() {
        let stderr = r#"To github.com:user/repo.git
 ! [rejected]        main -> main (non-fast-forward)
error: failed to push some refs to 'github.com:user/repo.git'
hint: Updates were rejected because the remote contains work that you do not
hint: have locally."#;
        let result = classify_push_error(stderr);
        assert_eq!(result.status, "rejected");
        assert!(result.message.contains("Pull first"));
    }

    #[test]
    fn test_classify_push_error_fetch_first() {
        let stderr = "error: failed to push some refs\nhint: Updates were rejected because the tip of your current branch is behind\nhint: its remote counterpart. Integrate the remote changes (e.g.\nhint: 'git pull ...') before pushing again.\nhint: See the 'Note about fast-forwards' in 'git push --help' for details.\n ! [rejected]        main -> main (fetch first)\n";
        let result = classify_push_error(stderr);
        assert_eq!(result.status, "rejected");
    }

    #[test]
    fn test_classify_push_error_auth_failure() {
        let stderr = "remote: Permission denied to user/repo.git\nfatal: unable to access 'https://github.com/user/repo.git/': The requested URL returned error: 403";
        let result = classify_push_error(stderr);
        assert_eq!(result.status, "auth_error");
        assert!(result.message.contains("authentication"));
    }

    #[test]
    fn test_classify_push_error_network() {
        let stderr = "fatal: unable to access 'https://github.com/user/repo.git/': Could not resolve host: github.com";
        let result = classify_push_error(stderr);
        assert_eq!(result.status, "network_error");
        assert!(result.message.contains("network"));
    }

    #[test]
    fn test_classify_push_error_unknown() {
        let stderr = "error: something unexpected happened\nhint: Try again later";
        let result = classify_push_error(stderr);
        assert_eq!(result.status, "error");
        assert!(result.message.contains("Try again later"));
    }

    #[test]
    fn test_classify_push_error_unknown_no_hint() {
        let stderr = "error: something totally weird";
        let result = classify_push_error(stderr);
        assert_eq!(result.status, "error");
        assert!(result.message.contains("something totally weird"));
    }

    #[test]
    fn test_git_push_result_serialization() {
        let result = GitPushResult {
            status: "rejected".to_string(),
            message: "Push rejected".to_string(),
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("\"rejected\""));
        let parsed: GitPushResult = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.status, "rejected");
    }

    #[test]
    fn test_git_push_success_returns_ok() {
        let (_bare, clone_a, _clone_b) = setup_remote_pair();
        let vp_a = clone_a.path().to_str().unwrap();

        fs::write(clone_a.path().join("note.md"), "# Note\n").unwrap();
        git_commit(vp_a, "initial").unwrap();
        let result = git_push(vp_a).unwrap();
        assert_eq!(result.status, "ok");
    }

    #[test]
    fn test_git_push_rejected_returns_rejected() {
        let (_bare, clone_a, clone_b) = setup_remote_pair();
        let vp_a = clone_a.path().to_str().unwrap();
        let vp_b = clone_b.path().to_str().unwrap();

        // Both clones commit and push — second push should be rejected
        fs::write(clone_a.path().join("note.md"), "# A\n").unwrap();
        git_commit(vp_a, "from A").unwrap();
        git_push(vp_a).unwrap();

        git_pull(vp_b).unwrap();
        fs::write(clone_b.path().join("note.md"), "# B\n").unwrap();
        git_commit(vp_b, "from B").unwrap();
        git_push(vp_b).unwrap();

        // Now A has a new commit but hasn't pulled B's changes
        fs::write(clone_a.path().join("other.md"), "# Other\n").unwrap();
        git_commit(vp_a, "from A again").unwrap();
        let result = git_push(vp_a).unwrap();
        assert_eq!(result.status, "rejected");
        assert!(result.message.contains("Pull first"));
    }

    #[test]
    fn test_git_pull_result_serialization() {
        let result = GitPullResult {
            status: "updated".to_string(),
            message: "2 file(s) updated".to_string(),
            updated_files: vec!["note.md".to_string()],
            conflict_files: vec![],
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("\"updatedFiles\""));
        assert!(json.contains("\"conflictFiles\""));

        let parsed: GitPullResult = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.status, "updated");
        assert_eq!(parsed.updated_files.len(), 1);
    }
}
