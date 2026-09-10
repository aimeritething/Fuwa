use crate::commands::expand_tilde;
use std::ffi::OsString;
use std::path::{Component, Path, PathBuf};

pub(crate) const ACTIVE_VAULT_PATH_ERROR: &str = "Path must stay inside the active vault";
pub(crate) const ACTIVE_VAULT_UNAVAILABLE_ERROR: &str = "Active vault is not available";
pub(crate) const NO_ACTIVE_VAULT_ERROR: &str = "No active vault selected";

/// The single root every file command is confined to.
///
/// The frontend passes `vault_path` on every call and that path *is* the root:
/// there is no vault registry, settings file or configured "active vault"
/// behind it. The root is kept both as requested (tilde-expanded, so validated
/// paths keep the caller's spelling) and canonicalized (symlinks resolved, so
/// containment checks cannot be fooled).
#[derive(Clone, Debug)]
pub(crate) struct VaultBoundary {
    requested_root: PathBuf,
    canonical_root: PathBuf,
}

impl VaultBoundary {
    pub(crate) fn from_request(requested_vault_path: Option<&str>) -> Result<Self, String> {
        let raw_root = requested_vault_path
            .filter(|path| !path.trim().is_empty())
            .ok_or_else(|| NO_ACTIVE_VAULT_ERROR.to_string())?;
        let requested_root = PathBuf::from(expand_tilde(raw_root).into_owned());
        let canonical_root = requested_root
            .canonicalize()
            .map_err(|_| ACTIVE_VAULT_UNAVAILABLE_ERROR.to_string())?;
        if !canonical_root.is_dir() {
            return Err(ACTIVE_VAULT_UNAVAILABLE_ERROR.to_string());
        }

        Ok(Self {
            requested_root,
            canonical_root,
        })
    }

    fn requested_root_str(&self) -> String {
        path_to_string(&self.requested_root)
    }

    fn validate_existing_path(&self, raw_path: &str) -> Result<String, String> {
        self.validate_path(raw_path, false)
    }

    pub(crate) fn validate_existing_paths(
        &self,
        raw_paths: &[String],
    ) -> Result<Vec<String>, String> {
        raw_paths
            .iter()
            .map(|path| self.validate_existing_path(path))
            .collect()
    }

    fn validate_writable_path(&self, raw_path: &str) -> Result<String, String> {
        self.validate_path(raw_path, true)
    }

    pub(crate) fn child_path(&self, relative_path: &str) -> Result<PathBuf, String> {
        validate_relative_child_path(relative_path)?;
        let requested = self.requested_root.join(relative_path);
        let canonical = canonicalize_candidate_for_write(&requested)?;
        self.ensure_within_root(&canonical)?;
        Ok(requested)
    }

    fn validate_path(&self, raw_path: &str, allow_missing_leaf: bool) -> Result<String, String> {
        let requested = self.requested_path(raw_path);
        let canonical = if allow_missing_leaf {
            canonicalize_candidate_for_write(&requested)?
        } else {
            requested
                .canonicalize()
                .map_err(|_| "File does not exist".to_string())?
        };
        self.ensure_within_root(&canonical)?;
        Ok(path_to_string(&requested))
    }

    fn requested_path(&self, raw_path: &str) -> PathBuf {
        let expanded = PathBuf::from(expand_tilde(raw_path).into_owned());
        if expanded.is_absolute() {
            expanded
        } else {
            self.requested_root.join(expanded)
        }
    }

    fn ensure_within_root(&self, candidate: &Path) -> Result<(), String> {
        candidate
            .strip_prefix(&self.canonical_root)
            .map(|_| ())
            .map_err(|_| ACTIVE_VAULT_PATH_ERROR.to_string())
    }
}

fn canonicalize_candidate_for_write(path: &Path) -> Result<PathBuf, String> {
    let (ancestor, tail) = find_existing_ancestor(path)?;
    Ok(tail
        .into_iter()
        .fold(ancestor, |current, segment| current.join(segment)))
}

