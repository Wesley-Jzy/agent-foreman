# Agent Detail Drawer + HUD Integration Design

**Date:** 2026-03-31
**Status:** Approved

## Problem

The current dashboard shows minimal info per agent: one truncated line of recent output and basic metrics. There's no way to see what an agent is actually doing step-by-step, no context usage visibility, and no way to send slash commands.

## Goals

1. Card-level activity summary — what tool/action is running right now
2. Context usage (%) visible on each card and in the drawer header
3. Expandable detail drawer — full conversation + tool call log, like claude.ai web view
4. Slash command quick-send from the drawer

## Design

### Card Enhancements

Each agent card gains two new rows below the existing project/branch line:

- **Activity line**: `[ToolName badge] short description of current action` — sourced from `current_tool` and `recent_output` in the agent snapshot
- **Context mini-bar**: horizontal progress bar (green → yellow → red) with percentage label, sourced from `context_pct` in the snapshot

### Right-Side Drawer

Triggered by clicking any agent card. The main board shifts left (shrinks by 460px via CSS margin); the drawer slides in from the right at fixed width 460px.

**Drawer sections (top to bottom):**

1. **Header**: status pill, project name, agent meta (type / pid / host), branch, close button; below that a larger context bar showing exact token usage
2. **Conversation area** (scrollable, flex-grow): messages rendered as:
   - User messages → left-aligned bubble (muted blue)
   - Assistant text → full-width muted card
   - Tool use blocks → collapsible row showing tool name + arg preview; expands to show full input params and result/error
   - Thinking blocks → dashed italic card
3. **Slash command panel** (pinned to bottom):
   - Quick chips: `/commit`, `/simplify`, `/review`, `/test`, `继续`
   - Text input + Send button (reuses existing `/api/action` endpoint)
   - Clicking a chip fills the input; Enter sends

Only one drawer open at a time. Clicking another card switches the drawer to that agent.

### Backend Changes

#### New fields on agent snapshot object

| Field | Type | Source |
|-------|------|--------|
| `current_tool` | `str \| null` | Name of the last `tool_use` entry in the session tail |
| `context_pct` | `float \| null` | `input_tokens / 200000 * 100` from last `usage` entry in session JSONL |

These are added to the agent dict in `summarize_host()`. Both are extracted during existing session parsing — no extra file reads.

#### `parse_claude_session()` enhancement

Currently extracts only the last assistant text. Enhanced to also:
- Track `current_tool`: scan reversed tail for the last `tool_use` content block, extract `name`
- Track `context_pct`: scan reversed tail for the last entry with `usage.input_tokens`, compute percentage

Codex sessions: `context_pct` left null (Codex JSONL format doesn't include token usage in the same way); `current_tool` extracted from the last `tool_call` entry if present.

#### New API endpoint

```
GET /api/session?agent_id=<id>
```

Returns the full parsed message list for the agent's session file:

```json
{
  "ok": true,
  "agent_id": "local:claude:38421",
  "session_id": "abc123",
  "messages": [
    {"role": "user", "type": "text", "text": "...", "ts": 1234567890},
    {"role": "assistant", "type": "text", "text": "...", "ts": 1234567891},
    {"role": "assistant", "type": "tool_use", "tool_name": "Read", "tool_input": {...}, "ts": 1234567892},
    {"role": "tool", "type": "tool_result", "tool_name": "Read", "content": "...", "is_error": false, "ts": 1234567893}
  ]
}
```

Parses the last 150 lines of the session JSONL. For remote agents, the endpoint returns an empty message list with a graceful error note (remote session file reading is out of scope for this iteration).

**Handler path:** `DashboardHandler`, GET `/api/session`, looks up agent by ID in `SnapshotStore`, reads session file, parses and returns messages.

### Frontend Changes

**`app.js`:**
- `makeCard()`: add activity line and context mini-bar rendering
- Add `openDrawer(agentId)` / `closeDrawer()` functions; drawer state tracked in `state.drawerAgentId`
- `fetchSession(agentId)`: calls `/api/session?agent_id=<id>`, renders into drawer
- Drawer polls every 3 seconds (separate `setInterval` from the main 1s snapshot poll)
- `renderConvo(messages)`: renders message list into drawer conversation area; handles text / tool_use / tool_result / thinking types
- Slash command chips: click fills input value; existing send logic unchanged

**`static/styles.css`:** drawer layout, bubble styles, tool block styles, context bar styles.

**`index.html`:** add drawer DOM structure (header, convo area, cmd panel).

### Context Percentage Calculation

```python
# In parse_claude_session():
# Scan reversed tail for last usage entry
for raw in reversed(lines[-80:]):
    obj = safe_json_loads(raw)
    usage = (obj.get("message") or obj).get("usage") or {}
    if usage.get("input_tokens"):
        context_pct = round(usage["input_tokens"] / 200_000 * 100, 1)
        break
```

Upper bound 200,000 tokens (claude-sonnet-4-x context window). If `input_tokens` exceeds this, cap at 100%.

### Slash Command Configuration

Default chip list hardcoded in frontend: `["/commit", "/simplify", "/review", "/test", "继续"]`.
Future: make configurable via `config.json` `quick_commands` array (out of scope for this iteration).

## What's Not Changing

- Send/injection mechanism (`/api/action`) — unchanged
- Main board refresh cadence (1s silent poll) — unchanged
- Host management panel — unchanged
- Session matching and status inference logic — unchanged

## Scope Boundary

This spec covers the drawer UI, the two new snapshot fields (`current_tool`, `context_pct`), and the `/api/session` endpoint. It does not cover:
- WebSocket / real-time streaming (polling is sufficient)
- Codex session context_pct (left null for now)
- Remote session file proxying via SSH (local sessions only in first iteration; remote falls back to graceful empty state)
