mod asset_scope;
mod commands;
pub mod menu;
pub mod vault;
pub mod vault_watcher;

pub(crate) use asset_scope::sync_vault_asset_scope;

use std::ffi::OsStr;
use std::process::Command;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Spawn `program` without a console window on Windows. Used by the native
/// clipboard commands (`pbcopy` / `pbpaste` on macOS).
pub(crate) fn hidden_command(program: impl AsRef<OsStr>) -> Command {
    let mut command = Command::new(program);
    suppress_windows_console(&mut command);
    command
}

#[cfg(windows)]
fn suppress_windows_console(command: &mut Command) {
    use std::os::windows::process::CommandExt;
    command.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
fn suppress_windows_console(_command: &mut Command) {}

fn setup_plugins(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    if cfg!(debug_assertions) {
        app.handle().plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )?;
    }

    app.handle().plugin(tauri_plugin_dialog::init())?;
    app.handle().plugin(tauri_plugin_opener::init())?;
    setup_macos_webview_shortcut_prevention(app)?;
    Ok(())
}

/// Browser-reserved chords that WKWebView would swallow before the renderer's
/// shortcut handler sees them: ⌘O (Open Folder…) and ⌘F (Find). Spec §7 keeps
/// Tolaria's command-key list and drops its only command-shift entry (⌘⇧L).
/// Keep these lists narrow and verify every addition with native QA.
#[cfg(any(test, all(desktop, target_os = "macos")))]
const MACOS_WEBVIEW_RESERVED_COMMAND_KEYS: &[&str] = &["O", "F"];
#[cfg(any(test, all(desktop, target_os = "macos")))]
const MACOS_WEBVIEW_RESERVED_COMMAND_SHIFT_KEYS: &[&str] = &[];

#[cfg(all(desktop, target_os = "macos"))]
fn setup_macos_webview_shortcut_prevention(
    app: &mut tauri::App,
) -> Result<(), Box<dyn std::error::Error>> {
    use tauri_plugin_prevent_default::ModifierKey::{MetaKey, ShiftKey};
    use tauri_plugin_prevent_default::{Flags, KeyboardShortcut};

    let mut builder = tauri_plugin_prevent_default::Builder::new().with_flags(Flags::empty());

    for key in MACOS_WEBVIEW_RESERVED_COMMAND_KEYS {
        builder = builder.shortcut(KeyboardShortcut::with_modifiers(key, &[MetaKey]));
    }
    for key in MACOS_WEBVIEW_RESERVED_COMMAND_SHIFT_KEYS {
        builder = builder.shortcut(KeyboardShortcut::with_modifiers(key, &[MetaKey, ShiftKey]));
    }

    app.handle().plugin(builder.build())?;
    Ok(())
}

#[cfg(not(all(desktop, target_os = "macos")))]
fn setup_macos_webview_shortcut_prevention(
    _app: &mut tauri::App,
) -> Result<(), Box<dyn std::error::Error>> {
    Ok(())
}

#[cfg(debug_assertions)]
fn show_debug_main_window(app: &mut tauri::App) {
    use tauri::Manager;

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.center();
        let _ = window.set_focus();
    }
}

#[cfg(not(debug_assertions))]
fn show_debug_main_window(_app: &mut tauri::App) {}

fn setup_app(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    setup_plugins(app)?;
    menu::setup_menu(app)?;
    show_debug_main_window(app);
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .manage(asset_scope::AllowedAssetScopeRoots(std::sync::Mutex::new(
            Vec::new(),
        )))
        .manage(vault_watcher::VaultWatcherState::new())
        .invoke_handler(tauri::generate_handler![
            commands::get_note_content,
            commands::validate_note_content,
            commands::save_note_content,
            commands::create_note_content,
            commands::delete_note,
            commands::batch_delete_notes,
            commands::rename_note_filename,
            commands::move_note_to_folder,
            commands::create_vault_folder,
            commands::rename_vault_folder,
            commands::delete_vault_folder,
            commands::list_vault_folders,
            commands::save_image,
            commands::copy_image_to_vault,
            vault_watcher::start_vault_watcher,
            vault_watcher::stop_vault_watcher,
            commands::open_vault_file_external,
            commands::reveal_path_in_file_manager,
            commands::sync_vault_asset_scope_for_window,
            commands::copy_text_to_clipboard,
            commands::read_text_from_clipboard,
        ])
        .setup(setup_app)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::{MACOS_WEBVIEW_RESERVED_COMMAND_KEYS, MACOS_WEBVIEW_RESERVED_COMMAND_SHIFT_KEYS};
    use crate::asset_scope::{missing_asset_scope_roots, vault_asset_scope_roots};
    use std::path::PathBuf;

    #[test]
    fn macos_webview_shortcut_prevention_reserves_open_and_find_only() {
        assert_eq!(MACOS_WEBVIEW_RESERVED_COMMAND_KEYS, ["O", "F"]);
        assert!(MACOS_WEBVIEW_RESERVED_COMMAND_SHIFT_KEYS.is_empty());
    }

    #[cfg(unix)]
    #[test]
    fn vault_asset_scope_roots_include_requested_symlink_path() {
        let directory = tempfile::tempdir().unwrap();
        let canonical_vault = directory.path().join("Getting Started");
        let symlinked_vault = directory.path().join("Symlinked Getting Started");
        std::fs::create_dir(&canonical_vault).unwrap();
        std::os::unix::fs::symlink(&canonical_vault, &symlinked_vault).unwrap();

        let roots = vault_asset_scope_roots(&symlinked_vault).unwrap();

        assert_eq!(roots[0], canonical_vault.canonicalize().unwrap());
        assert!(roots.contains(&symlinked_vault));
    }

    #[test]
    fn missing_asset_scope_roots_keeps_previously_allowed_vaults() {
        let vault_a = PathBuf::from("/vault-a");
        let vault_b = PathBuf::from("/vault-b");
        let allowed_roots = vec![vault_a.clone()];

        assert_eq!(
            missing_asset_scope_roots(&allowed_roots, std::slice::from_ref(&vault_b)),
            vec![vault_b]
        );
        assert!(
            missing_asset_scope_roots(&allowed_roots, std::slice::from_ref(&vault_a)).is_empty()
        );
    }
}
