# @bewaremypower/dsh-todo-reminder

Advisory DeepSeek Harness plugin: when an agent's `todo_write` list still has unfinished items and has not been updated for a configured number of tool calls, it appends a reminder to the next tool result so the model refreshes the list. It never blocks, rewrites, or delays a call.

Agents that never wrote a list are never reminded. A real user message resets tracking; a `todo_write` call (successful or rejected) restarts the counter with the list's latest unfinished count.

## Install

The package is a DSH bundle (`dsh.bundle.patch` → `cordis.patch.yml`), so it installs through the same path as any third-party bundle:

- Plugins page in the DSH Web sidebar, or
- the `plugin_manager` tool with the spec `github:bewaremypower/dsh-todo-reminder` (or the full git URL), or
- `pnpm add github:bewaremypower/dsh-todo-reminder` inside `~/.dsh/profiles/<profile>/`.

For local development, install `link:<absolute path to this repo>` instead. Changes apply immediately on profiles with HMR enabled; otherwise the manager reports `restart-required`.

## Configuration

Add `config` to the entry in `cordis.patch.yml` (or override from the profile patch):

```yaml
- id: todo-reminder
  config:
    thresholds: [10, 30, 60]
```

| Field | Default | Meaning |
|---|---|---|
| `thresholds` | `[10, 30, 60]` | Consecutive non-`todo_write` tool-call counts at which a reminder is delivered while the recorded list still has unfinished items. |
