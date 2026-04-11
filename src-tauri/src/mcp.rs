use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::{Child, Command};

const MCP_SERVER_NAME: &str = "tolaria";
const LEGACY_MCP_SERVER_NAME: &str = "laputa";

/// Status of the MCP server installation.
#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum McpStatus {
    /// MCP is registered in Claude config and server files exist.
    Installed,
    /// MCP server files or config are missing but can be installed.
    NotInstalled,
    /// Claude CLI is not installed — must install that first.
    NoClaudeCli,
}

/// Find the `node` binary path at runtime.
pub(crate) fn find_node() -> Result<PathBuf, String> {
    let output = Command::new("which")
        .arg("node")
        .output()
        .map_err(|e| format!("Failed to run `which node`: {e}"))?;
    if output.status.success() {
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !path.is_empty() {
            return Ok(PathBuf::from(path));
        }
    }

    if let Some(path) = fallback_node_path() {
        return Ok(path);
    }

    Err("node not found in PATH or common install locations".into())
}

fn fallback_node_path() -> Option<PathBuf> {
    let mut candidates = vec![
        PathBuf::from("/opt/homebrew/bin/node"),
        PathBuf::from("/usr/local/bin/node"),
    ];

    if let Some(home) = dirs::home_dir() {
        candidates.push(home.join(".volta").join("bin").join("node"));

        let nvm_dir = home.join(".nvm").join("versions").join("node");
        if let Ok(entries) = std::fs::read_dir(nvm_dir) {
            let mut versions = entries
                .filter_map(|entry| entry.ok().map(|entry| entry.path()))
                .collect::<Vec<_>>();
            versions.sort();
            versions.reverse();
            candidates.extend(
                versions
                    .into_iter()
                    .map(|version| version.join("bin").join("node")),
            );
        }
    }

    candidates.into_iter().find(|path| path.is_file())
}

/// Resolve the path to `mcp-server/`.
///
/// In dev mode, uses `CARGO_MANIFEST_DIR` (set at compile time).
/// In release mode, navigates from the current executable.
pub(crate) fn mcp_server_dir() -> Result<PathBuf, String> {
    let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("mcp-server");
    if dev_path.join("ws-bridge.js").exists() {
        return Ok(std::fs::canonicalize(&dev_path).unwrap_or(dev_path));
    }

    let exe = std::env::current_exe().map_err(|e| format!("Cannot find executable: {e}"))?;
    // On macOS the exe lives at Contents/MacOS/<binary>.
    // Resources are placed at Contents/Resources/ by Tauri.
    let release_path = exe
        .parent()
        .and_then(|p| p.parent())
        .map(|p| p.join("Resources").join("mcp-server"))
        .ok_or_else(|| "Cannot resolve mcp-server directory".to_string())?;
    if release_path.join("ws-bridge.js").exists() {
        return Ok(release_path);
    }

    Err(format!(
        "mcp-server not found at {} or {}",
        dev_path.display(),
        release_path.display()
    ))
}

/// Spawn the WebSocket bridge as a child process.
pub fn spawn_ws_bridge(vault_path: &str) -> Result<Child, String> {
    let node = find_node()?;
    let server_dir = mcp_server_dir()?;
    let script = server_dir.join("ws-bridge.js");

    let child = Command::new(node)
        .arg(&script)
        .env("VAULT_PATH", vault_path)
        .env("WS_PORT", "9710")
        .env("WS_UI_PORT", "9711")
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn ws-bridge: {e}"))?;

    log::info!("ws-bridge spawned (pid: {})", child.id());
    Ok(child)
}

/// Build the MCP server entry JSON for a given vault path and index.js path.
fn build_mcp_entry(index_js: &str, vault_path: &str) -> serde_json::Value {
    serde_json::json!({
        "command": "node",
        "args": [index_js],
        "env": { "VAULT_PATH": vault_path }
    })
}

/// Write MCP registration to a list of config file paths.
/// Returns "registered" on first registration, "updated" if already present.
fn register_mcp_to_configs(entry: &serde_json::Value, config_paths: &[PathBuf]) -> String {
    let mut status = "registered";
    for config_path in config_paths {
        match upsert_mcp_config(config_path, entry) {
            Ok(true) => status = "updated",
            Ok(false) => {}
            Err(e) => log::warn!("Failed to update {}: {}", config_path.display(), e),
        }
    }
    status.to_string()
}

