# /laputa-done <task_id>

Mark a Laputa task as done: move to In Review, notify Brian, then self-dispatch the next task.

Run this after Phase 1 (Playwright) and Phase 2 (native app QA) both pass.

## Steps

**1. Move task to In Review**

```bash
curl -s -X POST "https://api.todoist.com/api/v1/tasks/$ARGUMENTS/move" \
  -H "Authorization: Bearer $TODOIST_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"section_id": "6g3XjX33FF4Vj86M"}'
```

**2. Notify Brian**

```bash
openclaw system event --text "laputa-task-done:$ARGUMENTS" --mode now
```

**3. Pick the next task**

Run `/laputa-next-task` to get the next task and start working on it immediately.

If `/laputa-next-task` returns `NO_TASKS` → exit cleanly. The hourly watchdog will restart you when new tasks arrive.
