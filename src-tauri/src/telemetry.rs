use crate::settings;
use regex::Regex;
use std::sync::Mutex;

/// Global Sentry guard — must live for the duration of the app.
static SENTRY_GUARD: Mutex<Option<sentry::ClientInitGuard>> = Mutex::new(None);

/// Scrub absolute file paths from a string to prevent vault content leakage.
fn scrub_paths(input: &str) -> String {
    let re = Regex::new(r"(?:/[\w.-]+){2,}|[A-Z]:\\[\w\\.-]+").unwrap();
    re.replace_all(input, "<redacted-path>").to_string()
}

/// Initialize Sentry if the user has opted in to crash reporting.
/// Returns `true` if Sentry was initialized, `false` if skipped.
pub fn init_sentry_from_settings() -> bool {
    let settings = match settings::get_settings() {
        Ok(s) => s,
        Err(_) => return false,
    };

    if settings.crash_reporting_enabled != Some(true) {
        return false;
    }

    let dsn = option_env!("SENTRY_DSN").unwrap_or_default();
    if dsn.is_empty() {
        return false;
    }

    let anonymous_id = settings.anonymous_id.unwrap_or_default();
    let guard = sentry::init(sentry::ClientOptions {
        dsn: dsn.parse().ok(),
        release: Some(env!("CARGO_PKG_VERSION").into()),
        send_default_pii: false,
        before_send: Some(std::sync::Arc::new(|mut event| {
            if let Some(ref mut msg) = event.message {
                *msg = scrub_paths(msg);
            }
            Some(event)
        })),
        ..Default::default()
    });

    sentry::configure_scope(|scope| {
        scope.set_user(Some(sentry::User {
            id: Some(anonymous_id),
            ..Default::default()
        }));
    });

    *SENTRY_GUARD.lock().unwrap() = Some(guard);
    true
}

/// Tear down and reinitialize Sentry (called when user changes settings).
pub fn reinit_sentry() {
    // Drop old guard first
    *SENTRY_GUARD.lock().unwrap() = None;
    // Re-read settings and optionally re-init
    init_sentry_from_settings();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scrub_paths_unix() {
        assert_eq!(
            scrub_paths("Error at /Users/luca/Laputa/note.md"),
            "Error at <redacted-path>"
        );
    }

    #[test]
    fn test_scrub_paths_windows() {
        assert_eq!(
            scrub_paths("Error at C:\\Users\\test\\doc.md"),
            "Error at <redacted-path>"
        );
    }

    #[test]
    fn test_scrub_paths_no_paths() {
        assert_eq!(scrub_paths("Normal error message"), "Normal error message");
    }

    #[test]
    fn test_init_sentry_returns_false_without_dsn() {
        // Without SENTRY_DSN env var set at compile time, init should return false
        assert!(!init_sentry_from_settings());
    }
}
