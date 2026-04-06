use super::*;
use std::collections::HashMap;
use std::fs;
use std::io::Write;
use tempfile::TempDir;

fn create_test_file(dir: &Path, name: &str, content: &str) {
    let file_path = dir.join(name);
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).unwrap();
    }
    let mut file = fs::File::create(file_path).unwrap();
    file.write_all(content.as_bytes()).unwrap();
}

fn parse_test_entry(dir: &TempDir, name: &str, content: &str) -> VaultEntry {
    create_test_file(dir.path(), name, content);
    parse_md_file(&dir.path().join(name), None).unwrap()
}

#[test]
fn test_reload_entry_returns_fresh_data() {
    let dir = TempDir::new().unwrap();
    create_test_file(
        dir.path(),
        "my-note.md",
        "---\ntitle: My Note\nStatus: Active\n---\n# My Note\n\nOriginal.",
    );
    let entry = reload_entry(&dir.path().join("my-note.md")).unwrap();
    assert_eq!(entry.title, "My Note");
    assert_eq!(entry.status, Some("Active".to_string()));

    // Modify on disk and reload — must see the new content
    create_test_file(
        dir.path(),
        "my-note.md",
        "---\ntitle: My Note\nStatus: Done\n---\n# My Note\n\nUpdated.",
    );
    let fresh = reload_entry(&dir.path().join("my-note.md")).unwrap();
    assert_eq!(fresh.status, Some("Done".to_string()));
}

#[test]
fn test_reload_entry_nonexistent_file() {
    let result = reload_entry(std::path::Path::new("/nonexistent/path/note.md"));
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("does not exist"));
}

const FULL_FM_CONTENT: &str = "---\ntitle: Laputa Project\nIs A: Project\naliases:\n  - Laputa\n  - Castle in the Sky\nBelongs to:\n  - Studio Ghibli\nRelated to:\n  - Miyazaki\nStatus: Active\nOwner: Luca\nCadence: Weekly\n---\n# Laputa Project\n\nThis is a project note.\n";

#[test]
fn test_parse_full_frontmatter_identity() {
    let dir = TempDir::new().unwrap();
    let entry = parse_test_entry(&dir, "laputa.md", FULL_FM_CONTENT);
    assert_eq!(entry.title, "Laputa Project");
    assert_eq!(entry.is_a, Some("Project".to_string()));
    assert_eq!(entry.filename, "laputa.md");
}

#[test]
fn test_parse_full_frontmatter_lists() {
    let dir = TempDir::new().unwrap();
    let entry = parse_test_entry(&dir, "laputa.md", FULL_FM_CONTENT);
    assert_eq!(entry.aliases, vec!["Laputa", "Castle in the Sky"]);
    // Belongs to / Related to are no longer first-class fields.
    // As arrays of plain strings (no wikilinks), they don't appear in
    // relationships or properties — only wikilink arrays become relationships,
    // and only scalars become properties.
    assert!(entry.relationships.get("Belongs to").is_none());
    assert!(entry.relationships.get("Related to").is_none());
}

#[test]
fn test_parse_full_frontmatter_scalars() {
    let dir = TempDir::new().unwrap();
    let entry = parse_test_entry(&dir, "laputa.md", FULL_FM_CONTENT);
    assert_eq!(entry.status, Some("Active".to_string()));
    assert_eq!(
        entry.properties.get("Owner").and_then(|v| v.as_str()),
        Some("Luca")
    );
    assert_eq!(
        entry.properties.get("Cadence").and_then(|v| v.as_str()),
        Some("Weekly")
    );
}

#[test]
fn test_parse_empty_frontmatter() {
    let dir = TempDir::new().unwrap();
    let entry = parse_test_entry(
        &dir,
        "just-a-title.md",
        "---\n---\n# Just a Title\n\nNo frontmatter fields.",
    );
    // H1 is now the primary title source
    assert_eq!(entry.title, "Just a Title");
    assert!(entry.aliases.is_empty());

    assert!(entry.belongs_to.is_empty());
    assert_eq!(entry.status, None);
}

#[test]
fn test_parse_no_frontmatter() {
    let dir = TempDir::new().unwrap();
    let content = "# A Note Without Frontmatter\n\nJust markdown.";
    create_test_file(dir.path(), "a-note-without-frontmatter.md", content);

    let entry = parse_md_file(&dir.path().join("a-note-without-frontmatter.md"), None).unwrap();
    // No title in frontmatter → derived from filename
    assert_eq!(entry.title, "A Note Without Frontmatter");
}

#[test]
fn test_parse_single_string_aliases() {
    let dir = TempDir::new().unwrap();
    let content = "---\naliases: SingleAlias\n---\n# Test\n";
    create_test_file(dir.path(), "single-alias.md", content);

    let entry = parse_md_file(&dir.path().join("single-alias.md"), None).unwrap();
    assert_eq!(entry.aliases, vec!["SingleAlias"]);
}

#[test]
fn test_scan_vault_root_and_protected_folders() {
    let dir = TempDir::new().unwrap();
    create_test_file(dir.path(), "root.md", "# Root Note\n");
    create_test_file(
        dir.path(),
        "project.md",
        "---\ntype: Type\n---\n# Project\n",
    );
    create_test_file(dir.path(), "attachments/notes.md", "# Attachment note\n");
    create_test_file(
        dir.path(),
        "not-markdown.txt",
        "This should be included as text",
    );

    let entries = scan_vault(dir.path(), &HashMap::new()).unwrap();
    assert_eq!(entries.len(), 4);

    let filenames: Vec<&str> = entries.iter().map(|e| e.filename.as_str()).collect();
    assert!(filenames.contains(&"root.md"));
    assert!(filenames.contains(&"project.md"));
    assert!(filenames.contains(&"notes.md"));
    assert!(filenames.contains(&"not-markdown.txt"));

    let txt_entry = entries
        .iter()
        .find(|e| e.filename == "not-markdown.txt")
        .unwrap();
    assert_eq!(txt_entry.file_kind, "text");
    assert_eq!(txt_entry.title, "not-markdown.txt");
}

#[test]
fn test_scan_vault_includes_subdirectory_notes() {
    let dir = TempDir::new().unwrap();
    create_test_file(dir.path(), "root.md", "# Root Note\n");
    create_test_file(
        dir.path(),
        "random-folder/nested.md",
        "---\ntype: Note\n---\n# Nested\n",
    );
    create_test_file(
        dir.path(),
        "project/old-project.md",
        "---\ntype: Project\n---\n# Old\n",
    );

    let entries = scan_vault(dir.path(), &HashMap::new()).unwrap();
    assert_eq!(
        entries.len(),
        3,
        "all .md files including subdirs should be scanned"
    );
    let filenames: Vec<&str> = entries.iter().map(|e| e.filename.as_str()).collect();
    assert!(filenames.contains(&"root.md"));
    assert!(filenames.contains(&"nested.md"));
    assert!(filenames.contains(&"old-project.md"));
}

#[test]
fn test_scan_vault_includes_all_protected_folders() {
    let dir = TempDir::new().unwrap();
    create_test_file(dir.path(), "root.md", "# Root\n");
    create_test_file(dir.path(), "attachments/notes.md", "# Attachment note\n");
    create_test_file(dir.path(), "assets/image.md", "# Asset\n");

    let entries = scan_vault(dir.path(), &HashMap::new()).unwrap();
    assert_eq!(entries.len(), 3);
}

#[test]
fn test_scan_vault_skips_hidden_folders() {
    let dir = TempDir::new().unwrap();
    create_test_file(dir.path(), "root.md", "# Root\n");
    create_test_file(dir.path(), ".laputa/cache.md", "# Cache\n");
    create_test_file(dir.path(), ".git/objects.md", "# Git\n");

    let entries = scan_vault(dir.path(), &HashMap::new()).unwrap();
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].filename, "root.md");
}

