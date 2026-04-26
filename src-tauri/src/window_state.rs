use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{
    App, AppHandle, Manager, PhysicalPosition, PhysicalSize, Position, RunEvent, Size,
    WebviewWindow, WindowEvent,
};

const MAIN_WINDOW_LABEL: &str = "main";
const WINDOW_STATE_FILE: &str = "window-state.json";
const MIN_WINDOW_WIDTH: u32 = 480;
const MIN_WINDOW_HEIGHT: u32 = 400;

#[derive(Debug, Default)]
pub(crate) struct MainWindowFrameState(Mutex<Option<WindowFrame>>);

#[derive(Debug, Clone, Copy, Eq, PartialEq, Serialize, Deserialize)]
struct WindowFrame {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

#[derive(Debug, Clone, Copy, Eq, PartialEq)]
struct ScreenArea {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct PersistedWindowState {
    main: Option<WindowFrame>,
}

pub(crate) fn restore_main_window_state(app: &mut App) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return;
    };
    let Some(frame) = read_main_window_frame() else {
        return;
    };
    let areas = current_screen_areas(&window);
    let Some(restored_frame) = fit_frame_to_screens(frame, &areas) else {
        return;
    };

    if let Err(err) = apply_window_frame(&window, restored_frame) {
        log::warn!("Failed to restore main window state: {err}");
        return;
    }

    cache_frame(app.handle(), restored_frame);
}

pub(crate) fn handle_run_event(app_handle: &AppHandle, event: &RunEvent) {
    match event {
        RunEvent::WindowEvent {
            label,
            event:
                WindowEvent::Moved(_) | WindowEvent::Resized(_) | WindowEvent::ScaleFactorChanged { .. },
            ..
        } if label == MAIN_WINDOW_LABEL => cache_current_normal_frame(app_handle),
        RunEvent::WindowEvent {
            label,
            event: WindowEvent::CloseRequested { .. } | WindowEvent::Destroyed,
            ..
        } if label == MAIN_WINDOW_LABEL => save_main_window_frame(app_handle),
        RunEvent::Exit => save_main_window_frame(app_handle),
        _ => {}
    }
}

fn cache_current_normal_frame(app_handle: &AppHandle) {
    if let Some(frame) = current_normal_main_window_frame(app_handle) {
        cache_frame(app_handle, frame);
    }
}

fn save_main_window_frame(app_handle: &AppHandle) {
    let frame = current_normal_main_window_frame(app_handle).or_else(|| cached_frame(app_handle));
    if let Some(frame) = frame {
        if let Err(err) = write_main_window_frame(frame) {
            log::warn!("Failed to save main window state: {err}");
        }
    }
}

fn current_normal_main_window_frame(app_handle: &AppHandle) -> Option<WindowFrame> {
    let window = app_handle.get_webview_window(MAIN_WINDOW_LABEL)?;
    if !is_normal_window(&window) {
        return None;
    }
    read_window_frame(&window).filter(is_valid_saved_frame)
}

fn is_normal_window(window: &WebviewWindow) -> bool {
    let is_fullscreen = window.is_fullscreen().unwrap_or(false);
    let is_maximized = window.is_maximized().unwrap_or(false);
    let is_minimized = window.is_minimized().unwrap_or(false);
    !is_fullscreen && !is_maximized && !is_minimized
}

fn read_window_frame(window: &WebviewWindow) -> Option<WindowFrame> {
    let position = window.outer_position().ok()?;
    let size = window.outer_size().ok()?;
    Some(WindowFrame {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
    })
}

fn apply_window_frame(window: &WebviewWindow, frame: WindowFrame) -> tauri::Result<()> {
    window.set_size(Size::Physical(PhysicalSize::new(frame.width, frame.height)))?;
    window.set_position(Position::Physical(PhysicalPosition::new(frame.x, frame.y)))
}

fn current_screen_areas(window: &WebviewWindow) -> Vec<ScreenArea> {
    window
        .available_monitors()
        .unwrap_or_default()
        .into_iter()
        .map(|monitor| {
            let area = monitor.work_area();
            ScreenArea {
                x: area.position.x,
                y: area.position.y,
                width: area.size.width,
                height: area.size.height,
            }
        })
        .filter(ScreenArea::has_area)
        .collect()
}

