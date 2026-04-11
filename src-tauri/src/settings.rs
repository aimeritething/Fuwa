use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

const APP_CONFIG_DIR: &str = "com.tolaria.app";
const LEGACY_APP_CONFIG_DIR: &str = "com.laputa.app";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Settings {
    pub github_token: Option<String>,
    pub github_username: Option<String>,
    pub auto_pull_interval_minutes: Option<u32>,
    pub telemetry_consent: Option<bool>,
    pub crash_reporting_enabled: Option<bool>,
    pub analytics_enabled: Option<bool>,
    pub anonymous_id: Option<String>,
    pub release_channel: Option<String>,
}

fn app_config_dir() -> Result<PathBuf, String> {
    dirs::config_dir().ok_or_else(|| "Could not determine config directory".to_string())
}

fn preferred_app_config_path(file_name: &str) -> Result<PathBuf, String> {
    Ok(app_config_dir()?.join(APP_CONFIG_DIR).join(file_name))
}

fn resolve_existing_or_preferred_app_config_path(file_name: &str) -> Result<PathBuf, String> {
    let preferred = preferred_app_config_path(file_name)?;
    if preferred.exists() {
        return Ok(preferred);
    }

    let legacy = app_config_dir()?
        .join(LEGACY_APP_CONFIG_DIR)
        .join(file_name);
    if legacy.exists() {
        return Ok(legacy);
    }

    Ok(preferred)
}

fn settings_path() -> Result<PathBuf, String> {
    resolve_existing_or_preferred_app_config_path("settings.json")
}

fn get_settings_at(path: &PathBuf) -> Result<Settings, String> {
    if !path.exists() {
        return Ok(Settings::default());
    }
    let content =
        fs::read_to_string(path).map_err(|e| format!("Failed to read settings: {}", e))?;
    serde_json::from_str(&content).map_err(|e| format!("Failed to parse settings: {}", e))
}

fn save_settings_at(path: &PathBuf, settings: Settings) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    // Trim whitespace and convert empty strings to None
    let cleaned = Settings {
        github_token: settings
            .github_token
            .map(|k| k.trim().to_string())
            .filter(|k| !k.is_empty()),
        github_username: settings
            .github_username
            .map(|k| k.trim().to_string())
            .filter(|k| !k.is_empty()),
        auto_pull_interval_minutes: settings.auto_pull_interval_minutes,
        telemetry_consent: settings.telemetry_consent,
        crash_reporting_enabled: settings.crash_reporting_enabled,
        analytics_enabled: settings.analytics_enabled,
        anonymous_id: settings
            .anonymous_id
            .map(|k| k.trim().to_string())
            .filter(|k| !k.is_empty()),
        release_channel: settings
            .release_channel
            .map(|k| k.trim().to_string())
            .filter(|k| !k.is_empty()),
    };

    let json = serde_json::to_string_pretty(&cleaned)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    fs::write(path, json).map_err(|e| format!("Failed to write settings: {}", e))
}

pub fn get_settings() -> Result<Settings, String> {
    get_settings_at(&settings_path()?)
}

pub fn save_settings(settings: Settings) -> Result<(), String> {
    save_settings_at(&preferred_app_config_path("settings.json")?, settings)
}

fn last_vault_file() -> Result<PathBuf, String> {
    resolve_existing_or_preferred_app_config_path("last-vault.txt")
}

fn get_last_vault_at(path: &PathBuf) -> Option<String> {
    fs::read_to_string(path)
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn set_last_vault_at(path: &PathBuf, vault_path: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }
    fs::write(path, vault_path.trim())
        .map_err(|e| format!("Failed to write last vault path: {}", e))
}

pub fn get_last_vault() -> Option<String> {
    last_vault_file().ok().and_then(|p| get_last_vault_at(&p))
}

