use crate::ai_agents::AiAgentAvailability;
use std::path::{Path, PathBuf};

pub(crate) fn check_cli() -> AiAgentAvailability {
    match find_binary() {
        Ok(binary) => AiAgentAvailability {
            installed: true,
            version: crate::cli_agent_runtime::version_for_binary(&binary),
        },
        Err(_) => AiAgentAvailability {
            installed: false,
            version: None,
        },
    }
}

pub(crate) fn find_binary() -> Result<PathBuf, String> {
    if let Some(binary) = find_binary_on_path() {
        return Ok(binary);
    }
    if let Some(binary) = find_binary_in_user_shell() {
        return Ok(binary);
    }
    if let Some(binary) = crate::cli_agent_runtime::find_executable_binary_candidate(
        kiro_binary_candidates(),
        "Kiro CLI",
    )? {
        return Ok(binary);
    }

    Err("Kiro CLI not found. Install it: https://kiro.dev/docs/cli".into())
}

fn find_binary_on_path() -> Option<PathBuf> {
    crate::hidden_command(path_lookup_command())
        .arg("kiro-cli")
        .output()
        .ok()
        .and_then(|output| path_from_successful_output(&output))
}

fn path_lookup_command() -> &'static str {
    if cfg!(windows) { "where" } else { "which" }
}

fn find_binary_in_user_shell() -> Option<PathBuf> {
    user_shell_candidates()
        .into_iter()
        .filter(|shell| shell.exists())
        .find_map(|shell| command_path_from_shell(&shell, "kiro-cli"))
}

fn user_shell_candidates() -> Vec<PathBuf> {
    let mut shells = Vec::new();
    if let Some(shell) = std::env::var_os("SHELL") {
        if !shell.is_empty() {
            shells.push(PathBuf::from(shell));
        }
    }
    shells.push(PathBuf::from("/bin/zsh"));
    shells.push(PathBuf::from("/bin/bash"));
    shells
}

fn command_path_from_shell(shell: &Path, command: &str) -> Option<PathBuf> {
    crate::hidden_command(shell)
        .arg("-lc")
        .arg(format!("command -v {command}"))
        .output()
        .ok()
        .and_then(|output| path_from_successful_output(&output))
}

fn path_from_successful_output(output: &std::process::Output) -> Option<PathBuf> {
    if output.status.success() {
        first_existing_path(&String::from_utf8_lossy(&output.stdout))
    } else {
        None
    }
}

fn first_existing_path(stdout: &str) -> Option<PathBuf> {
    stdout.lines().find_map(|line| {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            return None;
        }
        let candidate = PathBuf::from(trimmed);
        candidate.exists().then_some(candidate)
    })
}

fn kiro_binary_candidates() -> Vec<PathBuf> {
    dirs::home_dir()
        .map(|home| kiro_binary_candidates_for_home(&home))
        .unwrap_or_default()
}

fn kiro_binary_candidates_for_home(home: &Path) -> Vec<PathBuf> {
    vec![
        home.join(".local/bin/kiro-cli"),
        home.join(".kiro/bin/kiro-cli"),
        home.join(".local/share/mise/shims/kiro-cli"),
        home.join(".asdf/shims/kiro-cli"),
        home.join(".npm-global/bin/kiro-cli"),
        home.join(".npm/bin/kiro-cli"),
        home.join(".bun/bin/kiro-cli"),
        PathBuf::from("/usr/local/bin/kiro-cli"),
        PathBuf::from("/opt/homebrew/bin/kiro-cli"),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn binary_candidates_include_supported_installs() {
        let home = PathBuf::from("/Users/alex");
        let candidates = kiro_binary_candidates_for_home(&home);
        let expected = [
            home.join(".local/bin/kiro-cli"),
            home.join(".kiro/bin/kiro-cli"),
            home.join(".npm-global/bin/kiro-cli"),
            PathBuf::from("/opt/homebrew/bin/kiro-cli"),
        ];
        for candidate in expected {
            assert!(candidates.contains(&candidate), "missing {}", candidate.display());
        }
    }

    #[test]
    fn first_existing_path_skips_empty_and_missing_lines() {
        let dir = tempfile::tempdir().unwrap();
        let missing = dir.path().join("missing-kiro");
        let kiro = dir.path().join("kiro-cli");
        std::fs::write(&kiro, "#!/bin/sh\n").unwrap();

        let stdout = format!("\n{}\n{}\n", missing.display(), kiro.display());
        assert_eq!(first_existing_path(&stdout), Some(kiro));
    }
}