#[test]
fn test_scan_vault_nonexistent_path() {
    let result = scan_vault(
        Path::new("/nonexistent/path/that/does/not/exist"),
        &HashMap::new(),
    );
    assert!(result.is_err());
}

#[test]
fn test_parse_malformed_yaml() {
    let dir = TempDir::new().unwrap();
    // Malformed YAML — gray_matter should handle this gracefully
    let content = "---\nIs A: [unclosed bracket\n---\n# Malformed\n";
    create_test_file(dir.path(), "malformed.md", content);

    let entry = parse_md_file(&dir.path().join("malformed.md"), None);
    // Should still succeed — gray_matter may parse partially or skip
    assert!(entry.is_ok());
}

#[test]
fn test_get_note_content() {
    let dir = TempDir::new().unwrap();
    let content = "---\nIs A: Note\n---\n# Test Note\n\nHello, world!";
    create_test_file(dir.path(), "test.md", content);

    let path = dir.path().join("test.md");
    let result = get_note_content(&path);
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), content);
}

#[test]
fn test_get_note_content_nonexistent() {
    let result = get_note_content(Path::new("/nonexistent/path/file.md"));
    assert!(result.is_err());
}

#[test]
fn test_parse_md_file_has_snippet() {
    let dir = TempDir::new().unwrap();
    let content = "---\nIs A: Note\n---\n# Test Note\n\nHello, world! This is a snippet.";
    create_test_file(dir.path(), "test.md", content);

    let entry = parse_md_file(&dir.path().join("test.md"), None).unwrap();
    assert_eq!(entry.snippet, "Hello, world! This is a snippet.");
}

#[test]
fn test_parse_md_file_has_word_count() {
    let dir = TempDir::new().unwrap();
    let content =
        "---\nIs A: Note\n---\n# Test Note\n\nHello world. This is a test with seven words.";
    create_test_file(dir.path(), "test.md", content);

    let entry = parse_md_file(&dir.path().join("test.md"), None).unwrap();
    assert_eq!(entry.word_count, 9);
}

#[test]
fn test_parse_md_file_word_count_empty_body() {
    let dir = TempDir::new().unwrap();
    let content = "---\nIs A: Note\n---\n# Empty Note\n";
    create_test_file(dir.path(), "test.md", content);

    let entry = parse_md_file(&dir.path().join("test.md"), None).unwrap();
    assert_eq!(entry.word_count, 0);
}

#[test]
fn test_parse_relationships_array() {
    let dir = TempDir::new().unwrap();
    let content = r#"---
Is A: Responsibility
Has:
  - "[[essay/foo|Foo Essay]]"
  - "[[essay/bar|Bar Essay]]"
Topics:
  - "[[topic/rust]]"
  - "[[topic/wasm]]"
Status: Active
---
# Publish Essays
"#;
    create_test_file(dir.path(), "publish-essays.md", content);

    let entry = parse_md_file(&dir.path().join("publish-essays.md"), None).unwrap();
    assert_eq!(entry.relationships.len(), 3); // Has, Topics, Type
    assert_eq!(
        entry.relationships.get("Has").unwrap(),
        &vec![
            "[[essay/foo|Foo Essay]]".to_string(),
            "[[essay/bar|Bar Essay]]".to_string()
        ]
    );
    assert_eq!(
        entry.relationships.get("Topics").unwrap(),
        &vec!["[[topic/rust]]".to_string(), "[[topic/wasm]]".to_string()]
    );
    assert_eq!(
        entry.relationships.get("Type").unwrap(),
        &vec!["[[responsibility]]".to_string()]
    );
}

#[test]
fn test_parse_relationships_single_string() {
    let dir = TempDir::new().unwrap();
    let content = r#"---
Is A: Project
Owner: "[[person/luca-rossi|Luca Rossi]]"
Belongs to:
  - "[[responsibility/grow-newsletter]]"
---
# Some Project
"#;
    create_test_file(dir.path(), "some-project.md", content);

    let entry = parse_md_file(&dir.path().join("some-project.md"), None).unwrap();

    // Owner with wikilink should appear in relationships
    assert!(entry.relationships.get("Owner").is_some());
    // Wikilinks don't go to properties
    assert!(entry.properties.get("Owner").is_none());

    // Belongs to is a wikilink array, should appear in relationships
    let belongs = entry.relationships.get("Belongs to").unwrap();
    assert_eq!(
        belongs,
        &vec!["[[responsibility/grow-newsletter]]".to_string()]
    );
    // Also parsed in the dedicated field
    assert_eq!(entry.belongs_to, vec!["[[responsibility/grow-newsletter]]"]);
}

#[test]
fn test_parse_relationships_ignores_non_wikilinks() {
    let dir = TempDir::new().unwrap();
    let content = r#"---
Is A: Note
Status: Active
Tags:
  - productivity
  - writing
Custom Field: just a plain string
---
# A Note
"#;
    create_test_file(dir.path(), "plain-note.md", content);

    let entry = parse_md_file(&dir.path().join("plain-note.md"), None).unwrap();
    // Tags and Custom Field don't contain wikilinks — only the auto-generated "Type" relationship
    assert_eq!(entry.relationships.len(), 1);
    assert_eq!(
        entry.relationships.get("Type").unwrap(),
        &vec!["[[note]]".to_string()]
    );
}

const BIG_PROJECT_CONTENT: &str = "---\nIs A: Project\nHas:\n  - \"[[deliverable/mvp]]\"\n  - \"[[deliverable/v2]]\"\nTopics:\n  - \"[[topic/ai]]\"\n  - \"[[topic/compilers]]\"\nEvents:\n  - \"[[event/launch-day]]\"\nNotes:\n  - \"[[note/design-rationale]]\"\n  - \"[[note/meeting-2024-01]]\"\n  - \"[[note/meeting-2024-02]]\"\nOwner: \"[[person/alice]]\"\nRelated to:\n  - \"[[project/sibling-project]]\"\nBelongs to:\n  - \"[[area/engineering]]\"\nStatus: Active\n---\n# Big Project\n";

fn parse_big_project_rels() -> HashMap<String, Vec<String>> {
    let dir = TempDir::new().unwrap();
    let entry = parse_test_entry(&dir, "big-project.md", BIG_PROJECT_CONTENT);
    entry.relationships
}

#[test]
fn test_parse_relationships_custom_fields() {
    let rels = parse_big_project_rels();
    assert_eq!(rels.get("Has").unwrap().len(), 2);
    assert_eq!(rels.get("Topics").unwrap().len(), 2);
    assert_eq!(rels.get("Events").unwrap().len(), 1);
}

#[test]
fn test_parse_relationships_owner_and_notes() {
    let rels = parse_big_project_rels();
    assert_eq!(rels.get("Notes").unwrap().len(), 3);
    // Owner with wikilink should be in relationships
    assert!(rels.get("Owner").is_some());
}

#[test]
fn test_parse_relationships_builtin_wikilink_fields() {
    let rels = parse_big_project_rels();
    assert_eq!(rels.get("Related to").unwrap().len(), 1);
    assert_eq!(rels.get("Belongs to").unwrap().len(), 1);
}

#[test]
fn test_parse_relationships_skip_keys_excluded_from_generic() {
    let rels = parse_big_project_rels();
    assert!(rels.get("Status").is_none());
    assert!(rels.get("Is A").is_none());
}

