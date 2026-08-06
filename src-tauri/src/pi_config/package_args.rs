use serde_json::Value;
use std::path::Path;

const PI_MCP_ADAPTER_EXTENSION: &str = "npm:pi-mcp-adapter";

pub(super) fn build_args(agent_dir: &Path, vault_dir: &Path) -> Vec<String> {
    let mut args = vec!["--mode".into(), "json".into(), "--no-session".into()];
    if !settings_load_mcp_adapter(&agent_dir.join("settings.json"))
        && !settings_load_mcp_adapter(&vault_dir.join(".pi/settings.json"))
    {
        args.push("--extension".into());
        args.push(PI_MCP_ADAPTER_EXTENSION.into());
    }
    args
}

fn settings_load_mcp_adapter(path: &Path) -> bool {
    let Ok(contents) = std::fs::read_to_string(path) else {
        return false;
    };
    let Ok(settings) = serde_json::from_str::<Value>(&contents) else {
        return false;
    };
    settings
        .get("packages")
        .and_then(Value::as_array)
        .is_some_and(|packages| packages.iter().any(package_loads_mcp_adapter))
}

fn package_loads_mcp_adapter(package: &Value) -> bool {
    let (source, extensions) = match package {
        Value::String(source) => (source.as_str(), None),
        Value::Object(config) => (
            config
                .get("source")
                .and_then(Value::as_str)
                .unwrap_or_default(),
            config.get("extensions"),
        ),
        _ => return false,
    };
    let is_adapter = source
        .strip_prefix(PI_MCP_ADAPTER_EXTENSION)
        .is_some_and(|suffix| suffix.is_empty() || suffix.starts_with('@'));
    let extensions_disabled =
        matches!(extensions, Some(Value::Array(entries)) if entries.is_empty());
    is_adapter && !extensions_disabled
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn args_use_documented_json_mode_with_mcp_adapter() {
        let args = args_for_settings(r#"{}"#, false);

        assert_eq!(args[..3], ["--mode", "json", "--no-session"]);
        assert!(args.contains(&PI_MCP_ADAPTER_EXTENSION.to_string()));
        assert!(!args.contains(&"--no-tools".to_string()));
    }

    #[test]
    fn args_skip_injected_adapter_when_settings_load_it() {
        let cases = [
            (r#"{"packages":["npm:pi-mcp-adapter"]}"#, false),
            (
                r#"{"packages":[{"source":"npm:pi-mcp-adapter@1.2.3"}]}"#,
                false,
            ),
            (r#"{"packages":["npm:pi-mcp-adapter"]}"#, true),
        ];

        for (settings, project_local) in cases {
            let args = args_for_settings(settings, project_local);
            assert!(!args.contains(&"--extension".to_string()), "{settings}");
            assert!(
                !args.contains(&PI_MCP_ADAPTER_EXTENSION.to_string()),
                "{settings}"
            );
        }
    }

    #[test]
    fn args_keep_injected_adapter_for_non_loading_or_invalid_settings() {
        let cases = [
            r#"{"packages":["npm:pi-mcp-adapter-plus"]}"#,
            r#"{"packages":[{"source":"npm:pi-mcp-adapter","extensions":[]}]}"#,
            r#"{"comment":"npm:pi-mcp-adapter"}"#,
            "not json",
        ];

        for settings in cases {
            let args = args_for_settings(settings, false);
            assert!(args.contains(&"--extension".to_string()), "{settings}");
        }
    }

    fn args_for_settings(settings: &str, project_local: bool) -> Vec<String> {
        let agent_dir = tempfile::tempdir().unwrap();
        let vault_dir = tempfile::tempdir().unwrap();
        let settings_path = if project_local {
            vault_dir.path().join(".pi/settings.json")
        } else {
            agent_dir.path().join("settings.json")
        };
        std::fs::create_dir_all(settings_path.parent().unwrap()).unwrap();
        std::fs::write(settings_path, settings).unwrap();
        build_args(agent_dir.path(), vault_dir.path())
    }
}
