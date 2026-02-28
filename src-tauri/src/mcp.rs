use std::path::{Path, PathBuf};
use std::process::{Child, Command};

/// Find the `node` binary path at runtime.
fn find_node() -> Result<PathBuf, String> {
    let output = Command::new("which")
        .arg("node")
        .output()
        .map_err(|e| format!("Failed to run `which node`: {e}"))?;
    if !output.status.success() {
        return Err("node not found in PATH".into());
    }
    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(PathBuf::from(path))
}

/// Resolve the path to `mcp-server/ws-bridge.js`.
///
/// In dev mode, uses `CARGO_MANIFEST_DIR` (set at compile time).
/// In release mode, navigates from the current executable.
fn mcp_server_dir() -> Result<PathBuf, String> {
    // Dev mode: CARGO_MANIFEST_DIR points to src-tauri/
    let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("mcp-server");
    if dev_path.join("ws-bridge.js").exists() {
        return Ok(std::fs::canonicalize(&dev_path).unwrap_or(dev_path));
    }

    // Release mode: relative to the executable
    let exe = std::env::current_exe().map_err(|e| format!("Cannot find executable: {e}"))?;
    let release_path = exe
        .parent()
        .and_then(|p| p.parent())
        .map(|p| p.join("mcp-server"))
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

/// Register Laputa as an MCP server in Claude Code and Cursor config files.
pub fn register_mcp(vault_path: &str) -> Result<String, String> {
    let server_dir = mcp_server_dir()?;
    let index_js = server_dir
        .join("index.js")
        .to_string_lossy()
        .into_owned();

    let entry = serde_json::json!({
        "command": "node",
        "args": [index_js],
        "env": { "VAULT_PATH": vault_path }
    });

    let configs = [
        dirs::home_dir().map(|h| h.join(".claude").join("mcp.json")),
        dirs::home_dir().map(|h| h.join(".cursor").join("mcp.json")),
    ];

    let mut status = "registered";
    for config_path in configs.into_iter().flatten() {
        match upsert_mcp_config(&config_path, &entry) {
            Ok(was_update) => {
                if was_update {
                    status = "updated";
                }
            }
            Err(e) => log::warn!("Failed to update {}: {}", config_path.display(), e),
        }
    }

    Ok(status.to_string())
}

/// Insert or update the "laputa" entry in an MCP config file.
fn upsert_mcp_config(
    config_path: &Path,
    entry: &serde_json::Value,
) -> Result<bool, String> {
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

    let was_update = servers.get("laputa").is_some();

    servers
        .as_object_mut()
        .ok_or("mcpServers is not a JSON object")?
        .insert("laputa".to_string(), entry.clone());

    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {e}"))?;
    std::fs::write(config_path, json)
        .map_err(|e| format!("Cannot write {}: {e}", config_path.display()))?;

    Ok(was_update)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn register_mcp_creates_config_files() {
        let tmp = tempfile::tempdir().unwrap();
        let config_path = tmp.path().join("mcp.json");
        let entry = serde_json::json!({
            "command": "node",
            "args": ["/test/mcp-server/index.js"],
            "env": { "VAULT_PATH": "/test/vault" }
        });

        // First call creates the file
        let was_update = upsert_mcp_config(&config_path, &entry).unwrap();
        assert!(!was_update);

        let raw = std::fs::read_to_string(&config_path).unwrap();
        let config: serde_json::Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(
            config["mcpServers"]["laputa"]["args"][0],
            "/test/mcp-server/index.js"
        );
        assert_eq!(
            config["mcpServers"]["laputa"]["env"]["VAULT_PATH"],
            "/test/vault"
        );

        // Second call updates
        let entry2 = serde_json::json!({
            "command": "node",
            "args": ["/test/mcp-server/index.js"],
            "env": { "VAULT_PATH": "/new/vault" }
        });
        let was_update = upsert_mcp_config(&config_path, &entry2).unwrap();
        assert!(was_update);

        let raw = std::fs::read_to_string(&config_path).unwrap();
        let config: serde_json::Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(
            config["mcpServers"]["laputa"]["env"]["VAULT_PATH"],
            "/new/vault"
        );
    }

    #[test]
    fn upsert_preserves_other_servers() {
        let tmp = tempfile::tempdir().unwrap();
        let config_path = tmp.path().join("mcp.json");

        // Seed with existing config
        let existing = serde_json::json!({
            "mcpServers": {
                "other-server": { "command": "other", "args": [] }
            }
        });
        std::fs::write(&config_path, serde_json::to_string(&existing).unwrap()).unwrap();

        let entry = serde_json::json!({
            "command": "node",
            "args": ["/test/index.js"],
            "env": { "VAULT_PATH": "/vault" }
        });
        upsert_mcp_config(&config_path, &entry).unwrap();

        let raw = std::fs::read_to_string(&config_path).unwrap();
        let config: serde_json::Value = serde_json::from_str(&raw).unwrap();
        assert!(config["mcpServers"]["other-server"].is_object());
        assert!(config["mcpServers"]["laputa"].is_object());
    }
}