#[test]
fn test_parse_relationships_single_vs_array_wikilinks() {
    // Verifies both single wikilink strings and arrays are parsed correctly.
    let dir = TempDir::new().unwrap();
    let content = r#"---
Mentor: "[[person/bob|Bob Smith]]"
Reviewers:
  - "[[person/carol]]"
  - "[[person/dave]]"
Context: "[[area/research]]"
---
# A Note
"#;
    create_test_file(dir.path(), "single-vs-array.md", content);

    let entry = parse_md_file(&dir.path().join("single-vs-array.md"), None).unwrap();

    // Single string → Vec with one element
    assert_eq!(
        entry.relationships.get("Mentor").unwrap(),
        &vec!["[[person/bob|Bob Smith]]".to_string()]
    );
    // Array → Vec with multiple elements
    assert_eq!(
        entry.relationships.get("Reviewers").unwrap(),
        &vec![
            "[[person/carol]]".to_string(),
            "[[person/dave]]".to_string()
        ]
    );
    // Another single string
    assert_eq!(
        entry.relationships.get("Context").unwrap(),
        &vec!["[[area/research]]".to_string()]
    );
}

const SKIP_KEYS_CONTENT: &str = "---\nIs A: \"[[project]]\"\nAliases:\n  - \"[[alias/foo]]\"\nStatus: \"[[status/active]]\"\nCadence: \"[[cadence/weekly]]\"\nCreated at: \"[[time/2024-01-01]]\"\nCreated time: \"[[time/noon]]\"\nReal Relation: \"[[note/important]]\"\n---\n# Skip Keys Test\n";

fn parse_skip_keys_rels() -> (HashMap<String, Vec<String>>, usize) {
    let dir = TempDir::new().unwrap();
    let entry = parse_test_entry(&dir, "skip-keys.md", SKIP_KEYS_CONTENT);
    let len = entry.relationships.len();
    (entry.relationships, len)
}

#[test]
fn test_skip_keys_identity_fields_excluded() {
    let (rels, _) = parse_skip_keys_rels();
    assert!(rels.get("Is A").is_none());
    assert!(rels.get("Aliases").is_none());
    assert!(rels.get("Status").is_none());
}

#[test]
fn test_skip_keys_temporal_fields_excluded() {
    let (rels, _) = parse_skip_keys_rels();
    assert!(rels.get("Cadence").is_some());
    assert!(rels.get("Created at").is_some());
    assert!(rels.get("Created time").is_some());
}

#[test]
fn test_skip_keys_real_relation_included() {
    let (rels, len) = parse_skip_keys_rels();
    assert_eq!(
        rels.get("Real Relation").unwrap(),
        &vec!["[[note/important]]".to_string()]
    );
    // "Real Relation" + "Type" + "Cadence" + "Created at" + "Created time"
    assert_eq!(len, 5);
    assert_eq!(rels.get("Type").unwrap(), &vec!["[[project]]".to_string()]);
    assert!(rels.get("Cadence").is_some());
    assert!(rels.get("Created at").is_some());
    assert!(rels.get("Created time").is_some());
}

#[test]
fn test_parse_relationships_mixed_wikilinks_and_plain_in_array() {
    // Verifies that within an array, only wikilink entries are kept.
    let dir = TempDir::new().unwrap();
    let content = r#"---
References:
  - "[[source/paper-a]]"
  - "just a plain string"
  - "[[source/paper-b]]"
  - "no links here"
---
# Mixed Array
"#;
    create_test_file(dir.path(), "mixed-array.md", content);

    let entry = parse_md_file(&dir.path().join("mixed-array.md"), None).unwrap();

    // Only the wikilink entries should be captured
    assert_eq!(
        entry.relationships.get("References").unwrap(),
        &vec![
            "[[source/paper-a]]".to_string(),
            "[[source/paper-b]]".to_string()
        ]
    );
}

// --- large relationship array (regression: No Code note with 32 Notes) ---

#[test]
fn test_parse_large_notes_relationship_array() {
    let dir = TempDir::new().unwrap();
    let content = r#"---
type: Topic
Referred by Data:
  - "[[michele-sampieri|Michele Sampieri]]"
  - "[[varun-anand|Varun Anand]]"
Belongs to:
  - "[[engineering|Engineering]]"
aliases:
  - No Code
Notes:
  - "[[8020-we-help-companies-move-faster-without-code|8020 | We help companies move faster without code.]]"
  - "[[airdev-build-hub|Airdev Build Hub]]"
  - "[[airdev-leader-in-bubble-and-no-code-development|AirDev | Leader in Bubble and No-Code Development]]"
  - "[[budibase-internal-tools-made-easy|Budibase - Internal tools made easy]]"
  - "[[bullet-launch-bubble-boilerplate|Bullet Launch Bubble Boilerplate]]"
  - "[[canvas-base-template-for-bubble|Canvas • Base Template for Bubble]]"
  - "[[chameleon-microsurveys|Chameleon | Microsurveys]]"
  - "[[felt-the-best-way-to-make-maps-on-the-internet|Felt – The best way to make maps on the internet]]"
  - "[[flutterflow-build-native-apps-visually|FlutterFlow | Build Native Apps Visually]]"
  - "[[framer-ai-generate-and-publish-your-site-with-ai-in-seconds|Framer AI — Generate and publish your site with AI in seconds.]]"
  - "[[jumpstart-pro-the-best-ruby-on-rails-saas-template|Jumpstart Pro | The best Ruby on Rails SaaS Template]]"
  - "[[mailparser-email-parser-software-workflow-automation|MailParser • Email Parser Software & Workflow Automation]]"
  - "[[make-work-the-way-you-imagine|Make | Work the way you imagine]]"
  - "[[michele-sampieri|Michele Sampieri]]"
  - "[[n8nio-a-powerful-workflow-automation-tool|n8n.io - a powerful workflow automation tool]]"
  - "[[n8nio-ai-workflow-automation-tool|n8n.io - AI workflow automation tool]]"
  - "[[nocodey-find-best-nocoder|Nocodey • Find Best Nocoder]]"
  - "[[outseta-software-for-subscription-start-ups|Outseta | Software for subscription start-ups]]"
  - "[[payments-tax-subscriptions-for-software-companies-lemon-squeezy|Payments, tax & subscriptions for software companies • Lemon Squeezy]]"
  - "[[retool-portals-custom-client-portal-software|Retool Portals • Custom Client Portal Software]]"
  - "[[rise-of-the-no-code-economy-report-formstack|Rise of the No-Code Economy Report | Formstack]]"
  - "[[scene-the-smart-way-to-build-websites|Scene • The smart way to build websites]]"
  - "[[scrapingbee-the-best-web-scraping-api|ScrapingBee • the best web scraping API]]"
  - "[[softr-build-a-website-web-app-or-portal-on-airtable-without-code|Softr | Build a website, web app or portal on Airtable without code]]"
  - "[[superblocks-build-modern-internal-apps-in-days-not-months|Superblocks • Build modern internal apps in days, not months]]"
  - "[[superwall-quickly-deploy-paywalls|Superwall • Quickly deploy paywalls]]"
  - "[[tails-tailwind-css-page-creator|Tails | Tailwind CSS Page Creator]]"
  - "[[the-open-source-firebase-alternative-supabase|The Open Source Firebase Alternative | Supabase]]"
  - "[[varun-anand|Varun Anand]]"
  - "[[xano-the-fastest-no-code-backend-development-platform|Xano - The Fastest No Code Backend Development Platform]]"
  - "[[directus-open-data-platform-for-headless-content-management|{'Directus': 'Open Data Platform for Headless Content Management'}]]"
  - "[[framer-design-beautiful-websites-in-minutes|{'Framer': 'Design beautiful websites in minutes'}]]"
title: No Code
---
# No Code
"#;
    create_test_file(dir.path(), "no-code.md", content);
    let entry = parse_md_file(&dir.path().join("no-code.md"), None).unwrap();

    let notes = entry
        .relationships
        .get("Notes")
        .expect("Notes relationship should exist");
    assert_eq!(notes.len(), 32, "All 32 Notes entries should be parsed");

    let referred = entry
        .relationships
        .get("Referred by Data")
        .expect("Referred by Data should exist");
    assert_eq!(referred.len(), 2);

    let belongs = entry
        .relationships
        .get("Belongs to")
        .expect("Belongs to should exist");
    assert_eq!(belongs.len(), 1);
}