pub fn set_last_vault(vault_path: &str) -> Result<(), String> {
    set_last_vault_at(&preferred_app_config_path("last-vault.txt")?, vault_path)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Helper: save settings to a temp file and reload them.
    fn save_and_reload(settings: Settings) -> Settings {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("settings.json");
        save_settings_at(&path, settings).unwrap();
        get_settings_at(&path).unwrap()
    }

    #[test]
    fn test_default_settings_all_none() {
        let s = Settings::default();
        assert!(s.github_token.is_none());
        assert!(s.github_username.is_none());
        assert!(s.auto_pull_interval_minutes.is_none());
        assert!(s.telemetry_consent.is_none());
        assert!(s.crash_reporting_enabled.is_none());
        assert!(s.analytics_enabled.is_none());
        assert!(s.anonymous_id.is_none());
    }

    #[test]
    fn test_settings_json_roundtrip() {
        let settings = Settings {
            github_token: Some("gho_xyz789".to_string()),
            github_username: Some("lucaong".to_string()),
            telemetry_consent: Some(true),
            crash_reporting_enabled: Some(true),
            analytics_enabled: Some(false),
            anonymous_id: Some("abc-123-uuid".to_string()),
            ..Default::default()
        };
        let json = serde_json::to_string(&settings).unwrap();
        let parsed: Settings = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.github_token, settings.github_token);
        assert_eq!(parsed.github_username, settings.github_username);
        assert_eq!(parsed.telemetry_consent, Some(true));
        assert_eq!(parsed.crash_reporting_enabled, Some(true));
        assert_eq!(parsed.analytics_enabled, Some(false));
        assert_eq!(parsed.anonymous_id.as_deref(), Some("abc-123-uuid"));
    }

    #[test]
    fn test_get_settings_returns_default_for_missing_file() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("nonexistent.json");
        let result = get_settings_at(&path).unwrap();
        assert!(result.github_token.is_none());
    }

    #[test]
    fn test_save_and_load_preserves_values() {
        let loaded = save_and_reload(Settings {
            github_token: Some("gho_token123".to_string()),
            github_username: Some("lucaong".to_string()),
            auto_pull_interval_minutes: Some(10),
            ..Default::default()
        });
        assert_eq!(loaded.github_token.as_deref(), Some("gho_token123"));
        assert_eq!(loaded.github_username.as_deref(), Some("lucaong"));
        assert_eq!(loaded.auto_pull_interval_minutes, Some(10));
    }

    #[test]
    fn test_save_trims_whitespace() {
        let loaded = save_and_reload(Settings {
            github_token: Some("  gho_abc  ".to_string()),
            github_username: Some("  lucaong  ".to_string()),
            ..Default::default()
        });
        assert_eq!(loaded.github_token.as_deref(), Some("gho_abc"));
        assert_eq!(loaded.github_username.as_deref(), Some("lucaong"));
    }

    #[test]
    fn test_save_filters_empty_and_whitespace_only() {
        let loaded = save_and_reload(Settings {
            github_username: Some("".to_string()),
            ..Default::default()
        });
        assert!(loaded.github_username.is_none());
    }

    #[test]
    fn test_save_creates_parent_directories() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("nested").join("dir").join("settings.json");

        save_settings_at(
            &path,
            Settings {
                github_token: Some("gho_test".to_string()),
                ..Default::default()
            },
        )
        .unwrap();
        assert!(path.exists());
        assert_eq!(
            get_settings_at(&path).unwrap().github_token.as_deref(),
            Some("gho_test")
        );
    }

    #[test]
    fn test_get_settings_malformed_json() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("bad.json");
        fs::write(&path, "not valid json{{{").unwrap();

        let err = get_settings_at(&path).unwrap_err();
        assert!(err.contains("Failed to parse settings"));
    }

    #[test]
    fn test_telemetry_fields_roundtrip() {
        let loaded = save_and_reload(Settings {
            telemetry_consent: Some(true),
            crash_reporting_enabled: Some(true),
            analytics_enabled: Some(false),
            anonymous_id: Some("test-uuid-v4".to_string()),
            ..Default::default()
        });
        assert_eq!(loaded.telemetry_consent, Some(true));
        assert_eq!(loaded.crash_reporting_enabled, Some(true));
        assert_eq!(loaded.analytics_enabled, Some(false));
        assert_eq!(loaded.anonymous_id.as_deref(), Some("test-uuid-v4"));
    }

    #[test]
    fn test_old_settings_json_missing_telemetry_fields() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("settings.json");
        // Simulate old settings.json without telemetry fields
        fs::write(&path, r#"{"github_token":"gho_test"}"#).unwrap();
        let loaded = get_settings_at(&path).unwrap();
        assert_eq!(loaded.github_token.as_deref(), Some("gho_test"));
        assert!(loaded.telemetry_consent.is_none());
        assert!(loaded.crash_reporting_enabled.is_none());
        assert!(loaded.analytics_enabled.is_none());
        assert!(loaded.anonymous_id.is_none());
    }

    #[test]
    fn test_settings_path_returns_ok() {
        let result = settings_path();
        assert!(result.is_ok());
        let path = result.unwrap();
        let path = path.to_str().unwrap();
        assert!(path.contains("com.tolaria.app") || path.contains("com.laputa.app"));
    }

    #[test]
    fn test_preferred_settings_path_uses_tolaria_namespace() {
        let result = preferred_app_config_path("settings.json");
        assert!(result.is_ok());
        assert!(result
            .unwrap()
            .to_str()
            .unwrap()
            .contains("com.tolaria.app"));
    }

    #[test]
    fn test_get_last_vault_returns_none_for_missing_file() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("last-vault.txt");
        assert!(get_last_vault_at(&path).is_none());
    }

    #[test]
    fn test_set_and_get_last_vault_roundtrip() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("last-vault.txt");
        set_last_vault_at(&path, "/Users/test/MyVault").unwrap();
        assert_eq!(
            get_last_vault_at(&path).as_deref(),
            Some("/Users/test/MyVault")
        );
    }

    #[test]
    fn test_set_last_vault_trims_whitespace() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("last-vault.txt");
        set_last_vault_at(&path, "  /Users/test/Vault  ").unwrap();
        assert_eq!(
            get_last_vault_at(&path).as_deref(),
            Some("/Users/test/Vault")
        );
    }

    #[test]
    fn test_get_last_vault_returns_none_for_empty_file() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("last-vault.txt");
        fs::write(&path, "   \n  ").unwrap();
        assert!(get_last_vault_at(&path).is_none());
    }

    #[test]
    fn test_set_last_vault_creates_parent_directories() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("nested").join("dir").join("last-vault.txt");
        set_last_vault_at(&path, "/Users/test/Vault").unwrap();
        assert!(path.exists());
        assert_eq!(
            get_last_vault_at(&path).as_deref(),
            Some("/Users/test/Vault")
        );
    }

    #[test]
    fn test_set_last_vault_overwrites_previous() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("last-vault.txt");
        set_last_vault_at(&path, "/Users/test/OldVault").unwrap();
        set_last_vault_at(&path, "/Users/test/NewVault").unwrap();
        assert_eq!(
            get_last_vault_at(&path).as_deref(),
            Some("/Users/test/NewVault")
        );
    }
}
