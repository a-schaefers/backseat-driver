#!/usr/bin/env python3
"""Tests for scripts/jack.py: what it reads off a screen, and what it calls a disagreement.

    python3 scripts/test_jack.py        (also `npm run tools`, and part of `npm run check`)

Nothing here needs a running session. The one test that needs tmux is skipped without it.
"""

from __future__ import annotations

import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import jack  # noqa: E402

REPO = HERE.parent

# A fullscreen terminal with the tutor's pane docked beside the conversation, cut down to twelve rows.
DOCKED = """\
                                                    │                                                  ✕
 ▐▛███▛█   Claude Code v2.1.289                     │1: Play (1)  2: Review  3: Explain  4: Progress
▝▜██████▀  Haiku 4.5 · Claude Pro                   │On. Watching for your next save.
 ▝▝   ▝▝   /tmp/ride                                │● No editor is connected.
                                                    │w: Working on adding a median function
❯ /bsd                                              │
  ⎿  backseat-driver: Backseat Driver is on.        │stats.py
● The idea behind note 1 is the difference between  │❯ 1  ✘ bug · line 6
  an odd and an even count: with four numbers there │    For even-length lists, median should average
  is no single middle one, so which do you return?  │    the two middle values, not take the upper one.
────────────────────────────────────────────────────│
❯                                                   │e: explain   d: dismiss   m: mute   l: look now
""".split("\n")

TEXTS = [
    "1: Play (1)", "2: Review", "3: Explain", "4: Progress", "On. Watching for your next save.", "●", "No editor is connected.",
    "w: Working on", "adding a median function", "stats.py", "1", "✘ bug · line 6",
    "For even-length lists, median should average the two middle values, not take the upper one.", "e: explain", "l: look now",
]


def session(**over) -> dict:
    base = {
        "id": "aaaaaaaa-1111-4000-8000-000000000001", "short": "aaaaaaaa", "bg": "", "pid": 0, "kind": "interactive", "status": "idle",
        "name": "", "cwd": "/tmp/ride", "home": None, "plugin": "installed", "eyes": None, "entry": None, "debug": None, "state": None, "is_me": False,
        "copy": {"folder": "", "version": "", "commit": "", "can_say": True},
    }
    made = {**base, **over}
    # A session that says the tutor is on has said so where the others read it, unless a test says otherwise.
    if made["state"] is not None and "entry" not in over:
        made["entry"] = {"session": made["id"], "mode": made["state"].get("mode", "on"), "at": 0, "leftAt": 0}
    return made


def state(now: int, **over) -> dict:
    base = {
        "at": now - 2000, "mode": "on", "repoRoot": "", "deadlines": {}, "pushers": [], "lease": {"isDriver": True, "holder": "x"},
        "session": {"id": "aaaaaaaa", "surfaces": ["terminal"], "layout": "vertical", "panes": [{"id": "backseat-driver", "isPlaced": True, "isShown": True}]},
        "pane": {"mode": "on", "notes": [], "watch": {}},
        "shown": {"pane": {"at": now - 3000, "placement": "dock", "columns": 48, "texts": TEXTS}, "band": None, "hint": "", "opened": {"at": now - 9000, "isPlaced": True, "reason": ""}},
    }
    return {**base, **over}


def world(sessions: list[dict], homes: list[pathlib.Path] | None = None, now: int | None = None) -> dict:
    now = jack.now_ms() if now is None else now
    return {"now": now, "procs": {}, "sessions": sessions, "gone": [], "homes": homes or [], "panes": []}


def bad(found: list[tuple[str, str]]) -> list[str]:
    return [text for level, text in found if level == jack.BAD]


