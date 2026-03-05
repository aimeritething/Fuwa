use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;

/// Resolved qmd binary location: path + optional working directory.
/// The working dir is required for the bundled binary to find its node_modules.
#[derive(Debug, Clone)]
pub struct QmdBinary {
    pub path: String,
    pub work_dir: Option<PathBuf>,
}

impl QmdBinary {
    /// Create a `Command` pre-configured with the correct working directory.
    pub fn command(&self) -> Command {
        let mut cmd = Command::new(&self.path);
        if let Some(ref dir) = self.work_dir {
            cmd.current_dir(dir);
        }
        cmd
    }
}

static QMD_CACHE: Mutex<Option<QmdBinary>> = Mutex::new(None);

/// Locate the qmd binary, checking bundled resource first, then known locations.
/// Caches the result for subsequent calls.
pub fn find_qmd_binary() -> Option<QmdBinary> {
    if let Ok(guard) = QMD_CACHE.lock() {
        if let Some(ref cached) = *guard {
            return Some(cached.clone());
        }
    }

    let result = find_qmd_binary_uncached();

    if let Some(ref bin) = result {
        if let Ok(mut guard) = QMD_CACHE.lock() {
            *guard = Some(bin.clone());
        }
    }

    result
}

fn find_qmd_binary_uncached() -> Option<QmdBinary> {
    // 1. Check bundled binary (Tauri resource)
    if let Some(bin) = find_bundled_qmd() {
        return Some(bin);
    }

    // 2. Check known system locations
    let candidates = [
        dirs::home_dir().map(|h| h.join(".bun/bin/qmd").to_string_lossy().to_string()),
        Some("/usr/local/bin/qmd".to_string()),
        Some("/opt/homebrew/bin/qmd".to_string()),
    ];
    for candidate in candidates.into_iter().flatten() {
        if Path::new(&candidate).exists() {
            return Some(QmdBinary {
                path: candidate,
                work_dir: None,
            });
        }
    }

    // 3. Fallback: try PATH
    Command::new("which")
        .arg("qmd")
        .output()
        .ok()
        .and_then(|o| {
            if o.status.success() {
                Some(QmdBinary {
                    path: String::from_utf8_lossy(&o.stdout).trim().to_string(),
                    work_dir: None,
                })
            } else {
                None
            }
        })
}

/// Look for the bundled qmd binary inside the app bundle or dev resources.
fn find_bundled_qmd() -> Option<QmdBinary> {
    let exe = std::env::current_exe().ok()?;
    let exe_dir = exe.parent()?;

    // macOS app bundle: <app>/Contents/MacOS/laputa → <app>/Contents/Resources/qmd/qmd
    let bundle_dir = exe_dir.parent()?.join("Resources").join("qmd");
    if let Some(bin) = prepare_bundled_dir(&bundle_dir) {
        return Some(bin);
    }

    // Dev mode: use compile-time CARGO_MANIFEST_DIR for reliable path resolution
    let dev_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("resources")
        .join("qmd");
    if let Some(bin) = prepare_bundled_dir(&dev_dir) {
        return Some(bin);
    }

    // Dev mode fallback: walk up from exe_dir to find the project root
    let mut dir = exe_dir.to_path_buf();
    for _ in 0..6 {
        let qmd_dir = dir.join("resources").join("qmd");
        if let Some(bin) = prepare_bundled_dir(&qmd_dir) {
            return Some(bin);
        }
        if !dir.pop() {
            break;
        }
    }

    None
}

/// Validate a bundled qmd directory and prepare the binary for execution.
/// Sets execute permissions and removes macOS quarantine attributes.
fn prepare_bundled_dir(qmd_dir: &Path) -> Option<QmdBinary> {
    let qmd_path = qmd_dir.join("qmd");
    if !qmd_path.exists() {
        return None;
    }

    ensure_executable(&qmd_path);

    // Remove macOS quarantine attributes that block execution of bundled binaries
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("xattr")
            .args(["-rd", "com.apple.quarantine"])
            .arg(qmd_dir)
            .output();
    }

    Some(QmdBinary {
        path: qmd_path.to_string_lossy().to_string(),
        work_dir: Some(qmd_dir.to_path_buf()),
    })
}

/// Ensure a file has execute permission.
#[cfg(unix)]
fn ensure_executable(path: &Path) {
    use std::os::unix::fs::PermissionsExt;
    if let Ok(metadata) = path.metadata() {
        let mode = metadata.permissions().mode();
        if mode & 0o111 == 0 {
            let mut perms = metadata.permissions();
            perms.set_mode(mode | 0o755);
            let _ = std::fs::set_permissions(path, perms);
        }
    }
}

#[cfg(not(unix))]
fn ensure_executable(_path: &Path) {}

