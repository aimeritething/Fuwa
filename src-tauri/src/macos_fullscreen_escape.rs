const ESCAPE_KEY_CODE: u16 = 53;
static DISMISSABLE_SURFACE_OPEN: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);

fn should_suppress_escape(key_code: u16, surface_open: bool, is_fullscreen: bool) -> bool {
    key_code == ESCAPE_KEY_CODE && surface_open && is_fullscreen
}

#[tauri::command]
pub(crate) fn set_macos_dismissable_escape_surface_open(open: bool) {
    DISMISSABLE_SURFACE_OPEN.store(open, std::sync::atomic::Ordering::Relaxed);
}

#[cfg(all(desktop, target_os = "macos"))]
pub(crate) fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use block2::RcBlock;
    use objc2_app_kit::{NSEvent, NSEventMask};
    use std::ptr::NonNull;
    use std::sync::atomic::Ordering;
    use tauri::Manager;

    const DISPATCH_ESCAPE_SCRIPT: &str = "document.activeElement?.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true,cancelable:true}));";

    let app_handle = app.handle().clone();
    let handler = RcBlock::new(move |event: NonNull<NSEvent>| -> *mut NSEvent {
        // SAFETY: AppKit supplies a non-null NSEvent for the duration of this callback.
        let event_ref = unsafe { event.as_ref() };
        let Some(window) = app_handle.get_webview_window("main") else {
            return event.as_ptr();
        };
        let surface_open = DISMISSABLE_SURFACE_OPEN.load(Ordering::Relaxed);
        let is_fullscreen = window.is_fullscreen().unwrap_or(false);

        if !should_suppress_escape(event_ref.keyCode(), surface_open, is_fullscreen) {
            return event.as_ptr();
        }

        let _ = window.eval(DISPATCH_ESCAPE_SCRIPT);
        std::ptr::null_mut()
    });

    // SAFETY: The handler returns only AppKit's input event pointer or null, as required.
    let monitor = unsafe {
        NSEvent::addLocalMonitorForEventsMatchingMask_handler(NSEventMask::KeyDown, &handler)
    };
    if let Some(monitor) = monitor {
        std::mem::forget(monitor);
    }
    Ok(())
}

#[cfg(not(all(desktop, target_os = "macos")))]
pub(crate) fn setup(_app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::should_suppress_escape;

    #[test]
    fn suppresses_only_fullscreen_dialog_escape() {
        assert!(should_suppress_escape(53, true, true));
        assert!(!should_suppress_escape(53, false, true));
        assert!(!should_suppress_escape(53, true, false));
        assert!(!should_suppress_escape(3, true, true));
    }
}