class Numbers(unittest.TestCase):
    """The tool judges by the tutor's own numbers. They are written twice, so they are held together here."""

    def number(self, path: str, name: str) -> float:
        text = (REPO / path).read_text()
        found = re.search(rf"^{name}\s*=\s*([0-9_.]+)", text, re.M) or re.search(rf"\b{name}\s*=\s*([0-9_.]+)", text)
        self.assertIsNotNone(found, f"{name} not found in {path}")
        return float(found.group(1).replace("_", ""))

    def test_they_are_the_kernels(self):
        self.assertEqual(jack.LEASE_TTL_MS, self.number("kernel/src/Kernel/Lease.purs", "ttlMs"))
        self.assertEqual(jack.SELF_CHECK_MS, self.number("kernel/src/Kernel/Sessions.purs", "checkEveryMs"))
        self.assertEqual(jack.ALIVE_MS, self.number("kernel/src/Kernel/Sessions.purs", "aliveMs"))
        self.assertEqual(jack.EDITOR_TTL_MS, self.number("plugin/core/editors.ts", "EDITOR_TTL_MS"))

    def test_a_project_folder_is_named_as_the_tutor_names_it(self):
        # Both seen in real data folders.
        self.assertEqual(jack.project_id("/home/grok/repos/bashscripts"), "bashscripts-2c7d6042")
        self.assertEqual(jack.project_id("/tmp/bsd-jack-ride/"), "bsd-jack-ride-419d5870")

    def test_the_data_folder_is_found_as_the_tutor_finds_it(self):
        self.assertEqual(jack.data_home({"HOME": "/home/me"}), pathlib.Path("/home/me/.local/share/backseat-driver"))
        self.assertEqual(jack.data_home({"HOME": "/home/me", "XDG_DATA_HOME": "/x/"}), pathlib.Path("/x/backseat-driver"))
        self.assertEqual(jack.data_home({"HOME": "/home/me", "XDG_DATA_HOME": "/x", "BACKSEAT_DRIVER_HOME": "/scratch/"}), pathlib.Path("/scratch"))
        self.assertIsNone(jack.data_home({}))

    def test_a_background_session_gets_its_environment_from_its_settings(self):
        argv = ["claude", "--model", "haiku", "--settings", json.dumps({"env": {"BACKSEAT_DRIVER_HOME": "/scratch"}}), "--plugin-dir", "/repo/plugin"]
        self.assertEqual(jack.settings_env(argv), {"BACKSEAT_DRIVER_HOME": "/scratch"})
        self.assertEqual(jack.settings_env(["claude", "--settings=not json"]), {})
        self.assertEqual(jack.plugin_dirs(argv), ["/repo/plugin"])
        self.assertEqual(jack.plugin_source(["claude"]), "installed")
        self.assertEqual(jack.plugin_source(["claude", "--plugin-dir", str(REPO / "plugin")]), str(REPO / "plugin"))

    def test_which_copy_of_the_plugin_a_session_runs_and_whether_it_can_say(self):
        # The working copy follows the debug switch under the name the tool looks for.
        self.assertIn(f"export async function {jack.FOLLOWS_SWITCH}(", (REPO / "plugin" / "core" / "debugging.ts").read_text())
        working = jack.plugin_copy(str(REPO / "plugin"), "")
        self.assertEqual(working["folder"], str(REPO / "plugin"))
        self.assertTrue(working["can_say"])
        self.assertEqual(working["version"], json.loads((REPO / "plugin" / ".claude-plugin" / "plugin.json").read_text())["version"])
        with tempfile.TemporaryDirectory() as tmp:
            # An installed copy from before the switch could be followed: found through its config folder's book.
            old = pathlib.Path(tmp) / "cache" / "backseat-driver" / "0.1.0"
            (old / ".claude-plugin").mkdir(parents=True)
            (old / "core").mkdir()
            (old / "hooks").mkdir()
            (old / ".claude-plugin" / "plugin.json").write_text(json.dumps({"name": "backseat-driver", "version": "0.1.0"}))
            (old / "core" / "debugging.ts").write_text("export async function startDebug() {}\n")
            (old / "hooks" / "register.tsx").write_text("// nothing follows the switch here\n")
            config = pathlib.Path(tmp) / "config"
            (config / "plugins").mkdir(parents=True)
            (config / "plugins" / "installed_plugins.json").write_text(json.dumps({"version": 2, "plugins": {
                "backseat-driver@backseat-driver": [{"scope": "user", "installPath": str(old), "version": "0.1.0", "gitCommitSha": "46ce6bb0c253702bb443c9ecec6ae98952177630"}]}}))
            installed = jack.plugin_copy("installed", str(config))
            self.assertEqual(installed, {"folder": str(old), "version": "0.1.0", "commit": "46ce6bb", "can_say": False})
            s = session(copy=installed)
            self.assertTrue(jack.cannot_say(s))
            self.assertEqual(jack.copy_label(s), "installed 0.1.0 (46ce6bb)")
            # With nothing installed, nothing is known of the copy.
            (config / "plugins" / "installed_plugins.json").write_text(json.dumps({"version": 2, "plugins": {}}))
            self.assertEqual(jack.plugin_copy("installed", str(config)), {"folder": "", "version": "", "commit": "", "can_say": None})
        self.assertEqual(jack.copy_label(session(plugin=str(REPO / "plugin"))), "working copy")
        self.assertEqual(jack.copy_label(session(plugin=str(jack.LIVE))), "live copy")

    def test_the_live_copy_is_compared_with_the_working_copy_file_by_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            src, live = pathlib.Path(tmp) / "plugin", pathlib.Path(tmp) / "live"
            for root in (src, live):
                (root / "hooks").mkdir(parents=True)
                (root / "hooks" / "register.tsx").write_text("same\n")
                (root / "core").mkdir()
            (src / "core" / "look.ts").write_text("new\n")
            (live / "core" / "look.ts").write_text("old\n")
            (live / "core" / "gone.ts").write_text("removed from the working copy\n")
            (src / "core" / "added.ts").write_text("not yet synced\n")
            # Tests and the types Claude Code writes are never part of it.
            (src / "tests").mkdir()
            (src / "tests" / "x.test.ts").write_text("test\n")
            (live / ".claude-plugin" / "types").mkdir(parents=True)
            (live / ".claude-plugin" / "types" / "index.d.ts").write_text("types\n")
            self.assertEqual(jack.live_diff(src, live), ["core/added.ts", "core/gone.ts", "core/look.ts"])
            self.assertEqual(jack.live_diff(src, pathlib.Path(tmp) / "nowhere"), ["core/added.ts", "core/look.ts", "hooks/register.tsx"])
        self.assertEqual(jack.is_busy(None), "")
        self.assertEqual(jack.is_busy({"pane": {"watch": {"state": "watching"}, "review": {"state": "done"}}}), "")
        self.assertEqual(jack.is_busy({"pane": {"watch": {"state": "looking"}}}), "a look is running")
        self.assertEqual(jack.is_busy({"pane": {"watch": {"state": "watching"}, "review": {"state": "running"}}}), "a deep review is running")