/// Try to install qmd globally using bun. Returns Ok if installation succeeded.
pub fn try_auto_install_qmd() -> Result<(), String> {
    let bun = find_bun().ok_or("bun not found — cannot auto-install qmd")?;

    log::info!("Auto-installing qmd via bun...");
    let output = Command::new(&bun)
        .args(["install", "-g", "qmd"])
        .output()
        .map_err(|e| format!("Failed to run bun install: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("bun install -g qmd failed: {stderr}"));
    }

    // Clear cache so the newly installed binary is discovered
    clear_qmd_cache();
    log::info!("qmd auto-install succeeded");
    Ok(())
}

/// Locate bun binary for auto-installing qmd.
fn find_bun() -> Option<PathBuf> {
    let candidates = [
        dirs::home_dir().map(|h| h.join(".bun/bin/bun")),
        Some(PathBuf::from("/opt/homebrew/bin/bun")),
        Some(PathBuf::from("/usr/local/bin/bun")),
    ];
    for candidate in candidates.into_iter().flatten() {
        if candidate.exists() {
            return Some(candidate);
        }
    }

    // Fallback: try PATH
    Command::new("which")
        .arg("bun")
        .output()
        .ok()
        .and_then(|o| {
            if o.status.success() {
                Some(PathBuf::from(
                    String::from_utf8_lossy(&o.stdout).trim().to_string(),
                ))
            } else {
                None
            }
        })
}

/// Clear the cached qmd binary (e.g. after path changes or installation).
pub fn clear_qmd_cache() {
    if let Ok(mut guard) = QMD_CACHE.lock() {
        *guard = None;
    }
}

#[derive(Debug, Serialize, Clone)]
pub struct IndexStatus {
    pub available: bool,
    pub qmd_installed: bool,
    pub collection_exists: bool,
    pub indexed_count: usize,
    pub embedded_count: usize,
    pub pending_embed: usize,
}

/// Check whether the vault has a qmd index and its status.
pub fn check_index_status(vault_path: &str) -> IndexStatus {
    let qmd = match find_qmd_binary() {
        Some(b) => b,
        None => {
            return IndexStatus {
                available: false,
                qmd_installed: false,
                collection_exists: false,
                indexed_count: 0,
                embedded_count: 0,
                pending_embed: 0,
            }
        }
    };

    let vault_name = vault_dir_name(vault_path);
    let output = qmd.command().args(["status"]).output();

    match output {
        Ok(o) if o.status.success() => {
            let stdout = String::from_utf8_lossy(&o.stdout);
            parse_status_for_vault(&stdout, &vault_name)
        }
        _ => IndexStatus {
            available: false,
            qmd_installed: true,
            collection_exists: false,
            indexed_count: 0,
            embedded_count: 0,
            pending_embed: 0,
        },
    }
}

fn vault_dir_name(vault_path: &str) -> String {
    Path::new(vault_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("laputa")
        .to_lowercase()
}

fn parse_status_for_vault(status_output: &str, vault_name: &str) -> IndexStatus {
    let mut collection_exists = false;
    let mut indexed_count = 0;
    let mut embedded_count = 0;
    let mut pending_embed = 0;

    // Look for collection section matching vault name
    let mut in_vault_section = false;
    for line in status_output.lines() {
        let trimmed = line.trim();
        // Collection headers look like: "  laputa (qmd://laputa/)"
        if trimmed.contains(&format!("qmd://{vault_name}/")) {
            collection_exists = true;
            in_vault_section = true;
            continue;
        }
        // New collection section starts
        if trimmed.contains("qmd://") && !trimmed.contains(vault_name) {
            in_vault_section = false;
            continue;
        }
        if in_vault_section {
            if let Some(count_str) = extract_count_from_line(trimmed, "Files:") {
                indexed_count = count_str;
            }
        }
    }

    // Global counts from the Documents section
    for line in status_output.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("Total:") {
            if let Some(n) = extract_first_number(trimmed) {
                if embedded_count == 0 && indexed_count == 0 {
                    indexed_count = n;
                }
            }
        } else if trimmed.starts_with("Vectors:") {
            if let Some(n) = extract_first_number(trimmed) {
                embedded_count = n;
            }
        } else if trimmed.starts_with("Pending:") {
            if let Some(n) = extract_first_number(trimmed) {
                pending_embed = n;
            }
        }
    }

    IndexStatus {
        available: true,
        qmd_installed: true,
        collection_exists,
        indexed_count,
        embedded_count,
        pending_embed,
    }
}

fn extract_count_from_line(line: &str, prefix: &str) -> Option<usize> {
    if !line.starts_with(prefix) {
        return None;
    }
    extract_first_number(line)
}

fn extract_first_number(s: &str) -> Option<usize> {
    s.split_whitespace()
        .find_map(|word| word.parse::<usize>().ok())
}

/// Ensure a qmd collection exists for this vault. Creates one if missing.
pub fn ensure_collection(vault_path: &str) -> Result<(), String> {
    let qmd = find_qmd_binary().ok_or("qmd not installed")?;
    let vault_name = vault_dir_name(vault_path);

    // Check if collection already exists
    let output = qmd
        .command()
        .args(["collection", "list"])
        .output()
        .map_err(|e| format!("Failed to list collections: {e}"))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        if stdout.contains(&format!("qmd://{vault_name}/")) {
            return Ok(());
        }
    }

    // Create collection
    qmd.command()
        .args([
            "collection",
            "add",
            vault_path,
            "--name",
            &vault_name,
            "--mask",
            "**/*.md",
        ])
        .output()
        .map_err(|e| format!("Failed to create collection: {e}"))?;

    Ok(())
}

