# /laputa-next-task

Pick the next Laputa task from Todoist and move it to In Progress.

Priority order: **To Rework** first, then **Open** (sorted by Todoist priority p1→p4).

## Steps

1. Fetch tasks from To Rework (`6g6QqvR9rRpvJWvv`), then Open (`6g3XjWR832hVHhCM`)
2. Sort each section by priority (p1 highest)
3. Take the first available task
4. Move it to In Progress (`6g3XjWjfmJFcGgHM`) via Todoist API:

```bash
curl -s -X POST "https://api.todoist.com/api/v1/tasks/<task_id>/move" \
  -H "Authorization: Bearer $TODOIST_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"section_id": "6g3XjWjfmJFcGgHM"}'
```

5. Fetch the full task details (description, comments) from Todoist:

```bash
curl -s "https://api.todoist.com/api/v1/tasks/<task_id>" \
  -H "Authorization: Bearer $TODOIST_API_KEY"

curl -s "https://api.todoist.com/api/v1/comments?task_id=<task_id>" \
  -H "Authorization: Bearer $TODOIST_API_KEY"
```

6. For To Rework tasks: read the ❌ QA failed comment — it tells you exactly what to fix
7. Output: task ID, title, and full description so you can start working immediately

If no tasks are available in either section → output `NO_TASKS` and exit cleanly.
