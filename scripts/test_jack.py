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
from unittest import mock

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
❯ /backseat                                              │
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
        "at": now - 2000, "mode": "on", "repoRoot": "", "deadlines": {"self": now + 8000}, "pushers": [], "lease": {"isDriver": True, "holder": "x"},
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
        self.assertEqual(jack.LEASE_BEAT_MS, self.number("kernel/src/Kernel/Lease.purs", "beatMs"))
        self.assertEqual(jack.PLACE_OBSERVATIONS, self.number("plugin/core/progress.ts", "PLACE_OBSERVATIONS"))
        self.assertEqual(jack.PLACE_COMMITS, self.number("plugin/core/progress.ts", "PLACE_COMMITS"))
        self.assertEqual(jack.PLACE_LINES, self.number("plugin/core/progress.ts", "PLACE_LINES"))
        self.assertEqual(jack.SHARED_CHECK_MS, self.number("plugin/hooks/register.tsx", "SHARED_CHECK_MS"))
        self.assertEqual(jack.PUSHED_SCAN_MS, self.number("kernel/src/Kernel/Sensor.purs", "pushedScanMs"))
        pane = (REPO / "plugin" / "hooks" / "pane.tsx").read_text()
        for mark in jack.SPINNER:
            self.assertIn(f"'{mark}'", pane.split("export const SPINNER")[1].split("\n")[0], mark)
        # The hellos are read out of the source: every voice has one, and they differ.
        hellos = jack.hellos_by_voice()
        self.assertEqual(sorted(hellos), ["default", "eli5-tldr-kiss-terse", "knuth", "primeagen", "torvalds"])
        self.assertEqual(hellos["default"], "Riding along. You drive.")
        self.assertEqual(len(set(hellos.values())), 5)
        self.assertIn(f"export const SURVEY_SUBJECT = '{jack.SURVEY_SUBJECT}'", (REPO / "plugin" / "core" / "review.ts").read_text())

    def test_the_source_fingerprint_is_the_mods(self):
        # Values from plugin/core/hash.ts and `splitSource` run under Node (2026-10-06): the lines however they end, no trailing empty one.
        self.assertEqual(jack.source_print("def mean(xs):\n    return sum(xs) / len(xs)\n"), "037b904e52b53bfa")
        self.assertEqual(jack.source_print("x = 1\r\ny = 2"), "5dcf4837b4d4501e")
        self.assertEqual(jack.source_print("héllo ✻ world\n\n"), "a26626c0372b340b")
        self.assertEqual(jack.source_print(""), "811c9dc5ebb6c228")
        self.assertEqual(jack.source_print("one\n"), "ba2719ef90963ae1")
        self.assertEqual(jack.fnv("x = 1\r\ny = 2"), "13a03882")

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
        # An audit runs in the deep review's place: a reload would cut it short too, and it is named.
        self.assertEqual(jack.is_busy({"pane": {"watch": {"state": "watching"}, "review": {"state": "running", "subject": jack.AUDIT_SUBJECT}}}), "an audit is running")


