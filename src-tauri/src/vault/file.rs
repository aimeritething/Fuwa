use std::fs;
use std::io::{Error, ErrorKind, Write};
use std::path::Path;
use std::thread;
use std::time::Duration;

const SAVE_RETRY_DELAYS_MS: [u64; 4] = [25, 50, 100, 200];

fn invalid_utf8_text_error(path: &Path) -> String {
    format!("File is not valid UTF-8 text: {}", path.display())
}

fn is_invalid_platform_path_error(error: &Error) -> bool {
    error.kind() == ErrorKind::InvalidInput
}

fn is_retryable_save_error(error: &Error) -> bool {
    error.kind() == ErrorKind::PermissionDenied
}

fn write_with_retry(
    mut write_once: impl FnMut() -> Result<(), Error>,
    mut wait_before_retry: impl FnMut(u64),
) -> Result<(), Error> {
    for delay in SAVE_RETRY_DELAYS_MS {
        match write_once() {
            Ok(()) => return Ok(()),
            Err(error) if is_retryable_save_error(&error) => wait_before_retry(delay),
            Err(error) => return Err(error),
        }
    }
    write_once()
}

fn read_existing_note_bytes(path: &Path) -> Result<Vec<u8>, String> {
    if !path.exists() {
        return Err(format!("File does not exist: {}", path.display()));
    }
    if !path.is_file() {
        return Err(format!("Path is not a file: {}", path.display()));
    }
    fs::read(path).map_err(|e| format!("Failed to read {}: {}", path.display(), e))
}

#[derive(Clone, Copy)]
enum NoteIoOperation {
    Save,
    Create,
}

#[derive(Clone, Copy)]
struct NotePathDisplay<'a> {
    value: &'a str,
}

impl<'a> NotePathDisplay<'a> {
    fn new(value: &'a str) -> Self {
        Self { value }
    }
}

impl NoteIoOperation {
    fn verb(self) -> &'static str {
        match self {
            Self::Save => "save",
            Self::Create => "create",
        }
    }
}

fn note_io_error(operation: NoteIoOperation, path: NotePathDisplay<'_>, error: &Error) -> String {
    let verb = operation.verb();
    if is_invalid_platform_path_error(error) {
        let path = path.value;
        format!(
            "Failed to {verb} note: the path is invalid on this platform. Rename the note or move it to a valid folder, then try again. Path: {path}"
        )
    } else {
        let path = path.value;
        format!("Failed to {verb} {path}: {error}")
    }
}

/// Read the content of a single note file.
pub fn get_note_content(path: &Path) -> Result<String, String> {
    let bytes = read_existing_note_bytes(path)?;
    String::from_utf8(bytes).map_err(|_| invalid_utf8_text_error(path))
}

fn validate_save_path(file_path: &Path, display_path: &str) -> Result<(), String> {
    let parent_missing = file_path.parent().is_some_and(|p| !p.exists());
    if parent_missing {
        return Err(format!(
            "Parent directory does not exist: {}",
            file_path.parent().unwrap().display()
        ));
    }
    let is_readonly = file_path.exists()
        && file_path
            .metadata()
            .map(|m| m.permissions().readonly())
            .unwrap_or(false);
    if is_readonly {
        return Err(format!("File is read-only: {}", display_path));
    }
    Ok(())
}

/// Write content to a note file. Creates parent directory if needed, validates path,
/// then writes content to disk.
pub fn save_note_content(path: &str, content: &str) -> Result<(), String> {
    let file_path = Path::new(path);
    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| {
                note_io_error(NoteIoOperation::Save, NotePathDisplay::new(path), &e)
            })?;
        }
    }
    validate_save_path(file_path, path)?;
    write_with_retry(
        || fs::write(file_path, content),
        |delay| thread::sleep(Duration::from_millis(delay)),
    )
    .map_err(|e| note_io_error(NoteIoOperation::Save, NotePathDisplay::new(path), &e))
}

/// Create a new note file without overwriting any existing file.
pub fn create_note_content(path: &str, content: &str) -> Result<(), String> {
    let file_path = Path::new(path);
    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| {
                note_io_error(NoteIoOperation::Create, NotePathDisplay::new(path), &e)
            })?;
        }
    }
    validate_save_path(file_path, path)?;
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(file_path)
        .map_err(|e| match e.kind() {
            ErrorKind::AlreadyExists => format!("File already exists: {}", path),
            _ => note_io_error(NoteIoOperation::Create, NotePathDisplay::new(path), &e),
        })?;
    file.write_all(content.as_bytes())
        .map_err(|e| note_io_error(NoteIoOperation::Save, NotePathDisplay::new(path), &e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_invalid_path_syntax_as_recoverable_save_error() {
        let path = "/Users/alex/notes/untitled-note-1777236475.md";
        let message = note_io_error(
            NoteIoOperation::Save,
            NotePathDisplay::new(path),
            &Error::new(ErrorKind::InvalidInput, "invalid path"),
        );

        assert!(message.contains("path is invalid on this platform"));
        assert!(message.contains("Rename the note or move it to a valid folder"));
        assert!(!message.contains("invalid path"));
    }

    #[test]
    fn retries_transient_access_denied_save_errors() {
        let mut attempts = 0;
        let mut delays = Vec::new();

        write_with_retry(
            || {
                attempts += 1;
                if attempts == 1 {
                    Err(Error::new(ErrorKind::PermissionDenied, "Access is denied"))
                } else {
                    Ok(())
                }
            },
            |delay| delays.push(delay),
        )
        .unwrap();

        assert_eq!(attempts, 2);
        assert_eq!(delays, vec![25]);
    }
}