/// Register Tolaria as an MCP server in Claude Code and Cursor config files.
pub fn register_mcp(vault_path: &str) -> Result<String, String> {
    let server_dir = mcp_server_dir()?;
    let index_js = server_dir.join("index.js").to_string_lossy().into_owned();

    let entry = build_mcp_entry(&index_js, vault_path);

    let configs: Vec<PathBuf> = [
        dirs::home_dir().map(|h| h.join(".claude").join("mcp.json")),
        dirs::home_dir().map(|h| h.join(".cursor").join("mcp.json")),
    ]
    .into_iter()
    .flatten()
    .collect();

    Ok(register_mcp_to_configs(&entry, &configs))
}

/// Insert or update the Tolaria entry in an MCP config file.
fn upsert_mcp_config(config_path: &Path, entry: &serde_json::Value) -> Result<bool, String> {
    if let Some(parent) = config_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Cannot create dir {}: {e}", parent.display()))?;
    }

    let mut config: serde_json::Value = if config_path.exists() {
        let raw = std::fs::read_to_string(config_path)
            .map_err(|e| format!("Cannot read {}: {e}", config_path.display()))?;
        serde_json::from_str(&raw)
            .map_err(|e| format!("Invalid JSON in {}: {e}", config_path.display()))?
    } else {
        serde_json::json!({})
    };

    let servers = config
        .as_object_mut()
        .ok_or("Config is not a JSON object")?
        .entry("mcpServers")
        .or_insert_with(|| serde_json::json!({}));

    let servers = servers
        .as_object_mut()
        .ok_or("mcpServers is not a JSON object")?;

    let was_update =
        servers.get(MCP_SERVER_NAME).is_some() || servers.get(LEGACY_MCP_SERVER_NAME).is_some();
    servers.remove(LEGACY_MCP_SERVER_NAME);
    servers.insert(MCP_SERVER_NAME.to_string(), entry.clone());

    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {e}"))?;
    std::fs::write(config_path, json)
        .map_err(|e| format!("Cannot write {}: {e}", config_path.display()))?;

    Ok(was_update)
}

