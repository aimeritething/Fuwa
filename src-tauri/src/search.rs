use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{Instant, SystemTime};
use walkdir::WalkDir;

#[derive(Debug, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SearchMatchCategory {
    ExactTitle,
    Title,
    Path,
    Body,
}

#[derive(Debug, Serialize, Clone)]
pub struct SearchResult {
    pub title: String,
    pub path: String,
    pub relative_path: String,
    pub snippet: String,
    pub score: f64,
    pub match_category: SearchMatchCategory,
    pub note_type: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SearchResponse {
    pub results: Vec<SearchResult>,
    pub elapsed_ms: u64,
    pub query: String,
    pub mode: String,
}

pub struct SearchOptions<'a> {
    pub vault_path: &'a str,
    pub query: &'a str,
    pub mode: &'a str,
    pub limit: usize,
    pub hide_gitignored_files: bool,
    pub exclude_frontmatter: bool,
}

struct Utf8Boundary<'a> {
    text: &'a str,
}

struct SnippetRequest<'a> {
    content: &'a str,
    query_lower: &'a str,
}

struct MatchScoreRequest<'a> {
    title_lower: &'a str,
    content_lower: &'a str,
    query_lower: &'a str,
}

#[derive(Clone, PartialEq, Eq)]
struct SearchFileFingerprint {
    modified: Option<SystemTime>,
    size: u64,
}

#[derive(Clone)]
struct SearchDocument {
    content: String,
    fingerprint: SearchFileFingerprint,
    path: PathBuf,
    relative_path: String,
    title: String,
}

#[derive(Default)]
struct VaultSearchIndex {
    documents: HashMap<PathBuf, SearchDocument>,
}

static SEARCH_INDEXES: OnceLock<Mutex<HashMap<PathBuf, VaultSearchIndex>>> = OnceLock::new();

impl Utf8Boundary<'_> {
    fn floor(&self, index: usize) -> usize {
        let mut boundary = index.min(self.text.len());
        while boundary > 0 && !self.text.is_char_boundary(boundary) {
            boundary -= 1;
        }
        boundary
    }

    fn lower_to_source(&self, lower_index: usize) -> usize {
        let mut lowered_len = 0;
        for (source_index, ch) in self.text.char_indices() {
            if lowered_len >= lower_index {
                return source_index;
            }
            lowered_len += ch.to_lowercase().map(|c| c.len_utf8()).sum::<usize>();
            if lowered_len > lower_index {
                return source_index;
            }
        }
        self.text.len()
    }
}

impl SnippetRequest<'_> {
    fn extract(&self) -> String {
        let content_lower = self.content.to_lowercase();
        let lower_pos = match content_lower.find(self.query_lower) {
            Some(p) => p,
            None => return String::new(),
        };
        let content_boundary = Utf8Boundary { text: self.content };
        let pos = content_boundary.lower_to_source(lower_pos);
        let start = self.content[..pos]
            .rfind('\n')
            .map(|i| i + 1)
            .unwrap_or_else(|| content_boundary.floor(pos.saturating_sub(60)));
        let end = self.content[pos..]
            .find('\n')
            .map(|i| pos + i)
            .unwrap_or_else(|| content_boundary.floor((pos + 120).min(self.content.len())));
        let snippet = &self.content[start..end];
        if snippet.len() > 200 {
            let end = Utf8Boundary { text: snippet }.floor(200);
            format!("{}…", &snippet[..end])
        } else {
            snippet.to_string()
        }
    }
}

impl MatchScoreRequest<'_> {
    fn score(&self) -> f64 {
        let title_exact = self.title_lower.contains(self.query_lower);
        let title_word = self
            .title_lower
            .split_whitespace()
            .any(|word| word == self.query_lower);
        let content_count = self.content_lower.matches(self.query_lower).count();

        let mut score = 0.0;
        if title_word {
            score += 10.0;
        } else if title_exact {
            score += 5.0;
        }
        score += (content_count as f64).min(20.0) * 0.5;
        score
    }
}

pub fn search_vault(
    vault_path: &str,
    query: &str,
    _mode: &str,
    limit: usize,
) -> Result<SearchResponse, String> {
    search_vault_with_options(SearchOptions {
        vault_path,
        query,
        mode: _mode,
        limit,
        hide_gitignored_files: crate::settings::hide_gitignored_files_enabled(),
        exclude_frontmatter: false,
    })
}

fn strip_frontmatter(content: &str) -> &str {
    let Some(rest) = content.strip_prefix("---") else {
        return content;
    };

    match rest.find("\n---") {
        Some(end) => rest[end + 4..].trim_start(),
        None => content,
    }
}

fn searchable_content(content: &str, exclude_frontmatter: bool) -> &str {
    if exclude_frontmatter {
        strip_frontmatter(content)
    } else {
        content
    }
}