// --- type from frontmatter only (no folder inference) ---

#[test]
fn test_type_from_frontmatter_only() {
    let dir = TempDir::new().unwrap();
    create_test_file(dir.path(), "test.md", "---\ntype: Custom\n---\n# Test\n");
    let entry = parse_md_file(&dir.path().join("test.md"), None).unwrap();
    assert_eq!(entry.is_a, Some("Custom".to_string()));
}

#[test]
fn test_no_type_when_frontmatter_missing() {
    let dir = TempDir::new().unwrap();
    create_test_file(dir.path(), "note/test.md", "# Test\n");
    let entry = parse_md_file(&dir.path().join("note/test.md"), None).unwrap();
    assert_eq!(entry.is_a, None, "type should not be inferred from folder");
}

// --- created_at sourcing from filesystem ---

#[test]
fn test_created_at_from_filesystem() {
    let dir = TempDir::new().unwrap();
    let content = "---\nIs A: Note\n---\n# Test\n";
    create_test_file(dir.path(), "test.md", content);

    let entry = parse_md_file(&dir.path().join("test.md"), None).unwrap();
    // created_at should be set from filesystem metadata (not None)
    assert!(
        entry.created_at.is_some(),
        "created_at should come from filesystem"
    );
}

// --- Type relationship tests ---

#[test]
fn test_type_relationship_added_for_regular_entries() {
    let dir = TempDir::new().unwrap();
    let content = "---\nIs A: Project\n---\n# My Project\n";
    let entry = parse_test_entry(&dir, "project/my-project.md", content);
    assert_eq!(
        entry.relationships.get("Type").unwrap(),
        &vec!["[[project]]".to_string()]
    );
}

#[test]
fn test_type_relationship_skipped_for_type_documents() {
    let dir = TempDir::new().unwrap();
    let content = "---\nIs A: Type\n---\n# Project\n";
    let entry = parse_test_entry(&dir, "project.md", content);
    assert!(entry.relationships.get("Type").is_none());
}

#[test]
fn test_no_type_relationship_without_frontmatter() {
    let dir = TempDir::new().unwrap();
    let content = "# A Person\n\nSome content.";
    let entry = parse_test_entry(&dir, "someone.md", content);
    assert_eq!(entry.is_a, None);
    assert!(entry.relationships.get("Type").is_none());
}

#[test]
fn test_type_relationship_handles_wikilink_is_a() {
    let dir = TempDir::new().unwrap();
    let content = "---\nIs A: \"[[experiment]]\"\n---\n# Test\n";
    let entry = parse_test_entry(&dir, "test.md", content);
    assert_eq!(
        entry.relationships.get("Type").unwrap(),
        &vec!["[[experiment]]".to_string()]
    );
}

#[test]
fn test_type_from_frontmatter_not_folder() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Type\n---\n# Some Type\n";
    let entry = parse_test_entry(&dir, "some-type.md", content);
    assert_eq!(entry.is_a, Some("Type".to_string()));
}

// --- type key (post-migration) tests ---

#[test]
fn test_parse_type_key_lowercase() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Project\n---\n# My Project\n";
    let entry = parse_test_entry(&dir, "project/my-project.md", content);
    assert_eq!(entry.is_a, Some("Project".to_string()));
}

#[test]
fn test_type_key_generates_type_relationship() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Person\n---\n# Alice\n";
    let entry = parse_test_entry(&dir, "person/alice.md", content);
    assert_eq!(
        entry.relationships.get("Type").unwrap(),
        &vec!["[[person]]".to_string()]
    );
}

#[test]
fn test_type_key_not_in_relationships_as_generic() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Note\nHas:\n  - \"[[task/foo]]\"\n---\n# Test\n";
    let entry = parse_test_entry(&dir, "note/test.md", content);
    // "type" key itself should not appear as a relationship (it's in SKIP_KEYS)
    // Only "Has" and the auto-generated "Type" should be relationships
    assert_eq!(entry.relationships.len(), 2);
    assert!(entry.relationships.get("Has").is_some());
    assert!(entry.relationships.get("Type").is_some());
}

// --- outgoing_links tests ---

#[test]
fn test_outgoing_links_extracted_from_content_body() {
    let dir = TempDir::new().unwrap();
    let content = "---\nIs A: Note\n---\n# My Note\n\nSee [[person/alice]] and [[topic/rust]].";
    let entry = parse_test_entry(&dir, "note/my-note.md", content);
    assert_eq!(entry.outgoing_links, vec!["person/alice", "topic/rust"]);
}

#[test]
fn test_outgoing_links_excludes_frontmatter_wikilinks() {
    let dir = TempDir::new().unwrap();
    let content = "---\nHas:\n  - \"[[task/design]]\"\n---\n# Note\n\nSee [[person/bob]].";
    let entry = parse_test_entry(&dir, "note/test.md", content);
    assert!(!entry.outgoing_links.contains(&"task/design".to_string()));
    assert!(entry.outgoing_links.contains(&"person/bob".to_string()));
}

#[test]
fn test_outgoing_links_handles_pipe_syntax() {
    let dir = TempDir::new().unwrap();
    let content = "# Note\n\nSee [[project/alpha|Alpha Project]] for details.";
    let entry = parse_test_entry(&dir, "test.md", content);
    assert!(entry.outgoing_links.contains(&"project/alpha".to_string()));
}

// --- save_note_content tests ---

#[test]
fn test_save_note_content_creates_parent_directory() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("new-type/untitled-note.md");
    let content = "---\ntitle: Untitled note\n---\n# Untitled note\n\n";

    assert!(!path.parent().unwrap().exists());
    save_note_content(path.to_str().unwrap(), content).unwrap();

    assert!(path.exists());
    assert_eq!(fs::read_to_string(&path).unwrap(), content);
}

#[test]
fn test_save_note_content_existing_directory() {
    let dir = TempDir::new().unwrap();
    fs::create_dir_all(dir.path().join("note")).unwrap();
    let path = dir.path().join("note/test.md");
    let content = "# Test\n";

    save_note_content(path.to_str().unwrap(), content).unwrap();
    assert_eq!(fs::read_to_string(&path).unwrap(), content);
}

#[test]
fn test_save_note_content_deeply_nested_new_directory() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("a/b/c/deep-note.md");
    let content = "---\ntitle: Deep\n---\n";

    save_note_content(path.to_str().unwrap(), content).unwrap();
    assert!(path.exists());
    assert_eq!(fs::read_to_string(&path).unwrap(), content);
}

// --- sidebar_label tests ---

#[test]
fn test_parse_sidebar_label_from_type_entry() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Type\nsidebar label: News\n---\n# News\n";
    let entry = parse_test_entry(&dir, "news.md", content);
    assert_eq!(entry.sidebar_label, Some("News".to_string()));
}

#[test]
fn test_parse_sidebar_label_missing_defaults_to_none() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Type\n---\n# Project\n";
    let entry = parse_test_entry(&dir, "project.md", content);
    assert_eq!(entry.sidebar_label, None);
}

#[test]
fn test_sidebar_label_not_in_relationships() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Type\nsidebar label: My Series\n---\n# Series\n";
    let entry = parse_test_entry(&dir, "series.md", content);
    assert!(entry.relationships.get("sidebar label").is_none());
}

// --- template field tests ---

#[test]
fn test_parse_template_from_type_entry() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Type\ntemplate: \"## Objective\\n\\n## Timeline\"\n---\n# Project\n";
    let entry = parse_test_entry(&dir, "project.md", content);
    assert!(entry.template.is_some());
}