class Screen(unittest.TestCase):
    def test_a_docked_pane_is_told_from_the_conversation_beside_it(self):
        self.assertEqual(jack.divider(DOCKED), 52)
        self.assertIsNone(jack.divider(["❯ hello", "  a │ b", "plain"]))
        parts = jack.sides(DOCKED)
        self.assertEqual(sorted(parts), ["conversation", "pane"])
        self.assertIn("On. Watching for your next save.", parts["pane"])
        self.assertIn("❯ /backseat", parts["conversation"])
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

    def test_a_tab_cut_off_its_row_is_not_a_scrolled_pane(self):
        # The owner's 157-column terminal, 2026-10-06: Claude Code docked the pane at 46 columns and "6: Set" was cut off.
        told = state(self.now)
        told["shown"]["pane"]["texts"] = ["1: Play", "2: Review", "3: Expl", "4: Growth", "5: Lessons", "6: Set", *TEXTS[4:]]
        told["shown"]["pane"]["columns"] = 46
        s = session(state=told)
        cut = [row.replace("1: Play (1)  2: Review  3: Explain  4: Progress", "1: Play 2: Review 3: Expl 4: Growth 5: Lessons") for row in DOCKED]
        found = bad(jack.check_session(world([s], now=self.now), s, cut))
        self.assertEqual(len(found), 1, found)
        self.assertIn("“6: Set”", found[0])
        self.assertIn("the row is cut, not scrolled", found[0])

    def test_a_keys_row_cut_short_of_its_hint(self):
        # The first ui-truth pass, 2026-10-06: a 46-column dock cut the hint to "Click here or press Ctr…".
        told = state(self.now)
        told["shown"]["pane"]["texts"] = [*TEXTS, "x: minimize", "Keys off", "Click here or press Ctrl+X Tab to use the keys."]
        s = session(state=told)
        cut = [*DOCKED[:-1], "❯                                                   │x: minimize  Keys off Click here or press Ctr…"]
        found = bad(jack.check_session(world([s], now=self.now), s, cut))
        self.assertEqual(len(found), 1, found)
        self.assertIn("keys row is cut", found[0])
        # Wrapped onto a line of its own, it is whole.
        whole = [*DOCKED[:-1], "❯                                                   │x: minimize  Keys off", "                                                    │Click here or press Ctrl+X Tab to use the keys."]
        found = jack.check_session(world([s], now=self.now), s, whole)
        self.assertEqual(bad(found), [])
        self.assertTrue(any("keys row is whole" in text for _, text in found), found)

    def test_a_session_that_does_not_drive_has_no_watching_light_and_offers_no_look(self):
        root = "/tmp/ride"
        self.project(root, {"session": "someone-else", "at": self.now - 1000})
        told = state(self.now, repoRoot=root, lease={"isDriver": False, "holder": ""})
        told["pane"]["watch"] = {"state": "idle", "line": "On. Another session is driving this project. This one is for the conversation."}
        told["shown"]["pane"]["texts"] = [*TEXTS, "look now"]
        s = session(home=self.home, state=told)
        found = bad(jack.check_session(world([s], [self.home], self.now), s, DOCKED))
        self.assertTrue(any("its light says “idle”, not following" in text for text in found), found)
        self.assertTrue(any("still offers look now" in text for text in found), found)
        told["pane"]["watch"]["state"] = "following"
        told["shown"]["pane"]["texts"] = TEXTS
        self.assertEqual([f for f in bad(jack.check_session(world([s], [self.home], self.now), s, DOCKED)) if "following" in f or "offers" in f], [])

    def test_a_hello_left_over_from_another_voice(self):
        told = state(self.now, loaded={"at": self.now - 60_000, "options": {"voice": "default"}})
        told["pane"]["speech"] = {"text": "Ready. Save something.", "tick": 9, "isBlinking": False}
        s = session(state=told)
        found = bad(jack.check_session(world([s], now=self.now), s, DOCKED))
        self.assertEqual(len(found), 1, found)
        self.assertIn("the torvalds voice's hello, under the default voice", found[0])
        told["loaded"]["options"]["voice"] = "torvalds"
        self.assertEqual(bad(jack.check_session(world([s], now=self.now), s, DOCKED)), [])
        told["pane"]["speech"]["text"] = "Review's in. Nice and small."
        self.assertEqual(bad(jack.check_session(world([s], now=self.now), s, DOCKED)), [])
        # A spinner caught a tick apart is the same badge, bare after the name.
        self.assertTrue(jack.is_on_screen("2: Review ✻", ["1: Play  2: Review ✶  3: Explain"]))
        self.assertTrue(jack.is_on_screen("3: Explain ✽", ["3: Explain ·"]))
        self.assertFalse(jack.is_on_screen("2: Review (new)", ["1: Play  2: Review ✶  3: Explain"]))

    def test_a_pane_squeezed_in_the_middle_and_one_cut_at_the_bottom(self):
        # The owner's pane, 2026-10-06 18:05: laid out into sixteen rows, the editors' light gone from its middle while rows below it showed.
        told = state(self.now)
        told["shown"]["pane"]["texts"] = [*TEXTS, "x: minimize", "Keys off", "Click here or press Ctrl+X Tab to use the keys."]
        squeezed = [row for row in DOCKED if "No editor is connected." not in row]
        s = session(state=told)
        found = bad(jack.check_session(world([s], now=self.now), s, squeezed))
        self.assertEqual(len(found), 1, found)
        self.assertIn("is squeezed: 1 piece(s) missing from its middle", found[0])
        self.assertIn("“No editor is connected.”", found[0])
        self.assertEqual(jack.squeezed_pieces(TEXTS, squeezed), ["No editor is connected."])
        # Cut at the bottom, the keys row among what is below the frame: a note, not a disagreement.
        found = jack.check_session(world([s], now=self.now), s, DOCKED)
        self.assertEqual(bad(found), [])
        self.assertTrue(any(level == jack.NOTE and "cut at the bottom" in text and "the keys row among them" in text for level, text in found), found)
        # The controls and the keys row at the top of every tab (2026-10-06): a short frame cuts the contents, and the note says only that.
        told["shown"]["pane"]["texts"] = [*TEXTS[:9], "e: explain", "l: look now", "x: minimize", "Keys off", "Click here or press Ctrl+X Tab to use the keys.", "stats.py", "✘ bug · line 6", "For even-length lists, median should average the two middle values, not take the upper one."]
        top = session(state=told)
        found = jack.check_session(world([top], now=self.now), top, told["shown"]["pane"]["texts"][:14])
        self.assertEqual(bad(found), [])
        notes = [text for level, text in found if level == jack.NOTE and "cut at the bottom" in text]
        self.assertEqual(len(notes), 1, found)
        self.assertIn("3 piece(s) are below the frame (a pane taller", notes[0])
        self.assertTrue(any("keys row is whole" in text for _, text in found), found)

    def test_a_session_on_without_its_look_at_itself(self):
        told = state(self.now, deadlines={"lease": self.now + 5000, "scan": self.now + 1000}, loaded={"at": self.now - 60_000, "options": {}})
        s = session(state=told)
        found = bad(jack.check_session(world([s], now=self.now), s, DOCKED))
        self.assertEqual(len(found), 1, found)
        self.assertIn("no `self` deadline", found[0])
        # Armed: nothing. Just loaded: not yet asked.
        told["deadlines"]["self"] = self.now + 8000
        self.assertEqual(bad(jack.check_session(world([s], now=self.now), s, DOCKED)), [])
        del told["deadlines"]["self"]
        told["loaded"]["at"] = self.now - 4000
        self.assertEqual(bad(jack.check_session(world([s], now=self.now), s, DOCKED)), [])

    def test_a_pane_standing_scrolled_past_its_top_since_a_tab_was_opened(self):
        debug = pathlib.Path(self.tmp.name) / "debug" / "20261006-000000-aaaaaaaa"
        debug.mkdir(parents=True)
        pressed = self.now - 12_000
        tab = {"t": pressed, "seq": 1, "s": "a", "p": "", "k": "ui", "n": "tab", "d": "play"}
        debug.joinpath("000000.jsonl").write_text(json.dumps(tab) + "\n")
        told = state(self.now)
        told["shown"]["pane"]["scroll"] = {"offset": 20, "bodyRows": 30}
        told["shown"]["pane"]["at"] = pressed + 500
        s = session(state=told, debug=debug)
        found = bad(jack.check_session(world([s], now=self.now), s, DOCKED))
        self.assertEqual(len(found), 1, found)
        self.assertIn("stands scrolled 20 row(s) past its top since the play tab was opened", found[0])
        # The person scrolled it after opening the tab: their view.
        scrolled = {"t": pressed + 3000, "seq": 2, "s": "a", "p": "", "k": "ui", "n": "scroll", "d": {"offset": 20, "by": 20, "origin": "person"}}
        debug.joinpath("000000.jsonl").write_text(json.dumps(tab) + "\n" + json.dumps(scrolled) + "\n")
        self.assertEqual(bad(jack.check_session(world([s], now=self.now), s, DOCKED)), [])
        # The tutor's own scroll to the top is not the person's.
        own = {**scrolled, "d": {"offset": 0, "by": -20, "origin": "plugin"}}
        debug.joinpath("000000.jsonl").write_text(json.dumps(tab) + "\n" + json.dumps(own) + "\n")
        self.assertEqual(len(bad(jack.check_session(world([s], now=self.now), s, DOCKED))), 1)
        # At the top: nothing to say.
        told["shown"]["pane"]["scroll"]["offset"] = 0
        self.assertEqual(bad(jack.check_session(world([s], now=self.now), s, DOCKED)), [])

    def test_before_any_look_the_tutor_never_says_nothing_changed_or_no_notes(self):
        told = state(self.now, look={"lastLookAt": None})
        told["pane"]["tab"] = "play"
        told["pane"]["watch"] = {"state": "idle", "lastLookAt": None, "line": "On. Watching for your next save."}
        told["said"] = [{"at": self.now - 30_000, "how": "toast", "text": "Nothing has changed since the last look."}]
        told["shown"]["pane"]["texts"] = [*TEXTS, "No notes. Keep going."]
        s = session(state=told)
        found = bad(jack.check_session(world([s], now=self.now), s, DOCKED))
        self.assertEqual(len(found), 2, found)
        self.assertIn("no look has ever run: what was changed at switch-on is the baseline", found[0])
        self.assertIn("reads as an all-clear on code nothing has looked at", found[1])
        # After a look, both are what they say.
        told["look"]["lastLookAt"] = self.now - 20_000
        self.assertEqual(bad(jack.check_session(world([s], now=self.now), s, DOCKED)), [])
        # A session that does not drive shows the driver's notes: "No notes" is right there with no look of its own.
        told["look"]["lastLookAt"] = None
        told["said"] = []
        told["pane"]["watch"]["state"] = "following"
        self.assertEqual(bad(jack.check_session(world([s], now=self.now), s, DOCKED)), [])

    def test_a_character_line_cut_mid_sentence(self):
        told = state(self.now)
        told["pane"]["speech"] = {"text": "I've had a look around. HTML is built up in strings and printed at the end. The database login details are typed…", "tick": 30, "isBlinking": False}
        found = bad(jack.check_speech("aaaaaaaa", told))
        self.assertEqual(len(found), 1, found)
        self.assertIn("a line cut mid-sentence", found[0])
        told["pane"]["speech"]["text"] = "I've had a look around. The Deep review tab has the map."
        self.assertEqual(bad(jack.check_speech("aaaaaaaa", told)), [])

    def test_a_narrow_pane_cuts_its_rows_and_a_cut_row_is_the_piece(self):
        # The owner's 23-column dock: "I've had a look around. HTML…" drawn as "_|o_o|_ I've had a loo…" (the eighth ui-truth pass, 2026-10-06).
        self.assertEqual(jack.piece_head(23), 13)
        self.assertEqual(jack.piece_head(64), jack.HEAD_CHARS)
        self.assertEqual(jack.piece_head(None), jack.HEAD_CHARS)
        line = "I've had a look around. HTML is built up in strings and printed at the end."
        self.assertTrue(jack.is_on_screen(line, ["_|o_o|_ I've had a loo…"], jack.piece_head(23)))
        self.assertFalse(jack.is_on_screen(line, ["_|o_o|_ I've had a loo…"]))
        told = state(self.now)
        told["shown"]["pane"]["columns"] = 23
        told["shown"]["pane"]["texts"] = [*TEXTS[:7], "Working on:", "w: say what", "(not clear yet)", "l: look now", "_|o_o|_", line]
        rows = ["1: Play (1)  2: Review", "3: Explain   4: Progress", "On. Watching for your", "●", "No editor is connected.", "Working on:", "w: say what", "(not clear yet)", "l: look now", "_|o_o|_ I've had a loo…"]
        s = session(state=told)
        self.assertEqual(bad(jack.check_session(world([s], now=self.now), s, rows)), [])

    def test_a_squeezed_middle_is_reported_under_a_cut_top(self):
        # At 23 columns the tab row was cut and the "Working on" value went missing under it (the eighth ui-truth pass, 2026-10-06).
        told = state(self.now)
        told["shown"]["pane"]["texts"] = [*TEXTS[:7], "Working on:", "includes/head.php, lines 24 to 35", "w: change", "e: explain", "No notes. Keep going."]
        rows = ["1: Play (1) 2: Review 3:", "4: Growth 5: Lessons 6:", "On. Watching for your next save.", "●", "No editor is connected.", "Working on:   w: change", "e: explain", "No notes. Keep going."]
        s = session(state=told)
        found = bad(jack.check_session(world([s], now=self.now), s, rows))
        self.assertTrue(any("not on its screen" in text for text in found), found)
        self.assertTrue(any("is squeezed as well: 1 piece(s) missing from its middle" in text and "includes/head.php, lines 24 to 35" in text for text in found), found)

    def test_the_growth_tab_under_no_level_never_says_the_next_level(self):
        told = state(self.now)
        told["pane"]["tab"] = "profile"
        told["pane"]["progress"] = {"records": [{"language": "php", "level": None}], "skipped": "", "busy": ""}
        told["shown"]["pane"]["texts"] = [*TEXTS, "Not placed yet", "Next level: To reach junior, show small pieces of PHP that are correct."]
        s = session(state=told)
        found = bad(jack.check_session(world([s], now=self.now), s, DOCKED))
        self.assertEqual(len(found), 1, found)
        self.assertIn("the model's words for a level it was not given", found[0])
        told["pane"]["progress"]["records"][0]["level"] = "junior"
        self.assertEqual(bad(jack.check_session(world([s], now=self.now), s, DOCKED)), [])

    def test_the_progress_files_against_themselves(self):
        home = pathlib.Path(self.tmp.name) / "home2"
        (home / "progress").mkdir(parents=True)
        placed = [{"from": None, "to": "beginner", "at": 1000}]
        write = lambda **record: (home / "progress" / "shell.json").write_text(json.dumps({"v": 1, "language": "shell", "history": placed, **record}))
        # Never placed, with the model's words for the level it proposed: the Growth tab would say "Not placed yet" over them.
        (home / "progress" / "php.json").write_text(json.dumps({"v": 1, "language": "php", "level": None, "history": [], "report": {"why": "", "next": "To reach junior, show more.", "at": 3000}, "withdrawnAt": 0}))
        words = [text for level, text in jack.check_progress_files(home) if level == jack.NOTE and "php.json" in text]
        self.assertEqual(len(words), 1, words)
        self.assertIn("keeps the model's words for the level it proposed", words[0])
        self.assertIn("a session with php in play mends the file", words[0])
        self.assertEqual([text for level, text in jack.check_progress_files(home) if level == jack.BAD and "php.json" in text], [])
        (home / "progress" / "php.json").write_text(json.dumps({"v": 1, "language": "php", "level": None, "history": [], "report": {"why": "", "next": "", "working": ["forms"], "at": 3000}, "withdrawnAt": 0}))
        self.assertEqual([text for level, text in jack.check_progress_files(home) if level != jack.FINE and "php.json" in text], [])
        # Its praise under no level is the same (the ninth ui-truth pass, 2026-10-07).
        (home / "progress" / "php.json").write_text(json.dumps({"v": 1, "language": "php", "level": None, "history": [], "report": {"why": "", "next": "", "encouragement": "You went straight to splitting code across files.", "at": 3000}, "withdrawnAt": 0}))
        self.assertTrue(any(level == jack.NOTE and "or its praise" in text for level, text in jack.check_progress_files(home) if "php.json" in text))
        # Withdrawn by a copy from before withdrawals were marked: the report written under the level is the placement's.
        write(level=None, report={"why": "Gaps keep it at beginner.", "at": 2000}, withdrawnAt=0)
        found = bad(jack.check_progress_files(home))
        self.assertEqual(len(found), 1, found)
        self.assertIn("has no level and still the report of the placement withdrawn", found[0])
        # Marked withdrawn, with the report from before: the same. With a report written since, without the model's
        # words for a level (the tutor drops them under no level): an unplaced record's own.
        write(level=None, report={"why": "Gaps keep it at beginner.", "at": 2000}, withdrawnAt=3000)
        self.assertEqual(len(bad(jack.check_progress_files(home))), 1)
        write(level=None, report={"why": "", "next": "", "working": ["edge cases"], "at": 4000}, withdrawnAt=3000)
        self.assertEqual(bad(jack.check_progress_files(home)), [])
        write(level=None, report={"why": "No level yet: four of eight observations.", "at": 4000}, withdrawnAt=3000)
        self.assertEqual(bad(jack.check_progress_files(home)), [])
        self.assertTrue(any(level == jack.NOTE and "keeps the model's words" in text for level, text in jack.check_progress_files(home)))
        write(level="junior", report=None)
        self.assertIn("is at junior and its history last reached beginner", bad(jack.check_progress_files(home))[0])
        write(level=None, report=None)
        self.assertEqual(bad(jack.check_progress_files(home)), [])
        shutil.rmtree(home)
        # A note's code words keep their backticks on the screen and lose them in the piece: both sides alike.
        self.assertTrue(jack.is_on_screen("`held` is read before two awaits, then `known.set`", ["    `held` is read before two awaits, then `known.set` is called"]))
        self.assertTrue(jack.is_on_screen("held is read before two awaits", ["`held` is read before two awaits"]))

    def test_the_settings_tab_against_the_manifest(self):
        folder = pathlib.Path(self.tmp.name) / "copy"
        (folder / ".claude-plugin").mkdir(parents=True)
        (folder / ".claude-plugin" / "plugin.json").write_text(json.dumps({"name": "backseat-driver", "userConfig": {"voice": {}, "editor_command": {}, "layout": {}}}))
        told = state(self.now, loaded={"at": self.now - 60_000, "options": {}})
        told["pane"]["settings"] = [{"key": "backseat-driver.voice", "label": "Voice persona", "value": "default"}]
        s = session(state=told, copy={"folder": str(folder), "version": "0.2.0", "commit": "", "can_say": True})
        found = bad(jack.check_session(world([s], now=self.now), s, DOCKED))
        self.assertEqual(len(found), 1, found)
        # `layout` is retired (plugin/core/settings.ts): only the editor command is missing.
        self.assertIn("Settings tab shows 1 row(s) and the manifest has 2 field(s): editor_command missing", found[0])
        self.assertIn("layout", jack.retired_settings())
        told["pane"]["settings"].append({"key": "backseat-driver.editor_command", "label": "Open in the editor", "value": ""})
        self.assertEqual(bad(jack.check_session(world([s], now=self.now), s, DOCKED)), [])

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
        s = session(state=state(self.now, deadlines={"scan": self.now - 60_000, "lease": self.now + 5000, "self": self.now + 8000}))
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