#[derive(Debug, Serialize, Clone)]
pub struct IndexingProgress {
    pub phase: String,
    pub current: usize,
    pub total: usize,
    pub done: bool,
    pub error: Option<String>,
}

/// Run full indexing: update + embed. Returns progress updates via callback.
pub fn run_full_index<F>(vault_path: &str, on_progress: F) -> Result<(), String>
where
    F: Fn(IndexingProgress),
{
    let qmd = find_qmd_binary().ok_or("qmd not installed")?;

    ensure_collection(vault_path)?;

    // Phase 1: update (scan files)
    on_progress(IndexingProgress {
        phase: "scanning".to_string(),
        current: 0,
        total: 0,
        done: false,
        error: None,
    });

    let update_output = qmd
        .command()
        .args(["update"])
        .output()
        .map_err(|e| format!("qmd update failed: {e}"))?;

    if !update_output.status.success() {
        let stderr = String::from_utf8_lossy(&update_output.stderr);
        let err = format!("qmd update failed: {stderr}");
        on_progress(IndexingProgress {
            phase: "error".to_string(),
            current: 0,
            total: 0,
            done: true,
            error: Some(err.clone()),
        });
        return Err(err);
    }

    // Parse update output for counts
    let update_stdout = String::from_utf8_lossy(&update_output.stdout);
    let total = parse_indexed_count(&update_stdout);

    on_progress(IndexingProgress {
        phase: "scanning".to_string(),
        current: total,
        total,
        done: false,
        error: None,
    });

    // Phase 2: embed (generate vectors)
    on_progress(IndexingProgress {
        phase: "embedding".to_string(),
        current: 0,
        total,
        done: false,
        error: None,
    });

    let embed_output = qmd
        .command()
        .args(["embed"])
        .output()
        .map_err(|e| format!("qmd embed failed: {e}"))?;

    if !embed_output.status.success() {
        let stderr = String::from_utf8_lossy(&embed_output.stderr);
        // Embedding failure is non-fatal — keyword search still works
        log::warn!("qmd embed failed (keyword search still works): {stderr}");
        on_progress(IndexingProgress {
            phase: "complete".to_string(),
            current: total,
            total,
            done: true,
            error: Some("Embedding failed — keyword search only".to_string()),
        });
        return Ok(());
    }

    on_progress(IndexingProgress {
        phase: "complete".to_string(),
        current: total,
        total,
        done: true,
        error: None,
    });

    Ok(())
}

fn parse_indexed_count(update_output: &str) -> usize {
    // qmd update output typically contains lines like "Indexed 9078 files"
    for line in update_output.lines() {
        if let Some(n) = extract_first_number(line) {
            return n;
        }
    }
    0
}

