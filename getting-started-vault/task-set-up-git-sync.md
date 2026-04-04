---
title: "Task: Set Up Git Sync"
type: Task
Status: Open
Belongs to: "[[Laputa Onboarding]]"
---

Your vault is a git repository. Connecting it to a remote lets you back up your notes and sync across devices.

## What to try

1. Create a new repository on GitHub, GitLab, or any git host
2. Open a terminal in your vault directory
3. Add the remote: `git remote add origin <your-repo-url>`
4. Push your vault: `git push -u origin main`

## Using the Changes view

Laputa has a built-in Changes view in the sidebar that shows modified files. From there you can:

- See which files have changed since the last commit
- Commit changes with a message
- Push to the remote

## Tip

Git sync means you can edit your vault from any device — even a plain text editor on a computer that does not have Laputa installed. The next time you open Laputa, pull the latest changes and everything updates.