#[test]
fn test_parse_template_block_scalar() {
    let dir = TempDir::new().unwrap();
    let content =
        "---\ntype: Type\ntemplate: |\n  ## Objective\n  \n  ## Timeline\n---\n# Project\n";
    let entry = parse_test_entry(&dir, "project.md", content);
    assert!(entry.template.is_some());
    let tmpl = entry.template.unwrap();
    assert!(tmpl.contains("## Objective"));
    assert!(tmpl.contains("## Timeline"));
}

#[test]
fn test_parse_template_missing_defaults_to_none() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Type\n---\n# Note\n";
    let entry = parse_test_entry(&dir, "note.md", content);
    assert_eq!(entry.template, None);
}

#[test]
fn test_template_not_in_relationships() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Type\ntemplate: \"## Heading\"\n---\n# Project\n";
    let entry = parse_test_entry(&dir, "project.md", content);
    assert!(entry.relationships.get("template").is_none());
}

// --- sort field tests ---

#[test]
fn test_parse_sort_from_type_entry() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Type\nsort: \"modified:desc\"\n---\n# Project\n";
    let entry = parse_test_entry(&dir, "project.md", content);
    assert_eq!(entry.sort, Some("modified:desc".to_string()));
}

#[test]
fn test_parse_sort_missing_defaults_to_none() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Type\n---\n# Project\n";
    let entry = parse_test_entry(&dir, "project.md", content);
    assert_eq!(entry.sort, None);
}

#[test]
fn test_sort_not_in_relationships() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Type\nsort: \"title:asc\"\n---\n# Project\n";
    let entry = parse_test_entry(&dir, "project.md", content);
    assert!(entry.relationships.get("sort").is_none());
}

#[test]
fn test_sort_not_in_properties() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Type\nsort: \"title:asc\"\n---\n# Project\n";
    let entry = parse_test_entry(&dir, "project.md", content);
    assert!(entry.properties.get("sort").is_none());
}

// --- custom properties tests ---

#[test]
fn test_extract_properties_scalar_values() {
    let dir = TempDir::new().unwrap();
    let content = r#"---
Is A: Project
Status: Active
Priority: High
Rating: 5
Due date: 2026-06-15
Reviewed: true
---
# Test
"#;
    let entry = parse_test_entry(&dir, "project/test.md", content);
    let expected: HashMap<String, serde_json::Value> = [
        ("Priority".into(), serde_json::Value::String("High".into())),
        ("Rating".into(), serde_json::json!(5)),
        (
            "Due date".into(),
            serde_json::Value::String("2026-06-15".into()),
        ),
        ("Reviewed".into(), serde_json::Value::Bool(true)),
    ]
    .into_iter()
    .collect();
    assert_eq!(entry.properties, expected);
}

#[test]
fn test_extract_properties_skips_structural_fields() {
    let dir = TempDir::new().unwrap();
    let content = r#"---
Is A: Project
Status: Active
Owner: Luca
Cadence: Weekly
Archived: false
Priority: High
---
# Test
"#;
    let entry = parse_test_entry(&dir, "project/test.md", content);
    // Priority + Owner + Cadence should survive — all others are structural
    assert_eq!(entry.properties.len(), 3);
    assert_eq!(
        entry.properties.get("Priority").and_then(|v| v.as_str()),
        Some("High")
    );
    assert_eq!(
        entry.properties.get("Owner").and_then(|v| v.as_str()),
        Some("Luca")
    );
    assert_eq!(
        entry.properties.get("Cadence").and_then(|v| v.as_str()),
        Some("Weekly")
    );
}

#[test]
fn test_extract_properties_skips_wikilinks() {
    let dir = TempDir::new().unwrap();
    let content = r#"---
Mentor: "[[person/alice]]"
Company: Acme Corp
---
# Test
"#;
    let entry = parse_test_entry(&dir, "test.md", content);
    assert!(entry.properties.get("Mentor").is_none());
    assert_eq!(
        entry.properties.get("Company").and_then(|v| v.as_str()),
        Some("Acme Corp")
    );
}

#[test]
fn test_extract_properties_skips_arrays() {
    let dir = TempDir::new().unwrap();
    let content = r#"---
Tags:
  - productivity
  - writing
Company: Acme Corp
---
# Test
"#;
    let entry = parse_test_entry(&dir, "test.md", content);
    assert!(entry.properties.get("Tags").is_none());
    assert_eq!(
        entry.properties.get("Company").and_then(|v| v.as_str()),
        Some("Acme Corp")
    );
}

#[test]
fn test_parse_archived_lowercase_alias() {
    let dir = TempDir::new().unwrap();
    let content = "---\narchived: true\n---\n# Old Quarter\n";
    let entry = parse_test_entry(&dir, "old-quarter.md", content);
    assert!(
        entry.archived,
        "lowercase 'archived' must be parsed via alias (frontend writes lowercase)"
    );
}

#[test]
fn test_parse_archived_titlecase() {
    let dir = TempDir::new().unwrap();
    let content = "---\nArchived: true\n---\n# Old Quarter\n";
    let entry = parse_test_entry(&dir, "old-quarter-2.md", content);
    assert!(entry.archived, "titlecase 'Archived' must also be parsed");
}

// --- archived string-value tests ---

#[test]
fn test_parse_archived_yes_titlecase() {
    let dir = TempDir::new().unwrap();
    let content = "---\nArchived: Yes\n---\n# Old\n";
    let entry = parse_test_entry(&dir, "old.md", content);
    assert!(entry.archived, "'Archived: Yes' must be parsed as true");
}

#[test]
fn test_parse_archived_yes_lowercase() {
    let dir = TempDir::new().unwrap();
    let content = "---\narchived: yes\n---\n# Old\n";
    let entry = parse_test_entry(&dir, "old2.md", content);
    assert!(entry.archived, "'archived: yes' must be parsed as true");
}

#[test]
fn test_parse_archived_yes_uppercase() {
    let dir = TempDir::new().unwrap();
    let content = "---\nArchived: YES\n---\n# Old\n";
    let entry = parse_test_entry(&dir, "old3.md", content);
    assert!(entry.archived, "'Archived: YES' must be parsed as true");
}

#[test]
fn test_parse_archived_no() {
    let dir = TempDir::new().unwrap();
    let content = "---\nArchived: No\n---\n# Active\n";
    let entry = parse_test_entry(&dir, "active2.md", content);
    assert!(!entry.archived, "'Archived: No' must be parsed as false");
}

#[test]
fn test_parse_archived_false_string() {
    let dir = TempDir::new().unwrap();
    let content = "---\nArchived: \"false\"\n---\n# Active\n";
    let entry = parse_test_entry(&dir, "active3.md", content);
    assert!(
        !entry.archived,
        "'Archived: \"false\"' must be parsed as false"
    );
}

#[test]
fn test_parse_archived_zero() {
    let dir = TempDir::new().unwrap();
    let content = "---\nArchived: 0\n---\n# Active\n";
    let entry = parse_test_entry(&dir, "active4.md", content);
    assert!(!entry.archived, "'Archived: 0' must be parsed as false");
}

#[test]
fn test_parse_archived_absent() {
    let dir = TempDir::new().unwrap();
    let content = "---\nIs A: Note\n---\n# Active\n";
    let entry = parse_test_entry(&dir, "active5.md", content);
    assert!(!entry.archived, "absent archived must default to false");
}

// --- new canonical underscore-prefixed keys ---

#[test]
fn test_parse_underscore_archived_canonical() {
    let dir = TempDir::new().unwrap();
    let content = "---\n_archived: true\n---\n# Old\n";
    let entry = parse_test_entry(&dir, "old-new.md", content);
    assert!(
        entry.archived,
        "'_archived: true' must be parsed as archived"
    );
}

// --- favorite field tests ---

