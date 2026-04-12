use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

const APP_CONFIG_DIR: &str = "com.tolaria.app";
const LEGACY_APP_CONFIG_DIR: &str = "com.laputa.app";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Settings {
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

    // Trim whitespace and convert empty strings to None.
    let cleaned = Settings {
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

    fn settings_snapshot(
        settings: &Settings,
    ) -> (
        Option<u32>,
        Option<bool>,
        Option<bool>,
        Option<bool>,
        Option<&str>,
        Option<&str>,
    ) {
        (
            settings.auto_pull_interval_minutes,
            settings.telemetry_consent,
            settings.crash_reporting_enabled,
            settings.analytics_enabled,
            settings.anonymous_id.as_deref(),
            settings.release_channel.as_deref(),
        )
    }

    fn assert_empty_settings(settings: &Settings) {
        assert_eq!(
            settings_snapshot(settings),
            (None, None, None, None, None, None)
        );
    }

    /// Helper: save settings to a temp file and reload them.
    fn save_and_reload(settings: Settings) -> Settings {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("settings.json");
        save_settings_at(&path, settings).unwrap();
        get_settings_at(&path).unwrap()
    }

    fn create_last_vault_path(path_parts: &[&str]) -> (tempfile::TempDir, PathBuf) {
        let dir = tempfile::TempDir::new().unwrap();
        let path = path_parts
            .iter()
            .fold(dir.path().to_path_buf(), |acc, part| acc.join(part));
        (dir, path)
    }

    fn write_and_assert_last_vault(path: &PathBuf, value: &str) {
        set_last_vault_at(path, value).unwrap();
        assert_eq!(get_last_vault_at(path).as_deref(), Some(value));
    }

    #[test]
    fn test_default_settings_all_none() {
        assert_empty_settings(&Settings::default());
    }

    #[test]
    fn test_settings_json_roundtrip() {
        let settings = Settings {
            auto_pull_interval_minutes: Some(10),
            telemetry_consent: Some(true),
            crash_reporting_enabled: Some(true),
            analytics_enabled: Some(false),
            anonymous_id: Some("abc-123-uuid".to_string()),
            release_channel: Some("beta".to_string()),
            ..Default::default()
        };
        let json = serde_json::to_string(&settings).unwrap();
        let parsed: Settings = serde_json::from_str(&json).unwrap();
        assert_eq!(settings_snapshot(&parsed), settings_snapshot(&settings));
    }

    #[test]
    fn test_get_settings_returns_default_for_missing_file() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("nonexistent.json");
        let result = get_settings_at(&path).unwrap();
        assert!(result.auto_pull_interval_minutes.is_none());
    }

    #[test]
    fn test_save_and_load_preserves_values() {
        let loaded = save_and_reload(Settings {
            auto_pull_interval_minutes: Some(10),
            release_channel: Some("alpha".to_string()),
            ..Default::default()
        });
        assert_eq!(loaded.auto_pull_interval_minutes, Some(10));
        assert_eq!(loaded.release_channel.as_deref(), Some("alpha"));
    }

    #[test]
    fn test_save_trims_whitespace() {
        let loaded = save_and_reload(Settings {
            anonymous_id: Some("  test-uuid  ".to_string()),
            release_channel: Some("  beta  ".to_string()),
            ..Default::default()
        });
        assert_eq!(loaded.anonymous_id.as_deref(), Some("test-uuid"));
        assert_eq!(loaded.release_channel.as_deref(), Some("beta"));
    }

    #[test]
    fn test_save_filters_empty_and_whitespace_only() {
        let loaded = save_and_reload(Settings {
            release_channel: Some("".to_string()),
            ..Default::default()
        });
        assert!(loaded.release_channel.is_none());
    }

    #[test]
    fn test_save_creates_parent_directories() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("nested").join("dir").join("settings.json");

        save_settings_at(
            &path,
            Settings {
                anonymous_id: Some("test-uuid".to_string()),
                ..Default::default()
            },
        )
        .unwrap();
        assert!(path.exists());
        assert_eq!(
            get_settings_at(&path).unwrap().anonymous_id.as_deref(),
            Some("test-uuid")
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
        assert_eq!(
            settings_snapshot(&loaded),
            (
                None,
                Some(true),
                Some(true),
                Some(false),
                Some("test-uuid-v4"),
                None
            )
        );
    }

    #[test]
    fn test_old_settings_json_missing_telemetry_fields() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("settings.json");
        // Simulate an old settings.json that still contains removed GitHub auth fields.
        fs::write(
            &path,
            r#"{"github_token":"gho_test","github_username":"lucaong"}"#,
        )
        .unwrap();
        let loaded = get_settings_at(&path).unwrap();
        assert_empty_settings(&loaded);
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
        let (_dir, path) = create_last_vault_path(&["last-vault.txt"]);
        write_and_assert_last_vault(&path, "/Users/test/MyVault");
    }

    #[test]
    fn test_set_last_vault_trims_whitespace() {
        let (_dir, path) = create_last_vault_path(&["last-vault.txt"]);
        write_and_assert_last_vault(&path, "/Users/test/Vault");
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
        let (_dir, path) = create_last_vault_path(&["nested", "dir", "last-vault.txt"]);
        write_and_assert_last_vault(&path, "/Users/test/Vault");
        assert!(path.exists());
    }

    #[test]
    fn test_set_last_vault_overwrites_previous() {
        let (_dir, path) = create_last_vault_path(&["last-vault.txt"]);
        write_and_assert_last_vault(&path, "/Users/test/OldVault");
        write_and_assert_last_vault(&path, "/Users/test/NewVault");
    }
}
