# Contribute

Source: reference/contribute.md
URL: /reference/contribute

# Contribute

Tolaria is free and open source, and any kind of help is useful. Pick the path that matches what you want to do.

## Sponsor Or Support

The best way to support Tolaria is to subscribe to [Refactoring](https://refactoring.fm/), Luca's newsletter and community about running good teams and shipping software with AI.

## Feature Requests

Use the [product board](https://tolaria.canny.io/) for feature ideas. Search first, upvote existing ideas, and create a new post when the request is genuinely new.

## Discussions

Use [GitHub Discussions](https://github.com/refactoringhq/tolaria/discussions) for questions, conversations, show and tell, and broader community context.

## Contribute Code

Small, focused pull requests are welcome. Check the product board first so you build the right thing, then open a PR on [GitHub](https://github.com/refactoringhq/tolaria/pulls). The [contributing guide](https://github.com/refactoringhq/tolaria/blob/main/CONTRIBUTING.md) explains the local workflow.

## Report A Bug

Use [GitHub Issues](https://github.com/refactoringhq/tolaria/issues) for bugs. Include what happened, what you expected, and clear reproduction steps. If you are reporting from inside Tolaria, use the Contribute panel to copy sanitized diagnostics and attach them to the issue.

---

# Docs Maintenance

Source: reference/docs-maintenance.md
URL: /reference/docs-maintenance

# Docs Maintenance

The public docs live in the app repo so documentation changes can ship with behavior changes.

## Update Docs When You Change

- A Tauri command.
- A new component or hook that changes user behavior.
- A data model or frontmatter convention.
- Git, AI, onboarding, or release behavior.
- Public release pages, download metadata, or updater channels.
- Platform support.
- Keyboard shortcuts.

## Suggested Workflow

1. Make the code change.
2. Update the matching concept, guide, or reference page.
3. Add a troubleshooting page if the change creates a new failure mode.
4. Run `pnpm docs:build`.
5. Check the home page, search, release/download links, and changed docs pages in a browser.

## Page Types

| Type | Purpose |
| --- | --- |
| Start | Helps a new user get into the app. |
| Concepts | Explains mental models. |
| Guides | Teaches workflows. |
| Reference | Gives stable facts and tables. |
| Troubleshooting | Starts from a symptom and ends with recovery. |

## Review Checklist

- Does the page describe current behavior?
- Does it mention macOS primary and Windows/Linux supported-early status when platform support matters?
- Are links relative and VitePress-compatible?
- Can a user discover the page with local search?

---

# File Layout

Source: reference/file-layout.md
URL: /reference/file-layout

# File Layout

Tolaria is not opinionated about folder structure. It finds notes recursively across the whole vault, stores new notes in the root by default, and uses types and relationships for real organization.

```txt
my-vault/
  project-alpha.md
  weekly-review.md
  research/
    source-notes.md
  attachments/
    diagram.png
    source.pdf
  project.md
  person.md
  views/
    active-projects.yml
```

## Root Notes

Tolaria works well with a flat vault. Folders are optional and can be useful for compatibility with other tools, but they are not required for people, projects, topics, or any other note category.

Type is not inferred from folder location. It comes from frontmatter, and relationships are expressed with wikilinks in fields. That is what Tolaria uses for the sidebar, Properties panel, search, custom views, and neighborhood navigation.

## Special Folders

| Folder | Purpose |
| --- | --- |
| `views/` | Saved custom views. |
| `attachments/` | Images and other attached files. |

PDFs, images, and other non-Markdown files stay as normal files. Folder browsing can show them in place, and Settings controls whether PDFs, images, and unsupported files appear in All Notes.

Whiteboards are Markdown files with durable tldraw data, so they belong with notes rather than in `attachments/`.

Type definitions are Markdown notes with `type: Type` in frontmatter. New type documents are normal notes, and existing type documents in older folders still work.

## Git Files

If the vault is a Git repository, `.git/` belongs to Git. Tolaria reads Git state but does not treat `.git/` as notes.

---

# Frontmatter Fields

Source: reference/frontmatter-fields.md
URL: /reference/frontmatter-fields

# Frontmatter Fields

Tolaria uses conventions instead of a required schema.

| Field | Meaning |
| --- | --- |
| `type` | The note's entity type. |
| `status` | Lifecycle state. |
| `icon` | Per-note icon. |
| `url` | External URL. |
| `date` | Single date. |
| `belongs_to` | Parent relationship. |
| `related_to` | Lateral relationship. |
| `has` | Contained relationship. |
| `_width` | Per-note editor width override. |
| `_icon`, `_color` | Type or note appearance metadata. |
| `_sidebar_label`, `_order` | Type sidebar label and order. |
| `_pinned_properties` | Properties pinned for a type. |

## Custom Fields

You can add your own fields. If a field contains wikilinks, Tolaria can treat it as a relationship.

## System Fields

Fields starting with `_` are reserved for system behavior and hidden from standard property editing. They remain plain YAML, so they can still be inspected or changed in raw mode when needed.

---

# Keyboard Shortcuts

Source: reference/keyboard-shortcuts.md
URL: /reference/keyboard-shortcuts

# Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Cmd+K` / `Ctrl+K` | Open command palette. |
| `Cmd+P` / `Ctrl+P` | Quick open notes and files. |
| `Cmd+N` / `Ctrl+N` | Create a new note. |
| `Cmd+S` / `Ctrl+S` | Save current note. |
| `Cmd+F` / `Ctrl+F` | Find in the current note. |
| `Cmd+Shift+F` / `Ctrl+Shift+F` | Search the vault. |
| `Cmd+Shift+V` / `Ctrl+Shift+V` | Paste without formatting. |
| `Cmd+\` / `Ctrl+\` | Toggle raw Markdown mode. |
| `Cmd+Shift+T` / `Ctrl+Shift+T` | Toggle table of contents. |
| `Cmd+Shift+I` / `Ctrl+Shift+I` | Toggle Properties panel. |
| `Cmd+Shift+L` / `Ctrl+Shift+L` | Toggle AI panel. |
| `Cmd+[` / `Alt+Left` | Navigate back when available. |
| `Cmd+]` / `Alt+Right` | Navigate forward when available. |
| `Cmd+Shift+O` / `Ctrl+Shift+O` | Open current note in a new window. |
| `Cmd+D` / `Ctrl+D` | Toggle favorite for the current note. |
| `Cmd+E` / `Ctrl+E` | Mark the current Inbox note organized. |

Some shortcuts vary by platform because macOS, Linux, and Windows reserve different key combinations.

Use the command palette to discover the current command set.

---

# Release Channels

Source: reference/release-channels.md
URL: /reference/release-channels

# Release Channels

Tolaria publishes Stable and Alpha release metadata to GitHub Pages.

## Stable

Stable follows manually promoted releases. This is the right channel for normal use.

The stable updater metadata lives at:

```txt
/stable/latest.json
```

The public download page points at the latest stable release.

## Alpha

Alpha follows pushes to `main`. It receives fixes and features earlier, but it can be rougher than Stable.

The alpha updater metadata lives at:

```txt
/alpha/latest.json
```

Compatibility endpoints also point to the alpha metadata:

```txt
/latest.json
/latest-canary.json
```

## Before Switching

Commit or push important vault changes before changing release channel or installing an update. Your notes are local files, but a clean Git state makes recovery simpler.

---

# Supported Platforms

Source: reference/supported-platforms.md
URL: /reference/supported-platforms

# Supported Platforms

Tolaria is a desktop app built with Tauri. Releases currently target macOS, Windows, and Linux.

| Platform | Current support | Notes |
| --- | --- | --- |
| macOS | Primary | Main development and QA target. Apple Silicon and Intel artifacts are published. |
| Windows | Supported, early | NSIS installers and signed updater bundles are published. Menu, shell-path, and credential-helper behavior receive platform-specific fixes as they appear. |
| Linux | Supported, early | AppImage and deb artifacts are published. Behavior can depend on distro WebKitGTK packages, Wayland/X11 details, and input-method setup. |

## Support Policy

Primary support means the platform is part of normal development and release validation. Supported, early means release artifacts exist and the app is expected to work, but platform-specific bugs can take longer to diagnose than macOS issues.

## Reporting Platform Bugs

Include:

- Tolaria version.
- Operating system and version.
- CPU architecture.
- Whether the vault is local-only or connected to a remote.
- Steps to reproduce.

---

# View Filters

Source: reference/view-filters.md
URL: /reference/view-filters

# View Filters

View filters define saved lists of notes.

## Common Filter Ideas

| Goal | Filter direction |
| --- | --- |
| Active projects | `type` is Project and `status` is Active |
| Drafts | `type` is Article and `status` is Draft |
| People follow-up | `type` is Person and date is before today |
| Recent work | modified date is within a recent range |

## Sorting

Useful sorts include:

- Recently modified first.
- Title ascending.
- Status ascending.
- A custom property ascending or descending.

## Operators

Saved views can combine filters for text, dates, relationship fields, and frontmatter values. Relative date expressions are useful for views such as notes changed this week or people that need follow-up.

Regex filters are available for power-user cases. Keep them narrow and test them on a small view first.

## Keep Views Focused

A view should answer one recurring question. If it becomes too broad, split it into two views.

You can also customize view appearance with the same kind of icon and color controls used by types.