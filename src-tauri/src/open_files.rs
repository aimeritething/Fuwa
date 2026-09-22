//! Finder, Open With and Dock opens. All three reach the process as one AppKit
//! call, `application:openURLs:`, which tao turns into `RunEvent::Opened { urls }`.
//! On a launch by document that event fires before `Ready`, so before `setup`
//! has created the window and long before the renderer has a listener; while
//! the app is running it arrives on a live loop.
//!
//! One shape serves both: every path is buffered in this managed state, which
//! `Builder::manage` registers before `run()` so it exists whenever `Opened`
//! fires, and an event pokes the renderer. The renderer treats the buffer as
//! the source of truth and drains it through `take_pending_open`: once after
//! its Session is restored, and again on every poke (ADR-0010). A poke that
//! nobody hears (no window yet) costs nothing; the paths wait in the buffer.

use std::{
    path::{Path, PathBuf},
    sync::Mutex,
    time::Instant,
};
use tauri::{AppHandle, Emitter, Manager, State, Url};

/// The renderer's poke. The payload is the paths just accepted, for logging;
/// the renderer drains the buffer rather than reading the payload.
pub const OPEN_FILES_EVENT: &str = "plumo://open-files";

/// Only `.md` is associated; Image files are not openable from outside Plumo
/// in v0.1, and anything else Launch Services hands over is dropped here.
const DOCUMENT_EXTENSION: &str = "md";

#[derive(Default)]
struct Intake {
    paths: Vec<PathBuf>,
    /// Set by `mark_ready`; before that no logger is installed, so the
    /// observation of an early `Opened` waits here to be logged at `Ready`.
    ready: bool,
    observations: Vec<String>,
}

/// Paths handed over by Launch Services that the renderer has not drained yet.
pub struct PendingOpen {
    inner: Mutex<Intake>,
    launched_at: Instant,
}

impl Default for PendingOpen {
    fn default() -> Self {
        Self {
            inner: Mutex::new(Intake::default()),
            launched_at: Instant::now(),
        }
    }
}

/// What the `Opened` arm has to do besides buffering.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Accepted {
    /// Nothing openable in the request.
    Nothing,
    /// Buffered and poked; a renderer, if there is one, will drain.
    Buffered,
    /// Buffered after `Ready` with no main window to hear the poke (⌘W closed
    /// it): the window must be recreated so a renderer boots and drains.
    NeedsWindow,
}

/// The Documents among the URLs Launch Services handed over, in its order.
pub fn document_paths(urls: &[Url]) -> Vec<PathBuf> {
    urls.iter()
        .filter_map(|url| url.to_file_path().ok())
        .filter(|path| is_document_path(path))
        .collect()
}

fn is_document_path(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case(DOCUMENT_EXTENSION))
}

/// Accept the URLs of one `RunEvent::Opened`: buffer the Documents among them
/// and poke the renderer. Safe before `Ready`, where the poke goes unheard and
/// the buffer does the work.
pub fn accept(app: &AppHandle, urls: &[Url]) -> Accepted {
    let paths = document_paths(urls);
    let state = app.state::<PendingOpen>();
    let (ready, observation) = state.record(&paths, urls.len());
    if let Some(line) = observation {
        log::info!("{line}");
    }
    if paths.is_empty() {
        return Accepted::Nothing;
    }
    if let Err(error) = app.emit(OPEN_FILES_EVENT, &paths) {
        log::warn!("Could not poke the renderer about an open request: {error}");
    }
    if ready && app.get_webview_window(crate::MAIN_WINDOW_LABEL).is_none() {
        Accepted::NeedsWindow
    } else {
        Accepted::Buffered
    }
}

/// `Ready` fired: the logger exists from here on, so the order of `Opened`
/// and `Ready` seen on this launch is written out now (the ticket asked for
/// the observation).
pub fn mark_ready(app: &AppHandle) {
    for line in app.state::<PendingOpen>().mark_ready() {
        log::info!("{line}");
    }
}

