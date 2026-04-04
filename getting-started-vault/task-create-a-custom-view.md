---
title: "Task: Create a Custom View"
type: Task
Status: Open
Belongs to: "[[Laputa Onboarding]]"
Related to: "[[Laputa Onboarding]]"
---

Views are saved filters that show a subset of your notes. This vault includes an example view — "Active Projects" — that shows all projects with status Active.

## What to try

1. Open the command palette (Cmd+K) and look for a "New View" action, or create a `.yml` file in the `views/` folder
2. Define filters — for example, show all tasks with status Open
3. Set a name, icon, and color for the view
4. Save — the view appears in the sidebar under Views

## View format

Views are YAML files in `views/`. Here is an example:

```yaml
name: Open Tasks
icon: check-square
color: orange
sort: "modified:desc"
filters:
  all:
    - field: type
      op: equals
      value: Task
    - field: Status
      op: equals
      value: Open
```

## Tip

Views update automatically as you add or change notes. They are a powerful way to create dashboards for your projects, areas, or any slice of your vault.