fn find_existing_ancestor(path: &Path) -> Result<(PathBuf, Vec<OsString>), String> {
    let mut current = path;
    let mut tail = Vec::new();

    loop {
        if current.exists() {
            let canonical = current
                .canonicalize()
                .map_err(|_| ACTIVE_VAULT_PATH_ERROR.to_string())?;
            tail.reverse();
            return Ok((canonical, tail));
        }

        let file_name = current
            .file_name()
            .ok_or_else(|| ACTIVE_VAULT_PATH_ERROR.to_string())?;
        tail.push(file_name.to_os_string());
        current = current
            .parent()
            .ok_or_else(|| ACTIVE_VAULT_PATH_ERROR.to_string())?;
    }
}

fn validate_relative_child_path(relative_path: &str) -> Result<(), String> {
    if relative_path.trim().is_empty() {
        return Err(ACTIVE_VAULT_PATH_ERROR.to_string());
    }

    let path = Path::new(relative_path);
    if path.is_absolute() {
        return Err(ACTIVE_VAULT_PATH_ERROR.to_string());
    }

    if path.components().any(|component| {
        matches!(
            component,
            Component::CurDir | Component::ParentDir | Component::RootDir | Component::Prefix(_)
        )
    }) {
        return Err(ACTIVE_VAULT_PATH_ERROR.to_string());
    }

    Ok(())
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

pub(crate) fn with_boundary<T>(
    requested_vault_path: Option<&str>,
    action: impl FnOnce(&VaultBoundary) -> Result<T, String>,
) -> Result<T, String> {
    let boundary = VaultBoundary::from_request(requested_vault_path)?;
    action(&boundary)
}

#[derive(Clone, Copy)]
pub(crate) enum ValidatedPathMode {
    Existing,
    Writable,
}

pub(crate) fn with_validated_path<T>(
    path: &str,
    vault_path: Option<&str>,
    mode: ValidatedPathMode,
    action: impl FnOnce(&str) -> Result<T, String>,
) -> Result<T, String> {
    with_boundary(vault_path, |boundary| {
        let validated_path = validate_for_mode(boundary, path, mode)?;
        action(&validated_path)
    })
}

fn validate_for_mode(
    boundary: &VaultBoundary,
    path: &str,
    mode: ValidatedPathMode,
) -> Result<String, String> {
    match mode {
        ValidatedPathMode::Existing => boundary.validate_existing_path(path),
        ValidatedPathMode::Writable => boundary.validate_writable_path(path),
    }
}

pub(crate) fn with_existing_paths<T>(
    paths: &[String],
    vault_path: Option<&str>,
    action: impl FnOnce(Vec<String>) -> Result<T, String>,
) -> Result<T, String> {
    with_boundary(vault_path, |boundary| {
        let validated_paths = boundary.validate_existing_paths(paths)?;
        action(validated_paths)
    })
}

pub(crate) fn with_requested_root<T>(
    vault_path: &str,
    action: impl FnOnce(&str) -> Result<T, String>,
) -> Result<T, String> {
    with_boundary(Some(vault_path), |boundary| {
        let requested_root = boundary.requested_root_str();
        action(&requested_root)
    })
}

pub(crate) fn with_existing_path_in_requested_vault<T>(
    vault_path: &str,
    path: &str,
    action: impl FnOnce(&str, &str) -> Result<T, String>,
) -> Result<T, String> {
    with_boundary(Some(vault_path), |boundary| {
        let requested_root = boundary.requested_root_str();
        let validated_path = boundary.validate_existing_path(path)?;
        action(&requested_root, &validated_path)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn root_arg(dir: &TempDir) -> String {
        dir.path().to_string_lossy().into_owned()
    }

    fn validate(path: &Path, root: &str, mode: ValidatedPathMode) -> Result<String, String> {
        with_validated_path(&path.to_string_lossy(), Some(root), mode, |validated| {
            Ok(validated.to_string())
        })
    }

    #[test]
    fn from_request_requires_a_root() {
        assert_eq!(
            VaultBoundary::from_request(None).unwrap_err(),
            NO_ACTIVE_VAULT_ERROR
        );
        assert_eq!(
            VaultBoundary::from_request(Some("   ")).unwrap_err(),
            NO_ACTIVE_VAULT_ERROR
        );
    }

    #[test]
    fn from_request_rejects_a_root_that_does_not_exist() {
        let dir = TempDir::new().unwrap();
        let missing = dir.path().join("missing");

        let err = VaultBoundary::from_request(Some(&missing.to_string_lossy())).unwrap_err();

        assert_eq!(err, ACTIVE_VAULT_UNAVAILABLE_ERROR);
    }

    #[test]
    fn from_request_rejects_a_file_as_root() {
        let dir = TempDir::new().unwrap();
        let file = dir.path().join("note.md");
        fs::write(&file, "# Note\n").unwrap();

        let err = VaultBoundary::from_request(Some(&file.to_string_lossy())).unwrap_err();

        assert_eq!(err, ACTIVE_VAULT_UNAVAILABLE_ERROR);
    }

    #[test]
    fn from_request_keeps_requested_and_canonical_roots() {
        let dir = TempDir::new().unwrap();

        let boundary = VaultBoundary::from_request(Some(&root_arg(&dir))).unwrap();

        assert_eq!(boundary.requested_root, dir.path());
        assert_eq!(boundary.canonical_root, dir.path().canonicalize().unwrap());
    }

    #[test]
    fn from_request_expands_a_leading_tilde() {
        let Some(home) = dirs::home_dir() else {
            return;
        };

        let boundary = VaultBoundary::from_request(Some("~")).unwrap();

        assert_eq!(boundary.requested_root, home);
    }

    #[cfg(unix)]
    #[test]
    fn from_request_canonicalizes_the_root_through_a_symlink() {
        let dir = TempDir::new().unwrap();
        let real = dir.path().join("Real Vault");
        let link = dir.path().join("Linked Vault");
        fs::create_dir(&real).unwrap();
        std::os::unix::fs::symlink(&real, &link).unwrap();
        fs::write(real.join("note.md"), "# Note\n").unwrap();
        let link_root = link.to_string_lossy().into_owned();

        let boundary = VaultBoundary::from_request(Some(&link_root)).unwrap();
        assert_eq!(boundary.requested_root, link);
        assert_eq!(boundary.canonical_root, real.canonicalize().unwrap());

        // A note addressed through the symlink stays inside the root and keeps
        // the caller's spelling; the same note addressed through the real path
        // is inside the root too.
        let through_link = validate(
            &link.join("note.md"),
            &link_root,
            ValidatedPathMode::Existing,
        );
        assert_eq!(
            through_link.unwrap(),
            link.join("note.md").to_string_lossy()
        );
        let through_real = validate(
            &real.join("note.md"),
            &link_root,
            ValidatedPathMode::Existing,
        );
        assert_eq!(
            through_real.unwrap(),
            real.join("note.md").to_string_lossy()
        );
    }

    #[cfg(unix)]
    #[test]
    fn validated_paths_reject_a_symlink_inside_the_root_that_points_outside() {
        let vault = TempDir::new().unwrap();
        let outside = TempDir::new().unwrap();
        let outside_note = outside.path().join("outside.md");
        fs::write(&outside_note, "# Outside\n").unwrap();
        let outside_dir = outside.path().join("Shared");
        fs::create_dir(&outside_dir).unwrap();
        fs::write(outside_dir.join("shared.md"), "# Shared\n").unwrap();
        // Both a file link and a directory link sit inside the root but
        // resolve outside it.
        let file_link = vault.path().join("link.md");
        let dir_link = vault.path().join("Linked");
        std::os::unix::fs::symlink(&outside_note, &file_link).unwrap();
        std::os::unix::fs::symlink(&outside_dir, &dir_link).unwrap();
        let root = root_arg(&vault);

        for mode in [ValidatedPathMode::Existing, ValidatedPathMode::Writable] {
            let err = validate(&file_link, &root, mode).unwrap_err();
            assert_eq!(err, ACTIVE_VAULT_PATH_ERROR, "file link should be rejected");
            let err = validate(&dir_link.join("shared.md"), &root, mode).unwrap_err();
            assert_eq!(
                err, ACTIVE_VAULT_PATH_ERROR,
                "path through a dir link should be rejected"
            );
        }

        // A new leaf under the linked directory is rejected before it exists.
        let err =
            validate(&dir_link.join("new.md"), &root, ValidatedPathMode::Writable).unwrap_err();
        assert_eq!(err, ACTIVE_VAULT_PATH_ERROR);

        // `child_path` follows the same rule for relative segments.
        let boundary = VaultBoundary::from_request(Some(&root)).unwrap();
        assert_eq!(
            boundary.child_path("Linked/New Folder").unwrap_err(),
            ACTIVE_VAULT_PATH_ERROR
        );
    }

    #[cfg(unix)]
    #[test]
    fn validated_paths_accept_a_symlink_inside_the_root_that_stays_inside() {
        let vault = TempDir::new().unwrap();
        let real_dir = vault.path().join("Real");
        fs::create_dir(&real_dir).unwrap();
        fs::write(real_dir.join("note.md"), "# Note\n").unwrap();
        let dir_link = vault.path().join("Alias");
        std::os::unix::fs::symlink(&real_dir, &dir_link).unwrap();
        let root = root_arg(&vault);

        let through_link = dir_link.join("note.md");
        let validated = validate(&through_link, &root, ValidatedPathMode::Existing).unwrap();
        // The caller's spelling is kept; only the containment check resolves the link.
        assert_eq!(validated, through_link.to_string_lossy());

        let new_note = dir_link.join("new.md");
        let validated = validate(&new_note, &root, ValidatedPathMode::Writable).unwrap();
        assert_eq!(validated, new_note.to_string_lossy());
    }

    #[test]
    fn validated_paths_reject_parent_traversal_in_both_modes() {
        let vault = TempDir::new().unwrap();
        let outside = TempDir::new().unwrap();
        fs::write(outside.path().join("outside.md"), "# Outside\n").unwrap();
        let sibling = outside.path().file_name().unwrap();
        let escape = vault.path().join("..").join(sibling).join("outside.md");
        assert!(escape.exists());
        let root = root_arg(&vault);

        for mode in [ValidatedPathMode::Existing, ValidatedPathMode::Writable] {
            let err = validate(&escape, &root, mode).unwrap_err();
            assert_eq!(err, ACTIVE_VAULT_PATH_ERROR);
        }

        // A leaf that does not exist yet is still confined in Writable mode.
        let new_escape = vault.path().join("../new-outside.md");
        let err = validate(&new_escape, &root, ValidatedPathMode::Writable).unwrap_err();
        assert_eq!(err, ACTIVE_VAULT_PATH_ERROR);
    }

    #[test]
    fn validated_paths_reject_absolute_paths_outside_the_root() {
        let vault = TempDir::new().unwrap();
        let outside = TempDir::new().unwrap();
        let existing = outside.path().join("outside.md");
        fs::write(&existing, "# Outside\n").unwrap();
        let root = root_arg(&vault);

        let err = validate(&existing, &root, ValidatedPathMode::Existing).unwrap_err();
        assert_eq!(err, ACTIVE_VAULT_PATH_ERROR);

        let new_outside = outside.path().join("new.md");
        let err = validate(&new_outside, &root, ValidatedPathMode::Writable).unwrap_err();
        assert_eq!(err, ACTIVE_VAULT_PATH_ERROR);
    }

    #[test]
    fn validated_paths_accept_paths_inside_the_root_in_both_modes() {
        let dir = TempDir::new().unwrap();
        let root = root_arg(&dir);
        let existing = dir.path().join("notes").join("existing.md");
        fs::create_dir_all(existing.parent().unwrap()).unwrap();
        fs::write(&existing, "# Existing\n").unwrap();

        let validated = validate(&existing, &root, ValidatedPathMode::Existing).unwrap();
        assert_eq!(validated, existing.to_string_lossy());

        // Writable mode accepts a leaf (and missing parents) that do not exist yet.
        let new_note = dir.path().join("new folder").join("new.md");
        let validated = validate(&new_note, &root, ValidatedPathMode::Writable).unwrap();
        assert_eq!(validated, new_note.to_string_lossy());
    }

    #[test]
    fn existing_mode_rejects_missing_files() {
        let dir = TempDir::new().unwrap();
        let missing = dir.path().join("missing.md");

        let err = validate(&missing, &root_arg(&dir), ValidatedPathMode::Existing).unwrap_err();

        assert_eq!(err, "File does not exist");
    }

    #[test]
    fn relative_paths_resolve_against_the_requested_root() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("note.md"), "# Note\n").unwrap();

        let validated = validate(
            Path::new("note.md"),
            &root_arg(&dir),
            ValidatedPathMode::Existing,
        )
        .unwrap();

        assert_eq!(validated, dir.path().join("note.md").to_string_lossy());
    }

    #[test]
    fn child_path_rejects_empty_absolute_and_traversing_segments() {
        let dir = TempDir::new().unwrap();
        let boundary = VaultBoundary::from_request(Some(&root_arg(&dir))).unwrap();

        for relative in [
            "",
            "  ",
            "/absolute",
            "../escape",
            "Projects/../../escape",
            "./Inbox",
        ] {
            assert_eq!(
                boundary.child_path(relative).unwrap_err(),
                ACTIVE_VAULT_PATH_ERROR,
                "{relative:?} should be rejected"
            );
        }
    }

    #[test]
    fn child_path_joins_nested_segments_under_the_requested_root() {
        let dir = TempDir::new().unwrap();
        let boundary = VaultBoundary::from_request(Some(&root_arg(&dir))).unwrap();

        let child = boundary.child_path("Projects/Laputa").unwrap();

        assert_eq!(child, dir.path().join("Projects").join("Laputa"));
    }

    #[test]
    fn with_existing_paths_validates_every_path() {
        let vault = TempDir::new().unwrap();
        let outside = TempDir::new().unwrap();
        let inside = vault.path().join("inside.md");
        let outside_note = outside.path().join("outside.md");
        fs::write(&inside, "# Inside\n").unwrap();
        fs::write(&outside_note, "# Outside\n").unwrap();
        let root = root_arg(&vault);

        let accepted =
            with_existing_paths(&[inside.to_string_lossy().into_owned()], Some(&root), Ok).unwrap();
        assert_eq!(accepted, vec![inside.to_string_lossy().into_owned()]);

        let err = with_existing_paths(
            &[
                inside.to_string_lossy().into_owned(),
                outside_note.to_string_lossy().into_owned(),
            ],
            Some(&root),
            Ok,
        )
        .unwrap_err();
        assert_eq!(err, ACTIVE_VAULT_PATH_ERROR);
    }

    #[test]
    fn with_requested_root_returns_the_root_as_requested() {
        let dir = TempDir::new().unwrap();
        let root = root_arg(&dir);

        let requested = with_requested_root(&root, |requested| Ok(requested.to_string())).unwrap();

        assert_eq!(requested, root);
    }

    #[test]
    fn with_existing_path_in_requested_vault_returns_root_and_validated_path() {
        let dir = TempDir::new().unwrap();
        let note = dir.path().join("note.md");
        fs::write(&note, "# Note\n").unwrap();
        let root = root_arg(&dir);

        let (requested_root, validated) =
            with_existing_path_in_requested_vault(&root, &note.to_string_lossy(), |root, path| {
                Ok((root.to_string(), path.to_string()))
            })
            .unwrap();

        assert_eq!(requested_root, root);
        assert_eq!(validated, note.to_string_lossy());
    }
}
