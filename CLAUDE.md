# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Agent Foreman** is a real-time browser dashboard for monitoring Codex and Claude Code AI agents. It shows agent status (needs input / working / idle), supports multi-machine SSH monitoring, and lets you send messages to agents from the browser.

## Commands

### Run the server
```bash
python3 monitor_server.py                        # default: http://127.0.0.1:8787
python3 monitor_server.py --host 0.0.0.0 --port 8787  # all interfaces
python3 monitor_server.py --config /path/to/config.json
```

First-time setup: `cp config.example.json config.json`

### Run tests
```bash
python3 -m unittest discover -s tests -p "test_*.py"   # all tests
python3 -m unittest tests.test_credentials              # single test file
```

No build, lint, or dependency install step — the backend is pure Python stdlib (psutil auto-installed on macOS).

## Architecture

### Backend (`monitor_server.py` — single file, ~1900 lines)

Runs a `ThreadingHTTPServer` with a `BaseHTTPRequestHandler`. Key classes:

- **`CredentialVault`** — AES-256-CBC + PBKDF2 encrypted storage for SSH passwords. Unlocked at startup with a master password; never writes plaintext to disk.
- **`ManagedHostStore`** — manages remote SSH host configs split between `config.json` (public metadata) and the encrypted vault (passwords).
- **`SnapshotStore`** — thread-safe in-memory cache of all agent states. `refresh()` calls `collect_all()` which probes all hosts in parallel; `get()` returns the latest snapshot.
- **`DashboardHandler`** — HTTP handler. GET `/api/snapshot`, `/api/hosts`, `/api/refresh`; POST `/api/action` (send message), `/api/hosts/save|delete|toggle|test`, `/api/rename`.

### Agent discovery pipeline

1. `list_processes()` — parses `ps` output to find Codex/Claude processes → `ProcInfo` objects
2. `dedupe_processes()` — keeps only root processes
3. Session parsing: `parse_codex_session()` (`.codex/sessions/*.jsonl`) / `parse_claude_session()` (`.claude/projects/*.jsonl`)
4. `match_sessions()` — correlates processes with sessions by CWD
5. `infer_status()` — classifies as `needs-input` / `busy` / `active` / `stale` / `idle` based on CPU, heartbeat age, and output patterns
6. `collect_all()` — aggregates local + remote hosts; remote hosts receive a base64-encoded JSON probe payload via SSH

### Message sending (agent input injection)

- **Linux local**: tmux → TIOCSTI → ptrace fallback
- **macOS local**: SSH + tmux send-keys
- **Remote**: SSH + tmux or ptrace injection

### Frontend (`static/`)

Vanilla JS + HTML + CSS — no framework, no build step. `app.js` polls `/api/snapshot` every second, renders agents grouped by status, and handles the host management modal. `styles.css` includes the animated mascot SVG.

## Configuration

`config.json` (gitignored) controls refresh interval, session scan limits, SSH hosts, status thresholds, and `needs_input_patterns` (regex list for detecting when an agent is waiting).

Sensitive gitignored files: `config.json`, `credentials.enc.json`, `session_aliases.json`.

## Tests

Tests live in `tests/` and cover: credential encryption roundtrips, host API validation, process filtering/deduplication, and config parsing. The `--probe` CLI flag is used internally to run agent discovery on remote machines.