fn fit_frame_to_screens(frame: WindowFrame, screens: &[ScreenArea]) -> Option<WindowFrame> {
    if frame_is_visible(frame, screens) {
        return Some(frame);
    }

    let screen = best_screen_for_frame(frame, screens)?;
    let width = clamp_dimension(frame.width, MIN_WINDOW_WIDTH, screen.width);
    let height = clamp_dimension(frame.height, MIN_WINDOW_HEIGHT, screen.height);
    Some(WindowFrame {
        x: clamp_axis(frame.x, width, screen.x, screen.width),
        y: clamp_axis(frame.y, height, screen.y, screen.height),
        width,
        height,
    })
}

fn frame_is_visible(frame: WindowFrame, screens: &[ScreenArea]) -> bool {
    frame_corners(frame)
        .into_iter()
        .all(|point| screens.iter().any(|screen| screen.contains(point)))
}

fn frame_corners(frame: WindowFrame) -> [(i32, i32); 4] {
    let right = frame.right() - 1;
    let bottom = frame.bottom() - 1;
    [
        (frame.x, frame.y),
        (right, frame.y),
        (frame.x, bottom),
        (right, bottom),
    ]
}

fn best_screen_for_frame(frame: WindowFrame, screens: &[ScreenArea]) -> Option<ScreenArea> {
    screens
        .iter()
        .copied()
        .filter(ScreenArea::has_area)
        .max_by_key(|screen| intersection_area(frame, *screen))
}

fn intersection_area(frame: WindowFrame, screen: ScreenArea) -> u64 {
    let left = frame.x.max(screen.x);
    let top = frame.y.max(screen.y);
    let right = frame.right().min(screen.right());
    let bottom = frame.bottom().min(screen.bottom());
    if right <= left || bottom <= top {
        return 0;
    }
    (right - left) as u64 * (bottom - top) as u64
}

fn clamp_dimension(value: u32, min: u32, max: u32) -> u32 {
    if max < min {
        max
    } else {
        value.clamp(min, max)
    }
}

fn clamp_axis(value: i32, size: u32, area_start: i32, area_size: u32) -> i32 {
    let max_start = area_start + area_size as i32 - size as i32;
    if max_start < area_start {
        return area_start;
    }
    value.clamp(area_start, max_start)
}

fn cache_frame(app_handle: &AppHandle, frame: WindowFrame) {
    let state: tauri::State<'_, MainWindowFrameState> = app_handle.state();
    if let Ok(mut cached_frame) = state.0.lock() {
        *cached_frame = Some(frame);
    };
}

fn cached_frame(app_handle: &AppHandle) -> Option<WindowFrame> {
    let state: tauri::State<'_, MainWindowFrameState> = app_handle.state();
    state.0.lock().ok().and_then(|cached_frame| *cached_frame)
}

fn window_state_path() -> Result<PathBuf, String> {
    crate::settings::preferred_app_config_path(WINDOW_STATE_FILE)
}

fn read_main_window_frame() -> Option<WindowFrame> {
    let content = fs::read_to_string(window_state_path().ok()?).ok()?;
    let persisted: PersistedWindowState = serde_json::from_str(&content).ok()?;
    persisted.main.filter(is_valid_saved_frame)
}

fn write_main_window_frame(frame: WindowFrame) -> Result<(), String> {
    let path = window_state_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create window state directory: {e}"))?;
    }

    let persisted = PersistedWindowState { main: Some(frame) };
    let json = serde_json::to_string_pretty(&persisted)
        .map_err(|e| format!("Failed to serialize window state: {e}"))?;
    fs::write(path, json).map_err(|e| format!("Failed to write window state: {e}"))
}

fn is_valid_saved_frame(frame: &WindowFrame) -> bool {
    frame.width >= MIN_WINDOW_WIDTH && frame.height >= MIN_WINDOW_HEIGHT
}

impl WindowFrame {
    fn right(self) -> i32 {
        self.x + self.width as i32
    }

    fn bottom(self) -> i32 {
        self.y + self.height as i32
    }
}

