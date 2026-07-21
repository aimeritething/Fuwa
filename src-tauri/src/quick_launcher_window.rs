use tauri::window::Color;

const QUICK_LAUNCHER_LABEL: &str = "quick-launcher";
const QUICK_LAUNCHER_TITLE: &str = "Tolaria Quick Launcher";
const QUICK_LAUNCHER_ROUTE: &str = "/?window=quick-launcher";
const QUICK_LAUNCHER_WIDTH: f64 = 580.0;
const QUICK_LAUNCHER_HEIGHT: f64 = 460.0;
const TRANSPARENT_BACKGROUND: Color = Color(0, 0, 0, 0);

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

#[cfg(desktop)]
fn configure_transparent_surface(window: &tauri::WebviewWindow) -> Result<(), String> {
    window
        .set_background_color(Some(TRANSPARENT_BACKGROUND))
        .map_err(|error| format!("Failed to clear quick launcher background: {error}"))?;
    window
        .set_shadow(false)
        .map_err(|error| format!("Failed to disable quick launcher native shadow: {error}"))
}

#[cfg(desktop)]
fn reveal_window(window: &tauri::WebviewWindow) -> Result<(), String> {
    window
        .unminimize()
        .map_err(|error| format!("Failed to unminimize quick launcher: {error}"))?;
    window
        .show()
        .map_err(|error| format!("Failed to show quick launcher: {error}"))?;
    window
        .set_focus()
        .map_err(|error| format!("Failed to focus quick launcher: {error}"))
}

#[cfg(desktop)]
fn create_window(app: &tauri::AppHandle) -> Result<tauri::WebviewWindow, String> {
    let spec = quick_launcher_window_spec();
    tauri::WebviewWindowBuilder::new(
        app,
        QUICK_LAUNCHER_LABEL,
        tauri::WebviewUrl::App(spec.route.into()),
    )
    .title(QUICK_LAUNCHER_TITLE)
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
    .map_err(|error| format!("Failed to create quick launcher: {error}"))
}

#[cfg(desktop)]
#[tauri::command]
pub fn show_quick_launcher(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;

    let window = match app.get_webview_window(QUICK_LAUNCHER_LABEL) {
        Some(window) => window,
        None => create_window(&app)?,
    };
    configure_transparent_surface(&window)?;
    reveal_window(&window)
}

#[cfg(mobile)]
#[tauri::command]
pub fn show_quick_launcher(_app: tauri::AppHandle) -> Result<(), String> {
    Err("The quick launcher is only available on desktop".to_string())
}

#[cfg(test)]
mod tests {
    use super::{quick_launcher_window_spec, Color, TRANSPARENT_BACKGROUND};

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
}
