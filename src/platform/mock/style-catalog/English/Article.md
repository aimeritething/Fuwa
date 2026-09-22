---
title: Keeping a Markdown folder in sync with git
tags: [git, notes, workflow]
---
# Keeping a Markdown folder in sync with git

I keep every note I write in one folder of Markdown files, and for three years that folder has been a git repository. No sync service, no database, no export button. This post describes the setup, the two scripts that make it bearable, and the mistakes I made on the way.

The short version: commit often and automatically, pull before you write, and never let two machines edit the same file in the same hour. The long version follows.

## Why git at all

A sync service is easier on day one. You install it, you sign in, and the files appear everywhere. The trouble starts later, when a note you were sure you wrote is gone and the service offers you thirty days of history for a file it thinks was never there.

Git gives me three things a sync service does not:

- **A history I can read.** `git log -p -- ideas/reading.md` shows every change to one note since the day I created it.
- **Merges I can see.** When two machines disagree, I get a conflict marker in a text file instead of a silent copy named `reading (conflicted copy 2).md`.
- **No lock-in.** The remote is a bare repository on a small server. If it disappears tomorrow, every laptop still holds the full history.

> Plain text is the only format I trust to outlive the program that wrote it.

That line is from a talk I half remember, and it has aged better than most of my notes.

## The layout

The folder is flat where it can be and nested where it must be:

```text
notes/
  inbox.md
  journal/
    2026-09.md
  projects/
    plumo.md
    garden.md
  attachments/
    garden-plan.png
```

Attachments live in one directory so that a relative link like `attachments/garden-plan.png` keeps working when a note moves between folders. Everything else is a `.md` file with a first-level heading as its title.

![Forested ridges fading into haze, seen from Oak Mountain](../images/oak-mountain-panorama.jpg)

I took up long walks at about the same time I took up this system, which may explain why half of `journal/` is about hills.

## Setting it up

### One: create the repository

1. Make the folder a repository and add a remote:

   ```shellscript
   cd ~/notes
   git init
   git remote add origin ssh://me@example.com/srv/git/notes.git
   ```

2. Tell git which files are noise. Editors leave swap files, and macOS leaves `.DS_Store` everywhere:

   ```text
   .DS_Store
   *.swp
   .obsidian/workspace.json
   ```

3. Make the first commit and push it.
4. Clone the repository on every other machine. Do not copy the folder by hand, or the first pull will conflict with itself.

### Two: commit without thinking

Nobody writes a commit message for a shopping list. The commits have to happen on their own, so a small script does it:

```shellscript
#!/usr/bin/env bash
set -euo pipefail

cd "$HOME/notes"
git add -A
if git diff --cached --quiet; then
  exit 0
fi
git commit --quiet -m "auto: $(hostname -s) $(date '+%Y-%m-%d %H:%M')"
git pull --rebase --quiet
git push --quiet
```

The order matters. Commit first, so that the rebase has a clean tree to work with, and push last, so that a failed pull never publishes a half-merged state.

> [!tip] Run it from a timer, not from the editor
> An editor hook fires on every save, which means dozens of commits per hour. A timer that runs every ten minutes produces a history you can still read a year later.

On macOS the timer is a launch agent. On Linux a systemd user timer does the same job in two short files:

```toml
# ~/.config/notes-sync/config.toml
interval_minutes = 10
repository = "~/notes"
quiet_hours = { from = "23:00", to = "07:00" }

[remote]
name = "origin"
branch = "main"
```

### Three: pull before you write

This is the rule I break most often. If the laptop has been asleep for a week and I start typing into `inbox.md` before the first sync runs, I have just created a conflict with everything the desktop wrote in the meantime.

> [!warning] A rebase conflict stops the script
> When `git pull --rebase` hits a conflict, the script exits and the timer keeps failing quietly every ten minutes. Make the script notify you, or you will find out a week later that nothing has been pushed since Tuesday.

My fix is crude: the script writes its last exit code to a file, and my shell prompt turns red when that file does not contain a zero.

## What about conflicts

They happen less often than I feared, and nearly always in the same two files: the inbox and the current month of the journal. Both are append-only, so the resolution is always *keep both sides*. Git can be told to do that on its own with a merge driver:

```shellscript
git config merge.union.driver true
echo "inbox.md merge=union" >> .gitattributes
echo "journal/*.md merge=union" >> .gitattributes
```

With `merge=union`, git keeps the lines from both sides and never stops to ask. That is wrong for prose you are editing, and exactly right for a list you only ever add to.

## How the options compare

| | Sync service | Git by hand | Git with a timer |
| --- | --- | --- | --- |
| Setup time | Minutes | An hour | An afternoon |
| History | Thirty days, per file | Forever, readable | Forever, noisy |
| Conflicts | Silent copies | Visible, manual | Visible, mostly automatic |
| Works offline | Partly | Yes | Yes |
| Works on a phone | Yes | With effort | With effort |

The phone is the honest weak spot. I use a git client that can commit and push, and I accept that mobile edits reach the other machines when I remember to tap the button.

## What I would do differently

I would start with the timer on day one instead of trusting myself to commit. I would keep attachments small, because a repository full of phone photos is slow to clone, and ==git never forgets a large file== even after you delete it. And I would write the conflict notification before I needed it, not after.

If you want to try it, this is the whole list:

- [ ] Put the folder under git and push it to a remote you control
- [ ] Add a `.gitignore` for editor and system files
- [ ] Install the sync script and run it from a timer
- [ ] Mark append-only files with `merge=union`
- [ ] Make a failed sync impossible to miss
- [ ] Clone, do not copy, on every new machine

The details are in [the git documentation on attributes](https://git-scm.com/docs/gitattributes), which is drier than this post and far more complete.
