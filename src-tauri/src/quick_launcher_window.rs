use serde::Deserialize;
use tauri::window::Color;

const QUICK_LAUNCHER_LABEL: &str = "quick-launcher";
const QUICK_LAUNCHER_ROUTE: &str = "/?window=quick-launcher";
const QUICK_LAUNCHER_WIDTH: f64 = 580.0;
const QUICK_LAUNCHER_HEIGHT: f64 = 460.0;
const TRANSPARENT_BACKGROUND: Color = Color(0, 0, 0, 0);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickLauncherWindowCopy {
    #[cfg(desktop)]
    clear_background_error: String,
    #[cfg(desktop)]
    create_error: String,
    #[cfg(mobile)]
    desktop_only_error: String,
    #[cfg(desktop)]
    disable_shadow_error: String,
    #[cfg(desktop)]
    focus_error: String,
    #[cfg(desktop)]
    show_error: String,
    #[cfg(desktop)]
    title: String,
    #[cfg(desktop)]
    title_error: String,
    #[cfg(desktop)]
    unminimize_error: String,
}

#[derive(Debug, PartialEq)]
struct QuickLauncherWindowSpec {
    background: Color,
    initially_focused: bool,
    initially_visible: bool,
    route: &'static str,
    transparent: bool,
}

fn quick_launcher_window_spec() -> QuickLauncherWindowSpec {
    QuickLauncherWindowSpec {
        background: TRANSPARENT_BACKGROUND,
        initially_focused: false,
        initially_visible: false,
        route: QUICK_LAUNCHER_ROUTE,
        transparent: true,
    }
}

fn format_native_error(template: &str, error: impl std::fmt::Display) -> String {
    template.replace("{error}", &error.to_string())
}

#[cfg(desktop)]
fn configure_transparent_surface(
    window: &tauri::WebviewWindow,
    copy: &QuickLauncherWindowCopy,
) -> Result<(), String> {
    window
        .set_background_color(Some(TRANSPARENT_BACKGROUND))
        .map_err(|error| format_native_error(&copy.clear_background_error, error))?;
    window
        .set_shadow(false)
        .map_err(|error| format_native_error(&copy.disable_shadow_error, error))
}

#[cfg(desktop)]
fn reveal_window(
    window: &tauri::WebviewWindow,
    copy: &QuickLauncherWindowCopy,
) -> Result<(), String> {
    window
        .unminimize()
        .map_err(|error| format_native_error(&copy.unminimize_error, error))?;
    window
        .show()
        .map_err(|error| format_native_error(&copy.show_error, error))?;
    window
        .set_focus()
        .map_err(|error| format_native_error(&copy.focus_error, error))
}

#[cfg(desktop)]
fn create_window(
    app: &tauri::AppHandle,
    copy: &QuickLauncherWindowCopy,
) -> Result<tauri::WebviewWindow, String> {
    let spec = quick_launcher_window_spec();
    tauri::WebviewWindowBuilder::new(
        app,
        QUICK_LAUNCHER_LABEL,
        tauri::WebviewUrl::App(spec.route.into()),
    )
    .title(&copy.title)
    .inner_size(QUICK_LAUNCHER_WIDTH, QUICK_LAUNCHER_HEIGHT)
    .min_inner_size(QUICK_LAUNCHER_WIDTH, QUICK_LAUNCHER_HEIGHT)
    .center()
    .resizable(false)
    .minimizable(false)
    .maximizable(false)
    .closable(true)
    .always_on_top(true)
    .decorations(false)
    .shadow(false)
    .transparent(spec.transparent)
    .background_color(spec.background)
    .skip_taskbar(true)
    .focused(spec.initially_focused)
    .visible(spec.initially_visible)
    .build()
    .map_err(|error| format_native_error(&copy.create_error, error))
}

#[cfg(desktop)]
#[tauri::command]
pub fn show_quick_launcher(
    app: tauri::AppHandle,
    copy: QuickLauncherWindowCopy,
) -> Result<(), String> {
    use tauri::Manager;

    let window = match app.get_webview_window(QUICK_LAUNCHER_LABEL) {
        Some(window) => window,
        None => create_window(&app, &copy)?,
    };
    window
        .set_title(&copy.title)
        .map_err(|error| format_native_error(&copy.title_error, error))?;
    configure_transparent_surface(&window, &copy)?;
    reveal_window(&window, &copy)
}

#[cfg(mobile)]
#[tauri::command]
pub fn show_quick_launcher(
    _app: tauri::AppHandle,
    copy: QuickLauncherWindowCopy,
) -> Result<(), String> {
    Err(copy.desktop_only_error)
}

#[cfg(test)]
mod tests {
    use super::{format_native_error, quick_launcher_window_spec, Color, TRANSPARENT_BACKGROUND};

    #[test]
    fn launcher_stays_hidden_until_its_clear_native_surface_is_ready() {
        let spec = quick_launcher_window_spec();

        assert_eq!(spec.background, TRANSPARENT_BACKGROUND);
        assert_eq!(spec.background, Color(0, 0, 0, 0));
        assert!(!spec.initially_focused);
        assert!(!spec.initially_visible);
        assert!(spec.transparent);
    }

    #[test]
    fn launcher_uses_the_dedicated_renderer_route() {
        assert_eq!(
            quick_launcher_window_spec().route,
            "/?window=quick-launcher"
        );
    }

    #[test]
    fn native_errors_preserve_the_localized_template_and_runtime_detail() {
        assert_eq!(
            format_native_error(
                "Impossibile mostrare l'avvio rapido: {error}",
                "window hidden"
            ),
            "Impossibile mostrare l'avvio rapido: window hidden"
        );
    }
}