class Issues(unittest.TestCase):
    """The project's ledger of issues (findings.json) against the pane. The owner's 2026-10-07: a real codebase with a
    critical issue showed nothing in either view, and the silence read as "he wrote a perfect codebase"."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.home = pathlib.Path(self.tmp.name) / "home"
        self.root = str(pathlib.Path(self.tmp.name) / "ride")
        pathlib.Path(self.root).mkdir()
        self.now = jack.now_ms()
        self.folder = self.home / "projects" / jack.project_id(self.root)
        self.folder.mkdir(parents=True)
        (self.folder / "project.json").write_text(json.dumps({"v": 1, "root": self.root, "isSurveyed": True, "isAudited": True}))

    def tearDown(self):
        self.tmp.cleanup()

    def issue(self, id_: int, severity: str, title: str, status: str = "open", file: str = "stats.py") -> dict:
        return {"id": id_, "file": file, "line": id_, "lineText": "x = 1", "severity": severity, "category": "bug", "topic": f"t{id_}", "title": title,
                "text": "Why it matters.", "condition": "", "origin": "audit", "commit": "abc1234", "at": 1, "status": status, "statusAt": 1,
                "statusBy": "review", "statusNote": "", "isPinned": False}

    def keep(self, findings: list[dict], coverage: dict | None = None, age_ms: int = 120_000) -> dict:
        ledger = {"v": 1, "nextId": len(findings) + 1, "findings": findings, "coverage": coverage or {"at": 0, "commit": "", "files": 0, "read": [], "skipped": []}}
        path = self.folder / "findings.json"
        path.write_text(json.dumps(ledger))
        written = (self.now - age_ms) / 1000
        os.utime(path, (written, written))
        return ledger

    def found(self, ledger: dict, tab: str, texts: list[str], **pane) -> list[tuple[str, str]]:
        made = state(self.now, repoRoot=self.root)
        made["pane"] = {**made["pane"], "tab": tab, "notes": [], "watch": {"state": "idle"}, "review": {"state": "done", "subject": "x"},
                        "issues": {"ledger": ledger, "placed": {}, "isAudited": True}, **pane}
        made["shown"] = {**made["shown"], "pane": {**made["shown"]["pane"], "texts": texts}}
        s = session(home=self.home, state=made)
        return jack.check_issues(world([s], [self.home], self.now), s, jack.projects(self.home)[0])

    def test_the_pane_holds_the_open_issues_of_the_file(self):
        high, gone = self.issue(1, "high", "mean of an empty list"), self.issue(2, "low", "a name", "dismissed")
        ledger = self.keep([high, gone])
        self.assertIn("ledger has findings.json's 1 open issue(s)", " ".join(text for _, text in self.found(ledger, "explain", [])))
        # The pane lost one, or kept one open that was dismissed elsewhere.
        self.assertIn("lacks open issue(s) 1", bad(self.found({**ledger, "findings": [gone]}, "explain", []))[0])
        self.assertIn("holds issue(s) 2 open", bad(self.found({**ledger, "findings": [high, {**gone, "status": "open"}]}, "explain", []))[0])
        # Written a moment ago: the sessions have their look at the shared files to take it up.
        ledger = self.keep([high, gone], age_ms=10_000)
        found = self.found({**ledger, "findings": []}, "explain", [])
        self.assertEqual(bad(found), [])
        self.assertTrue(any(level == jack.NOTE for level, _ in found))

    def test_the_tab_draws_the_open_issues_worst_first_and_never_a_closed_one(self):
        ledger = self.keep([self.issue(1, "high", "mean of an empty list"), self.issue(2, "medium", "unescaped output", file="index.php"),
                            self.issue(3, "critical", "the password in the web root", "dismissed", file=".")],
                           {"at": self.now - 600_000, "commit": "abc1234", "files": 2, "read": ["stats.py"], "skipped": []})
        status = "Audited 11:42 at abc1234: read 1 of 2 source files."
        high = ["❯ high · stats.py:1", "mean of an empty list", "Why it matters."]
        medium = ["medium · index.php:2", "unescaped output", "Why it matters."]
        right = [status, "Open: 1 high, 1 medium", *high, *medium]
        self.assertEqual(bad(self.found(ledger, "review", right)), [])
        # A row placed elsewhere, or whose line changed since, is the same row.
        self.assertEqual(bad(self.found(ledger, "review", [status, "Open: 1 high, 1 medium", "high · stats.py:9", "mean of an empty list", "medium · index.php:2, changed since", "unescaped output"])), [])
        # A dismissed issue drawn as open.
        self.assertIn("draws issue 3 “the password in the web root” as open", " ".join(bad(self.found(ledger, "review", right + ["critical · the project", "the password in the web root"]))))
        # Out of order, a row missing, the counts wrong.
        self.assertIn("out of order: medium, high", " ".join(bad(self.found(ledger, "review", [status, "Open: 1 high, 1 medium", *medium, *high]))))
        self.assertIn("lacks the row of 1 open issue(s) above low: 2 “unescaped output”", " ".join(bad(self.found(ledger, "review", [status, "Open: 1 high, 1 medium", *high]))))
        # A label without its title under it is no row.
        self.assertIn("lacks the row of 1 open issue(s) above low: 2 “unescaped output”", " ".join(bad(self.found(ledger, "review", [status, "Open: 1 high, 1 medium", *high, "medium · index.php:2"]))))
        self.assertIn("says “Open: 1 high”, and findings.json has 1 high, 1 medium open", " ".join(bad(self.found(ledger, "review", [status, "Open: 1 high", *high, *medium]))))
        self.assertIn("says nothing of the 1 high, 1 medium open", " ".join(bad(self.found(ledger, "review", [status, *high, *medium]))))
        # What was read: said, or that no audit ran.
        self.assertIn("does not say what the audit of", " ".join(bad(self.found(ledger, "review", right[1:]))))
        never = self.keep([])
        self.assertIn("says nothing of an audit, and none is on record", " ".join(bad(self.found(never, "review", ["Fine."]))))
        self.assertEqual(bad(self.found(never, "review", ["Not audited for issues yet. a: audit the codebase."])), [])
        # While the audit runs, it says so instead.
        self.assertEqual(bad(self.found(never, "review", ["Auditing this project since 11:40."], review={"state": "running", "subject": jack.AUDIT_SUBJECT})), [])

    def test_the_empty_play_by_play_says_what_the_ledger_holds(self):
        ledger = self.keep([self.issue(1, "high", "mean of an empty list"), self.issue(2, "low", "a name")])
        self.assertEqual(bad(self.found(ledger, "play", ["On. Watching for your next save.", "The deep review has 1 high open: 2: Deep review."])), [])
        self.assertIn("says “Not audited for issues yet: 2: Deep review.”, and findings.json makes it “The deep review has 1 high open",
                      " ".join(bad(self.found(ledger, "play", ["On.", "Not audited for issues yet: 2: Deep review."]))))
        self.assertIn("says nothing of the ledger", " ".join(bad(self.found(ledger, "play", ["On. Watching for your next save."]))))
        # With notes open, the tab shows them and not the line.
        self.assertEqual(bad(self.found(ledger, "play", ["On."], notes=[{"id": 1}])), [])
        self.assertEqual(jack.ledger_line(jack.ledger_counts([]), False, {}), "Not audited for issues yet: 2: Deep review.")
        self.assertEqual(jack.ledger_line(jack.ledger_counts([]), True, {"at": 5, "read": ["a", "b"]}), "The audit found nothing open in the 2 files it read.")
        self.assertEqual(jack.ledger_line(jack.ledger_counts([self.issue(1, "low", "x"), self.issue(2, "medium", "y")]), True, {}), "The deep review has 2 lesser issues open: 2: Deep review.")

    def test_the_play_by_play_shows_open_issues_and_every_one_tracked(self):
        high = self.issue(1, "high", "mean of an empty list")
        tracked = {**self.issue(2, "medium", "unescaped output", file="index.php"), "isPinned": True}
        gone = self.issue(3, "high", "the password in the web root", "dismissed", file=".")
        ledger = self.keep([high, tracked, gone])
        line = "The deep review has 1 high open: 2: Deep review."
        right = ["On.", line, "From the deep review", "medium · index.php:2", "unescaped output", "❯ high · stats.py:1", "mean of an empty list"]
        self.assertEqual(bad(self.found(ledger, "play", right)), [])
        # A dismissed issue still shown, a tracked one missing.
        self.assertIn("shows issue 3 “the password in the web root” from the deep review, and findings.json has it dismissed",
                      " ".join(bad(self.found(ledger, "play", right + ["high · the project", "the password in the web root"]))))
        self.assertIn("does not show 1 tracked issue(s): 2 “unescaped output”", " ".join(bad(self.found(ledger, "play", ["On.", line, "From the deep review", *right[5:]]))))

    def test_the_deep_review_tab_lists_what_the_play_by_play_raised(self):
        ledger = self.keep([], {"at": self.now - 600_000, "commit": "abc1234", "files": 1, "read": ["stats.py"], "skipped": []})
        note = {"id": 4, "file": "stats.py", "line": 2, "kind": "bug", "topic": "empty-input", "text": "What does this do for an empty list?"}
        tip = {"id": 5, "file": "stats.py", "line": 1, "kind": "tip", "topic": "statistics", "text": "The standard library has a module for this."}
        status = "Audited 11:42 at abc1234: read 1 of 1 source files."
        found = lambda texts: " ".join(bad(self.found(ledger, "review", texts, notes=[note, tip])))
        self.assertEqual(found([status, jack.RAISED_HEADING, "● bug · stats.py:2", note["text"]]), "")
        self.assertIn("does not list the 1 bug(s) and risk(s) the play-by-play raised", found([status]))
        self.assertIn("without 1 of them: stats.py:2", found([status, jack.RAISED_HEADING]))

    def test_the_explain_tab_shows_open_issues_of_its_file(self):
        ledger = self.keep([self.issue(1, "high", "mean of an empty list"), self.issue(2, "low", "a name", "dismissed")],
                           {"at": self.now - 600_000, "commit": "abc1234", "files": 1, "read": ["stats.py"], "skipped": []})
        explain = {"spot": {"path": "stats.py", "line": 1}, "target": None}
        found = lambda texts: " ".join(bad(self.found(ledger, "explain", texts, explain=explain)))
        self.assertEqual(found(["stats.py", "Issue: high · line 1 mean of an empty list"]), "")
        self.assertIn("shows the issue “a name” at stats.py:2, which findings.json does not have open there", found(["stats.py", "Issue: low · line 2 a name"]))
        # A note beside an open issue is a note to read, not a disagreement: the next review adopts it.
        note = {"id": 7, "file": "stats.py", "line": 1, "kind": "bug", "topic": "division", "text": "What of an empty list?"}
        said = self.found(ledger, "explain", ["stats.py"], explain=explain, notes=[note])
        self.assertTrue(any(level == jack.NOTE and "stands beside issue 1" in text for level, text in said), said)

    def test_what_the_audit_read_is_in_the_repository(self):
        env = {**os.environ, "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@x", "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@x"}
        subprocess.run(["git", "init", "-q", self.root], check=True, env=env)
        (pathlib.Path(self.root) / "stats.py").write_text("x = 1\n")
        subprocess.run(["git", "-C", self.root, "add", "stats.py"], check=True, env=env)
        subprocess.run(["git", "-C", self.root, "commit", "-q", "-m", "Add stats"], check=True, env=env)
        ledger = self.keep([], {"at": self.now - 600_000, "commit": "abc1234", "files": 5, "read": ["stats.py", "ghost.php"], "skipped": []})
        found = " ".join(bad(self.found(ledger, "explain", [])))
        self.assertIn("says it read 1 file(s) the repository does not have: ghost.php", found)
        self.assertIn("counts 5 source files, and git lists 1 files in all", found)
        ledger = self.keep([], {"at": self.now - 600_000, "commit": "abc1234", "files": 1, "read": ["stats.py"], "skipped": []})
        self.assertEqual(bad(self.found(ledger, "explain", [])), [])

    def test_the_words_are_the_mods(self):
        findings = (REPO / "plugin" / "core" / "findings.ts").read_text()
        self.assertIn("export const SEVERITIES: readonly Severity[] = ['critical', 'high', 'medium', 'low']", findings)
        self.assertEqual(jack.SEVERITIES, ("critical", "high", "medium", "low"))
        for start in jack.LEDGER_LINE_STARTS:
            self.assertIn(start.split(" open")[0] if start.startswith("The deep review") else start, findings)
        self.assertIn(f"export const AUDIT_SUBJECT = '{jack.AUDIT_SUBJECT}'", (REPO / "plugin" / "core" / "review.ts").read_text())
        pane = (REPO / "plugin" / "hooks" / "pane.tsx").read_text()
        self.assertIn(f"export const PLAY_PICKS = {jack.PLAY_PICKS}", pane)
        self.assertIn(f"export const RAISED_HEADING = '{jack.RAISED_HEADING}'", pane)
        self.assertEqual(jack.counts_words({"critical": 1, "high": 2, "medium": 0, "low": 3}), "1 critical, 2 high, 3 low")


class Cache(unittest.TestCase):
    """The pane against the project's cache: what a restart, a takeover and a session that does not drive take up
    from the folder, and what every session keeps in step with. The owner's 2026-10-06: a fresh session beside the
    night's showed an empty Deep review tab with four reviews on disk."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.home = pathlib.Path(self.tmp.name) / "home"
        self.root = str(pathlib.Path(self.tmp.name) / "ride")
        pathlib.Path(self.root).mkdir()
        self.now = jack.now_ms()
        self.folder = self.home / "projects" / jack.project_id(self.root)
        self.folder.mkdir(parents=True)
        (self.folder / "project.json").write_text(json.dumps({"v": 1, "root": self.root}))
        (self.folder / "lease.json").write_text(json.dumps({"v": 1, "session": "other", "at": self.now - 1000}))

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, path: pathlib.Path, value, age_ms: int) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value))
        written = (self.now - age_ms) / 1000
        os.utime(path, (written, written))

    def told(self, is_driver: bool, **pane) -> dict:
        made = state(self.now, repoRoot=self.root, lease={"isDriver": is_driver, "holder": "x" if is_driver else ""})
        made["pane"] = {**made["pane"], **pane}
        return made

    def found(self, told: dict) -> list[tuple[str, str]]:
        s = session(home=self.home, state=told)
        w = world([s], [self.home], self.now)
        project = jack.projects(self.home)[0]
        return jack.check_cache(w, s, project)

    def test_an_empty_deep_review_tab_with_reviews_on_disk(self):
        reviews = [{"commit": "abc1234", "subject": "commit abc1234: Add mean", "at": self.now - 7_200_000, "text": "Fine."},
                   {"commit": "def5678", "subject": "commit def5678: Add median", "at": self.now - 3_600_000, "text": "Good."}]
        self.write(self.folder / "reviews.json", reviews, 60_000)
        empty = {"state": "none", "subject": "", "text": "", "older": []}
        found = bad(self.found(self.told(False, review=empty)))
        self.assertEqual(len(found), 1, found)
        self.assertIn("Deep review tab has nothing to read, and the cache holds 2 review(s)", found[0])
        self.assertIn("commit def5678: Add median", found[0])
        # The tab has them: nothing against it. Short of one in the history, or showing another as the latest: a disagreement.
        full = {"state": "done", "subject": "commit def5678: Add median", "text": "Good.", "older": [{}, {}]}
        self.assertEqual(bad(self.found(self.told(False, review=full))), [])
        self.assertTrue(any("has the cache's 2 review(s)" in text for _, text in self.found(self.told(False, review=full))))
        self.assertIn("lists 1 review(s) in its history, and the cache holds 2", bad(self.found(self.told(True, review={**full, "older": [{}]})))[0])
        self.assertIn("shows “commit abc1234: Add mean” as the latest review, and the cache's latest", bad(self.found(self.told(True, review={**full, "subject": "commit abc1234: Add mean"})))[0])
        # A first look around is not kept in reviews.json: the tab may show it as the latest.
        self.assertEqual(bad(self.found(self.told(True, review={**full, "subject": jack.SURVEY_SUBJECT}))), [])
        # Written a moment ago: a session that does not drive has a beat to take it up.
        self.write(self.folder / "reviews.json", reviews, 3_000)
        self.assertEqual(bad(self.found(self.told(False, review=empty))), [])
        self.assertTrue(any(level == jack.NOTE and "held against them next time" in text for level, text in self.found(self.told(False, review=empty))))

    def test_notes_kept_about_unchanged_files_that_the_pane_lacks(self):
        stats = pathlib.Path(self.root) / "stats.py"
        stats.write_text("def mean(xs): ...\n")
        old = (self.now - 600_000) / 1000
        os.utime(stats, (old, old))
        note = {"id": 7, "file": "stats.py", "line": 1, "kind": "tip", "topic": "naming", "text": "A note about the mean."}
        self.write(self.folder / "notes.json", {"v": 1, "notes": [note], "dismissed": [], "prints": {"stats.py": "x"}}, 300_000)
        found = bad(self.found(self.told(False, notes=[], dismissed=[])))
        self.assertEqual(len(found), 1, found)
        self.assertIn("lacks 1 note(s) that notes.json keeps about files unchanged since", found[0])
        self.assertIn("stats.py: “A note about the mean.”", found[0])
        # Shown, or dismissed here: nothing against it.
        self.assertEqual(bad(self.found(self.told(False, notes=[note], dismissed=[]))), [])
        self.assertEqual(bad(self.found(self.told(False, notes=[], dismissed=[{"file": "stats.py", "topic": "naming"}]))), [])
        # The file was saved after the notes were written: the next look says what is true of it, and the note may well be gone.
        fresh = (self.now - 60_000) / 1000
        os.utime(stats, (fresh, fresh))
        self.assertEqual(bad(self.found(self.told(False, notes=[], dismissed=[]))), [])

    def test_what_they_said_they_are_working_on(self):
        said_at = self.now - 120_000
        journal = {"said": {"text": "the mean", "at": said_at}, "inferred": None, "entries": [], "sittings": []}
        self.write(self.folder / "journal.json", journal, 100_000)
        blank = {"said": "", "saidAgo": "", "inferred": "", "where": "", "share": ""}
        found = bad(self.found(self.told(False, working=blank)))
        self.assertEqual(len(found), 1, found)
        self.assertIn("says they are working on “(nothing said)”, and the journal says they said “the mean”", found[0])
        self.assertEqual(bad(self.found(self.told(False, working={**blank, "said": "the mean"}))), [])
        # The driver merges the file at its next write: held against it once the file was written after what was said.
        self.assertEqual(len(bad(self.found(self.told(True, working=blank)))), 1)
        self.write(self.folder / "journal.json", journal, 120_000)
        self.assertEqual(bad(self.found(self.told(True, working=blank))), [])

    def test_the_commits_waiting_and_the_level(self):
        commits = [{"hash": "1" * 40, "title": "Later", "at": self.now, "isReviewed": False, "attempts": 0},
                   {"hash": "2" * 40, "title": "Done", "at": self.now, "isReviewed": True, "attempts": 0}]
        self.write(self.folder / "queue.json", {"v": 1, "commits": commits}, 60_000)
        review = {"state": "none", "subject": "", "text": "", "older": [], "waiting": 0}
        found = bad(self.found(self.told(False, review=review)))
        self.assertEqual(len(found), 1, found)
        self.assertIn("counts 0 commit(s) waiting for their review, and queue.json has 1", found[0])
        self.assertEqual(bad(self.found(self.told(False, review={**review, "waiting": 1}))), [])
        # The driver's count is held against the file in check_world, from memory, not from the pane.
        self.assertEqual(bad(self.found(self.told(True, review=review))), [])

        self.write(self.home / "progress" / "python.json", {"v": 1, "language": "python", "level": "junior", "observations": []}, 60_000)
        # A confirmed level: only the file is held against it (a provisional one under the bar is the next test's).
        records = {"records": [{"language": "python", "level": "beginner", "isProvisional": False, "observations": []}]}
        found = bad(self.found(self.told(True, progress=records)))
        self.assertEqual(len(found), 1, found)
        self.assertIn("places python at beginner, and progress/python.json says junior", found[0])
        self.assertEqual(bad(self.found(self.told(True, progress={"records": [{"language": "python", "level": "junior", "isProvisional": False}]}))), [])
        self.write(self.home / "progress" / "python.json", {"v": 1, "language": "python", "level": "mid"}, 5_000)
        self.assertEqual(bad(self.found(self.told(True, progress={"records": [{"language": "python", "level": "junior", "isProvisional": False}]}))), [])

    def test_a_level_the_bar_does_not_support(self):
        thin = {"records": [{"language": "shell", "level": "beginner", "isProvisional": True, "linesRead": 0,
                             "observations": [{"commit": c, "skill": "s"} for c in "aaaaabbbbbccccc"]}]}
        found = bad(self.found(self.told(True, progress=thin)))
        self.assertEqual(len(found), 1, found)
        self.assertIn("places shell at beginner (provisional) on 15 observation(s) from 3 commit(s) and 0 line(s) read", found[0])
        # Placed with the lines read, or confirmed, or withdrawn: nothing against it.
        self.assertEqual(bad(self.found(self.told(True, progress={"records": [{**thin["records"][0], "linesRead": 80}]}))), [])
        self.assertEqual(bad(self.found(self.told(True, progress={"records": [{**thin["records"][0], "isProvisional": False}]}))), [])
        self.assertEqual(bad(self.found(self.told(True, progress={"records": [{**thin["records"][0], "level": None}]}))), [])

    def test_the_first_look_around_counts_in_the_history(self):
        (self.folder / "project.json").write_text(json.dumps({"v": 1, "root": self.root, "isSurveyed": True,
            "survey": {"commit": "", "subject": jack.SURVEY_SUBJECT, "at": self.now - 7_200_000, "text": "A look around."}}))
        old = (self.now - 60_000) / 1000
        os.utime(self.folder / "project.json", (old, old))
        empty = {"state": "none", "subject": "", "text": "", "older": []}
        found = bad(self.found(self.told(True, review=empty)))
        self.assertEqual(len(found), 1, found)
        self.assertIn("the cache holds 1 review(s), the latest “a first look around this project”", found[0])
        shown = {"state": "done", "subject": jack.SURVEY_SUBJECT, "text": "A look around.", "older": [{}]}
        self.assertEqual(bad(self.found(self.told(True, review=shown))), [])

    def test_the_latest_reviewed_commit_counts_somewhere_or_the_tab_says_why(self):
        full = "a83b842d7f0e6c1b2a3f4e5d6c7b8a9f0e1d2c3b"
        self.write(self.folder / "reviews.json", [{"commit": "a83b842", "subject": "commit a83b842: fail loudly", "at": self.now - 7_200_000, "text": "Two lines."}], 60_000)
        shown = {"state": "done", "subject": "commit a83b842: fail loudly", "text": "Two lines.", "older": [{}]}
        # Not assessed, not waiting, and nothing says why.
        found = bad(self.found(self.told(True, review=shown, progress={"records": [], "skipped": "", "busy": ""})))
        self.assertEqual(len(found), 1, found)
        self.assertIn("says nothing of commit a83b842, which the Deep review tab reviewed", found[0])
        # The tab says why: fine. Assessed in a record, or waiting: fine too.
        self.assertEqual(bad(self.found(self.told(True, review=shown, progress={"records": [], "skipped": "Commit a83b842 is too small to say anything about your progress.", "busy": ""}))), [])
        self.write(self.home / "progress" / "shell.json", {"v": 1, "language": "shell", "level": None, "assessed": [full], "observations": []}, 60_000)
        self.assertEqual(bad(self.found(self.told(True, review=shown, progress={"records": [], "skipped": "", "busy": ""}))), [])
        (self.home / "progress" / "shell.json").unlink()
        self.write(self.folder / "queue.json", {"v": 1, "commits": [{"hash": full, "title": "fail loudly", "at": self.now, "isReviewed": True, "attempts": 0}]}, 60_000)
        self.assertEqual(bad(self.found(self.told(True, review=shown, progress={"records": [], "skipped": "", "busy": ""}))), [])

    def test_a_review_of_another_day_drawn_as_todays(self):
        last_night = self.now - 24 * 3_600_000
        review = {"state": "done", "subject": "commit a83b842: fail loudly", "text": "Two lines.", "older": [{"subject": "commit a83b842: fail loudly", "at": last_night}]}
        self.write(self.folder / "reviews.json", [{"commit": "a83b842", "subject": "commit a83b842: fail loudly", "at": last_night, "text": "Two lines."}], 60_000)
        bare = jack.clock(last_night)[:5]
        told = self.told(True, review=review, tab="review", progress={"records": [], "skipped": "Commit a83b842 is too small to say anything about your progress.", "busy": ""})
        told["shown"]["pane"]["texts"] = [*TEXTS, f"▸ Review 1 of 1 · {bare}", f"❯ {bare}  Commit a83b842: fail loudly"]
        found = bad(self.found(told))
        self.assertEqual(len(found), 1, found)
        self.assertIn(f"dates “commit a83b842: fail loudly” {bare}, a time of day, and it is of yesterday", found[0])
        # Drawn with its day, as the pane does since: nothing against it.
        told["shown"]["pane"]["texts"] = [*TEXTS, f"▸ Review 1 of 1 · yesterday {bare}", f"❯ yesterday {bare}  Commit a83b842: fail loudly"]
        self.assertEqual(bad(self.found(told)), [])
        # The tool's own clock says the day too.
        self.assertTrue(jack.day_clock(last_night, self.now).startswith("yesterday "))
        self.assertEqual(jack.day_clock(self.now - 60_000, self.now), jack.clock(self.now - 60_000))
        self.assertIn(",", jack.day_clock(self.now - 3 * 24 * 3_600_000, self.now))

    def test_watched_files_of_a_commit_that_did_not_count(self):
        env = {**os.environ, "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@x", "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@x"}
        subprocess.run(["git", "init", "-q", self.root], check=True, env=env)
        (pathlib.Path(self.root) / "stats.py").write_text("x = 1\n")
        subprocess.run(["git", "-C", self.root, "add", "stats.py"], check=True, env=env)
        subprocess.run(["git", "-C", self.root, "commit", "-q", "-m", "Add stats"], check=True, env=env)
        short = subprocess.run(["git", "-C", self.root, "rev-parse", "--short=7", "HEAD"], check=True, env=env, capture_output=True, text=True).stdout.strip()
        self.write(self.folder / "watched.json", {"v": 1, "paths": ["stats.py", "other.py"], "skipped": f"Commit {short} does not count toward your progress: it names a co-author."}, 60_000)
        found = bad(self.found(self.told(True, progress={"records": [], "skipped": "", "busy": ""})))
        self.assertEqual(len(found), 1, found)
        self.assertIn(f"keeps 1 watched file(s) of commit {short}, which did not count: stats.py", found[0])
        self.write(self.folder / "watched.json", {"v": 1, "paths": ["other.py"], "skipped": f"Commit {short} does not count toward your progress: it names a co-author."}, 60_000)
        self.assertEqual(bad(self.found(self.told(True, progress={"records": [], "skipped": "", "busy": ""}))), [])

    def test_what_was_said_comes_from_the_log_when_a_reload_emptied_the_ring(self):
        debug = pathlib.Path(self.tmp.name) / "debug" / "20261006-000000-aaaaaaaa"
        debug.mkdir(parents=True)
        (debug / "000000.jsonl").write_text(json.dumps({"t": self.now - 19_000, "seq": 1, "s": "a", "p": "", "k": "said", "n": "toast", "d": {"text": "Deep review ready: commit abc1234"}}) + "\n")
        told = state(self.now)
        told["said"] = []
        self.assertEqual([t["text"] for t in jack.said_lately(told, debug, self.now)], ["Deep review ready: commit abc1234"])
        told["said"] = [{"at": self.now - 1000, "how": "toast", "text": "From the ring."}]
        self.assertEqual([t["text"] for t in jack.said_lately(told, debug, self.now)], ["From the ring."])

    def test_open_notes_against_the_lines_they_quote(self):
        stats = pathlib.Path(self.root) / "stats.py"
        stats.write_text("def mean(xs):\n    return sum(xs) / len(xs)\n")
        old = (self.now - 600_000) / 1000
        os.utime(stats, (old, old))
        note = {"id": 1, "file": "stats.py", "line": 2, "kind": "tip", "topic": "t", "text": "A note.", "lineText": "return sum(xs) / len(xs)"}
        told = self.told(True, notes=[note], watch={"state": "idle", "lastLookAt": self.now - 60_000})
        found = jack.check_notes_lines("aaaaaaaa", told, self.root)
        self.assertEqual(bad(found), [])
        self.assertTrue(any("point at the lines they quote" in text for _, text in found), found)
        # The line moved: a note, placed at the next look. The line gone: the note is stale.
        stats.write_text("import math\n\ndef mean(xs):\n    return sum(xs) / len(xs)\n")
        os.utime(stats, (old, old))
        found = jack.check_notes_lines("aaaaaaaa", told, self.root)
        self.assertEqual(bad(found), [])
        self.assertTrue(any(level == jack.NOTE and "its line is now 4" in text for level, text in found), found)
        stats.write_text("def mean(xs):\n    return 0\n")
        os.utime(stats, (old, old))
        found = bad(jack.check_notes_lines("aaaaaaaa", told, self.root))
        self.assertEqual(len(found), 1, found)
        self.assertIn("which reads “return 0”, and the note quotes “return sum(xs) / len(xs)”", found[0])
        # Saved since the last look: the next look's business.
        fresh = (self.now - 1000) / 1000
        os.utime(stats, (fresh, fresh))
        self.assertEqual(jack.check_notes_lines("aaaaaaaa", told, self.root), [])

    def test_the_explain_tab_fresh_against_the_file(self):
        stats = pathlib.Path(self.root) / "stats.py"
        text = "def mean(xs):\n    return sum(xs) / len(xs)\n"
        stats.write_text(text)
        old = (self.now - 600_000) / 1000
        os.utime(stats, (old, old))
        entry = self.folder / "files" / f"{jack.fnv('stats.py')}-stats.py.json"
        entry.parent.mkdir(exist_ok=True)
        entry.write_text(json.dumps({"v": 1, "path": "stats.py", "print": jack.source_print(text)}))
        told = self.told(True, explain={"status": "fresh", "spot": {"path": "stats.py", "line": 2}})
        found = jack.check_explain_fresh("aaaaaaaa", told, self.root, jack.projects(self.home)[0])
        self.assertEqual(bad(found), [])
        self.assertTrue(any("is fresh for stats.py, as the file reads" in text for _, text in found), found)
        entry.write_text(json.dumps({"v": 1, "path": "stats.py", "print": "0000000000000000"}))
        found = bad(jack.check_explain_fresh("aaaaaaaa", told, self.root, jack.projects(self.home)[0]))
        self.assertEqual(len(found), 1, found)
        self.assertIn("says stats.py is fresh, and the cache's fingerprint 0000000000000000 is not the file's", found[0])
        told["pane"]["explain"]["status"] = "updating"
        self.assertEqual(jack.check_explain_fresh("aaaaaaaa", told, self.root, jack.projects(self.home)[0]), [])

    def test_the_deep_reviews_insights_against_what_explain_can_reach(self):
        stats = pathlib.Path(self.root) / "stats.py"
        text = "def mean(xs):\n    total = sum(xs)\n    return total / len(xs)\n"
        stats.write_text(text)
        (self.folder / "files").mkdir(exist_ok=True)
        entry = {"v": 1, "path": "stats.py", "print": jack.source_print(text), "symbols": [{"name": "mean", "kind": "function", "startLine": 1, "endLine": 3, "detail": {"what": "Averages.", "why": "Used by variance.", "watch": "Also, the project notes describe a different stats.py than this one.", "at": self.now - 600_000}}]}
        (self.folder / "files" / f"{jack.fnv('stats.py')}-stats.py.json").write_text(json.dumps(entry))
        known = {"v": 1, "root": self.root, "overview": "A statistics library.", "overviewAt": self.now - 120_000, "insights": [
            {"file": "stats.py", "symbol": "$nowhere", "text": "A code nothing names.", "commit": "abc1234", "at": 1, "print": jack.source_print(text), "of": "file"},
            {"file": "stats.py", "symbol": "total", "text": "The running sum.", "commit": "abc1234", "at": 1, "print": jack.source_print(text), "of": "file"},
        ]}
        self.write(self.folder / "project.json", known, 60_000)
        told = self.told(True, explain={"status": "fresh", "spot": {"path": "stats.py", "line": 2}, "target": {"name": "mean", "kind": "function", "startLine": 1, "endLine": 3}, "detail": {"what": "Averages.", "how": "", "why": "Used by variance.", "watch": "Also, the project notes describe a different stats.py than this one.", "uses": []}})
        found = jack.check_explain_insights("aaaaaaaa", told, self.root, jack.projects(self.home)[0])
        self.assertEqual(len(bad(found)), 1, found)
        self.assertIn("sends the reader to check stats.py against the project notes", bad(found)[0])
        notes = [text for level, text in found if level == jack.NOTE]
        self.assertEqual(len(notes), 1, found)
        self.assertIn("can never show 1 insight(s)", notes[0])
        self.assertIn("“$nowhere”", notes[0])
        # Written under old notes without sending the reader anywhere: a note, and the explanation stands.
        told["pane"]["explain"]["detail"]["watch"] = "Divides by the length."
        found = jack.check_explain_insights("aaaaaaaa", told, self.root, jack.projects(self.home)[0])
        self.assertEqual(bad(found), [])
        self.assertTrue(any("under project notes rewritten at" in text for _, text in found), found)
        self.assertEqual(jack.mentioned_at(["x = cm + 1"], "$cm"), 1)
        self.assertEqual(jack.mentioned_at(["x = acme + 1"], "$cm"), -1)
        self.assertEqual(jack.mentioned_at(["run() here"], "run()"), 1)

    def test_a_spot_the_pane_set_is_named_as_the_panes(self):
        (self.home / "editors").mkdir(exist_ok=True)
        (self.home / "editors" / "emacs-1.json").write_text(json.dumps({"v": 1, "editor": "emacs", "pid": 1, "at": self.now - 1000, "changed": self.now - 60_000, "root": self.root, "file": f"{self.root}/stats.py", "line": 18, "buffers": [f"{self.root}/stats.py"], "visible": [], "active": True}))
        told = self.told(True, explain={"status": "fresh", "spot": {"path": "stats.py", "line": 98}, "target": None, "detail": None})
        told["explain"] = {"isOn": True, "focus": {"path": "stats.py", "line": 98, "source": "pane"}, "editorFocusAt": self.now - 60_000, "focusText": ""}
        told["scan"] = {"lastScanAt": self.now - 2000}
        self.write(self.folder / "lease.json", {"v": 1, "session": "aaaaaaaa-1111-4000-8000-000000000001", "at": self.now}, 0)
        s = session(home=self.home, state=told)
        found = jack.check_session(world([s], [self.home], self.now), s, DOCKED)
        self.assertTrue(any("Explain spot is the pane's, stats.py:98; emacs's caret" in text and "was followed at" in text for _, text in found), found)
        self.assertFalse(any("follows emacs's caret: stats.py:98" in text for _, text in found), found)
        told["explain"]["focus"]["source"] = "editor"
        told["explain"]["focus"]["line"] = 18
        found = jack.check_session(world([s], [self.home], self.now), s, DOCKED)
        self.assertTrue(any("follows emacs's caret: stats.py:18" in text for _, text in found), found)

    def test_head_with_no_review_is_accounted_for_by_the_growth_tab(self):
        # An import of 385 files, the owner's first commit in a project, skipped silently (the ninth ui-truth pass, 2026-10-07).
        env = {**os.environ, "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "me@x", "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "me@x",
               "GIT_AUTHOR_DATE": f"@{self.now // 1000 - 3600} +0000", "GIT_COMMITTER_DATE": f"@{self.now // 1000 - 3600} +0000"}
        subprocess.run(["git", "init", "-q", self.root], check=True, env=env)
        (pathlib.Path(self.root) / "stats.py").write_text("x = 1\n")
        subprocess.run(["git", "-C", self.root, "add", "stats.py"], check=True, env=env)
        subprocess.run(["git", "-C", self.root, "commit", "-q", "-m", "First commit"], check=True, env=env)
        short = subprocess.run(["git", "-C", self.root, "rev-parse", "--short=7", "HEAD"], check=True, env=env, capture_output=True, text=True).stdout.strip()
        told = self.told(True, progress={"identity": ["me@x"], "records": [], "skipped": "", "busy": ""})
        found = bad(self.found(told))
        self.assertEqual(len(found), 1, found)
        self.assertIn(f"says nothing of HEAD {short}, the person's own commit of", found[0])
        told["pane"]["progress"]["skipped"] = f"Commit {short} does not count toward your progress: it adds 143875 lines in 385 files at once."
        found = self.found(told)
        self.assertEqual(bad(found), [])
        self.assertTrue(any(f"accounts for HEAD {short}" in text for _, text in found), found)
        # Someone else's commit, or one just made: nothing is asked.
        told["pane"]["progress"] = {"identity": ["other@x"], "records": [], "skipped": "", "busy": ""}
        self.assertEqual(bad(self.found(told)), [])

    def test_an_insight_credited_to_a_review_the_tab_does_not_have(self):
        (pathlib.Path(self.root) / "stats.py").write_text("x = 1\n")
        told = self.told(True, explain={"status": "fresh", "spot": {"path": "stats.py", "line": 1}, "target": None, "detail": None, "insights": ["Table names are built from suffixes. (deep review of 570e787)"]})
        found = jack.check_explain_insights("aaaaaaaa", told, self.root, jack.projects(self.home)[0])
        self.assertEqual(bad(found), [])
        self.assertTrue(any(level == jack.NOTE and "credits an insight to a deep review of 570e787" in text for level, text in found), found)
        self.write(self.folder / "reviews.json", [{"commit": "570e787", "subject": "commit 570e787: First commit", "at": self.now - 60_000, "text": "Fine."}], 60_000)
        found = jack.check_explain_insights("aaaaaaaa", told, self.root, jack.projects(self.home)[0])
        self.assertFalse(any("credits an insight" in text for _, text in found), found)

    def test_an_editors_root_against_gits(self):
        env = {**os.environ, "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@x", "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@x"}
        subprocess.run(["git", "init", "-q", self.root], check=True, env=env)
        real_root = os.path.realpath(self.root)
        (pathlib.Path(self.root) / "index.php").write_text("<?php\n")
        (self.home / "editors").mkdir(exist_ok=True)
        report = {"v": 1, "editor": "emacs", "pid": 1, "at": self.now - 1000, "changed": self.now - 5000, "file": f"{real_root}/index.php", "line": 1, "buffers": [], "visible": [], "active": True}
        (self.home / "editors" / "emacs-1.json").write_text(json.dumps(report))
        found = jack.check_editor_roots(self.home, self.now)
        self.assertEqual(len(found), 1, found)
        self.assertIn("emacs (pid 1) says no root for", found[0][1])
        self.assertEqual(found[0][0], jack.NOTE)
        (self.home / "editors" / "emacs-1.json").write_text(json.dumps({**report, "root": real_root}))
        self.assertEqual(jack.check_editor_roots(self.home, self.now), [])
        # A report from an editor that is gone says nothing.
        (self.home / "editors" / "emacs-1.json").write_text(json.dumps({**report, "at": self.now - 600_000}))
        self.assertEqual(jack.check_editor_roots(self.home, self.now), [])

    def test_a_skip_line_that_counts_a_patch_cut_by_the_host(self):
        env = {**os.environ, "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "me@x", "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "me@x"}
        subprocess.run(["git", "init", "-q", self.root], check=True, env=env)
        # A patch past the 4 MiB the host keeps: one vendored file of a hundred thousand lines.
        (pathlib.Path(self.root) / "viewer.js").write_text("".join(f"var v{i} = {i};\n" for i in range(220_000)))
        (pathlib.Path(self.root) / "stats.py").write_text("x = 1\n")
        subprocess.run(["git", "-C", self.root, "add", "."], check=True, env=env)
        subprocess.run(["git", "-C", self.root, "commit", "-q", "-m", "Import the viewer"], check=True, env=env)
        short = subprocess.run(["git", "-C", self.root, "rev-parse", "--short=7", "HEAD"], check=True, env=env, capture_output=True, text=True).stdout.strip()
        full = subprocess.run(["git", "-C", self.root, "rev-parse", "HEAD"], check=True, env=env, capture_output=True, text=True).stdout.strip()
        self.assertGreater(jack.patch_size(self.root, short) or 0, jack.OUTPUT_CAP)
        self.assertIsNone(jack.patch_size(self.root, "0" * 40))
        told = self.told(True, progress={"identity": ["me@x"], "records": [], "skipped": f"Commit {short} does not count toward your progress: it adds 5400 lines in 16 files at once, which reads as an import or generated code.", "busy": ""})
        found = bad(self.found(told))
        self.assertEqual(len(found), 1, found)
        self.assertIn(f"counts commit {short}'s patch as whole, and it is 4 MiB", found[0])
        # Said as a floor, as the tutor says it since: nothing against it.
        told["pane"]["progress"]["skipped"] = f"Commit {short} does not count toward your progress: it adds more than 5400 lines in 16 files at once, which reads as an import or generated code."
        self.assertEqual(bad(self.found(told)), [])
        # A record that assessed the commit judged it on part of its code.
        (self.home / "progress").mkdir(exist_ok=True)
        (self.home / "progress" / "javascript.json").write_text(json.dumps({"v": 1, "language": "javascript", "level": None, "history": [], "report": None, "assessed": [full], "observations": [], "withdrawnAt": 0}))
        found = bad(self.found(told))
        self.assertEqual(len(found), 1, found)
        self.assertIn(f"assessed commit {short} on a patch of 4 MiB", found[0])

    def test_the_working_on_time_against_the_journal(self):
        # "100% of the last 10 minutes in the editor" for seven seconds (the twelfth ui-truth pass, 2026-10-07).
        told = self.told(True, working={"said": "", "inferred": "", "where": "index.php, line 27", "share": "100% of the last 10 minutes in the editor"})
        found = bad(jack.check_working_share("aaaaaaaa", told, jack.projects(self.home)[0], self.now))
        self.assertEqual(len(found), 1, found)
        self.assertIn("a share of the editor's time, read as a share of the window", found[0])
        self.write(self.folder / "journal.json", {"entries": [{"kind": "focus", "at": self.now - 60_000, "ms": 7000, "path": "index.php", "lines": [[27, 27]], "where": ""}], "sittings": []}, 0)
        told["pane"]["working"]["share"] = "7 s in the editor in the last 10 minutes"
        self.assertEqual(bad(jack.check_working_share("aaaaaaaa", told, jack.projects(self.home)[0], self.now)), [])
        told["pane"]["working"]["share"] = "9 min in the editor in the last 10 minutes"
        found = bad(jack.check_working_share("aaaaaaaa", told, jack.projects(self.home)[0], self.now))
        self.assertEqual(len(found), 1, found)
        self.assertIn("the journal holds 7 s of caret time there", found[0])

    def test_a_section_shown_relying_on_a_later_one(self):
        outline = [{"name": "Page setup and includes", "kind": "section", "startLine": 2, "endLine": 42, "summary": ""},
                   {"name": "Goal keyword input", "kind": "section", "startLine": 44, "endLine": 60, "summary": ""}]
        explain = {"status": "fresh", "spot": {"path": "index.php", "line": 2}, "outline": outline, "target": outline[0],
                   "detail": {"what": "w", "how": "", "why": "", "watch": "", "uses": ["Goal keyword input"]}}
        found = bad(jack.check_explain_uses("aaaaaaaa", self.told(True, explain=explain), None))
        self.assertEqual(len(found), 1, found)
        self.assertIn("“Page setup and includes” relying on “Goal keyword input”, after it", found[0])
        explain["detail"]["uses"] = []
        self.assertEqual(bad(jack.check_explain_uses("aaaaaaaa", self.told(True, explain=explain), None)), [])
        # A later section relying on an earlier one is as it should be.
        explain["target"], explain["detail"]["uses"] = outline[1], ["Page setup and includes"]
        self.assertEqual(bad(jack.check_explain_uses("aaaaaaaa", self.told(True, explain=explain), None)), [])

    def test_a_pick_in_the_explain_outline_that_moved_the_page(self):
        pick = {"t": self.now - 30_000, "k": "ui", "n": "explain pick", "d": 98}
        drawn = lambda t, offset: {"t": t, "k": "shown", "n": "pane", "d": {"texts": [], "scroll": {"offset": offset, "bodyRows": 31}}}
        records = [drawn(self.now - 40_000, 8), pick, drawn(self.now - 29_000, 8), drawn(self.now - 25_000, 1)]
        found = bad(jack.check_pick_kept_page("aaaaaaaa", records, self.now))
        self.assertEqual(len(found), 1, found)
        self.assertIn("moved from row 8 to row 1 after a pick in the Explain outline", found[0])
        # The person scrolled after the pick: their view.
        self.assertEqual(jack.check_pick_kept_page("aaaaaaaa", records + [{"t": self.now - 20_000, "k": "ui", "n": "scroll", "d": {"offset": 1, "by": -7, "origin": "person"}}], self.now), [])
        # The page stayed: nothing to say.
        self.assertEqual(jack.check_pick_kept_page("aaaaaaaa", [drawn(self.now - 40_000, 8), pick, drawn(self.now - 25_000, 8)], self.now), [])

    def test_a_marker_from_before_the_command_was_renamed(self):
        self.assertIn("/backseat forget", jack.marker_text())
        (self.home / ".backseat-driver").write_text("Delete the folder to forget all of it, or run /bsd forget.\n")
        found = jack.check_marker(self.home)
        self.assertEqual(len(found), 1, found)
        self.assertEqual(found[0][0], jack.NOTE)
        (self.home / ".backseat-driver").write_text(jack.marker_text())
        self.assertEqual(jack.check_marker(self.home), [])

    def test_the_scrolled_note_names_the_pieces_missing(self):
        self.assertEqual(jack.quoted_pieces(["1: Play", "2: Review"]), "“1: Play”, “2: Review”")
        self.assertEqual(jack.quoted_pieces(["a", "b", "c", "d", "e"]), "“a”, “b”, “c” and 2 more")

    def test_a_bundle_reads_as_one_page(self):
        import contextlib
        import io
        self.write(self.folder / "reviews.json", [{"commit": "abc1234", "subject": "commit abc1234: Add mean", "at": self.now, "text": "Fine."}], 60_000)
        # The Settings tab's rows in the state: they shadowed the screen's rows in the bundle and crashed its checks (the third ui-truth pass).
        told = self.told(True, review={"state": "done", "subject": "commit abc1234: Add mean", "text": "Fine.", "older": [{}]},
                         settings=[{"key": "backseat-driver.voice", "label": "Voice persona", "value": "default", "options": ["default"]}])
        s = session(home=self.home, state=told)
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            jack.print_bundle(world([s], [self.home], self.now), s)
        page = out.getvalue()
        self.assertIn("settings tab: Voice persona: default", page)
        # A time of another day carries its day on the page too (the sixth ui-truth pass).
        self.write(self.folder / "journal.json", {"said": {"text": "", "at": self.now - 24 * 3_600_000}, "inferred": None, "entries": [], "sittings": []}, 60_000)
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            jack.print_bundle(world([s], [self.home], self.now), s)
        self.assertIn("said “” at yesterday ", out.getvalue())
        # The page ends with what the data folder says against the world (the tenth ui-truth pass, 2026-10-07).
        (self.home / "editors").mkdir(exist_ok=True)
        (self.home / "editors" / "emacs-7.json").write_text(json.dumps({"v": 1, "editor": "emacs", "pid": 1, "at": self.now - 1000, "changed": self.now - 5000, "file": f"{self.root}/stats.py", "line": 1, "buffers": [], "visible": [], "active": True}))
        subprocess.run(["git", "init", "-q", self.root], check=True)
        (pathlib.Path(self.root) / "stats.py").write_text("x = 1\n")
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            jack.print_home_checks(world([s], [self.home], self.now))
        self.assertIn("--- HOME CHECKS", out.getvalue())
        self.assertIn("says no root for", out.getvalue())
        # "provisional" is a level's word, as the pane draws it: a record with none is "not placed", plain.
        self.write(self.home / "progress" / "shell.json", {"v": 1, "language": "shell", "level": None, "isProvisional": True, "observations": []}, 60_000)
        told["pane"]["progress"] = {"records": [{"language": "shell", "level": None, "isProvisional": True, "observations": []}]}
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            jack.print_bundle(world([s], [self.home], self.now), s)
        self.assertIn("growth: shell not placed · 0 observations", out.getvalue())
        self.assertIn("progress/shell.json (written 60s ago): level none · 0 observations", out.getvalue())
        self.assertNotIn("not placed (provisional)", out.getvalue())
        for heading in ("=== SESSION aaaaaaaa", "--- SCREEN", "cannot be seen", "--- WHAT IT SAYS IT DRAWS", "--- THE PANE'S STATE", "--- THE CACHE ON DISK", "--- SAID LATELY", "--- CHECKS"):
            self.assertIn(heading, page)
        self.assertIn("review: state done · subject “commit abc1234: Add mean”", page)
        self.assertIn("reviews.json (written 60s ago): 1 review(s), oldest first", page)
        self.assertIn("ok aaaaaaaa's Deep review tab has the cache's 1 review(s)", page)


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

    def test_a_minimized_pane_is_a_note_and_its_strip_is_what_is_held_against_the_screen(self):
        told = state(self.now)
        told["session"]["panes"] = []
        told["shown"]["minimized"] = True
        told["shown"]["pane"] = None
        strip = ["▸ Backseat", "Play (2)", "Review", "Explain", "Growth", "Lessons", "Settings"]
        told["shown"]["band"] = {"at": self.now - 3000, "placement": "", "columns": 120, "texts": strip}
        s = session(state=told)
        found = jack.check_session(world([s], now=self.now), s, None)
        self.assertEqual(bad(found), [])
        self.assertTrue(any(level == jack.NOTE and "minimized" in text for level, text in found))
        # The strip is looked for on the screen, not the pane that is no longer there.
        on_screen = ["  ▸ Backseat  Play (2)  Review  Explain  Growth  Lessons  Settings  minimized", "❯ "]
        self.assertEqual(bad(jack.check_session(world([s], now=self.now), s, on_screen)), [])
        self.assertTrue(any("not on its screen" in text or "is not" in text for text in bad(jack.check_session(world([s], now=self.now), s, ["❯ "]))))

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


