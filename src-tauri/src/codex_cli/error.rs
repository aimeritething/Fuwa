pub(super) struct CodexProcessError {
    pub(super) stderr_output: String,
    pub(super) status: String,
}

pub(super) fn format_codex_error(error: CodexProcessError) -> String {
    let lower = error.stderr_output.to_ascii_lowercase();
    if is_codex_auth_error(&lower) {
        return "Codex CLI is not authenticated. Run `codex login` or launch `codex` in your terminal.".into();
    }

    if is_codex_write_permission_error(&lower) {
        return "Codex could not write to the active vault. Vault Safe uses a read-only Codex sandbox; switch to Power User for shell-backed local writes, or verify the selected vault folder is writable and retry. Writes outside the active vault remain blocked.".into();
    }

    if error.stderr_output.trim().is_empty() {
        format!("codex exited with status {}", error.status)
    } else {
        error
            .stderr_output
            .lines()
            .take(3)
            .collect::<Vec<_>>()
            .join("\n")
    }
}

fn is_codex_auth_error(lower: &str) -> bool {
    ["auth", "login", "sign in"]
        .iter()
        .any(|pattern| lower.contains(pattern))
}

fn is_codex_write_permission_error(lower: &str) -> bool {
    [
        "read-only sandbox",
        "writing is blocked",
        "rejected by user approval",
        "rejected by the environment",
    ]
    .iter()
    .any(|pattern| lower.contains(pattern))
}