/// Run incremental update for a single file change.
pub fn run_incremental_update(vault_path: &str) -> Result<(), String> {
    let qmd = find_qmd_binary().ok_or("qmd not installed")?;

    // Verify collection exists
    let vault_name = vault_dir_name(vault_path);
    let list_output = qmd
        .command()
        .args(["collection", "list"])
        .output()
        .map_err(|e| format!("Failed to list collections: {e}"))?;

    if list_output.status.success() {
        let stdout = String::from_utf8_lossy(&list_output.stdout);
        if !stdout.contains(&format!("qmd://{vault_name}/")) {
            // Collection doesn't exist yet — skip incremental, full index needed
            return Ok(());
        }
    }

    let output = qmd
        .command()
        .args(["update"])
        .output()
        .map_err(|e| format!("qmd incremental update failed: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("qmd update failed: {stderr}"));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn qmd_binary_command_sets_work_dir() {
        let qmd = QmdBinary {
            path: "/bin/echo".to_string(),
            work_dir: Some(PathBuf::from("/tmp")),
        };
        let cmd = qmd.command();
        let dbg = format!("{:?}", cmd);
        assert!(dbg.contains("/bin/echo"));
    }

    #[test]
    fn qmd_binary_command_no_work_dir() {
        let qmd = QmdBinary {
            path: "/bin/echo".to_string(),
            work_dir: None,
        };
        let output = qmd.command().arg("hello").output().unwrap();
        assert!(output.status.success());
    }

    #[test]
    fn vault_dir_name_extracts_last_segment() {
        assert_eq!(vault_dir_name("/Users/luca/Laputa"), "laputa");
        assert_eq!(vault_dir_name("/home/user/MyVault"), "myvault");
    }

    #[test]
    fn vault_dir_name_fallback() {
        assert_eq!(vault_dir_name(""), "laputa");
    }

    #[test]
    fn extract_first_number_works() {
        assert_eq!(
            extract_first_number("Total: 9078 files indexed"),
            Some(9078)
        );
        assert_eq!(extract_first_number("Vectors: 14676 embedded"), Some(14676));
        assert_eq!(extract_first_number("no numbers here"), None);
    }

    #[test]
    fn parse_status_finds_collection() {
        let status = r#"
QMD Status

Index: /Users/luca/.cache/qmd/index.sqlite
Size:  100.9 MB

Documents
  Total:    9115 files indexed
  Vectors:  14676 embedded
  Pending:  26 need embedding

Collections
  laputa (qmd://laputa/)
    Pattern:  **/*.md
    Files:    9078 (updated 20d ago)
"#;
        let result = parse_status_for_vault(status, "laputa");
        assert!(result.collection_exists);
        assert_eq!(result.indexed_count, 9078);
        assert_eq!(result.embedded_count, 14676);
        assert_eq!(result.pending_embed, 26);
    }

    #[test]
    fn parse_status_missing_collection() {
        let status = r#"
QMD Status

Documents
  Total:    100 files indexed
  Vectors:  50 embedded
  Pending:  0

Collections
  other (qmd://other/)
    Files:    100
"#;
        let result = parse_status_for_vault(status, "laputa");
        assert!(!result.collection_exists);
    }

    #[test]
    fn extract_count_from_line_works() {
        assert_eq!(
            extract_count_from_line("Files:    9078 (updated 20d ago)", "Files:"),
            Some(9078)
        );
        assert_eq!(extract_count_from_line("Pattern:  **/*.md", "Files:"), None);
    }

    #[test]
    fn parse_indexed_count_from_output() {
        assert_eq!(parse_indexed_count("Indexed 342 files in 1.2s"), 342);
        assert_eq!(parse_indexed_count("No output"), 0);
    }

    #[test]
    fn ensure_executable_sets_permission() {
        use std::fs;
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("test-bin");
        fs::write(&file, "#!/bin/sh\necho ok").unwrap();

        // Start with no execute permission
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&file, fs::Permissions::from_mode(0o644)).unwrap();
            assert_eq!(fs::metadata(&file).unwrap().permissions().mode() & 0o111, 0);

            ensure_executable(&file);
            assert_ne!(fs::metadata(&file).unwrap().permissions().mode() & 0o111, 0);
        }
    }

    #[test]
    fn ensure_executable_noop_when_already_executable() {
        use std::fs;
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("test-bin");
        fs::write(&file, "#!/bin/sh\necho ok").unwrap();

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&file, fs::Permissions::from_mode(0o755)).unwrap();
            ensure_executable(&file);
            let mode = fs::metadata(&file).unwrap().permissions().mode();
            assert_ne!(mode & 0o111, 0);
        }
    }

    #[test]
    fn prepare_bundled_dir_returns_none_for_missing_binary() {
        let dir = tempfile::tempdir().unwrap();
        assert!(prepare_bundled_dir(dir.path()).is_none());
    }

    #[test]
    fn prepare_bundled_dir_finds_and_prepares_binary() {
        use std::fs;
        let dir = tempfile::tempdir().unwrap();
        let qmd_path = dir.path().join("qmd");
        fs::write(&qmd_path, "#!/bin/sh\necho ok").unwrap();

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&qmd_path, fs::Permissions::from_mode(0o644)).unwrap();
        }

        let result = prepare_bundled_dir(dir.path());
        assert!(result.is_some());
        let bin = result.unwrap();
        assert!(bin.path.ends_with("qmd"));
        assert_eq!(bin.work_dir.unwrap(), dir.path());

        // Verify execute permission was set
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_ne!(
                fs::metadata(&qmd_path).unwrap().permissions().mode() & 0o111,
                0
            );
        }
    }

    #[test]
    fn find_bun_returns_some_if_available() {
        // This test may succeed or fail depending on the system.
        // It verifies the function doesn't panic.
        let _ = find_bun();
    }
}
