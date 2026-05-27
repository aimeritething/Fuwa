use std::path::Path;
use std::process::Output;

use super::git_command;

const DEFAULT_FETCH_REFSPEC: &str = "+refs/heads/*:refs/remotes/origin/*";
const REMOTE_URL_CONFIG_PATTERN: &str = r"^remote\..*\.url$";
const ORIGIN_URL_CONFIG_KEY: &str = "remote.origin.url";
const ORIGIN_FETCH_CONFIG_KEY: &str = "remote.origin.fetch";

pub(super) fn list_configured_remotes(vault: &Path) -> Result<Vec<String>, String> {
    let output = git_command()
        .args(["config", "--get-regexp", REMOTE_URL_CONFIG_PATTERN])
        .current_dir(vault)
        .output()
        .map_err(|e| format!("Failed to inspect git remotes: {e}"))?;

    if output.status.code() == Some(1) {
        return Ok(Vec::new());
    }
    if !output.status.success() {
        return Err(command_error("git config --get-regexp", &output));
    }

    Ok(stdout_lines(&output)
        .into_iter()
        .filter_map(|line| remote_name_from_url_config(&line))
        .collect())
}

fn remote_name_from_url_config(line: &str) -> Option<String> {
    let (key, value) = line.split_once(' ')?;
    if value.trim().is_empty() {
        return None;
    }
    key.strip_prefix("remote.")
        .and_then(|name| name.strip_suffix(".url"))
        .filter(|name| !name.is_empty())
        .map(ToString::to_string)
}

pub(super) fn configure_origin_remote(vault: &Path, remote_url: &str) -> Result<(), String> {
    run_git_config(vault, ORIGIN_URL_CONFIG_KEY, remote_url)?;
    run_git_config(vault, ORIGIN_FETCH_CONFIG_KEY, DEFAULT_FETCH_REFSPEC)
}

fn run_git_config(vault: &Path, key: &str, value: &str) -> Result<(), String> {
    let output = git_command()
        .args(["config", "--local", "--replace-all", key, value])
        .current_dir(vault)
        .output()
        .map_err(|e| format!("Failed to run git config: {e}"))?;

    if output.status.success() {
        return Ok(());
    }

    Err(command_error("git config", &output))
}

fn stdout_lines(output: &Output) -> Vec<String> {
    String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(ToString::to_string)
        .collect()
}

fn command_error(command: &str, output: &Output) -> String {
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if stderr.is_empty() {
        format!("{command} failed")
    } else {
        stderr
    }
}