/// Check whether the MCP server is properly installed and registered.
///
/// Returns `Installed` when the Tolaria entry exists in `~/.claude/mcp.json`
/// and the referenced index.js file is present. Returns `NoClaudeCli` when
/// the Claude CLI binary cannot be found. Otherwise returns `NotInstalled`.
pub fn check_mcp_status() -> McpStatus {
    // Check Claude CLI first — no point installing MCP if Claude isn't available
    if crate::claude_cli::find_claude_binary().is_err() {
        return McpStatus::NoClaudeCli;
    }

    let config_path = match dirs::home_dir() {
        Some(h) => h.join(".claude").join("mcp.json"),
        None => return McpStatus::NotInstalled,
    };

    if !config_path.exists() {
        return McpStatus::NotInstalled;
    }

    let raw = match std::fs::read_to_string(&config_path) {
        Ok(r) => r,
        Err(_) => return McpStatus::NotInstalled,
    };

    let config: serde_json::Value = match serde_json::from_str(&raw) {
        Ok(c) => c,
        Err(_) => return McpStatus::NotInstalled,
    };

    let Some(servers) = config.get("mcpServers").and_then(|value| value.as_object()) else {
        return McpStatus::NotInstalled;
    };
    let Some(entry) = servers
        .get(MCP_SERVER_NAME)
        .or_else(|| servers.get(LEGACY_MCP_SERVER_NAME))
    else {
        return McpStatus::NotInstalled;
    };

    // Verify the referenced index.js actually exists on disk
    if let Some(index_js) = entry["args"]
        .as_array()
        .and_then(|a| a.first())
        .and_then(|v| v.as_str())
    {
        if !Path::new(index_js).exists() {
            return McpStatus::NotInstalled;
        }
    } else {
        return McpStatus::NotInstalled;
    }

    McpStatus::Installed
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_mcp_entry_produces_correct_json() {
        let entry = build_mcp_entry("/path/to/index.js", "/my/vault");
        assert_eq!(entry["command"], "node");
        assert_eq!(entry["args"][0], "/path/to/index.js");
        assert_eq!(entry["env"]["VAULT_PATH"], "/my/vault");
    }

    #[test]
    fn upsert_creates_new_config() {
        let tmp = tempfile::tempdir().unwrap();
        let config_path = tmp.path().join("mcp.json");
        let entry = build_mcp_entry("/test/index.js", "/test/vault");

        let was_update = upsert_mcp_config(&config_path, &entry).unwrap();
        assert!(!was_update);

        let raw = std::fs::read_to_string(&config_path).unwrap();
        let config: serde_json::Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(
            config["mcpServers"][MCP_SERVER_NAME]["args"][0],
            "/test/index.js"
        );
        assert_eq!(
            config["mcpServers"][MCP_SERVER_NAME]["env"]["VAULT_PATH"],
            "/test/vault"
        );
    }

    #[test]
    fn upsert_updates_existing_config() {
        let tmp = tempfile::tempdir().unwrap();
        let config_path = tmp.path().join("mcp.json");

        let entry1 = build_mcp_entry("/test/index.js", "/vault/v1");
        upsert_mcp_config(&config_path, &entry1).unwrap();

        let entry2 = build_mcp_entry("/test/index.js", "/vault/v2");
        let was_update = upsert_mcp_config(&config_path, &entry2).unwrap();
        assert!(was_update);

        let raw = std::fs::read_to_string(&config_path).unwrap();
        let config: serde_json::Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(
            config["mcpServers"][MCP_SERVER_NAME]["env"]["VAULT_PATH"],
            "/vault/v2"
        );
    }

    #[test]
    fn upsert_migrates_legacy_server_name() {
        let tmp = tempfile::tempdir().unwrap();
        let config_path = tmp.path().join("mcp.json");

        let existing = serde_json::json!({
            "mcpServers": {
                "laputa": {
                    "command": "node",
                    "args": ["/old/index.js"],
                    "env": { "VAULT_PATH": "/old" }
                }
            }
        });
        std::fs::write(&config_path, serde_json::to_string(&existing).unwrap()).unwrap();

        let entry = build_mcp_entry("/test/index.js", "/vault");
        let was_update = upsert_mcp_config(&config_path, &entry).unwrap();
        assert!(was_update);

        let raw = std::fs::read_to_string(&config_path).unwrap();
        let config: serde_json::Value = serde_json::from_str(&raw).unwrap();
        assert!(config["mcpServers"][LEGACY_MCP_SERVER_NAME].is_null());
        assert_eq!(
            config["mcpServers"][MCP_SERVER_NAME]["args"][0],
            "/test/index.js"
        );
    }

    #[test]
    fn upsert_preserves_other_servers() {
        let tmp = tempfile::tempdir().unwrap();
        let config_path = tmp.path().join("mcp.json");

        let existing = serde_json::json!({
            "mcpServers": {
                "other-server": { "command": "other", "args": [] }
            }
        });
        std::fs::write(&config_path, serde_json::to_string(&existing).unwrap()).unwrap();

        let entry = build_mcp_entry("/test/index.js", "/vault");
        upsert_mcp_config(&config_path, &entry).unwrap();

        let raw = std::fs::read_to_string(&config_path).unwrap();
        let config: serde_json::Value = serde_json::from_str(&raw).unwrap();
        assert!(config["mcpServers"]["other-server"].is_object());
        assert!(config["mcpServers"][MCP_SERVER_NAME].is_object());
    }

    #[test]
    fn upsert_creates_parent_dirs() {
        let tmp = tempfile::tempdir().unwrap();
        let config_path = tmp.path().join("nested").join("dir").join("mcp.json");
        let entry = build_mcp_entry("/test/index.js", "/vault");

        upsert_mcp_config(&config_path, &entry).unwrap();
        assert!(config_path.exists());
    }

    #[test]
    fn register_mcp_to_configs_returns_registered_for_new() {
        let tmp = tempfile::tempdir().unwrap();
        let config = tmp.path().join("claude").join("mcp.json");
        let entry = build_mcp_entry("/test/index.js", "/vault");

        let status = register_mcp_to_configs(&entry, &[config]);
        assert_eq!(status, "registered");
    }

    #[test]
    fn register_mcp_to_configs_returns_updated_for_existing() {
        let tmp = tempfile::tempdir().unwrap();
        let config = tmp.path().join("mcp.json");
        let entry = build_mcp_entry("/test/index.js", "/vault");

        // First call
        register_mcp_to_configs(&entry, &[config.clone()]);
        // Second call
        let status = register_mcp_to_configs(&entry, &[config]);
        assert_eq!(status, "updated");
    }

    #[test]
    fn find_node_returns_valid_path() {
        let node = find_node().unwrap();
        assert!(node.exists(), "node binary should exist at {:?}", node);
        assert!(
            node.to_string_lossy().contains("node"),
            "path should contain 'node': {:?}",
            node
        );
    }

    #[test]
    fn mcp_server_dir_resolves_in_dev() {
        let dir = mcp_server_dir().unwrap();
        assert!(dir.join("ws-bridge.js").exists());
        assert!(dir.join("index.js").exists());
        assert!(dir.join("vault.js").exists());
    }

    #[test]
    fn spawn_ws_bridge_starts_and_can_be_killed() {
        let tmp = tempfile::tempdir().unwrap();
        let vault_path = tmp.path().to_str().unwrap();

        let mut child = spawn_ws_bridge(vault_path).unwrap();
        assert!(child.id() > 0, "child process should have a valid PID");

        // Clean up: kill the spawned process
        child.kill().unwrap();
        child.wait().unwrap();
    }

    #[test]
    fn register_mcp_to_configs_writes_multiple_configs() {
        let tmp = tempfile::tempdir().unwrap();
        let claude_cfg = tmp.path().join("claude").join("mcp.json");
        let cursor_cfg = tmp.path().join("cursor").join("mcp.json");
        let entry = build_mcp_entry("/test/index.js", "/vault");

        register_mcp_to_configs(&entry, &[claude_cfg.clone(), cursor_cfg.clone()]);

        assert!(claude_cfg.exists());
        assert!(cursor_cfg.exists());

        let raw = std::fs::read_to_string(&claude_cfg).unwrap();
        let config: serde_json::Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(
            config["mcpServers"][MCP_SERVER_NAME]["args"][0],
            "/test/index.js"
        );
    }
    #[test]
    fn upsert_returns_error_for_invalid_json() {
        let tmp = tempfile::tempdir().unwrap();
        let config_path = tmp.path().join("mcp.json");
        std::fs::write(&config_path, "not valid json{{{{").unwrap();
        let entry = build_mcp_entry("/test/index.js", "/vault");
        let result = upsert_mcp_config(&config_path, &entry);
        assert!(result.is_err());
    }

    #[test]
    fn register_mcp_to_configs_handles_empty_list() {
        let entry = build_mcp_entry("/test/index.js", "/vault");
        // Empty config list — function should return "registered" (no existing)
        let status = register_mcp_to_configs(&entry, &[]);
        // With empty config list, there were no updates, so status should be "registered"
        assert_eq!(status, "registered");
    }

    #[test]
    fn check_mcp_status_returns_valid_variant() {
        // On a dev machine with Claude CLI and MCP registered, this should be Installed.
        // On CI without Claude it might be NoClaudeCli. Either way it must not panic.
        let status = check_mcp_status();
        assert!(
            matches!(
                status,
                McpStatus::Installed | McpStatus::NotInstalled | McpStatus::NoClaudeCli
            ),
            "unexpected status: {:?}",
            status
        );
    }

    #[test]
    fn mcp_status_serializes_to_snake_case() {
        let json = serde_json::to_string(&McpStatus::Installed).unwrap();
        assert_eq!(json, r#""installed""#);
        let json = serde_json::to_string(&McpStatus::NotInstalled).unwrap();
        assert_eq!(json, r#""not_installed""#);
        let json = serde_json::to_string(&McpStatus::NoClaudeCli).unwrap();
        assert_eq!(json, r#""no_claude_cli""#);
    }
}