class StateWords(unittest.TestCase):
    # Claude Code's own rows, as `claude agents --json` gives them on 2.1.292: no `id` and no `short`.
    ROWS = [
        {"cwd": "/w", "kind": "interactive", "name": "", "pid": 1, "sessionId": "5825a346-2557-4f80-8cf4-7d8d239b4a33", "startedAt": 0, "status": "idle"},
        {"cwd": "/w", "kind": "background", "name": "", "pid": 2, "sessionId": "77aa0000-0000-4000-8000-000000000000", "startedAt": 0, "status": "idle", "id": "k3x"},
    ]

    def test_a_word_names_a_session_or_a_part(self):
        self.assertTrue(jack.names_a_session("5825", self.ROWS, []))
        self.assertTrue(jack.names_a_session("1788da52", self.ROWS, []))  # gone: read by its id from its log
        self.assertTrue(jack.names_a_session("k3x", self.ROWS, []))  # a background session's short id
        self.assertTrue(jack.names_a_session("bsd", self.ROWS, ["bsd"]))  # a tmux session's name
        for part in ("lease", "deadlines", "shown.pane.texts", "session", "mode"):
            self.assertFalse(jack.names_a_session(part, self.ROWS, ["bsd"]), part)

    def test_state_with_a_session_and_no_part(self):
        # The eleventh ui-truth pass's agent: `jack.py state <session>` crashed with KeyError: 'id' (2026-10-07).
        seen: dict = {}
        with mock.patch.object(jack, "claude_sessions", return_value=self.ROWS), mock.patch.object(jack, "tmux_panes", return_value=[]), \
                mock.patch.object(jack, "cmd_state", side_effect=lambda a: seen.update(session=a.session, path=a.path) or 0):
            self.assertEqual(jack.main(["state", "5825"]), 0)
            self.assertEqual(seen, {"session": "5825", "path": None})
            self.assertEqual(jack.main(["state", "lease"]), 0)
            self.assertEqual(seen, {"session": None, "path": "lease"})
            self.assertEqual(jack.main(["state", "5825", "mode"]), 0)
            self.assertEqual(seen, {"session": "5825", "path": "mode"})


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