#[test]
fn test_parse_favorite_true() {
    let dir = TempDir::new().unwrap();
    let content = "---\n_favorite: true\n_favorite_index: 3\n---\n# Fav\n";
    let entry = parse_test_entry(&dir, "fav.md", content);
    assert!(
        entry.favorite,
        "'_favorite: true' must be parsed as favorite"
    );
    assert_eq!(entry.favorite_index, Some(3));
}

#[test]
fn test_parse_favorite_absent_defaults_false() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Note\n---\n# Not Fav\n";
    let entry = parse_test_entry(&dir, "not-fav.md", content);
    assert!(!entry.favorite, "absent _favorite must default to false");
    assert_eq!(entry.favorite_index, None);
}

// --- visible field tests ---

#[test]
fn test_parse_visible_false_from_type_entry() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Type\nvisible: false\n---\n# Journal\n";
    let entry = parse_test_entry(&dir, "journal.md", content);
    assert_eq!(entry.visible, Some(false));
}

#[test]
fn test_parse_visible_true_from_type_entry() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Type\nvisible: true\n---\n# Project\n";
    let entry = parse_test_entry(&dir, "project.md", content);
    assert_eq!(entry.visible, Some(true));
}

#[test]
fn test_parse_visible_missing_defaults_to_none() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Type\n---\n# Project\n";
    let entry = parse_test_entry(&dir, "project.md", content);
    assert_eq!(entry.visible, None);
}

#[test]
fn test_archived_true_with_extra_non_string_fields() {
    let dir = TempDir::new().unwrap();
    // If any StringOrList field gets a non-string value, archived must still parse.
    let content = "---\nArchived: true\norder: 5\n---\n# Archived Note\n";
    let entry = parse_test_entry(&dir, "archived-extra.md", content);
    assert!(
        entry.archived,
        "Archived must be true even with other fields present"
    );
}

#[test]
fn test_fallback_parser_extracts_archived_from_malformed_yaml() {
    let dir = TempDir::new().unwrap();
    let fm = [
        "---",
        "type: Essay",
        "Notes:",
        "  - \"[[slug|{\"Broken\": 'quotes'}]]\"",
        "Archived: true",
        "---",
        "",
        "# Archived Essay",
    ];
    let content = fm.join("\n");
    create_test_file(dir.path(), "archived-essay.md", &content);
    let entry = parse_md_file(&dir.path().join("archived-essay.md"), None).unwrap();
    assert!(
        entry.archived,
        "Archived must be true even when YAML is malformed"
    );
    assert_eq!(entry.is_a, Some("Essay".to_string()));
}

#[test]
fn test_visible_not_in_relationships() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Type\nvisible: false\n---\n# Journal\n";
    let entry = parse_test_entry(&dir, "journal.md", content);
    assert!(entry.relationships.get("visible").is_none());
}

#[test]
fn test_visible_not_in_properties() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Type\nvisible: false\n---\n# Journal\n";
    let entry = parse_test_entry(&dir, "journal.md", content);
    assert!(entry.properties.get("visible").is_none());
}

// --- round-trip: canonical `type:` field and `Is A:` alias ---

#[test]
fn test_roundtrip_type_key_parses_correctly() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Quarter\n---\n# Q1 2026\n";
    let entry = parse_test_entry(&dir, "quarter/q1.md", content);
    assert_eq!(entry.is_a, Some("Quarter".to_string()));
}

#[test]
fn test_roundtrip_is_a_alias_still_works() {
    let dir = TempDir::new().unwrap();
    let content = "---\nIs A: Quarter\n---\n# Q1 2026\n";
    let entry = parse_test_entry(&dir, "quarter/q1.md", content);
    assert_eq!(entry.is_a, Some("Quarter".to_string()));
}

#[test]
fn test_roundtrip_is_a_snake_case_alias_still_works() {
    let dir = TempDir::new().unwrap();
    let content = "---\nis_a: Quarter\n---\n# Q1 2026\n";
    let entry = parse_test_entry(&dir, "quarter/q1.md", content);
    assert_eq!(entry.is_a, Some("Quarter".to_string()));
}

// --- StringOrList normalization (uniform, no per-field special cases) ---

#[test]
fn test_single_element_array_owner_unwraps_to_scalar() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Responsibility\nOwner:\n  - Luca\n---\n# Test\n";
    let entry = parse_test_entry(&dir, "test.md", content);
    assert_eq!(
        entry.properties.get("Owner").and_then(|v| v.as_str()),
        Some("Luca")
    );
    assert_eq!(entry.is_a, Some("Responsibility".to_string()));
}

#[test]
fn test_single_element_array_cadence_unwraps_to_scalar() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Procedure\nCadence:\n  - Weekly\n---\n# Test\n";
    let entry = parse_test_entry(&dir, "test.md", content);
    assert_eq!(
        entry.properties.get("Cadence").and_then(|v| v.as_str()),
        Some("Weekly")
    );
    assert_eq!(entry.is_a, Some("Procedure".to_string()));
}

#[test]
fn test_single_element_array_status_unwraps_to_scalar() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Project\nStatus:\n  - Active\n---\n# Test\n";
    let entry = parse_test_entry(&dir, "test.md", content);
    assert_eq!(entry.status, Some("Active".to_string()));
    assert_eq!(entry.is_a, Some("Project".to_string()));
}

#[test]
fn test_scalar_fields_unchanged() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Project\nOwner: Luca\nCadence: Daily\nStatus: Done\n---\n# Test\n";
    let entry = parse_test_entry(&dir, "test.md", content);
    assert_eq!(
        entry.properties.get("Owner").and_then(|v| v.as_str()),
        Some("Luca")
    );
    assert_eq!(
        entry.properties.get("Cadence").and_then(|v| v.as_str()),
        Some("Daily")
    );
    assert_eq!(entry.status, Some("Done".to_string()));
}

#[test]
fn test_absent_fields_no_crash() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Note\n---\n# Test\n";
    let entry = parse_test_entry(&dir, "test.md", content);
    assert_eq!(entry.status, None);
}

#[test]
fn test_array_field_does_not_break_type_detection() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Responsibility\nOwner:\n  - Luca\nCadence:\n  - Weekly\nStatus:\n  - Active\n---\n# My Responsibility\n";
    let entry = parse_test_entry(&dir, "test.md", content);
    assert_eq!(
        entry.is_a,
        Some("Responsibility".to_string()),
        "type must not be lost when other fields are arrays"
    );

    assert_eq!(entry.status, Some("Active".to_string()));
}

// ── Folder tree tests ──────────────────────────────────────────────────────

#[test]
fn test_scan_vault_folders_returns_tree() {
    let dir = TempDir::new().unwrap();
    fs::create_dir_all(dir.path().join("projects/laputa")).unwrap();
    fs::create_dir_all(dir.path().join("areas")).unwrap();

    let folders = scan_vault_folders(dir.path()).unwrap();
    let names: Vec<&str> = folders.iter().map(|f| f.name.as_str()).collect();
    assert!(names.contains(&"projects"));
    assert!(names.contains(&"areas"));

    let projects = folders.iter().find(|f| f.name == "projects").unwrap();
    assert_eq!(projects.children.len(), 1);
    assert_eq!(projects.children[0].name, "laputa");
    assert_eq!(projects.children[0].path, "projects/laputa");
}

#[test]
fn test_scan_vault_folders_excludes_hidden() {
    let dir = TempDir::new().unwrap();
    fs::create_dir_all(dir.path().join(".git")).unwrap();
    fs::create_dir_all(dir.path().join(".laputa")).unwrap();
    fs::create_dir_all(dir.path().join("visible")).unwrap();

    let folders = scan_vault_folders(dir.path()).unwrap();
    assert_eq!(folders.len(), 1);
    assert_eq!(folders[0].name, "visible");
}