class Screen(unittest.TestCase):
    def test_a_docked_pane_is_told_from_the_conversation_beside_it(self):
        self.assertEqual(jack.divider(DOCKED), 52)
        self.assertIsNone(jack.divider(["❯ hello", "  a │ b", "plain"]))
        parts = jack.sides(DOCKED)
        self.assertEqual(sorted(parts), ["conversation", "pane"])
        self.assertIn("On. Watching for your next save.", parts["pane"])
        self.assertIn("❯ /bsd", parts["conversation"])
        self.assertEqual(sorted(jack.sides(["one screen"])), ["screen"])

    def test_what_the_tutor_says_it_drew_is_found_where_it_is(self):
        head, rest = jack.missing_pieces(TEXTS, DOCKED)
        self.assertEqual((head, rest), ([], []))

    def test_text_wrapped_inside_the_pane_is_found_whole(self):
        where = jack.flows(DOCKED)
        self.assertTrue(jack.is_on_screen("For even-length lists, median should average the two middle values", where))
        # The same words do not run on across the conversation: only the pane's own side has them together.
        self.assertNotIn("average the two middle", where[0])

    def test_what_is_not_there_is_missed_and_the_top_of_the_pane_counts_most(self):
        gone = [row[:52] for row in DOCKED]
        head, rest = jack.missing_pieces(TEXTS, gone)
        self.assertEqual(head, ["1: Play (1)", "2: Review", "3: Explain", "4: Progress", "On. Watching for your next save."])
        self.assertIn("No editor is connected.", rest)
        # One mark says too little to be missed.
        self.assertNotIn("●", head + rest)
        self.assertNotIn("1", rest)

    def test_markdown_is_compared_as_a_terminal_draws_it(self):
        where = jack.flows(["  Review", "  The mean is fine, and the median sorts a copy."])
        self.assertTrue(jack.is_on_screen("## Review", where))
        self.assertTrue(jack.is_on_screen("The **mean** is fine, and the `median` sorts a copy.", where))
        self.assertTrue(jack.is_on_screen("- The mean is fine", where))
        self.assertFalse(jack.is_on_screen("The mode is wrong", where))

    def test_a_spinner_and_a_running_clock_are_not_news(self):
        rows = ["❯ hello", "✻ Brewing… (12s · esc to interrupt)", "  ⏵⏵ bypass permissions on · esc to interrupt", "│On. Watching.", "  3s · ↓ 1.2k tokens)"]
        self.assertEqual(jack.steady(rows), ["❯ hello", "│On. Watching."])

    @unittest.skipUnless(shutil.which("tmux"), "tmux is not installed")
    def test_terminal_output_is_replayed_into_the_screen_it_made(self):
        raw = b"first\r\nsecond\r\n\x1b[1;1Hfirst row, rewritten\x1b[3;1Hthird"
        rows = jack.replay(raw, 40, 6)
        self.assertEqual([row.rstrip() for row in rows[:3]], ["first row, rewritten", "second", "third"])
        # tmux leaves the server's socket behind after kill-server; the tool does not.
        self.assertFalse((jack.tmux_folder() / f"bsd-jack-replay-{os.getpid()}").exists())


