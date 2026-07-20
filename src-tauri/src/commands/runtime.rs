use std::time::Instant;

pub struct StartupTimingState {
    started_at: Instant,
}

impl Default for StartupTimingState {
    fn default() -> Self {
        Self {
            started_at: Instant::now(),
        }
    }
}

impl StartupTimingState {
    fn elapsed_ms(&self) -> u64 {
        self.started_at.elapsed().as_millis() as u64
    }
}

#[tauri::command]
pub fn get_startup_elapsed_ms(state: tauri::State<'_, StartupTimingState>) -> u64 {
    state.elapsed_ms()
}

fn should_use_external_media_preview_for_appimage(is_linux_appimage: bool) -> bool {
    is_linux_appimage
}

fn map_print_result<E: std::fmt::Display>(result: Result<(), E>) -> Result<(), String> {
    result.map_err(|error| format!("Failed to open the system print dialog: {error}"))
}

#[cfg(all(desktop, target_os = "linux"))]
fn linux_appimage_running() -> bool {
    crate::linux_appimage::is_running()
}

#[cfg(not(all(desktop, target_os = "linux")))]
fn linux_appimage_running() -> bool {
    false
}

#[tauri::command]
pub fn should_use_external_media_preview() -> bool {
    should_use_external_media_preview_for_appimage(linux_appimage_running())
}

#[tauri::command]
pub fn print_current_webview(window: tauri::WebviewWindow) -> Result<(), String> {
    map_print_result(window.print())
}

#[cfg(test)]
mod tests {
    use super::{
        map_print_result, should_use_external_media_preview_for_appimage, StartupTimingState,
    };

    #[test]
    fn external_media_preview_is_limited_to_linux_appimage() {
        assert!(should_use_external_media_preview_for_appimage(true));
        assert!(!should_use_external_media_preview_for_appimage(false));
    }

    #[test]
    fn print_errors_are_formatted_for_the_renderer() {
        let result = map_print_result::<&str>(Err("printer unavailable"));

        assert_eq!(
            result,
            Err("Failed to open the system print dialog: printer unavailable".to_string())
        );
    }

    #[test]
    fn startup_clock_reports_elapsed_milliseconds() {
        assert!(StartupTimingState::default().elapsed_ms() < 100);
    }
}