impl ScreenArea {
    fn right(self) -> i32 {
        self.x + self.width as i32
    }

    fn bottom(self) -> i32 {
        self.y + self.height as i32
    }

    fn has_area(&self) -> bool {
        self.width > 0 && self.height > 0
    }

    fn contains(&self, point: (i32, i32)) -> bool {
        let (x, y) = point;
        x >= self.x && x < self.right() && y >= self.y && y < self.bottom()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn frame(x: i32, y: i32, width: u32, height: u32) -> WindowFrame {
        WindowFrame {
            x,
            y,
            width,
            height,
        }
    }

    fn screen(x: i32, y: i32, width: u32, height: u32) -> ScreenArea {
        ScreenArea {
            x,
            y,
            width,
            height,
        }
    }

    #[test]
    fn keeps_valid_frame_unchanged() {
        let saved = frame(120, 80, 1400, 900);
        let screens = [screen(0, 0, 1920, 1080)];

        assert_eq!(fit_frame_to_screens(saved, &screens), Some(saved));
    }

    #[test]
    fn clamps_oversized_frame_to_current_work_area() {
        let saved = frame(-100, -80, 2600, 1800);
        let screens = [screen(0, 0, 1440, 900)];

        assert_eq!(
            fit_frame_to_screens(saved, &screens),
            Some(frame(0, 0, 1440, 900))
        );
    }

    #[test]
    fn moves_offscreen_frame_back_to_a_visible_screen() {
        let saved = frame(3200, 1800, 900, 700);
        let screens = [screen(0, 0, 1440, 900)];

        assert_eq!(
            fit_frame_to_screens(saved, &screens),
            Some(frame(540, 200, 900, 700))
        );
    }

    #[test]
    fn picks_the_screen_with_the_largest_visible_overlap() {
        let saved = frame(1700, 100, 900, 700);
        let screens = [screen(0, 0, 1920, 1080), screen(1920, 0, 1440, 900)];

        assert_eq!(fit_frame_to_screens(saved, &screens), Some(saved));
    }

    #[test]
    fn ignores_empty_screen_areas_when_restoring() {
        let saved = frame(100, 100, 800, 600);
        let screens = [screen(0, 0, 0, 900), screen(0, 0, 1440, 900)];

        assert_eq!(fit_frame_to_screens(saved, &screens), Some(saved));
    }

    #[test]
    fn returns_none_when_no_usable_screens_exist() {
        let saved = frame(100, 100, 800, 600);

        assert_eq!(fit_frame_to_screens(saved, &[]), None);
        assert_eq!(fit_frame_to_screens(saved, &[screen(0, 0, 0, 0)]), None);
    }

    #[test]
    fn fits_to_tiny_work_area_when_it_is_smaller_than_minimum_size() {
        let saved = frame(100, 100, 800, 600);
        let screens = [screen(0, 0, 320, 240)];

        assert_eq!(
            fit_frame_to_screens(saved, &screens),
            Some(frame(0, 0, 320, 240))
        );
    }

    #[test]
    fn reports_visibility_across_adjacent_screens() {
        let screens = [screen(0, 0, 1920, 1080), screen(1920, 0, 1440, 900)];

        assert!(frame_is_visible(frame(1700, 100, 900, 700), &screens));
        assert!(!frame_is_visible(frame(1700, 850, 900, 300), &screens));
    }

    #[test]
    fn computes_frame_and_screen_edges_for_overlap_checks() {
        let saved = frame(10, 20, 800, 600);
        let area = screen(0, 0, 500, 400);

        assert_eq!(saved.right(), 810);
        assert_eq!(saved.bottom(), 620);
        assert_eq!(area.right(), 500);
        assert_eq!(area.bottom(), 400);
        assert_eq!(intersection_area(saved, area), 490 * 380);
        assert_eq!(intersection_area(saved, screen(900, 900, 200, 200)), 0);
    }

    #[test]
    fn rejects_corrupted_tiny_saved_frames() {
        assert!(!is_valid_saved_frame(&frame(100, 100, 1, 900)));
        assert!(!is_valid_saved_frame(&frame(100, 100, 1400, 1)));
    }
}