class Log(unittest.TestCase):
    def test_a_log_is_read_across_its_chunks_and_a_line_caught_mid_write_is_left_for_later(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = pathlib.Path(tmp)
            (folder / "000000.jsonl").write_text('{"t":1,"seq":1,"k":"cmd","n":"on"}\n{"t":2,"seq":2,"k":"state","n":"mode"}\n')
            (folder / "000001.jsonl").write_text('{"t":3,"seq":3,"k":"look","n":"start"}\n{"t":4,"seq":4,"k":"lo')
            (folder / "state.json").write_text("{}")
            records = jack.log_records(folder)
            self.assertEqual([r["seq"] for r in records], [1, 2, 3])
            # From where the last reading ended: only what is new.
            (folder / "000001.jsonl").write_text('{"t":3,"seq":3,"k":"look","n":"start"}\n{"t":4,"seq":4,"k":"look","n":"done"}\n')
            self.assertEqual([r["seq"] for r in jack.log_records(folder, records[-1]["_at"])], [4])
            self.assertEqual(jack.log_records(None), [])

    def test_claude_codes_own_log_is_read_for_what_it_refused_and_not_for_everyday_lines(self):
        everyday = [
            "2026-10-05T21:12:46.969Z [DEBUG] $.fs.list (backseat-driver): /tmp/home/editors failed: ENOENT: no such file or directory, scandir '/tmp/home/editors'",
            "2026-10-05T21:11:49.321Z [DEBUG] hooks module backseat-driver@inline tool.call skipped: re-entry (the plugin's own code raised it; origin backseat-driver)",
            "2026-10-05T21:12:50.352Z [DEBUG] hooks module backseat-driver@inline session.end settled in 99.0ms (worker hop, next() included)",
            '2026-10-05T21:12:50.000Z [DEBUG] MCP server "backseat-driver": Channel notifications skipped: server did not declare claude/channel capability',
            "2026-10-05T21:12:50.000Z [ERROR] MCP server \"plugin:github:github\" Connection failed (400)",
        ]
        refused = [
            "backseat-driver: ui.render (Pane) refused: Box borderStyle is a number; the engine drew its own",
            "backseat-driver@inline: ui.render (AbovePrompt) threw while drawn: x is undefined; the engine drew its own",
            "ui.render (Pane): a hook returned a tree that does not validate: Text takes no key",
            "backseat-driver: hooks module did not load: /repo/plugin/hooks/register.tsx, compiled line 2554",
            "hooks module backseat-driver@inline prompt.submit failed: TypeError (41 chars)",
            "hooks module backseat-driver@inline tool.call skipped: exceeded 10000ms budget",
        ]
        self.assertEqual([line for line in everyday if jack.is_trouble(line)], [])
        self.assertEqual([line for line in refused if not jack.is_trouble(line)], [])

    def test_a_record_is_one_line(self):
        line = jack.record_line({"t": 0, "k": "model", "n": "play-by-play", "ms": 1905, "d": {"request": {"prompt": "x" * 400}}}, 60)
        self.assertIn("model/play-by-play 1905ms", line)
        self.assertTrue(line.endswith("…"))
        self.assertEqual(jack.dig({"a": [{"b": 7}]}, "a.0.b"), 7)
        self.assertIsNone(jack.dig({"a": 1}, "a.b"))


class Disagreements(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.home = pathlib.Path(self.tmp.name)
        # The files' own times are compared with the clock, so the clock is the real one.
        self.now = jack.now_ms()

    def tearDown(self):
        self.tmp.cleanup()

    def project(self, root: str, lease: dict, notes: int = 0, notes_age_ms: int = 0) -> None:
        folder = self.home / "projects" / jack.project_id(root)
        folder.mkdir(parents=True)
        (folder / "project.json").write_text(json.dumps({"v": 1, "root": root}))
        (folder / "lease.json").write_text(json.dumps({"v": 1, **lease}))
        (folder / "notes.json").write_text(json.dumps({"v": 1, "notes": [{"id": i} for i in range(notes)], "dismissed": [], "prints": {}}))
        written = (self.now - notes_age_ms) / 1000
        os.utime(folder / "notes.json", (written, written))

    def test_a_session_that_says_what_is_so_has_nothing_against_it(self):
        s = session(state=state(self.now))
        found = jack.check_session(world([s], now=self.now), s, DOCKED)
        self.assertEqual(bad(found), [])
        self.assertTrue(any("is on its screen as it says" in text for _, text in found))

    def test_a_pane_it_says_it_shows_and_the_screen_does_not_have(self):
        s = session(state=state(self.now))
        agents = ["Your conversation moved to the background — enter opens it", "Needs input", " ✻ current session"]
        found = bad(jack.check_session(world([s], now=self.now), s, agents))
        self.assertEqual(len(found), 1)
        self.assertIn("not on its screen", found[0])
        self.assertIn("“1: Play (1)”", found[0])

    def test_a_pane_drawn_docked_in_a_terminal_made_too_narrow_for_a_dock_is_a_move_and_not_a_fault(self):
        # The owner resized the terminal (2026-10-05): the drawing on record is from the side, the screen is already
        # the agents view or the pane above the prompt, and the next drawing is the one to check.
        narrow = session(state=state(self.now), eyes={"kind": "tmux", "name": "0", "sock": "/x", "pane": "%0", "cols": 89, "rows": 30})
        found = jack.check_session(world([narrow], now=self.now), narrow, ["❯ ", "  ⏵⏵ bypass permissions on"])
        self.assertEqual(bad(found), [])
        self.assertTrue(any(level == jack.NOTE and "moving above the prompt" in text for level, text in found))
        # Wide enough for a dock and the pane still missing: a fault, as before.
        wide = session(state=state(self.now), eyes={"kind": "tmux", "name": "0", "sock": "/x", "pane": "%0", "cols": 170, "rows": 40})
        self.assertTrue(any("not on its screen" in text for text in bad(jack.check_session(world([wide], now=self.now), wide, ["❯ "]))))

    def test_a_pane_scrolled_down_to_read_is_their_view_and_not_a_fault(self):
        # The owner (2026-10-05) scrolled a long deep review in a 30-row terminal: the tabs went above the frame.
        s = session(state=state(self.now))
        scrolled = [row for row in DOCKED if "1: Play" not in row and "On. Watching" not in row]
        found = jack.check_session(world([s], now=self.now), s, scrolled)
        self.assertEqual(bad(found), [])
        self.assertTrue(any(level == jack.NOTE and "is scrolled" in text for level, text in found), found)

    def test_watchers_missing_right_after_a_reload_are_being_started_again(self):
        # The procs table has no inotifywait under this fake pid, and the state says two are live.
        live = {"pushers": [{"role": "tree", "isLive": True}, {"role": "focus", "isLive": True}]}
        just = session(pid=4242, state=state(self.now, loaded={"at": self.now - 1000, "options": {}}, **live))
        found = jack.check_session(world([just], now=self.now), just, DOCKED)
        self.assertEqual(bad(found), [])
        self.assertTrue(any(level == jack.NOTE and "being started again" in text for level, text in found), found)
        settled = session(pid=4242, state=state(self.now, loaded={"at": self.now - 60_000, "options": {}}, **live))
        self.assertTrue(any("inotifywait run under it" in text for text in bad(jack.check_session(world([settled], now=self.now), settled, DOCKED))))

    def test_a_session_that_ended_is_read_as_a_record_and_not_as_stuck(self):
        # `truth <id>` on a session that said goodbye (the owner closed it, 2026-10-05) read its last state as timers that do not run.
        gone = session(kind="gone", state=state(self.now, at=self.now - 900_000), entry={"session": "aaaaaaaa-1111-4000-8000-000000000001", "mode": "on", "at": self.now - 960_000, "leftAt": self.now - 900_000})
        found = jack.check_session(world([gone], now=self.now), gone, None)
        self.assertEqual(bad(found), [])
        self.assertTrue(any(level == jack.NOTE and "is not running" in text for level, text in found), found)

    def test_a_screen_that_cannot_be_seen_is_said_and_not_counted(self):
        s = session(state=state(self.now))
        found = jack.check_session(world([s], now=self.now), s, None)
        self.assertEqual(bad(found), [])
        self.assertTrue(any(level == jack.NOTE and "cannot be seen" in text for level, text in found))

    def test_a_session_on_and_drawing_nowhere(self):
        told = state(self.now)
        told["session"]["surfaces"] = []
        s = session(state=told)
        self.assertTrue(any("draws nowhere" in text for text in bad(jack.check_session(world([s], now=self.now), s, None))))

    def test_a_session_whose_timers_stopped(self):
        s = session(state=state(self.now, at=self.now - jack.STATE_STALE_MS - 1000))
        found = bad(jack.check_session(world([s], now=self.now), s, DOCKED))
        self.assertEqual(len(found), 1)
        self.assertIn("its timers do not run", found[0])

    def test_a_pane_that_is_open_and_not_drawn(self):
        told = state(self.now)
        told["shown"]["opened"] = {"at": self.now, "isPlaced": False, "reason": "100 columns, and an unasked pane needs 144"}
        told["shown"]["pane"] = None
        s = session(state=told)
        found = bad(jack.check_session(world([s], now=self.now), s, ["❯ "]))
        self.assertTrue(any("open and not drawn: 100 columns" in text for text in found))

    def test_a_deadline_that_came_and_went(self):
        s = session(state=state(self.now, deadlines={"scan": self.now - 60_000, "lease": self.now + 5000}))
        found = bad(jack.check_session(world([s], now=self.now), s, DOCKED))
        self.assertEqual(len(found), 1)
        self.assertIn("`scan`", found[0])

    def test_the_mode_held_twice_and_differing(self):
        told = state(self.now)
        told["pane"]["mode"] = "off"
        s = session(state=told)
        self.assertTrue(any("holds the mode twice" in text for text in bad(jack.check_session(world([s], now=self.now), s, DOCKED))))

    def test_a_driver_the_lease_does_not_name_and_one_that_stopped_renewing(self):
        root = "/tmp/ride"
        self.project(root, {"session": "someone-else", "at": self.now - 1000})
        s = session(home=self.home, state=state(self.now, repoRoot=root))
        found = bad(jack.check_session(world([s], [self.home], self.now), s, DOCKED))
        self.assertTrue(any("says it drives" in text and "the lease names someonee" in text for text in found), found)

        other = pathlib.Path(tempfile.mkdtemp())
        try:
            self.home = other
            self.project(root, {"session": s["id"], "at": self.now - jack.LEASE_TTL_MS - 5000})
            s = session(home=other, state=state(self.now, repoRoot=root))
            found = bad(jack.check_session(world([s], [other], self.now), s, DOCKED))
            self.assertTrue(any("last renewed its lease" in text for text in found), found)
        finally:
            shutil.rmtree(other)

    def test_notes_in_the_pane_that_the_project_folder_does_not_keep(self):
        root = "/tmp/ride"
        self.project(root, {"session": "aaaaaaaa-1111-4000-8000-000000000001", "at": self.now - 1000}, notes=0, notes_age_ms=60_000)
        told = state(self.now, repoRoot=root)
        told["pane"]["notes"] = [{"id": 1}, {"id": 2}]
        s = session(home=self.home, state=told)
        found = bad(jack.check_session(world([s], [self.home], self.now), s, DOCKED))
        self.assertEqual(len(found), 1, found)
        self.assertIn("2 open note(s) in its pane, and notes.json", found[0])
        self.assertIn("lacks 2 of them", found[0])
        # More kept than shown is a note about text changed since: kept, and never shown again.
        told["pane"]["notes"] = []
        self.assertEqual(bad(jack.check_session(world([s], [self.home], self.now), s, DOCKED)), [])

    def test_an_editor_light_that_does_not_match_the_editors_files(self):
        root = "/tmp/ride"
        self.project(root, {"session": "aaaaaaaa-1111-4000-8000-000000000001", "at": self.now - 1000})
        (self.home / "editors").mkdir()
        (self.home / "editors" / "emacs-1.json").write_text(json.dumps({"v": 1, "editor": "emacs", "pid": 1, "at": self.now - 5000, "file": f"{root}/stats.py", "line": 2}))
        told = state(self.now, repoRoot=root)
        told["pane"]["watch"] = {"editors": ""}
        s = session(home=self.home, state=told)
        found = bad(jack.check_session(world([s], [self.home], self.now), s, DOCKED))
        self.assertTrue(any("shows a red light" in text and "emacs" in text for text in found), found)

        told["pane"]["watch"] = {"editors": "Emacs is connected."}
        self.assertEqual(bad(jack.check_session(world([s], [self.home], self.now), s, DOCKED)), [])
        # A minute without a word, and it is not connected: a green light is then a lie.
        late = world([s], [self.home], self.now + jack.EDITOR_TTL_MS)
        told["at"] = late["now"] - 1000
        (self.home / "projects" / jack.project_id(root) / "lease.json").write_text(json.dumps({"v": 1, "session": s["id"], "at": late["now"] - 1000}))
        self.assertTrue(any("shows a green light" in text for text in bad(jack.check_session(late, s, DOCKED))))

    def test_a_lease_held_by_a_session_that_is_not_running(self):
        # The owner's afternoon of 2026-10-05: the process a conversation had left went on holding the lease.
        self.project("/tmp/ride", {"session": "ba556cdf-cb41-461e-973b-5db27b210b5a", "at": self.now - 4000})
        found = bad(jack.check_homes(world([session()], [self.home], self.now)))
        self.assertEqual(len(found), 1)
        self.assertIn("held by ba556cdf", found[0])
        self.assertIn("no such session is running", found[0])
        # Run out, it is nobody's, and nothing is wrong.
        self.assertEqual(bad(jack.check_homes(world([session()], [self.home], self.now + jack.LEASE_TTL_MS))), [])

    def test_a_lease_held_by_a_session_that_draws_nowhere(self):
        told = state(self.now)
        told["session"]["surfaces"] = []
        s = session(state=told)
        self.project("/tmp/ride", {"session": s["id"], "at": self.now - 4000})
        found = bad(jack.check_homes(world([s], [self.home], self.now)))
        self.assertTrue(any("which draws nowhere" in text for text in found), found)

    def test_a_session_that_said_it_was_on_and_is_gone_without_a_goodbye(self):
        entry = {"session": "dead0000-0000-4000-8000-000000000000", "born": 1, "cwd": "/tmp/ride", "mode": "on", "at": self.now - 30_000, "leftAt": 0}
        (self.home / "sessions.json").write_text(json.dumps({"v": 1, "sessions": [entry, {**entry, "session": "left0000", "leftAt": self.now - 1000}]}))
        found = bad(jack.check_homes(world([session()], [self.home], self.now)))
        self.assertEqual(len(found), 1)
        self.assertIn("dead0000", found[0])
        self.assertIn("no goodbye", found[0])

    def test_what_the_tutor_says_its_mode_is(self):
        self.assertEqual(jack.tutor_mode(session()), "off")
        self.assertEqual(jack.tutor_mode(session(entry={"mode": "paused", "leftAt": 0})), "paused")
        self.assertEqual(jack.tutor_mode(session(entry={"mode": "on", "leftAt": 5})), "off")
        self.assertEqual(jack.tutor_mode(session(state={"mode": "on"}, entry=None)), "on")

    def test_a_pane_on_the_screen_of_a_session_that_says_nothing(self):
        # A copy that could say it is on, and says nothing: a fault.
        quiet = session()
        found = jack.check_session(world([quiet], now=self.now), quiet, DOCKED)
        self.assertEqual(len(bad(found)), 1)
        self.assertIn("nothing says the tutor is on in it", bad(found)[0])
        # A copy from before the tutor could say: the pane is on screen, and that is all jack can know of it.
        old = session(copy={"folder": "/x/0.1.0", "version": "0.1.0", "commit": "46ce6bb", "can_say": False})
        found = jack.check_session(world([old], now=self.now), old, DOCKED)
        self.assertEqual(bad(found), [])
        notes = [text for level, text in found if level == jack.NOTE]
        self.assertEqual(len(notes), 1)
        self.assertIn("installed 0.1.0 (46ce6bb)", notes[0])
        self.assertIn("/reload-plugins", notes[0])
        # No pane on the screen: nothing to say either way.
        self.assertEqual(jack.check_session(world([old], now=self.now), old, ["❯ "]), [])

    def test_the_session_to_look_at_is_the_one_with_the_tutor_on(self):
        me = session(id="me000000-0", short="me000000", is_me=True, state={"mode": "on"})
        off = session(id="off00000-0", short="off00000")
        on = session(id="on000000-0", short="on000000", entry={"mode": "on", "leftAt": 0}, eyes={"kind": "tmux", "name": "bsd", "cols": 1, "rows": 1})
        w = world([me, off, on])
        self.assertIs(jack.pick(w, None), on)
        self.assertIs(jack.pick(w, "off"), off)
        self.assertIs(jack.pick(w, "bsd"), on)
        self.assertIsNone(jack.pick(w, "nobody"))


class ToldAndBelieved(unittest.TestCase):
    """What the tutor told the person outside its pane, and what it believes about the world, against both."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = pathlib.Path(self.tmp.name)
        self.now = jack.now_ms()

    def tearDown(self):
        self.tmp.cleanup()

    def told(self, *said, **over) -> dict:
        return session(state=state(self.now, said=list(said), **over))

    def test_an_answer_to_bsd_on_the_screen_and_one_that_is_not(self):
        answer = {"at": self.now - 3000, "how": "command", "text": "Backseat Driver is on."}
        s = self.told(answer)
        found = jack.check_said(world([s], now=self.now), s, DOCKED)
        self.assertEqual(bad(found), [])
        self.assertTrue(any("command “Backseat Driver is on.” is on its screen" in text for _, text in found))
        missing = {"at": self.now - 3000, "how": "transcript", "text": "Nothing was forgotten."}
        s = self.told(missing)
        found = bad(jack.check_said(world([s], now=self.now), s, DOCKED))
        self.assertEqual(len(found), 1)
        self.assertIn("“Nothing was forgotten.”", found[0])

    def test_what_was_said_too_long_ago_or_a_moment_ago_is_not_looked_for(self):
        s = self.told(
            {"at": self.now - jack.SAID_RECENT_MS - 1000, "how": "transcript", "text": "Scrolled away long since."},
            {"at": self.now - 200, "how": "command", "text": "Not drawn yet."},
            {"at": self.now - jack.TOAST_MS - 500, "how": "toast", "text": "A toast that is gone."},
        )
        self.assertEqual(jack.check_said(world([s], now=self.now), s, DOCKED), [])

    def test_a_question_a_dialog_is_said_to_ask(self):
        s = self.told(asking={"at": self.now - 5000, "question": "How are you using Backseat Driver?"})
        found = bad(jack.check_said(world([s], now=self.now), s, DOCKED))
        self.assertEqual(len(found), 1)
        self.assertIn("no such question is on its screen", found[0])
        shown = DOCKED + ["│ How are you using Backseat Driver?"]
        self.assertEqual(bad(jack.check_said(world([s], now=self.now), s, shown)), [])

    def test_the_hint_line_in_the_unified_layout(self):
        told = state(self.now, said=[])
        told["session"]["layout"] = "unified"
        told["shown"]["hint"] = "backseat watching · ctrl+x tab for keys"
        s = session(state=told)
        self.assertEqual(len(bad(jack.check_said(world([s], now=self.now), s, DOCKED))), 1)
        hinted = DOCKED + ["  ? for shortcuts · backseat watching · ctrl+x tab for keys"]
        self.assertEqual(bad(jack.check_said(world([s], now=self.now), s, hinted)), [])

    def test_a_pane_the_person_closed_is_their_choice_and_not_a_fault(self):
        told = state(self.now)
        told["session"]["panes"] = []
        s = session(state=told)
        self.assertTrue(any("lists no pane of its own" in text for text in bad(jack.check_session(world([s], now=self.now), s, None))))
        told["shown"]["closed"] = {"at": self.now - 4000, "origin": "person"}
        found = jack.check_session(world([s], now=self.now), s, None)
        self.assertEqual(bad(found), [])
        self.assertTrue(any(level == jack.NOTE and "closed by the person" in text for level, text in found))

    def test_a_session_that_runs_code_older_than_the_working_copy(self):
        plugin = self.dir / "plugin"
        (plugin / "hooks").mkdir(parents=True)
        (plugin / "tests").mkdir()
        saved = self.now - jack.RELOAD_GRACE_MS - 10_000
        (plugin / "hooks" / "register.tsx").write_text("x")
        os.utime(plugin / "hooks" / "register.tsx", (saved / 1000, saved / 1000))
        # A test saved later is not code the session runs.
        (plugin / "tests" / "a.test.ts").write_text("x")
        s = session(plugin=str(plugin), state=state(self.now, loaded={"at": saved - 60_000, "options": {}}))
        found = bad(jack.check_world(world([s], now=self.now), s))
        self.assertEqual(len(found), 1, found)
        self.assertIn("runs code older than the working copy", found[0])
        self.assertIn("hooks/register.tsx", found[0])
        s["state"]["loaded"]["at"] = saved + 100
        self.assertEqual(bad(jack.check_world(world([s], now=self.now), s)), [])

    def test_settings_that_were_saved_and_never_loaded(self):
        config = self.dir / "config"
        config.mkdir()
        (config / "settings.json").write_text(json.dumps({"pluginConfigs": {
            "backseat-driver@inline": {"options": {"quiet_time": "5 seconds", "animated_persona": False}},
            "backseat-driver@backseat-driver": {"options": {"quiet_time": "60 seconds"}},
        }}))
        working = str(REPO / "plugin")
        options = {"quiet_time": "10 seconds", "animated_persona": False, "layout": "vertical"}
        s = session(plugin=working, config=str(config), argv=[], state=state(self.now, loaded={"at": self.now, "options": options}))
        found = bad(jack.check_world(world([s], now=self.now), s))
        self.assertTrue(any("quiet_time: 5 seconds in the settings, 10 seconds in force" in text for text in found), found)
        # A --settings flag comes last and wins.
        s["argv"] = ["claude", "--settings", json.dumps({"pluginConfigs": {"backseat-driver@inline": {"options": {"quiet_time": "10 seconds"}}}})]
        self.assertFalse(any("settings that are not the ones saved" in text for text in bad(jack.check_world(world([s], now=self.now), s))))
        # An installed copy reads its own entry, not the working copy's.
        s = session(plugin="installed", config=str(config), argv=[], state=state(self.now, loaded={"at": self.now, "options": {"quiet_time": "60 seconds"}}))
        self.assertEqual(bad(jack.check_world(world([s], now=self.now), s)), [])

    def git(self, *args: str) -> str:
        return subprocess.run(["git", "-C", str(self.dir / "ride"), *args], capture_output=True, text=True, check=True).stdout.strip()

    def ride(self) -> str:
        root = self.dir / "ride"
        root.mkdir()
        self.git("init", "-q")
        self.git("config", "user.email", "me@example.com")
        self.git("config", "user.name", "Me")
        (root / "stats.py").write_text("x = 1\n")
        self.git("add", ".")
        self.git("commit", "-qm", "one")
        return str(root)

    def back(self, path: pathlib.Path, ms: int) -> None:
        at = (self.now - ms) / 1000
        os.utime(path, (at, at))

    @unittest.skipUnless(shutil.which("git"), "git is not installed")
    def test_a_commit_and_a_save_the_tutor_did_not_see(self):
        root = self.ride()
        first = self.git("rev-parse", "HEAD")
        (pathlib.Path(root) / "stats.py").write_text("x = 2\n")
        self.git("commit", "-qam", "two")
        self.back(pathlib.Path(root) / ".git" / "logs" / "HEAD", 20_000)
        (pathlib.Path(root) / "median.py").write_text("y\n")
        (pathlib.Path(root) / "package-lock.json").write_text("{}\n")
        for name in ("median.py", "package-lock.json"):
            self.back(pathlib.Path(root) / name, 20_000)
        believed = {"repoRoot": root, "scan": {"lastScanAt": self.now - 2000}, "review": {"lastHead": first, "waiting": {"commits": []}},
                    "watcher": {"dirty": [], "noise": ["package-lock.json"]}, "loaded": {"at": self.now, "options": {}}}
        s = session(state=state(self.now, **believed))
        found = bad(jack.check_world(world([s], now=self.now), s))
        self.assertTrue(any(f"believes HEAD is {first[:7]}" in text and "missed a commit" in text for text in found), found)
        self.assertTrue(any("has not seen 1 changed file(s)" in text and "median.py" in text for text in found), found)
        # What it has seen, it has seen; and a save after its last scan is not yet its to have seen.
        s["state"]["review"]["lastHead"] = self.git("rev-parse", "HEAD")
        s["state"]["watcher"]["dirty"] = ["median.py"]
        (pathlib.Path(root) / "later.py").write_text("z\n")
        self.assertEqual(bad(jack.check_world(world([s], now=self.now), s)), [])

    @unittest.skipUnless(shutil.which("git"), "git is not installed")
    def test_a_file_it_believes_changed_that_git_calls_clean(self):
        root = self.ride()
        self.back(pathlib.Path(root) / "stats.py", 20_000)
        self.back(pathlib.Path(root) / ".git" / "logs" / "HEAD", 20_000)
        believed = {"repoRoot": root, "scan": {"lastScanAt": self.now - 2000}, "review": {"lastHead": self.git("rev-parse", "HEAD")},
                    "watcher": {"dirty": ["stats.py"], "noise": []}, "loaded": {"at": self.now, "options": {}}}
        s = session(state=state(self.now, **believed))
        found = bad(jack.check_world(world([s], now=self.now), s))
        self.assertEqual(len(found), 1, found)
        self.assertIn("git calls clean: stats.py", found[0])

    def test_commits_waiting_in_memory_and_on_disk(self):
        home = self.dir / "home"
        root = "/tmp/ride-queue"
        folder = home / "projects" / jack.project_id(root)
        folder.mkdir(parents=True)
        (folder / "project.json").write_text(json.dumps({"v": 1, "root": root}))
        (folder / "queue.json").write_text(json.dumps({"v": 1, "commits": [{"hash": "a" * 40}]}))
        self.back(folder / "queue.json", 30_000)
        believed = {"repoRoot": root, "scan": {"lastScanAt": self.now - 1000}, "review": {"waiting": {"commits": []}}, "loaded": {"at": self.now, "options": {}}}
        s = session(home=home, state=state(self.now, **believed))
        found = bad(jack.check_world(world([s], [home], self.now), s))
        self.assertTrue(any("0 commit(s) waiting for a review in memory, and queue.json keeps 1" in text for text in found), found)

    def test_an_editor_caret_the_tutor_did_not_follow(self):
        home = self.dir / "home"
        (home / "editors").mkdir(parents=True)
        root = "/tmp/ride-editor"
        caret = {"v": 1, "editor": "neovim", "pid": 1, "at": self.now - 1000, "changed": self.now - 8000, "root": root, "file": f"{root}/stats.py", "line": 9}
        (home / "editors" / "neovim-1.json").write_text(json.dumps(caret))
        believed = {"repoRoot": root, "scan": {"lastScanAt": self.now - 1000}, "loaded": {"at": self.now, "options": {}},
                    "explain": {"isOn": True, "editorFocusAt": self.now - 60_000, "focus": {"path": "stats.py", "line": 2}}}
        s = session(home=home, state=state(self.now, **believed))
        found = bad(jack.check_world(world([s], [home], self.now), s))
        self.assertTrue(any("neovim moved to" in text and "stats.py:9" in text for text in found), found)
        s["state"]["explain"]["editorFocusAt"] = self.now - 7900
        self.assertEqual(bad(jack.check_world(world([s], [home], self.now), s)), [])
        # A caret that moved after the state was written (every ten seconds when nothing is logged) is not yet news
        # the tutor could have: seen as a false `!!` on 2026-10-05, 5 s after a move, with the state 9 s old.
        s["state"]["explain"]["editorFocusAt"] = self.now - 60_000
        s["state"]["at"] = self.now - 9000
        self.assertEqual(bad(jack.check_world(world([s], [home], self.now), s)), [])


class Finding(unittest.TestCase):
    def test_sessions_are_looked_for_under_every_config_folder_in_use(self):
        procs = {1: {"pid": 1, "ppid": 0, "argv": ["claude", "--plugin-dir", "x"], "state": "S"}, 2: {"pid": 2, "ppid": 0, "argv": ["bash"], "state": "S"}}
        envs = {1: {"CLAUDE_CONFIG_DIR": "/tmp/dev-config", "HOME": "/home/me"}, 2: {"CLAUDE_CONFIG_DIR": "/elsewhere"}}
        real = jack.environ
        try:
            jack.environ = lambda pid: envs.get(pid, {})
            found = jack.config_dirs(procs)
        finally:
            jack.environ = real
        self.assertEqual(found[0], jack.default_config())
        self.assertIn("/tmp/dev-config", found)
        self.assertNotIn("/elsewhere", found)

    def test_a_data_folder_given_with_no_command_reads_as_the_status(self):
        seen = []
        real = jack.cmd_status
        try:
            jack.cmd_status = lambda args: seen.append(args.home) or 0
            self.assertEqual(jack.main(["--home", "/tmp/scratch-home"]), 0)
            self.assertEqual(jack.main([]), 0)
        finally:
            jack.cmd_status = real
        self.assertEqual(seen, ["/tmp/scratch-home", None])


if __name__ == "__main__":
    unittest.main(verbosity=1)
