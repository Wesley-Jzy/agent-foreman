# tests/test_session_parsing.py
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


def load_monitor_server():
    root = Path(__file__).resolve().parents[1]
    spec = importlib.util.spec_from_file_location("monitor_server", root / "monitor_server.py")
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


monitor_server = load_monitor_server()

# A minimal Claude session JSONL with one tool_use and usage info
_SESSION_LINES = [
    {"type": "user", "timestamp": "2026-01-01T00:00:00Z",
     "cwd": "/project", "message": {"role": "user", "content": "Fix the bug"}},
    {"type": "assistant", "timestamp": "2026-01-01T00:01:00Z",
     "message": {
         "role": "assistant",
         "content": [
             {"type": "text", "text": "I'll look at the file"},
             {"type": "tool_use", "id": "tu1", "name": "Read",
              "input": {"file_path": "/project/foo.py"}},
         ],
         "usage": {"input_tokens": 40000, "output_tokens": 80},
     }},
    {"type": "user", "timestamp": "2026-01-01T00:02:00Z",
     "message": {"role": "user", "content": [
         {"type": "tool_result", "tool_use_id": "tu1", "content": "def foo(): pass"},
     ]}},
]

# Session with no tool_use and no usage — fields should be None
_SESSION_LINES_PLAIN = [
    {"type": "user", "timestamp": "2026-01-01T00:00:00Z",
     "cwd": "/project", "message": {"role": "user", "content": "Hello"}},
    {"type": "assistant", "timestamp": "2026-01-01T00:01:00Z",
     "message": {"role": "assistant", "content": [{"type": "text", "text": "Hi"}]}},
]


def _write_session(lines):
    """Write a list of dicts as JSONL to a temp file, return Path."""
    tf = tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False)
    for line in lines:
        tf.write(json.dumps(line) + "\n")
    tf.flush()
    tf.close()
    return Path(tf.name)


class SessionParsingFieldsTests(unittest.TestCase):
    def test_current_tool_extracted(self):
        path = _write_session(_SESSION_LINES)
        result = monitor_server.parse_claude_session(path, None, None)
        self.assertEqual(result["current_tool"], "Read")

    def test_context_pct_extracted(self):
        path = _write_session(_SESSION_LINES)
        result = monitor_server.parse_claude_session(path, None, None)
        # 40000 / 200000 * 100 = 20.0
        self.assertAlmostEqual(result["context_pct"], 20.0, places=1)

    def test_current_tool_none_when_absent(self):
        path = _write_session(_SESSION_LINES_PLAIN)
        result = monitor_server.parse_claude_session(path, None, None)
        self.assertIsNone(result["current_tool"])

    def test_context_pct_none_when_absent(self):
        path = _write_session(_SESSION_LINES_PLAIN)
        result = monitor_server.parse_claude_session(path, None, None)
        self.assertIsNone(result["context_pct"])

    def test_context_pct_capped_at_100(self):
        over_limit = [
            {"type": "user", "timestamp": "2026-01-01T00:00:00Z",
             "cwd": "/project", "message": {"role": "user", "content": "Hi"}},
            {"type": "assistant", "timestamp": "2026-01-01T00:01:00Z",
             "message": {
                 "role": "assistant",
                 "content": [{"type": "text", "text": "ok"}],
                 "usage": {"input_tokens": 999999, "output_tokens": 1},
             }},
        ]
        path = _write_session(over_limit)
        result = monitor_server.parse_claude_session(path, None, None)
        self.assertEqual(result["context_pct"], 100.0)


class ParseSessionMessagesTests(unittest.TestCase):
    def test_returns_list(self):
        path = _write_session(_SESSION_LINES)
        msgs = monitor_server.parse_session_messages(str(path))
        self.assertIsInstance(msgs, list)

    def test_user_message_included(self):
        path = _write_session(_SESSION_LINES)
        msgs = monitor_server.parse_session_messages(str(path))
        user_msgs = [m for m in msgs if m["role"] == "user" and m["type"] == "text"]
        self.assertTrue(any("Fix the bug" in m["text"] for m in user_msgs))

    def test_assistant_text_included(self):
        path = _write_session(_SESSION_LINES)
        msgs = monitor_server.parse_session_messages(str(path))
        asst = [m for m in msgs if m["role"] == "assistant" and m["type"] == "text"]
        self.assertTrue(any("look at the file" in m["text"] for m in asst))

    def test_tool_use_included(self):
        path = _write_session(_SESSION_LINES)
        msgs = monitor_server.parse_session_messages(str(path))
        tools = [m for m in msgs if m["type"] == "tool_use"]
        self.assertEqual(len(tools), 1)
        self.assertEqual(tools[0]["tool_name"], "Read")
        self.assertEqual(tools[0]["tool_input"]["file_path"], "/project/foo.py")

    def test_tool_result_included_with_name(self):
        path = _write_session(_SESSION_LINES)
        msgs = monitor_server.parse_session_messages(str(path))
        results = [m for m in msgs if m["type"] == "tool_result"]
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["tool_name"], "Read")
        self.assertIn("def foo", results[0]["content"])

    def test_missing_file_returns_empty_list(self):
        msgs = monitor_server.parse_session_messages("/nonexistent/path.jsonl")
        self.assertEqual(msgs, [])


if __name__ == "__main__":
    unittest.main()