impl PendingOpen {
    /// Buffer `paths` and return whether `Ready` has fired, plus the
    /// observation line to log now (`None` while it waits for the logger).
    fn record(&self, paths: &[PathBuf], requested: usize) -> (bool, Option<String>) {
        let mut intake = self.inner.lock().unwrap();
        let line = format!(
            "Opened {requested} url(s), {} Document(s) {:?}, {} ms after launch, {} Ready",
            paths.len(),
            paths,
            self.launched_at.elapsed().as_millis(),
            if intake.ready { "after" } else { "before" },
        );
        intake.paths.extend(paths.iter().cloned());
        if intake.ready {
            (true, Some(line))
        } else {
            intake.observations.push(line);
            (false, None)
        }
    }

    /// Note `Ready`; returns the lines to log, the `Ready` line last so the
    /// log reads in the order the events fired.
    fn mark_ready(&self) -> Vec<String> {
        let mut intake = self.inner.lock().unwrap();
        intake.ready = true;
        let mut lines = std::mem::take(&mut intake.observations);
        lines.push(format!(
            "Ready {} ms after launch, {} Document(s) pending",
            self.launched_at.elapsed().as_millis(),
            intake.paths.len()
        ));
        lines
    }

    /// Drain, never peek: a renderer that reloads must not reopen the file.
    fn take(&self) -> Vec<PathBuf> {
        std::mem::take(&mut self.inner.lock().unwrap().paths)
    }
}

/// The renderer's drain, once its listener is registered and its Session
/// restored, and again on every poke. Paths as strings, the shape the mock
/// Folder fixture answers with.
#[tauri::command]
pub fn take_pending_open(state: State<'_, PendingOpen>) -> Vec<String> {
    state
        .take()
        .iter()
        .map(|path| path.to_string_lossy().into_owned())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn url(path: &str) -> Url {
        Url::from_file_path(path).unwrap()
    }

    #[test]
    fn document_paths_keeps_md_only_in_the_requested_order() {
        let urls = [
            url("/Users/plumo/Notes/B.md"),
            url("/Users/plumo/Notes/lake.png"),
            url("/Users/plumo/Notes/A.MD"),
            url("/Users/plumo/Notes/README.markdown"),
            url("/Users/plumo/Notes/notes.txt"),
        ];

        assert_eq!(
            document_paths(&urls),
            vec![
                PathBuf::from("/Users/plumo/Notes/B.md"),
                PathBuf::from("/Users/plumo/Notes/A.MD"),
            ]
        );
    }

    #[test]
    fn document_paths_drops_non_file_urls() {
        let urls = [Url::parse("https://example.com/Plan.md").unwrap()];

        assert!(document_paths(&urls).is_empty());
    }

    #[test]
    fn take_drains_what_was_recorded_and_then_answers_empty() {
        let pending = PendingOpen::default();
        pending.record(&[PathBuf::from("/a.md")], 1);
        pending.record(&[PathBuf::from("/b.md")], 1);

        assert_eq!(
            pending.take(),
            vec![PathBuf::from("/a.md"), PathBuf::from("/b.md")]
        );
        assert!(pending.take().is_empty());
    }

    #[test]
    fn an_opened_before_ready_is_logged_at_ready_in_event_order() {
        let pending = PendingOpen::default();

        let (ready, line) = pending.record(&[PathBuf::from("/a.md")], 1);
        assert!(!ready);
        assert_eq!(line, None);

        let lines = pending.mark_ready();
        assert_eq!(lines.len(), 2);
        assert!(lines[0].starts_with("Opened 1 url(s), 1 Document(s)"));
        assert!(lines[0].ends_with("before Ready"));
        assert!(lines[1].starts_with("Ready "));
        assert!(lines[1].ends_with("1 Document(s) pending"));
    }

    #[test]
    fn an_opened_after_ready_is_logged_at_once() {
        let pending = PendingOpen::default();
        pending.mark_ready();

        let (ready, line) = pending.record(&[PathBuf::from("/a.md")], 2);

        assert!(ready);
        let line = line.unwrap();
        assert!(line.starts_with("Opened 2 url(s), 1 Document(s)"));
        assert!(line.ends_with("after Ready"));
        assert!(pending.mark_ready().len() == 1, "nothing left waiting");
    }
}