#[test]
fn test_scan_vault_folders_flat_vault() {
    let dir = TempDir::new().unwrap();
    create_test_file(dir.path(), "note.md", "# Note\n");

    let folders = scan_vault_folders(dir.path()).unwrap();
    assert!(folders.is_empty(), "flat vault has no visible folders");
}

// --- list_properties_display tests ---

#[test]
fn test_parse_list_properties_display() {
    let dir = TempDir::new().unwrap();
    let content =
        "---\ntype: Type\n_list_properties_display:\n  - rating\n  - genre\n---\n# Movies\n";
    let entry = parse_test_entry(&dir, "movies.md", content);
    assert_eq!(entry.list_properties_display, vec!["rating", "genre"]);
}

#[test]
fn test_parse_list_properties_display_absent_defaults_empty() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Type\n---\n# Books\n";
    let entry = parse_test_entry(&dir, "books.md", content);
    assert!(entry.list_properties_display.is_empty());
}

#[test]
fn test_list_properties_display_not_in_properties_or_relationships() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Type\n_list_properties_display:\n  - rating\n---\n# Movies\n";
    let entry = parse_test_entry(&dir, "movies.md", content);
    assert!(
        !entry.properties.contains_key("_list_properties_display"),
        "_list_properties_display must not leak into properties map"
    );
    assert!(
        !entry.relationships.contains_key("_list_properties_display"),
        "_list_properties_display must not leak into relationships map"
    );
}

#[test]
fn test_yml_file_uses_name_field_as_title() {
    let dir = TempDir::new().unwrap();
    let yml_content = "name: Active Projects\nicon: rocket\ncolor: blue\n";
    let yml_path = dir.path().join("active-projects.yml");
    std::fs::write(&yml_path, yml_content).unwrap();
    let entry = super::parse_non_md_file(&yml_path, None).unwrap();
    assert_eq!(entry.title, "Active Projects");
    assert_eq!(entry.filename, "active-projects.yml");
}

#[test]
fn test_yml_file_without_name_falls_back_to_filename() {
    let dir = TempDir::new().unwrap();
    let yml_content = "key: value\n";
    let yml_path = dir.path().join("config.yml");
    std::fs::write(&yml_path, yml_content).unwrap();
    let entry = super::parse_non_md_file(&yml_path, None).unwrap();
    assert_eq!(entry.title, "config.yml");
}

#[test]
fn test_non_yml_file_uses_filename_as_title() {
    let dir = TempDir::new().unwrap();
    let txt_path = dir.path().join("notes.txt");
    std::fs::write(&txt_path, "some content").unwrap();
    let entry = super::parse_non_md_file(&txt_path, None).unwrap();
    assert_eq!(entry.title, "notes.txt");
}

#[test]
fn test_classify_file_kind_yml_is_text() {
    assert_eq!(
        classify_file_kind(Path::new("views/active-projects.yml")),
        "text"
    );
    assert_eq!(classify_file_kind(Path::new("config.yaml")), "text");
    assert_eq!(classify_file_kind(Path::new("data.json")), "text");
    assert_eq!(classify_file_kind(Path::new("script.py")), "text");
    assert_eq!(classify_file_kind(Path::new("readme.txt")), "text");
}

#[test]
fn test_classify_file_kind_md_is_markdown() {
    assert_eq!(classify_file_kind(Path::new("note.md")), "markdown");
    assert_eq!(classify_file_kind(Path::new("README.markdown")), "markdown");
}

#[test]
fn test_classify_file_kind_unknown_is_binary() {
    assert_eq!(classify_file_kind(Path::new("photo.png")), "binary");
    assert_eq!(classify_file_kind(Path::new("archive.zip")), "binary");
}

#[test]
fn test_non_md_file_gets_text_file_kind() {
    let dir = TempDir::new().unwrap();
    create_test_file(
        dir.path(),
        "views/my-view.yml",
        "name: My View\nicon: rocket\n",
    );
    let entry = super::parse_non_md_file(&dir.path().join("views/my-view.yml"), None).unwrap();
    assert_eq!(entry.file_kind, "text");
    assert_eq!(entry.title, "My View");
}

/// Regression test: notes with complex frontmatter (quoted values, wikilinks
/// in arrays, Notion-imported fields) must parse type and _organized correctly.
/// Bug: initial load showed Type: None and notes appeared in Inbox despite
/// having type and _organized: true in frontmatter.
#[test]
fn test_complex_frontmatter_type_and_organized() {
    let dir = TempDir::new().unwrap();

    // Notion-style frontmatter with quoted dates, wikilinks in arrays, non-standard fields
    let content = r#"---
type: Note
_organized: true
aliases: ["My Complex Note"]
Topics: ["[[topic-writing]]", "[[topic-productivity|Productivity]]"]
"Created at": "2021-12-31T14:19:00.000Z"
Status: Published
Owner: "[[person-luca|Luca]]"
---
# My Complex Note

Content here.
"#;
    let entry = parse_test_entry(&dir, "complex-note.md", content);
    assert_eq!(
        entry.is_a,
        Some("Note".to_string()),
        "type must be parsed correctly with complex frontmatter"
    );
    assert!(
        entry.organized,
        "_organized must be true with complex frontmatter"
    );
}

#[test]
fn test_complex_frontmatter_is_a_alias_with_extra_fields() {
    let dir = TempDir::new().unwrap();

    // Uses "Is A" instead of "type", plus many non-standard fields
    let content = r#"---
Is A: Evergreen
_organized: true
aliases: ["Writing for Clarity vs. Writing for Credit"]
Topics: ["[[topic-writing]]"]
Status: Published
"Last edited": "2024-06-15T10:30:00.000Z"
notion_id: "abc123def456"
---
# Writing for Clarity vs. Writing for Credit

Content.
"#;
    let entry = parse_test_entry(&dir, "writing-note.md", content);
    assert_eq!(
        entry.is_a,
        Some("Evergreen".to_string()),
        "Is A must be parsed correctly with quoted keys nearby"
    );
    assert!(
        entry.organized,
        "_organized must be true even with complex surrounding fields"
    );
}

#[test]
fn test_complex_frontmatter_boolean_as_yaml_yes() {
    let dir = TempDir::new().unwrap();

    // _organized as YAML boolean Yes (not true)
    let content = "---\ntype: Note\n_organized: Yes\nStatus: Draft\n---\n# Test\n";
    let entry = parse_test_entry(&dir, "yes-note.md", content);
    assert_eq!(entry.is_a, Some("Note".to_string()));
    assert!(entry.organized, "_organized: Yes must be parsed as true");
}

/// Regression: gray_matter may fail to parse YAML with unquoted timestamp values
/// (colons in values like "14:19:00"), causing the entire frontmatter to be lost.
#[test]
fn test_complex_frontmatter_unquoted_timestamp() {
    let dir = TempDir::new().unwrap();

    let content = "---\ntype: Note\n_organized: true\nCreated at: 2021-12-31T14:19:00.000Z\nTopics:\n  - \"[[topic-writing]]\"\n---\n# Test\n";
    let entry = parse_test_entry(&dir, "timestamp-note.md", content);
    assert_eq!(
        entry.is_a,
        Some("Note".to_string()),
        "type must survive unquoted timestamp in sibling field"
    );
    assert!(
        entry.organized,
        "_organized must survive unquoted timestamp in sibling field"
    );
}

/// Regression: gray_matter may fail with flow-style arrays containing wikilinks
/// whose brackets look like nested YAML structures.
#[test]
fn test_complex_frontmatter_flow_array_with_wikilinks() {
    let dir = TempDir::new().unwrap();

    let content = r#"---
type: Evergreen
_organized: true
Topics: ["[[topic-writing]]", "[[topic-productivity|Productivity]]"]
Has: ["[[note-one]]", "[[note-two]]", "[[note-three]]"]
---
# Test
"#;
    let entry = parse_test_entry(&dir, "flow-array.md", content);
    assert_eq!(
        entry.is_a,
        Some("Evergreen".to_string()),
        "type must survive flow arrays with wikilinks"
    );
    assert!(
        entry.organized,
        "_organized must survive flow arrays with wikilinks"
    );
}