fn is_markdown_search_candidate(vault_dir: &Path, path: &Path) -> bool {
    if !path.extension().is_some_and(|ext| ext == "md") {
        return false;
    }

    let vault_relative_path = path.strip_prefix(vault_dir).unwrap_or(path);
    !vault_relative_path
        .components()
        .any(|component| component.as_os_str().to_string_lossy().starts_with('.'))
}

fn collect_markdown_paths(vault_dir: &Path, hide_gitignored_files: bool) -> Vec<PathBuf> {
    let paths = WalkDir::new(vault_dir)
        .into_iter()
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.into_path())
        .filter(|path| is_markdown_search_candidate(vault_dir, path))
        .collect::<Vec<_>>();

    crate::vault::filter_gitignored_paths(vault_dir, paths, hide_gitignored_files)
}

fn search_indexes() -> &'static Mutex<HashMap<PathBuf, VaultSearchIndex>> {
    SEARCH_INDEXES.get_or_init(|| Mutex::new(HashMap::new()))
}

fn search_file_fingerprint(path: &Path) -> Option<SearchFileFingerprint> {
    let metadata = std::fs::metadata(path).ok()?;
    Some(SearchFileFingerprint {
        modified: metadata.modified().ok(),
        size: metadata.len(),
    })
}

fn vault_relative_search_path(vault_dir: &Path, path: &Path) -> String {
    path.strip_prefix(vault_dir)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

fn load_search_document(
    vault_dir: &Path,
    path: PathBuf,
    fingerprint: SearchFileFingerprint,
) -> Option<SearchDocument> {
    let content = std::fs::read_to_string(&path).ok()?;
    let filename = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("");
    let title = crate::vault::derive_markdown_title_from_content(&content, filename);
    Some(SearchDocument {
        content,
        fingerprint,
        relative_path: vault_relative_search_path(vault_dir, &path),
        path,
        title,
    })
}

fn refresh_search_index(vault_dir: &Path, hide_gitignored_files: bool) -> Vec<SearchDocument> {
    let paths = collect_markdown_paths(vault_dir, hide_gitignored_files);
    let visible_paths = paths.iter().cloned().collect::<HashSet<_>>();
    let mut indexes = search_indexes()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let index = indexes.entry(vault_dir.to_path_buf()).or_default();
    index
        .documents
        .retain(|path, _| visible_paths.contains(path));

    for path in paths {
        let Some(fingerprint) = search_file_fingerprint(&path) else {
            index.documents.remove(&path);
            continue;
        };
        let unchanged = index
            .documents
            .get(&path)
            .is_some_and(|document| document.fingerprint == fingerprint);
        if unchanged {
            continue;
        }
        if let Some(document) = load_search_document(vault_dir, path.clone(), fingerprint) {
            index.documents.insert(path, document);
        } else {
            index.documents.remove(&path);
        }
    }

    index.documents.values().cloned().collect()
}

fn match_category(
    title_lower: &str,
    relative_path_lower: &str,
    content_lower: &str,
    query_lower: &str,
) -> Option<SearchMatchCategory> {
    if title_lower.trim() == query_lower.trim() {
        return Some(SearchMatchCategory::ExactTitle);
    }
    if title_lower.contains(query_lower) {
        return Some(SearchMatchCategory::Title);
    }
    if relative_path_lower.contains(query_lower) {
        return Some(SearchMatchCategory::Path);
    }
    content_lower
        .contains(query_lower)
        .then_some(SearchMatchCategory::Body)
}

fn category_score(category: SearchMatchCategory) -> f64 {
    match category {
        SearchMatchCategory::ExactTitle => 40.0,
        SearchMatchCategory::Title => 30.0,
        SearchMatchCategory::Path => 20.0,
        SearchMatchCategory::Body => 10.0,
    }
}

pub fn search_vault_with_options(options: SearchOptions<'_>) -> Result<SearchResponse, String> {
    let start = Instant::now();
    let query_lower = options.query.to_lowercase();
    let vault_dir = Path::new(options.vault_path);

    let mut results: Vec<SearchResult> = Vec::new();

    for document in refresh_search_index(vault_dir, options.hide_gitignored_files) {
        let searchable_content = searchable_content(&document.content, options.exclude_frontmatter);
        let content_lower = searchable_content.to_lowercase();
        let title_lower = document.title.to_lowercase();
        let relative_path_lower = document.relative_path.to_lowercase();
        let Some(match_category) = match_category(
            &title_lower,
            &relative_path_lower,
            &content_lower,
            &query_lower,
        ) else {
            continue;
        };

        let score = category_score(match_category)
            + MatchScoreRequest {
                title_lower: &title_lower,
                content_lower: &content_lower,
                query_lower: &query_lower,
            }
            .score();
        let snippet = SnippetRequest {
            content: searchable_content,
            query_lower: &query_lower,
        }
        .extract();
        let full_path = document.path.to_string_lossy().to_string();

        results.push(SearchResult {
            title: document.title,
            path: full_path,
            relative_path: document.relative_path,
            snippet,
            score,
            match_category,
            note_type: None,
        });
    }

    results.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    results.truncate(options.limit);

    let elapsed_ms = start.elapsed().as_millis() as u64;

    Ok(SearchResponse {
        results,
        elapsed_ms,
        query: options.query.to_string(),
        mode: options.mode.to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::Builder;

    fn init_git_repo(root: &Path) {
        crate::hidden_command("git")
            .args(["init"])
            .current_dir(root)
            .output()
            .unwrap();
    }

    macro_rules! snippet {
        ($content:expr, $query_lower:expr) => {
            SnippetRequest {
                content: $content,
                query_lower: $query_lower,
            }
            .extract()
        };
    }

    macro_rules! match_score {
        ($title_lower:expr, $content_lower:expr, $query_lower:expr) => {
            MatchScoreRequest {
                title_lower: $title_lower,
                content_lower: $content_lower,
                query_lower: $query_lower,
            }
            .score()
        };
    }

    #[test]
    fn test_extract_snippet_basic() {
        let content = "line one\nline with keyword here\nline three";
        let snippet = snippet!(content, "keyword");
        assert!(snippet.contains("keyword"));
    }

    #[test]
    fn test_extract_snippet_no_match() {
        let snippet = snippet!("nothing here", "missing");
        assert!(snippet.is_empty());
    }

    #[test]
    fn test_score_match_title_word() {
        let score = match_score!("my keyword", "", "keyword");
        assert!(score >= 10.0);
    }

    #[test]
    fn test_score_match_content_only() {
        let score = match_score!("unrelated", "some keyword text keyword", "keyword");
        assert!(score > 0.0);
        assert!(score < 10.0);
    }

    #[test]
    fn test_extract_snippet_long() {
        let long_line = "a".repeat(300);
        let content = format!("start\n{}keyword{}\nend", long_line, long_line);
        let snippet = snippet!(&content, "keyword");
        assert!(snippet.len() <= 203); // 200 + "…" (3 bytes UTF-8)
    }

    #[test]
    fn test_extract_snippet_multibyte_context_start() {
        let prefix = format!("{}a", "한".repeat(21));
        let content = format!("{prefix}needle after multibyte prefix");

        let snippet = snippet!(&content, "needle");

        assert!(snippet.contains("needle"));
        assert!(snippet.is_char_boundary(snippet.len()));
    }

    #[test]
    fn test_extract_snippet_multibyte_context_end() {
        let content = format!("x{}", "한".repeat(50));

        let snippet = snippet!(&content, "x");

        assert!(snippet.starts_with('x'));
        assert!(snippet.is_char_boundary(snippet.len()));
    }

    #[test]
    fn test_extract_snippet_multibyte_truncation() {
        let content = format!("key {}\n", "한".repeat(100));

        let snippet = snippet!(&content, "key");

        assert!(snippet.starts_with("key"));
        assert!(snippet.ends_with('…'));
        assert!(snippet.is_char_boundary(snippet.len()));
    }

    #[test]
    fn test_extract_snippet_maps_expanded_lowercase_to_source_boundary() {
        let content = "İstanbul needle";

        let snippet = snippet!(content, "i");

        assert!(snippet.starts_with("İstanbul"));
        assert!(snippet.is_char_boundary(snippet.len()));
    }

    #[test]
    fn test_search_vault_uses_h1_for_result_title() {
        let dir = Builder::new()
            .prefix("search-vault-")
            .tempdir_in(std::env::current_dir().unwrap())
            .unwrap();
        let note_path = dir.path().join("legacy-name.md");
        fs::write(
            &note_path,
            "# Updated Display Title\n\nThe body contains keyword for search.",
        )
        .unwrap();

        let response =
            search_vault(dir.path().to_str().unwrap(), "keyword", "keyword", 10).unwrap();

        assert_eq!(response.results.len(), 1);
        assert_eq!(response.results[0].title, "Updated Display Title");
    }

    #[test]
    fn test_search_vault_hides_gitignored_notes_when_enabled() {
        let dir = Builder::new()
            .prefix("search-gitignored-")
            .tempdir_in(std::env::current_dir().unwrap())
            .unwrap();
        init_git_repo(dir.path());
        fs::create_dir_all(dir.path().join("ignored")).unwrap();
        fs::write(dir.path().join(".gitignore"), "ignored/\n").unwrap();
        fs::write(dir.path().join("visible.md"), "# Visible\n\nneedle").unwrap();
        fs::write(dir.path().join("ignored/hidden.md"), "# Hidden\n\nneedle").unwrap();

        let hidden = search_vault_with_options(SearchOptions {
            vault_path: dir.path().to_str().unwrap(),
            query: "needle",
            mode: "keyword",
            limit: 10,
            hide_gitignored_files: true,
            exclude_frontmatter: false,
        })
        .unwrap();
        let shown = search_vault_with_options(SearchOptions {
            vault_path: dir.path().to_str().unwrap(),
            query: "needle",
            mode: "keyword",
            limit: 10,
            hide_gitignored_files: false,
            exclude_frontmatter: false,
        })
        .unwrap();

        assert_eq!(hidden.results.len(), 1);
        assert_eq!(hidden.results[0].title, "Visible");
        assert_eq!(shown.results.len(), 2);
    }

    #[test]
    fn test_search_vault_can_exclude_frontmatter_from_content_matches() {
        let dir = Builder::new()
            .prefix("search-frontmatter-scope-")
            .tempdir_in(std::env::current_dir().unwrap())
            .unwrap();
        fs::write(
            dir.path().join("frontmatter-only.md"),
            [
                "---",
                "Owner: hidden-frontmatter-keyword",
                "---",
                "",
                "# Public Body",
                "",
                "The note body deliberately omits the hidden property token.",
            ]
            .join("\n"),
        )
        .unwrap();
        fs::write(
            dir.path().join("body-match.md"),
            "# Body Match\n\nBody includes hidden-frontmatter-keyword here.",
        )
        .unwrap();

        let response = search_vault_with_options(SearchOptions {
            vault_path: dir.path().to_str().unwrap(),
            query: "hidden-frontmatter-keyword",
            mode: "keyword",
            limit: 10,
            hide_gitignored_files: false,
            exclude_frontmatter: true,
        })
        .unwrap();

        assert_eq!(response.results.len(), 1);
        assert_eq!(response.results[0].title, "Body Match");
    }

    #[test]
    fn test_search_vault_reports_title_path_and_body_match_categories() {
        let dir = Builder::new()
            .prefix("search-categories-")
            .tempdir_in(std::env::current_dir().unwrap())
            .unwrap();
        fs::create_dir_all(dir.path().join("roadmaps")).unwrap();
        fs::write(dir.path().join("exact.md"), "# Needle\n\nNo body match.").unwrap();
        fs::write(
            dir.path().join("roadmaps/needle-plan.md"),
            "# Project Plan\n\nNo body match.",
        )
        .unwrap();
        fs::write(
            dir.path().join("body.md"),
            "# Reference\n\nThe needle appears in the body.",
        )
        .unwrap();

        let response = search_vault(dir.path().to_str().unwrap(), "needle", "keyword", 10).unwrap();

        assert_eq!(
            response.results[0].match_category,
            SearchMatchCategory::ExactTitle
        );
        assert_eq!(
            response.results[1].match_category,
            SearchMatchCategory::Path
        );
        assert_eq!(
            response.results[2].match_category,
            SearchMatchCategory::Body
        );
        assert_eq!(response.results[1].relative_path, "roadmaps/needle-plan.md");
    }

    #[test]
    fn test_search_index_refreshes_created_edited_renamed_and_deleted_notes() {
        let dir = Builder::new()
            .prefix("search-refresh-")
            .tempdir_in(std::env::current_dir().unwrap())
            .unwrap();
        let first_path = dir.path().join("first.md");
        let renamed_path = dir.path().join("renamed.md");

        fs::write(&first_path, "# First\n\nalpha").unwrap();
        assert_eq!(
            search_vault(dir.path().to_str().unwrap(), "alpha", "keyword", 10)
                .unwrap()
                .results
                .len(),
            1
        );

        fs::write(&first_path, "# First\n\nbeta with a different length").unwrap();
        assert!(
            search_vault(dir.path().to_str().unwrap(), "alpha", "keyword", 10)
                .unwrap()
                .results
                .is_empty()
        );
        assert_eq!(
            search_vault(dir.path().to_str().unwrap(), "beta", "keyword", 10)
                .unwrap()
                .results
                .len(),
            1
        );

        fs::rename(&first_path, &renamed_path).unwrap();
        let renamed = search_vault(dir.path().to_str().unwrap(), "renamed", "keyword", 10).unwrap();
        assert_eq!(renamed.results[0].relative_path, "renamed.md");

        fs::remove_file(&renamed_path).unwrap();
        assert!(
            search_vault(dir.path().to_str().unwrap(), "beta", "keyword", 10)
                .unwrap()
                .results
                .is_empty()
        );

        fs::write(dir.path().join("created.md"), "# Created\n\ngamma").unwrap();
        assert_eq!(
            search_vault(dir.path().to_str().unwrap(), "gamma", "keyword", 10)
                .unwrap()
                .results
                .len(),
            1
        );
    }
}