/// Regression: YAML that gray_matter cannot parse at all (returns Pod::String)
/// must still extract type and _organized via fallback parser.
#[test]
fn test_fallback_parser_extracts_type_and_organized() {
    use super::frontmatter::extract_fm_and_rels;
    // Simulate gray_matter returning String (parse failure) by passing None
    let raw_content =
        "---\ntype: Note\n_organized: true\nBroken: value: with: colons\n---\n# Test\n";
    let (fm, _, _) = extract_fm_and_rels(None, raw_content);
    assert_eq!(
        fm.is_a.as_ref().and_then(|v| v.clone().into_scalar()),
        Some("Note".to_string()),
        "fallback parser must extract type"
    );
    assert_eq!(
        fm.organized,
        Some(true),
        "fallback parser must extract _organized"
    );
}

/// Regression: real-world Notion-imported note with quoted keys containing
/// special characters (?, spaces) and many non-standard fields.
#[test]
fn test_notion_imported_frontmatter_with_special_quoted_keys() {
    let dir = TempDir::new().unwrap();
    let content = r#"---
type: Readings
aliases:
  - "1 to 1s"
"Discarded for digest?": false
"Note Status": Saved
URL: "http://theengineeringmanager.com/management-101/121s/"
Author: James Stanier
Category: Articles
"Full Title": 1 to 1s
Highlights: 21
"Last Synced": 2025-12-10
"Last Highlighted": 2021-04-12
notion_id: 2c5bdf02-815c-81ce-9dce-eca60ddaeb08
_organized: true
---

# 1 to 1s

Content.
"#;
    let entry = parse_test_entry(&dir, "1-to-1s.md", content);
    assert_eq!(
        entry.is_a,
        Some("Readings".to_string()),
        "type must be parsed with Notion-style quoted keys"
    );
    assert!(
        entry.organized,
        "_organized must be true with Notion-style frontmatter"
    );
}

/// Regression: unquoted colon in YAML list item causes gray_matter to mis-parse.
/// `aliases:\n  - Bitcoin: Net Unrealized...` has an unquoted `:` in a list item.
/// gray_matter may return a partial/mangled Hash instead of failing cleanly.
#[test]
fn test_unquoted_colon_in_list_item_breaks_parsing() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Note\n_organized: true\naliases:\n  - Bitcoin: Net Unrealized Profit/Loss\n  - Note\n---\n# Test\n";
    let entry = parse_test_entry(&dir, "colon-alias.md", content);
    assert_eq!(
        entry.is_a,
        Some("Note".to_string()),
        "type must be parsed correctly even when gray_matter fails due to unquoted colon in list item"
    );
    assert!(
        entry.organized,
        "_organized must be true even when gray_matter fails due to unquoted colon in list item"
    );
}

/// Regression: `# ` in a YAML list item is interpreted as a comment by gray_matter,
/// truncating the frontmatter and losing subsequent fields.
#[test]
fn test_hash_in_list_item_treated_as_comment() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Note\n_organized: true\naliases:\n  - # Writing a Good CLAUDE.md\n  - Note\n---\n# Title\n";
    let entry = parse_test_entry(&dir, "hash-alias.md", content);
    assert_eq!(
        entry.is_a,
        Some("Note".to_string()),
        "type must be parsed even when alias starts with # (YAML comment char)"
    );
    assert!(
        entry.organized,
        "_organized must be true even when alias starts with # (YAML comment char)"
    );
}

/// Full reproduction: real-world Notion-imported note with unquoted colon in alias.
#[test]
fn test_real_world_notion_note_with_unquoted_colon() {
    let dir = TempDir::new().unwrap();
    let content = r#"---
type: Note
workspace: personal
notion_id: de48a4ad-e7ad-42aa-a5ce-1efdc259d7f9
"Created at": "2021-12-17T10:21:00.000Z"
Reviewed: True
Topics:
  - "[[web3|Web3 / Crypto]]"
URL: https://studio.glassnode.com/metrics?a=BTC&category=Market%20Indicators&m=indicators.NetUnrealizedProfitLoss&s=1320105600&u=1639267199&zoom=
aliases:
  - Bitcoin: Net Unrealized Profit/Loss (NUPL) - Glassnode Studio
  - Note
Trashed: true
"Trashed at": 2026-03-11
_organized: true
---

# Bitcoin: Net Unrealized Profit/Loss (NUPL) - Glassnode Studio

"#;
    let entry = parse_test_entry(&dir, "bitcoin-note.md", content);
    assert_eq!(
        entry.is_a,
        Some("Note".to_string()),
        "type must be parsed correctly even with unquoted colon in alias"
    );
    assert!(
        entry.organized,
        "_organized must be true even with unquoted colon in alias"
    );
}

/// Scan the real user vault and verify all notes with type/organized in frontmatter
/// have those fields correctly parsed.
#[test]
fn test_real_vault_type_and_organized_consistency() {
    let vault_path = std::path::Path::new("/Users/luca/Laputa");
    if !vault_path.exists() {
        eprintln!("Skipping: ~/Laputa vault not found");
        return;
    }

    let mut mismatches = Vec::new();
    let walker = walkdir::WalkDir::new(vault_path)
        .into_iter()
        .filter_entry(|e| !e.file_name().to_string_lossy().starts_with('.'));

    for dir_entry in walker.filter_map(|e| e.ok()) {
        let path = dir_entry.path();
        if !path.is_file() || path.extension().is_none_or(|ext| ext != "md") {
            continue;
        }
        let content = match std::fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        // Only check files that have frontmatter
        if !content.starts_with("---\n") {
            continue;
        }
        let fm_end = match content[4..].find("\n---") {
            Some(pos) => pos + 4,
            None => continue,
        };
        let fm_block = &content[4..fm_end];

        // Check if frontmatter has type with a non-empty value
        let has_type_with_value = fm_block.lines().any(|l| {
            let trimmed = l.trim();
            for prefix in &["type:", "Is A:", "is_a:"] {
                if let Some(rest) = trimmed.strip_prefix(prefix) {
                    return !rest.trim().is_empty();
                }
            }
            false
        });

        // Check if frontmatter has _organized: true
        let has_organized_true = fm_block.lines().any(|l| {
            let t = l.trim();
            t == "_organized: true"
                || t == "_organized: True"
                || t == "_organized: yes"
                || t == "_organized: Yes"
        });

        if !has_type_with_value && !has_organized_true {
            continue;
        }

        let parsed = match parse_md_file(path, None) {
            Ok(e) => e,
            Err(err) => {
                mismatches.push(format!("PARSE ERROR: {} -> {}", path.display(), err));
                continue;
            }
        };

        if has_type_with_value && parsed.is_a.is_none() {
            mismatches.push(format!(
                "TYPE MISSING: {} (raw has type with value but parsed isA=None)",
                path.display()
            ));
        }
        if has_organized_true && !parsed.organized {
            mismatches.push(format!(
                "ORGANIZED MISSING: {} (raw has _organized: true but parsed organized=false)",
                path.display()
            ));
        }
    }

    if !mismatches.is_empty() {
        let summary = mismatches
            .iter()
            .take(20)
            .cloned()
            .collect::<Vec<_>>()
            .join("\n");
        panic!(
            "Found {} parsing mismatches in real vault:\n{}",
            mismatches.len(),
            summary
        );
    }
}

// Frontmatter update/delete tests are in frontmatter.rs
// save_image tests are in vault/image.rs
// purge_trash tests are in vault/trash.rs
// rename_note tests are in vault/rename.rs
