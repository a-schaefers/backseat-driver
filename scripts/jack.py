#!/usr/bin/env python3
"""jack in: eyes and ears on a RUNNING Backseat Driver.

The owner, 2026-10-05: "give yourself eyes to see what I see, while the
ability to introspect the code and logs at will and hear from the program
verbosely telling you what it also claims and thinks it is doing, then when
what you see differs from what it SAYS you are able to dive in and fix."

Three accounts of one session are put side by side:

  SAYS   what the tutor believes: the state it writes beside its debug log
         (mode, lease, deadlines, the pieces of text it last drew and where),
         and what it tells every other session in the data folder.
  DID    what it did: the debug log, every git call, file, model request and
         answer, in order.
  IS     what is so, read from outside it: the screen as the person sees it,
         the files on disk, the processes that are running.

Every line that starts with `!!` is a place where they disagree. That is
where to look.

    scripts/jack.py                 one screen: every session, what each says, what is so
    scripts/jack.py in              switch the debug log on in every running session (they
                                    notice within ten seconds), wait for them, then the screen
    scripts/jack.py out             switch it off again, when `in` switched it on
    scripts/jack.py screen [S]      the screen of a session, as the person sees it
    scripts/jack.py truth [S]       every check, passed or not
    scripts/jack.py watch [S]       follow: screen changes, log records and new disagreements
                                    as they happen, one line each (for Monitor or a background shell)
    scripts/jack.py log [S] [-n N] [-k kinds] [--grep text] [--full]
    scripts/jack.py model [S] [N]   exactly what a model call was given and what it answered
    scripts/jack.py state [S] [path]  the tutor's own state, or one part: `state lease`, `state shown.pane.texts`
    scripts/jack.py files           the data folder, with ages
    scripts/jack.py ps              every process that matters, and whose it is
    scripts/jack.py sync            bring the live copy the owner's sessions load up to the working
                                    copy (local/live/plugin), when the tutor is between things, and
                                    watch them come back up. A save under plugin/ alone reloads nothing of theirs
    scripts/jack.py tour [S]        drive a session in tmux as a person would, and check after every step
    scripts/jack.py keys S <keys>   type into a session in tmux (`keys bsd /backseat Enter`). Only when asked to.

S names a session: the start of its id, its tmux session's name, or the short
id `claude agents` gives a background one. Left out, it is the one session
with the tutor on, or else the one most lately busy.

Eyes: a session is seen when it runs inside tmux (exact), or in the
background under Claude Code's own daemon, where `claude logs` has its output
(a left arrow on an empty prompt sends any session there, and Enter opens it
again). A session in a plain terminal cannot be seen from outside: this says
so and checks the rest.

Reading is free and changes nothing. `in` and `out` write one small file in
the data folder, the same one `/backseat debug on` writes. `keys` types into
somebody's session: never without being asked. Nothing here calls a model.
"""

from __future__ import annotations

import argparse
import codecs
import fcntl
import functools
import json
import os
import pathlib
import re
import shlex
import struct
import subprocess
import sys
import tempfile
import termios
import time
from datetime import datetime

REPO = pathlib.Path(__file__).resolve().parents[1]
FOLDER = "backseat-driver"
PLUGIN = "backseat-driver"
PANE_ID = "backseat-driver"

# The tutor's own numbers (kernel/src/Kernel/Lease.purs, Sessions.purs; plugin/core/editors.ts).
# scripts/test_jack.py holds them to the source.
LEASE_TTL_MS = 60_000
LEASE_BEAT_MS = 20_000
EDITOR_TTL_MS = 60_000
SELF_CHECK_MS = 10_000
ALIVE_MS = 660_000
# A state file older than this, with the log on, is a session whose timers do not run.
STATE_STALE_MS = 3 * SELF_CHECK_MS
# A session with the tutor on has had this long since its load to arm its look at itself (`self`).
SELF_GRACE_MS = 15_000
# A tab opened this long ago has had its pane scrolled back to the top by the tutor.
TAB_SETTLE_MS = 2_000
# What the tutor holds of the time in the editor is up to a slice of attention (2 min) and a journal write (30 s) ahead of the file.
WORKING_SLACK_MS = 150_000
# A commit of the person's own this old with no review must be accounted for by the Growth tab.
HEAD_GRACE_MS = 20 * 60_000
# How much of a process's output Claude Code keeps (`$.process.run`, `isStdoutTruncated`): a patch past it is read in part.
OUTPUT_CAP = 4 * 1024 * 1024
# How many of a record's latest assessed commits are measured against that cap.
ASSESSED_MEASURED = 5
# A deadline this far past its time has not been met.
OVERDUE_MS = 15_000
# After a reload the watchers are killed and started again: this long, a mismatch with the processes is that.
WATCHERS_GRACE_MS = 5_000
# A session that does not drive takes the project folder up at every beat of the lease: its pane may be a beat
# behind the files. The driver writes them itself, and reads the shared ones from its scan within a few seconds.
FOLLOW_GRACE_MS = LEASE_BEAT_MS + 5_000
DRIVER_GRACE_MS = 5_000
SHARED_GRACE_MS = 15_000
# What the pane calls the first look around a project, which reviews nothing and is kept in project.json, not reviews.json (plugin/core/review.ts).
SURVEY_SUBJECT = "a first look around this project"
# What the pane calls an audit of the codebase for issues, kept in reviews.json under no commit (plugin/core/review.ts).
AUDIT_SUBJECT = "an audit of this project"
# How bad an issue is, worst first (plugin/core/findings.ts `SEVERITIES`): the Deep review tab ranks by it.
SEVERITIES = ("critical", "high", "medium", "low")
# The driver takes another session's change to the ledger up at its next look at the shared files, at most every
# SHARED_CHECK_MS from its scan (plugin/hooks/register.tsx), which a watched tree spaces PUSHED_SCAN_MS apart
# (Kernel.Sensor); a session that does not drive, at its next beat of the lease.
SHARED_CHECK_MS = 5_000
PUSHED_SCAN_MS = 30_000
LEDGER_GRACE_MS = PUSHED_SCAN_MS + SHARED_CHECK_MS + 5_000
# How many issues the Play-by-play tab shows from the deep review, and the heading on the Deep review tab over what the
# play-by-play raised (plugin/hooks/pane.tsx `PLAY_PICKS`, `RAISED_HEADING`).
PLAY_PICKS = 3
RAISED_HEADING = "Raised while you worked"
# How long the spot in focus is checked ten times a second after an editor's caret moved (plugin/core/following.ts).
EDITOR_LIVE_MS = 600_000
# A line that opens with a comment (plugin/core/noise.ts `COMMENT`): code commented out.
COMMENT_LINE = re.compile(r"^(//|#|/\*|\*|--|<!--|;|%)")
# The lines the empty play-by-play draws about the ledger (plugin/core/findings.ts `ledgerLine`): one of them, always.
LEDGER_LINE_STARTS = ("Open in the deep review: ", "The audit found nothing open", "The audit has not finished", "Not audited for issues yet.")
# The bar for a first placement (plugin/core/progress.ts): a level on a record under it is one the rules no longer support.
PLACE_OBSERVATIONS = 8
PLACE_COMMITS = 3
PLACE_LINES = 80
# The spinner's marks behind a tab at work (plugin/hooks/pane.tsx `SPINNER`), bare after the tab's name: a drawing and a screen
# caught a tick apart differ only there.
SPINNER = "·✢✳✶✻✽"
# The first pieces of a drawing are the six tabs: the top of the pane, which is never below the fold.
HEAD_PIECES = 6
# Claude Code docks a pane at the side from this many columns (CLAUDE.md, "Handoff"); under it the pane goes above the prompt.
DOCK_COLUMNS = 110
# The owner's sessions load this copy of `plugin/` (their `claude` adds `--plugin-dir` for it), which `sync` brings up
# to the working copy when a change is ready: a save in `plugin/` alone reloads nothing of theirs. Git-ignored (local/).
LIVE = REPO / "local" / "live" / "plugin"
# What the live copy does without: never loaded, or written by Claude Code itself.
LIVE_SKIP = ("tests", "node_modules", ".claude-plugin/types")

BAD = "!!"
FINE = "ok"
NOTE = "··"


# ------------------------------------------------------------------ small things ----
def now_ms() -> int:
    return int(time.time() * 1000)


def ago(ms: float | None) -> str:
    if ms is None:
        return "?"
    s = int(max(0, ms) / 1000)
    if s < 90:
        return f"{s}s"
    if s < 5400:
        return f"{s // 60}m"
    if s < 172800:
        return f"{s // 3600}h{(s % 3600) // 60:02d}m"
    return f"{s // 86400}d{(s % 86400) // 3600}h"


def day_clock(ms: float | None, now: int | None = None) -> str:
    """A moment as the person reads it beside today's clock: today's by its time, another day's with its day (the
    pane's `dayTime`): a review of the night before read as tonight's (the fifth ui-truth pass, 2026-10-06)."""
    if not isinstance(ms, (int, float)):
        return "?"
    then = datetime.fromtimestamp(ms / 1000)
    today = datetime.fromtimestamp((now if now is not None else now_ms()) / 1000)
    time_ = then.strftime("%H:%M:%S")
    if then.date() == today.date():
        return time_
    if (today.date() - then.date()).days == 1:
        return f"yesterday {time_}"
    return then.strftime("%b %-d, ") + time_


def clock(ms: float | None) -> str:
    if not ms:
        return "—"
    return datetime.fromtimestamp(ms / 1000).strftime("%H:%M:%S")


def short(session_id: str) -> str:
    """A session's id as its debug folder and every log record name it."""
    return re.sub(r"[^A-Za-z0-9]", "", session_id or "")[:8] or "session"


def read_json(path: pathlib.Path):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return None


def mtime_ms(path: pathlib.Path) -> float | None:
    try:
        return path.stat().st_mtime * 1000
    except OSError:
        return None


def run(argv: list[str], timeout: float = 15, **kw) -> tuple[int, str, str]:
    try:
        p = subprocess.run(argv, capture_output=True, text=True, timeout=timeout, **kw)
        return p.returncode, p.stdout, p.stderr
    except (OSError, subprocess.TimeoutExpired) as e:
        return 127, "", f"{type(e).__name__}: {e}"


def tilde(path: str) -> str:
    home = str(pathlib.Path.home())
    return "~" + path[len(home):] if path == home or path.startswith(home + "/") else path


def dig(value, path: str):
    """`a.b.0.c` into nested dicts and lists, or None."""
    for part in [p for p in path.split(".") if p]:
        if isinstance(value, dict):
            value = value.get(part)
        elif isinstance(value, list) and part.lstrip("-").isdigit() and -len(value) <= int(part) < len(value):
            value = value[int(part)]
        else:
            return None
    return value


# ------------------------------------------------------------------ the data folder ----
def data_home(env: dict[str, str]) -> pathlib.Path | None:
    """Where a process with this environment keeps the tutor's files (plugin/core/datahome.ts)."""
    if env.get("BACKSEAT_DRIVER_HOME", "").strip():
        return pathlib.Path(env["BACKSEAT_DRIVER_HOME"].strip().rstrip("/") or "/")
    if env.get("XDG_DATA_HOME", "").strip():
        return pathlib.Path(env["XDG_DATA_HOME"].strip().rstrip("/")) / FOLDER
    home = env.get("HOME", "").strip() or env.get("USERPROFILE", "").strip()
    return pathlib.Path(home.rstrip("/")) / ".local/share" / FOLDER if home else None


def code_units(text: str) -> list[int]:
    """The string as JavaScript reads it: UTF-16 code units."""
    units = text.encode("utf-16-le")
    return [units[i] | (units[i + 1] << 8) for i in range(0, len(units), 2)]


def fnv(text: str) -> str:
    """plugin/core/hash.ts `shortHash`: FNV-1a over the string's UTF-16 code units."""
    h = 0x811C9DC5
    for unit in code_units(text):
        h ^= unit
        h = (h * 0x01000193) & 0xFFFFFFFF
    return f"{h:08x}"


def mix(text: str) -> str:
    """plugin/core/hash.ts `mix`: a second 32 bits, mixed the way MurmurHash3 mixes, over the UTF-16 code units."""
    units = code_units(text)
    h = 0x9747B28C
    for unit in units:
        unit = (unit * 0xCC9E2D51) & 0xFFFFFFFF
        unit = ((unit << 15) | (unit >> 17)) & 0xFFFFFFFF
        h ^= (unit * 0x1B873593) & 0xFFFFFFFF
        h = ((h << 13) | (h >> 19)) & 0xFFFFFFFF
        h = (h * 5 + 0xE6546B64) & 0xFFFFFFFF
    h ^= len(units)
    h ^= h >> 16
    h = (h * 0x85EBCA6B) & 0xFFFFFFFF
    h ^= h >> 13
    h = (h * 0xC2B2AE35) & 0xFFFFFFFF
    return f"{(h ^ (h >> 16)) & 0xFFFFFFFF:08x}"


def split_source(text: str) -> list[str]:
    """plugin/core/knowledge.ts `splitSource`: lines however they end, without a trailing empty one."""
    lines = text.split("\n")
    if lines and lines[-1] == "":
        lines.pop()
    return [line[:-1] if line.endswith("\r") else line for line in lines]


def source_print(text: str) -> str:
    """plugin/core/knowledge.ts `sourcePrint`: the fingerprint of a whole file's text, however its lines end. What the
    Explain cache and the kept notes are held to; scripts/test_jack.py holds it to values from the mod's own hash."""
    joined = "\n".join(split_source(text))
    return fnv(joined) + mix(joined)


def safe_name(text: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._+-]+", "_", text.strip())
    cleaned = re.sub(r"\.{2,}", ".", cleaned)
    cleaned = re.sub(r"^\.+", "", cleaned)[:60]
    return cleaned or "_"


def project_id(repo_root: str) -> str:
    root = repo_root.rstrip("/") if len(repo_root) > 1 else repo_root
    return f"{safe_name(root.split('/')[-1])}-{fnv(root)}"


def projects(home: pathlib.Path) -> list[dict]:
    out = []
    for folder in sorted((home / "projects").glob("*")):
        if not folder.is_dir():
            continue
        known = read_json(folder / "project.json") or {}
        notes = read_json(folder / "notes.json") or {}
        queue = read_json(folder / "queue.json")
        reviews = read_json(folder / "reviews.json")
        journal = read_json(folder / "journal.json")
        findings = read_json(folder / "findings.json")
        out.append({
            "id": folder.name,
            "dir": folder,
            "root": known.get("root", ""),
            "lease": read_json(folder / "lease.json") or {},
            "lease_at": mtime_ms(folder / "lease.json"),
            "notes": notes.get("notes", []) if isinstance(notes, dict) else [],
            "dismissed": notes.get("dismissed", []) if isinstance(notes, dict) else [],
            "notes_at": mtime_ms(folder / "notes.json"),
            "queue": queue,
            "queue_at": mtime_ms(folder / "queue.json"),
            "reviews": [r for r in reviews if isinstance(r, dict)] if isinstance(reviews, list) else [],
            "survey": known.get("survey") if isinstance(known.get("survey"), dict) else None,
            "project_at": mtime_ms(folder / "project.json"),
            "reviews_at": mtime_ms(folder / "reviews.json"),
            "journal": journal if isinstance(journal, dict) else {},
            "journal_at": mtime_ms(folder / "journal.json"),
            "findings": findings if isinstance(findings, dict) else None,
            "findings_at": mtime_ms(folder / "findings.json"),
            "is_audited": known.get("isAudited") is True,
        })
    return out


def editors(home: pathlib.Path) -> list[dict]:
    out = []
    for f in sorted((home / "editors").glob("*.json")):
        data = read_json(f) or {}
        pid = data.get("pid")
        out.append({
            "name": f.name,
            "data": data,
            "at": data.get("at") or mtime_ms(f),
            "alive": isinstance(pid, int) and pathlib.Path(f"/proc/{pid}").exists(),
        })
    return out


def is_under(path: str, root: str) -> bool:
    return bool(root) and (path == root or path.startswith(root.rstrip("/") + "/"))


def editors_here(found: list[dict], root: str, now: int) -> list[dict]:
    """The editors the tutor would call connected to this project (plugin/core/editors.ts `connectedHere`)."""
    here = []
    for e in found:
        d = e["data"]
        if not isinstance(d.get("at"), (int, float)) or now - d["at"] > EDITOR_TTL_MS:
            continue
        opened = [d.get("file", "")] + [b for b in d.get("buffers", []) if isinstance(b, str)]
        if any(is_under(path, root) for path in opened if path):
            here.append(e)
    return here


# ------------------------------------------------------------------ the debug log ----
def debug_dir(home: pathlib.Path, session_id: str) -> pathlib.Path | None:
    found = sorted((home / "debug").glob(f"*-{short(session_id)}"))
    return found[-1] if found else None


def log_records(folder: pathlib.Path | None, since_seq: tuple[str, int] | None = None) -> list[dict]:
    """Every record of one session's log, oldest first. A chunk is written again as it grows, so a
    line that does not parse is one caught mid-write: it is left for the next reading."""
    if folder is None:
        return []
    out = []
    for chunk in sorted(folder.glob("*.jsonl")):
        if since_seq is not None and chunk.name < since_seq[0]:
            continue
        try:
            lines = chunk.read_text().split("\n")
        except OSError:
            continue
        for index, line in enumerate(lines):
            if not line:
                continue
            if since_seq is not None and chunk.name == since_seq[0] and index < since_seq[1]:
                continue
            try:
                record = json.loads(line)
            except ValueError:
                break
            record["_at"] = (chunk.name, index + 1)
            out.append(record)
    return out


def brief(value, width: int = 150) -> str:
    """A record's details in one line."""
    if value is None:
        return ""
    text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, separators=(", ", ": "))
    text = re.sub(r"\s+", " ", text)
    return text if len(text) <= width else text[: width - 1] + "…"


def record_line(r: dict, width: int = 150, with_session: bool = False) -> str:
    took = f" {r['ms']}ms" if isinstance(r.get("ms"), (int, float)) and r["ms"] >= 1 else ""
    who = f" {r.get('s', '')}" if with_session else ""
    return f"{clock(r.get('t'))}{who} {r.get('k', '?')}/{r.get('n', '?')}{took}  {brief(r.get('d'), width)}".rstrip()


# ------------------------------------------------------------------ processes ----
def all_procs() -> dict[int, dict]:
    out: dict[int, dict] = {}
    for p in pathlib.Path("/proc").iterdir():
        if not p.name.isdigit():
            continue
        try:
            argv = [a.decode(errors="replace") for a in (p / "cmdline").read_bytes().split(b"\0") if a]
            stat = (p / "stat").read_text().rsplit(")", 1)[1].split()
            out[int(p.name)] = {"pid": int(p.name), "ppid": int(stat[1]), "argv": argv, "state": stat[0]}
        except (OSError, IndexError, ValueError):
            continue
    return out


def environ(pid: int) -> dict[str, str]:
    try:
        raw = pathlib.Path(f"/proc/{pid}/environ").read_bytes().split(b"\0")
    except OSError:
        return {}
    env = {}
    for item in raw:
        key, _, value = item.decode(errors="replace").partition("=")
        if key:
            env[key] = value
    return env


def cwd_of(pid: int) -> str:
    try:
        return os.readlink(f"/proc/{pid}/cwd")
    except OSError:
        return ""


def tty_of(pid: int) -> str:
    try:
        target = os.readlink(f"/proc/{pid}/fd/0")
    except OSError:
        return ""
    return target if target.startswith("/dev/pts/") or target.startswith("/dev/tty") else ""


def tty_size(tty: str) -> tuple[int, int] | None:
    """(columns, rows) of a terminal, asked of the terminal itself."""
    try:
        fd = os.open(tty, os.O_RDONLY | os.O_NOCTTY | os.O_NONBLOCK)
    except OSError:
        return None
    try:
        rows, cols, _, _ = struct.unpack("HHHH", fcntl.ioctl(fd, termios.TIOCGWINSZ, b"\0" * 8))
        return (cols, rows) if cols and rows else None
    except OSError:
        return None
    finally:
        os.close(fd)


def ancestors(pid: int, procs: dict[int, dict]) -> list[int]:
    out = []
    seen = set()
    while pid in procs and pid not in seen:
        seen.add(pid)
        pid = procs[pid]["ppid"]
        out.append(pid)
    return out


def children(pid: int, procs: dict[int, dict]) -> list[int]:
    kids = [p for p, info in procs.items() if info["ppid"] == pid]
    return kids + [g for k in kids for g in children(k, procs)]


# ------------------------------------------------------------------ sessions ----
def default_config() -> str:
    return os.environ.get("CLAUDE_CONFIG_DIR") or str(pathlib.Path.home() / ".claude")


def config_dirs(procs: dict[int, dict] | None = None) -> list[str]:
    """Every Claude Code config folder in use on this machine: this one's, and each running `claude`'s. Claude Code
    lists only the sessions of its own config folder, so a session started with another one (a dev session's, say)
    is found through its process."""
    found = [default_config()]
    for pid, info in (procs if procs is not None else all_procs()).items():
        if not info["argv"] or not pathlib.Path(info["argv"][0]).name.startswith("claude"):
            continue
        env = environ(pid)
        config = env.get("CLAUDE_CONFIG_DIR") or (str(pathlib.Path(env["HOME"]) / ".claude") if env.get("HOME") else "")
        if config and config not in found:
            found.append(config)
    return found


def claude_env(config: str) -> dict[str, str]:
    return {**os.environ, "CLAUDE_CONFIG_DIR": config}


def claude_sessions(procs: dict[int, dict] | None = None) -> list[dict]:
    """Every Claude Code session on this machine, as Claude Code lists them: interactive and background, under
    every config folder in use. Each row says which (`config`)."""
    rows: list[dict] = []
    seen: set[tuple] = set()
    for config in config_dirs(procs):
        code, out, _ = run(["claude", "agents", "--json"], timeout=30, cwd="/", env=claude_env(config))
        try:
            listed = json.loads(out) if code == 0 else []
        except ValueError:
            listed = []
        for r in listed:
            if not isinstance(r, dict) or not r.get("sessionId") or (r.get("pid"), r["sessionId"]) in seen:
                continue
            seen.add((r.get("pid"), r["sessionId"]))
            rows.append({**r, "config": config})
    return rows


# A word given to `state` that reads as the start of a session id: four or more hex digits. No part of the state does.
SESSION_WORD = re.compile(r"[0-9a-f]{4}[0-9a-f-]{0,32}")


def names_a_session(name: str, rows: list[dict], tmux_names: list[str]) -> bool:
    """Whether a word given to `state` names a session rather than a part of its state (`jack.py state lease`): the
    start of a session's id, running or gone (a gone one is read from its log), a background session's short id, or
    a tmux session's name. Until 2026-10-07 the check read `id` and `short` off Claude Code's own rows, which carry
    neither, so `state <session>` with no part crashed (`KeyError: 'id'`, found by the eleventh ui-truth pass's
    agent on its way out), and a gone session's id would have been taken for a part."""
    if SESSION_WORD.fullmatch(name) or name in tmux_names:
        return True
    return any(isinstance(r, dict) and (str(r.get("sessionId") or "").startswith(name) or r.get("id") == name) for r in rows)


def roster(config: str | None = None) -> dict:
    """Claude Code's own record of its background sessions: which terminal each has, and how big."""
    found = read_json(pathlib.Path(config or default_config()) / "daemon" / "roster.json") or {}
    return found.get("workers", {}) if isinstance(found, dict) else {}


def plugin_dirs(argv: list[str]) -> list[str]:
    out = []
    for i, word in enumerate(argv):
        if word == "--plugin-dir" and i + 1 < len(argv):
            out.append(argv[i + 1])
        elif word.startswith("--plugin-dir="):
            out.append(word.split("=", 1)[1])
    return out


def settings_env(argv: list[str]) -> dict[str, str]:
    """The `env` block of the settings a session was started with. Claude Code's daemon starts a background
    session with its own environment and the session's flags, so this is all that reaches such a session."""
    env: dict[str, str] = {}
    for i, word in enumerate(argv):
        value = argv[i + 1] if word == "--settings" and i + 1 < len(argv) else (word.split("=", 1)[1] if word.startswith("--settings=") else None)
        if value is None:
            continue
        try:
            given = json.loads(value) if value.lstrip().startswith("{") else json.loads(pathlib.Path(value).read_text())
        except (OSError, ValueError):
            continue
        if isinstance(given, dict) and isinstance(given.get("env"), dict):
            env.update({str(k): str(v) for k, v in given["env"].items()})
    return env


def plugin_source(argv: list[str]) -> str:
    """Which copy of the tutor a session runs: a working copy given with --plugin-dir, or the installed one."""
    for folder in plugin_dirs(argv):
        manifest = read_json(pathlib.Path(folder) / ".claude-plugin" / "plugin.json") or {}
        if manifest.get("name") == PLUGIN:
            return folder
    return "installed"


# The tutor reads the debug switch every ten seconds under this name (plugin/core/debugging.ts), which is what lets
# `in` start a session's log from outside. A copy of the plugin without it (0.1.0 as installed on 2026-10-05) reads
# the switch only at switch-on and on a reload, writes no state before that, and says nothing in sessions.json: of
# such a session jack sees the screen and the files, and not what it believes. scripts/test_jack.py holds the name.
FOLLOWS_SWITCH = "followSwitch"


def plugin_copy(source: str, config: str) -> dict:
    """The copy of the plugin a session runs: its folder, version and commit, and whether it can say what it
    believes (`can_say`: it follows the debug switch; None when its folder is not known). `source` is a working
    copy's folder, or "installed", whose folder is in the config folder's installed_plugins.json."""
    folder, version, commit = "", "", ""
    if source not in ("installed", "?", ""):
        folder = source
    else:
        book = read_json(pathlib.Path(config or default_config()) / "plugins" / "installed_plugins.json") or {}
        for key, entries in (book.get("plugins") or {}).items() if isinstance(book.get("plugins"), dict) else []:
            if str(key).partition("@")[0] == PLUGIN and isinstance(entries, list) and entries and isinstance(entries[0], dict):
                folder = str(entries[0].get("installPath") or "")
                version = str(entries[0].get("version") or "")
                commit = str(entries[0].get("gitCommitSha") or "")[:7]
                break
    if folder and not version:
        version = str((read_json(pathlib.Path(folder) / ".claude-plugin" / "plugin.json") or {}).get("version") or "")
    can_say = None
    if folder:
        sources = [pathlib.Path(folder) / "core" / "debugging.ts", pathlib.Path(folder) / "hooks" / "register.tsx"]
        can_say = any(FOLLOWS_SWITCH in p.read_text(errors="replace") for p in sources if p.is_file())
    return {"folder": folder, "version": version, "commit": commit, "can_say": can_say}


def live_files(root: pathlib.Path) -> dict[str, pathlib.Path]:
    """The files of a plugin folder that a session loads, by their path inside it."""
    found: dict[str, pathlib.Path] = {}
    for path in root.rglob("*") if root.is_dir() else []:
        rel = path.relative_to(root).as_posix()
        if path.is_file() and not any(rel == skip or rel.startswith(skip + "/") for skip in LIVE_SKIP):
            found[rel] = path
    return found


def live_diff(source: pathlib.Path, live: pathlib.Path) -> list[str]:
    """The files in which a live copy differs from the working copy's `plugin/`: changed, new, or gone."""
    ours, theirs = live_files(source), live_files(live)
    differing = []
    for rel in sorted(set(ours) | set(theirs)):
        a, b = ours.get(rel), theirs.get(rel)
        if a is None or b is None or a.stat().st_size != b.stat().st_size or a.read_bytes() != b.read_bytes():
            differing.append(rel)
    return differing


def is_busy(state: dict | None) -> str:
    """What a session's tutor is in the middle of that a reload would cut short, or '' when nothing."""
    if not isinstance(state, dict):
        return ""
    play = dig(state, "pane.watch.state")
    if play in ("looking", "settling"):
        return "a look is " + ("running" if play == "looking" else "about to start")
    if dig(state, "pane.review.state") == "running":
        return "an audit is running" if dig(state, "pane.review.subject") == AUDIT_SUBJECT else "a deep review is running"
    if dig(state, "pane.progress.busy"):
        return "a look at progress is running"
    return ""


def copy_label(s: dict) -> str:
    """The copy a session runs, in a few words: `working copy`, `live copy`, or `installed 0.1.0 (46ce6bb)`."""
    if s.get("plugin") == "?":
        return "an unknown copy"
    if s.get("plugin") not in (None, "installed"):
        return "live copy" if pathlib.Path(str(s["plugin"])) == LIVE else "working copy"
    copy = s.get("copy") or {}
    words = ["installed", copy.get("version") or "", f"({copy['commit']})" if copy.get("commit") else ""]
    return " ".join(w for w in words if w)


def cannot_say(s: dict) -> bool:
    """Whether a session runs a copy of the plugin from before the tutor could be asked what it believes."""
    return (s.get("copy") or {}).get("can_say") is False


def behind(commit: str) -> int | None:
    """How many commits of this working copy an installed copy's commit is behind, when it is known here."""
    if not commit:
        return None
    code, out, _ = run(["git", "-C", str(REPO), "rev-list", "--count", f"{commit}..HEAD"], timeout=5)
    return int(out.strip()) if code == 0 and out.strip().isdigit() else None


def tmux_folder() -> pathlib.Path:
    return pathlib.Path(os.environ.get("TMUX_TMPDIR") or "/tmp") / f"tmux-{os.getuid()}"


def sweep_replays() -> None:
    """Removes the sockets of replay servers (`bsd-jack-replay-<pid>`) whose run of the tool is gone: tmux leaves
    the socket behind when its server is killed, and a run that was killed itself never got to remove it."""
    folder = tmux_folder()
    for p in folder.glob("bsd-jack-replay-*") if folder.is_dir() else []:
        pid = p.name.rsplit("-", 1)[-1]
        if not pid.isdigit() or int(pid) == os.getpid():
            continue
        try:
            os.kill(int(pid), 0)
        except ProcessLookupError:
            try:
                p.unlink()
            except OSError:
                pass
        except OSError:
            pass


def tmux_sockets() -> list[str]:
    sweep_replays()
    folder = tmux_folder()
    found = [str(p) for p in folder.glob("*") if p.is_socket()] if folder.is_dir() else []
    return sorted(found)


def tmux_panes() -> list[dict]:
    panes = []
    for sock in tmux_sockets():
        if "bsd-jack-replay" in sock:
            continue
        code, out, _ = run(["tmux", "-S", sock, "list-panes", "-a", "-F", "#{pane_pid}\t#{session_name}\t#{pane_id}\t#{pane_width}\t#{pane_height}"], timeout=5)
        if code != 0:
            continue
        for line in out.splitlines():
            parts = line.split("\t")
            if len(parts) == 5 and parts[0].isdigit():
                panes.append({"sock": sock, "pid": int(parts[0]), "name": parts[1], "pane": parts[2], "cols": int(parts[3]), "rows": int(parts[4])})
    return panes


def eyes_for(pid: int, session_id: str, procs: dict[int, dict], panes: list[dict], workers: dict) -> dict | None:
    """How a session's screen can be read from outside, or None when it cannot."""
    line = [pid] + ancestors(pid, procs)
    for pane in panes:
        if pane["pid"] in line:
            return {"kind": "tmux", **pane}
    for name, worker in workers.items():
        if worker.get("sessionId") == session_id or worker.get("replPid") == pid:
            size = tty_size(tty_of(pid)) or (dig(worker, "dispatch.cols") or 120, dig(worker, "dispatch.rows") or 40)
            return {"kind": "background", "short": name, "cols": int(size[0]), "rows": int(size[1]), "config": worker.get("_config")}
    return None


def eyes_label(eyes: dict | None) -> str:
    if eyes is None:
        return "none (a plain terminal)"
    if eyes["kind"] == "tmux":
        return f"tmux {eyes['name']} {eyes['cols']}x{eyes['rows']}"
    return f"claude logs {eyes['short']} {eyes['cols']}x{eyes['rows']}"


def replay(raw: bytes, cols: int, rows: int) -> list[str]:
    """What a terminal of that size shows after it was sent `raw`: tmux is the terminal."""
    sock = f"bsd-jack-replay-{os.getpid()}"
    with tempfile.NamedTemporaryFile(prefix="bsd-jack-", suffix=".raw", delete=False) as f:
        f.write(raw)
        path = f.name
    try:
        script = f"cat {shlex.quote(path)}; tmux -L {sock} wait-for -S shown; sleep 20"
        code, _, err = run(["tmux", "-L", sock, "-f", "/dev/null", "new-session", "-d", "-s", "r", "-x", str(cols), "-y", str(rows), script], timeout=10)
        if code != 0:
            return [f"(could not replay the terminal output: {err.strip()})"]
        run(["tmux", "-L", sock, "wait-for", "shown"], timeout=10)
        _, out, _ = run(["tmux", "-L", sock, "capture-pane", "-p", "-t", "r"], timeout=5)
        return out.split("\n")
    finally:
        run(["tmux", "-L", sock, "kill-server"], timeout=5)
        # tmux 3.6 leaves the socket behind after kill-server.
        for leftover in (path, str(tmux_folder() / sock)):
            try:
                os.unlink(leftover)
            except OSError:
                pass


def screen_of(eyes: dict | None) -> list[str] | None:
    """The rows on a session's screen right now, or None when it cannot be seen."""
    if eyes is None:
        return None
    if eyes["kind"] == "tmux":
        code, out, _ = run(["tmux", "-S", eyes["sock"], "capture-pane", "-p", "-t", eyes["pane"]], timeout=5)
        return out.split("\n") if code == 0 else None
    try:
        p = subprocess.run(["claude", "logs", eyes["short"]], capture_output=True, timeout=30, cwd="/", env=claude_env(eyes.get("config") or default_config()))
    except (OSError, subprocess.TimeoutExpired):
        return None
    return replay(p.stdout, eyes["cols"], eyes["rows"]) if p.returncode == 0 and p.stdout else None


# ------------------------------------------------------------------ reading a screen ----
BOX = "│┃|╭╮╰╯─━┌┐└┘├┤┬┴┼╌╎"


def squash(text: str) -> str:
    """Text as it is compared: frames and runs of space gone."""
    return re.sub(r"\s+", " ", text.translate({ord(c): " " for c in BOX})).strip()


def demark(text: str) -> str:
    """A line of Markdown as a terminal draws it: without the marks."""
    text = re.sub(r"^\s*(#{1,6}|[-*+>]|\d+[.)])\s+", "", text)
    return re.sub(r"(\*\*|__|`|\*)", "", text)


def divider(rows: list[str]) -> int | None:
    """The column of the line between the conversation and a pane docked beside it, or None."""
    counts: dict[int, int] = {}
    for row in rows:
        for col, char in enumerate(row):
            if char in "│┃" and 20 <= col < len(row) - 10:
                counts[col] = counts.get(col, 0) + 1
    if not counts:
        return None
    col, count = max(counts.items(), key=lambda item: item[1])
    return col if count >= max(6, len(rows) * 0.4) else None


def flows(rows: list[str]) -> list[str]:
    """The screen's text as runs to search in: the whole of it, and each side of a docked pane by itself, so
    that text wrapped inside the pane is not cut up by the conversation beside it."""
    out = [squash(" ".join(rows))]
    col = divider(rows)
    if col is not None:
        out.append(squash(" ".join(row[col + 1:] for row in rows)))
        out.append(squash(" ".join(row[:col] for row in rows)))
    return out


# How much of a piece's beginning is looked for on the screen.
HEAD_CHARS = 28
# A pane narrower than this cuts its rows short of that: a piece is looked for by what a row of it can hold.
NARROW_COLUMNS = 40


def piece_head(columns) -> int:
    """How many characters of a piece a row of the pane can hold: the owner's 23-column dock cut every long line to
    about fifteen characters and an ellipsis, and the tool took them for missing (the eighth ui-truth pass, 2026-10-06)."""
    if isinstance(columns, int) and 0 < columns < NARROW_COLUMNS:
        return max(8, columns - 10)
    return HEAD_CHARS


def is_on_screen(piece: str, where: list[str], head: int = HEAD_CHARS) -> bool:
    """Whether a piece of text the tutor says it drew is there. Long text is cut or wrapped by the
    terminal, so its beginning is what is looked for; one or two characters say too little to judge."""
    want = despin(squash(demark(piece)))
    if len(want) < 3:
        return True
    want = want[:head].rstrip()
    # The screen keeps the backticks of a note's code words as a plain Text draws them; the piece has them dropped: both sides alike.
    return any(want in despin(demark(flow)) for flow in where)


def quoted_pieces(pieces: list[str], shown: int = 3) -> str:
    """Pieces of a drawing named for a reader: the first few quoted, and how many more. The scrolled-pane note said
    "the tabs and the status line" whatever was missing (the twelfth ui-truth pass, 2026-10-07)."""
    quoted = ", ".join(f"“{p[:30]}”" for p in pieces[:shown])
    return quoted + (f" and {len(pieces) - shown} more" if len(pieces) > shown else "")


def missing_pieces(texts: list[str], rows: list[str], chars: int = HEAD_CHARS) -> tuple[list[str], list[str]]:
    """The pieces not on the screen: those from the top of the drawing, and the rest."""
    where = flows(rows)
    head = [t for t in texts[:HEAD_PIECES] if not is_on_screen(t, where, chars)]
    rest = [t for t in texts[HEAD_PIECES:] if not is_on_screen(t, where, chars)]
    return head, rest


# The last row of the pane says where the keyboard is and how the pane is driven: the word, and how its hint ends
# (plugin/hooks/pane.tsx `KEYBOARD_HINT`, `FOCUSED_HINT`).
KEYS_HINTS = {"Keys off": "to use the keys.", "Keys on": "back to the prompt."}


def check_keys_row(who: str, texts: list[str], rows: list[str]) -> list[tuple[str, str]]:
    """The keys row's hint, whole on the screen: a drawing with the word for where the keyboard is must show the end
    of the hint after it too, wrapped or not. A 46-column dock cut it to "Click here or press Ctr…" and the screen
    check let it pass, the hint being past the pieces it holds whole (the first ui-truth pass, 2026-10-06)."""
    where = flows(rows)
    for word, tail in KEYS_HINTS.items():
        if word in texts and is_on_screen(word, where):
            if not any(tail in flow for flow in where):
                return [(BAD, f"{who}'s keys row is cut: “{word}” is on the screen and the hint after it does not end in “{tail}”: the person is not told how to use the keys")]
            return [(FINE, f"{who}'s keys row is whole: “{word}” and its hint")]
    return []


def squeezed_pieces(texts: list[str], rows: list[str], chars: int = HEAD_CHARS) -> list[str]:
    """The pieces missing from the screen while a later piece of the same drawing is on it: not below the fold, but
    squeezed out of the middle. Only pieces long enough to be told apart count, on either side."""
    where = flows(rows)
    found = [len(squash(demark(t))) >= 3 and is_on_screen(t, where, chars) for t in texts]
    last_found = max((i for i, ok in enumerate(found) if ok), default=-1)
    return [t for i, t in enumerate(texts) if i < last_found and not found[i] and len(squash(demark(t))) >= 3]


def pieces_below(texts: list[str], rows: list[str], chars: int = HEAD_CHARS) -> int:
    """How many pieces from below the top of the drawing are really on the screen: long enough to be told apart, and found."""
    where = flows(rows)
    return sum(1 for t in texts[HEAD_PIECES:] if len(squash(demark(t))) >= 3 and is_on_screen(t, where, chars))


def sides(rows: list[str]) -> dict[str, list[str]]:
    """The screen's rows by what they are of: the conversation and the pane beside it, or one screen."""
    col = divider(rows)
    if col is None:
        return {"screen": [row.rstrip() for row in rows]}
    return {"conversation": [row[:col].rstrip() for row in rows], "pane": [row[col + 1:].rstrip() for row in rows]}


VOLATILE = re.compile(r"(esc to interrupt|\(\d+s\b|\b\d+s ·|tokens\)|^\s*[✻✶✳✢✽·∗*]\s+\S+…)")


def steady(rows: list[str]) -> list[str]:
    """The rows that do not change by themselves: a spinner and a running clock are not news."""
    return [row.rstrip() for row in rows if not VOLATILE.search(row)]


# ------------------------------------------------------------------ the world ----
def world(home_override: str | None = None) -> dict:
    """Everything there is to see, read once."""
    now = now_ms()
    procs = all_procs()
    panes = tmux_panes()
    rows = claude_sessions(procs)
    # Each config folder's background sessions, each marked with the folder `claude logs` has to be asked under.
    workers = {name: {**worker, "_config": config} for config in dict.fromkeys(r["config"] for r in rows) for name, worker in roster(config).items()}
    default_home = pathlib.Path(home_override) if home_override else data_home(dict(os.environ))
    sessions = []
    for row in rows:
        pid = row.get("pid") if isinstance(row.get("pid"), int) else 0
        # A background session is a process the daemon had ready: its flags came to it afterwards, and are on record.
        worker = next((v for v in workers.values() if v.get("sessionId") == row["sessionId"]), {})
        flags = dig(worker, "dispatch.launch.flagArgs")
        argv = procs.get(pid, {}).get("argv", []) + ([str(flag) for flag in flags] if isinstance(flags, list) else [])
        env = {**environ(pid), **settings_env(argv)} if pid else {}
        home = pathlib.Path(home_override) if home_override else (data_home(env) if env else default_home)
        eyes = eyes_for(pid, row["sessionId"], procs, panes, workers) if pid else None
        folder = debug_dir(home, row["sessionId"]) if home else None
        state = read_json(folder / "state.json") if folder else None
        book = (read_json(home / "sessions.json") or {}).get("sessions", []) if home else []
        entry = next((e for e in book if isinstance(e, dict) and e.get("session") == row["sessionId"]), None)
        sessions.append({
            "id": row["sessionId"],
            "short": short(row["sessionId"]),
            "bg": row.get("id") or "",
            "pid": pid,
            "kind": row.get("kind", "?"),
            "status": row.get("status", "?"),
            "name": row.get("name", ""),
            "cwd": row.get("cwd") or cwd_of(pid),
            "home": home,
            "plugin": plugin_source(argv),
            "copy": plugin_copy(plugin_source(argv), row.get("config", "")),
            "eyes": eyes,
            "entry": entry,
            "debug": folder,
            "state": state if isinstance(state, dict) else None,
            "is_me": pid in ([os.getpid()] + ancestors(os.getpid(), procs)),
            "config": row.get("config", ""),
            "argv": argv,
        })
    homes = []
    for home in [default_home] + [s["home"] for s in sessions]:
        if home is not None and home not in homes and home.is_dir():
            homes.append(home)
    running = {s["id"] for s in sessions}
    gone = []
    for home in homes:
        for entry in (read_json(home / "sessions.json") or {}).get("sessions", []):
            if isinstance(entry, dict) and entry.get("session") and entry["session"] not in running:
                gone.append(ghost(home, str(entry["session"]), entry))
    return {"now": now, "procs": procs, "sessions": sessions, "gone": gone, "homes": homes, "panes": panes}


def ghost(home: pathlib.Path, session_id: str, entry: dict | None) -> dict:
    """A session that is not running, as the data folder remembers it: what it said, and its log."""
    folder = debug_dir(home, session_id)
    state = read_json(folder / "state.json") if folder else None
    return {
        "id": session_id, "short": short(session_id), "bg": "", "pid": 0, "kind": "gone", "status": "—", "name": "",
        "cwd": str((entry or {}).get("cwd", "")), "home": home, "plugin": "?", "copy": {"folder": "", "version": "", "commit": "", "can_say": None}, "eyes": None, "entry": entry,
        "debug": folder, "state": state if isinstance(state, dict) else None, "is_me": False, "config": "", "argv": [],
    }


def tutor_mode(s: dict) -> str:
    """What the tutor says its mode is in a session: from its own state, else from what it told the others."""
    if s["state"] is not None and isinstance(s["state"].get("mode"), str):
        return s["state"]["mode"]
    entry = s["entry"]
    if entry is not None and not entry.get("leftAt"):
        return str(entry.get("mode", "on"))
    return "off"


def pick(w: dict, name: str | None) -> dict | None:
    sessions = w["sessions"]
    if name:
        for s in sessions + w.get("gone", []):
            eyes = s["eyes"] or {}
            if s["id"].startswith(name) or s["short"].startswith(name) or s["bg"] == name or eyes.get("name") == name:
                return s
        # One that left nothing but its log.
        for home in w["homes"]:
            found = sorted((home / "debug").glob(f"*-{name}*"))
            if found and found[-1].is_dir():
                return ghost(home, found[-1].name.rsplit("-", 1)[-1], None) | {"debug": found[-1], "state": read_json(found[-1] / "state.json")}
        return None
    others = [s for s in sessions if not s["is_me"]]
    on = [s for s in others if tutor_mode(s) != "off"]
    if len(on) == 1:
        return on[0]
    ranked = sorted(on or others, key=lambda s: (s["status"] != "busy", -(mtime_ms(s["debug"] / "state.json") or 0) if s["debug"] else 0))
    return ranked[0] if ranked else None


# ------------------------------------------------------------------ the checks ----
def check_progress_files(home: pathlib.Path) -> list[tuple[str, str]]:
    """Each language's progress record, against itself: a report left under no level (the model's words for a placement
    since withdrawn stood under "Not placed yet": the third ui-truth pass, 2026-10-06), and a level that is not the one
    the history last reached (the history records levels reached, never one taken away)."""
    out: list[tuple[str, str]] = []
    for file in sorted((home / "progress").glob("*.json")):
        record = read_json(file)
        if not isinstance(record, dict):
            continue
        level = record.get("level")
        history = [h for h in (record.get("history") or []) if isinstance(h, dict)]
        report = record.get("report") if isinstance(record.get("report"), dict) else None
        withdrawn_at = record.get("withdrawnAt") or 0
        reached_at = (history[-1].get("at") or 0) if history else 0
        # A report under no level is the placement's when it was written after the level the history last reached and
        # before the withdrawal (or with no withdrawal on record, by a copy from before withdrawals were marked).
        is_stale = level is None and report is not None and history and (report.get("at") or 0) >= reached_at and (withdrawn_at == 0 or (report.get("at") or 0) < withdrawn_at)
        # Under no level, why a level and what the next needs are the model's words for a level the code did not give,
        # whether withdrawn since or never given (the seventh ui-truth pass, 2026-10-06: "To reach junior, …" under
        # "Not placed yet" at a first assessment). The tutor drops them as the record is written and as it is read.
        has_words = report is not None and bool(report.get("why") or report.get("next") or report.get("encouragement"))
        if is_stale:
            out.append((BAD, f"progress/{file.name} has no level and still the report of the placement withdrawn: the Growth tab would say “Not placed yet” over its words"))
        elif level is None and has_words:
            # Nothing draws or tells them since 2026-10-06, and a session with the language in play mends the file at
            # switch-on: until one does, the file keeps them, which is worth a note and no more.
            out.append((NOTE, f"progress/{file.name} has no level and keeps the model's words for the level it proposed (why, what the next level needs, or its praise): nothing shows them, and a session with {record.get('language') or 'the language'} in play mends the file at switch-on"))
        elif level and history and history[-1].get("to") != level:
            out.append((BAD, f"progress/{file.name} is at {level} and its history last reached {history[-1].get('to')}: a level the history does not account for"))
        else:
            out.append((FINE, f"progress/{file.name} is at {level or 'no level'}, as its history and report say"))
        # The lines read, against git: an older recount counted blank lines too, where every assessment counts the
        # non-blank ones (the seventeenth ui-truth pass, 2026-10-07: bashscripts' 31 read as 39).
        recount = lines_recount(home, record)
        said = record.get("linesRead") or 0
        if recount is not None and recount[0] != said:
            language = record.get("language") or file.stem
            if record.get("isLinesNonBlank") is True:
                out.append((BAD, f"progress/{file.name} has read {said} line(s), and its {len(record.get('assessed') or [])} assessed commit(s) add {recount[0]} non-blank line(s) of {language} in {tilde(recount[1])}: the bar is held against a count the rules do not make"))
            else:
                out.append((NOTE, f"progress/{file.name} has read {said} line(s), counted by an older recount with the blank ones; its assessed commits add {recount[0]} non-blank in {tilde(recount[1])}, and a session with {language} in play counts them again at switch-on"))
    return out


def marker_text() -> str:
    """What the data folder's marker says, as plugin/core/datahome.ts `MARKER_TEXT` writes it."""
    try:
        source = (REPO / "plugin" / "core" / "datahome.ts").read_text()
    except OSError:
        return ""
    m = re.search(r"export const MARKER_TEXT =\s*'((?:[^'\\]|\\.)*)'", source)
    return m.group(1).encode().decode("unicode_escape") if m else ""


def check_marker(home: pathlib.Path) -> list[tuple[str, str]]:
    """The data folder's marker against what the tutor writes now: one written before 2026-10-06 named /bsd forget, a
    command since gone, and was never written again (the twelfth ui-truth pass, 2026-10-07)."""
    try:
        said = (home / ".backseat-driver").read_text()
    except OSError:
        return []
    want = marker_text()
    if want and said != want:
        return [(NOTE, f"{tilde(str(home))}'s marker says “{brief(said, 80)}”, and the tutor writes “{brief(want, 80)}”: it is written again at the next switch-on")]
    return []


def check_editor_roots(home: pathlib.Path, now: int) -> list[tuple[str, str]]:
    """Each connected editor's `root` against git's: the Emacs plugin remembered "no repository" for a folder for good,
    and said no root for an hour after the owner made one under it (the ninth ui-truth pass, 2026-10-07)."""
    out: list[tuple[str, str]] = []
    for e in editors(home):
        d = e["data"]
        file = str(d.get("file") or "")
        if not e["alive"] or now - (e["at"] or 0) > EDITOR_TTL_MS or not file or not pathlib.Path(file).exists():
            continue
        top = (git_out(str(pathlib.Path(file).parent), "rev-parse", "--show-toplevel") or "").strip()
        said = str(d.get("root") or "")
        if top and said != top:
            out.append((NOTE, f"{d.get('editor')} (pid {d.get('pid')}) says {'no root' if not said else 'root ' + tilde(said)} for {tilde(file)}, and git says {tilde(top)}: the editor plugin remembers a folder's root from before, until it is restarted"))
    return out


def check_homes(w: dict) -> list[tuple[str, str]]:
    """What the data folder says, against which sessions are really there."""
    out: list[tuple[str, str]] = []
    now = w["now"]
    live = {s["id"]: s for s in w["sessions"]}
    for home in w["homes"]:
        out += check_progress_files(home)
        out += check_editor_roots(home, now)
        out += check_marker(home)
    for home in w["homes"]:
        for entry in (read_json(home / "sessions.json") or {}).get("sessions", []):
            if not isinstance(entry, dict) or entry.get("leftAt"):
                continue
            sid = str(entry.get("session", ""))
            said = now - (entry.get("at") or 0)
            if sid not in live and said <= ALIVE_MS:
                out.append((BAD, f"session {short(sid)} said {ago(said)} ago that the tutor is on ({entry.get('mode')}), in {tilde(str(entry.get('cwd', '')))}: no such session is running, and it said no goodbye"))
            elif sid in live and said > ALIVE_MS:
                out.append((BAD, f"session {short(sid)} is running and last said {ago(said)} ago that the tutor is on: it says so every five minutes, so its timers do not run"))
        for project in projects(home):
            lease = project["lease"]
            holder = str(lease.get("session", ""))
            if not holder:
                continue
            age = now - (lease.get("at") or 0)
            if age >= LEASE_TTL_MS:
                continue
            where = project["id"]
            if holder not in live:
                out.append((BAD, f"the lease of {where} is held by {short(holder)}, renewed {ago(age)} ago: no such session is running. It is free at {clock((lease.get('at') or 0) + LEASE_TTL_MS)}"))
                continue
            state = live[holder]["state"]
            if state is not None and dig(state, "lease.isDriver") is False:
                out.append((BAD, f"the lease of {where} names {short(holder)}, which says it does not drive"))
            surfaces = dig(state, "session.surfaces") if state else None
            if isinstance(surfaces, list) and len(surfaces) == 0:
                out.append((BAD, f"the lease of {where} is held by {short(holder)}, which draws nowhere: whatever it looks at, nobody sees"))
    return out


# A screen and a state file are read a moment apart, and either may be the newer: what one of them lacks is looked
# at once more, this long after, before it is called a disagreement.
RECHECK_S = 1.2
# How many times: seen flapping six times in two minutes (2026-10-05) with one look, each taken back within seconds.
RECHECKS = 3


def check_session(w: dict, s: dict, rows: list[str] | None) -> list[tuple[str, str]]:
    """What one session says, against what is so. Where the screen lacks something the tutor says it shows, both
    are read again a moment later, so that a drawing caught between two writes is not called a fault."""
    found = check_session_once(w, s, rows)
    # A tab's badge flips with every lookup while the caret moves (`3: Explain (…)`), so a drawing and the screen
    # are often half a phase apart: a few looks, not one, before a missing piece is called a disagreement.
    for _ in range(RECHECKS):
        if s["eyes"] is None or s["debug"] is None or not any(level == BAD and "on its screen" in text for level, text in found):
            return found
        time.sleep(RECHECK_S)
        state = read_json(s["debug"] / "state.json")
        again = {**s, "state": state if isinstance(state, dict) else None}
        found = check_session_once({**w, "now": now_ms()}, again, screen_of(s["eyes"]))
    return found


def check_session_once(w: dict, s: dict, rows: list[str] | None) -> list[tuple[str, str]]:
    """What one session says, against what is so, read once."""
    out: list[tuple[str, str]] = []
    now = w["now"]
    state = s["state"]
    mode = tutor_mode(s)
    who = s["short"]
    if state is None:
        if mode != "off":
            out.append((NOTE, f"{who} says the tutor is {mode} and writes no state: its debug log is off (jack.py in), or it runs a copy of the plugin from before the log could be switched from outside"))
        if rows is not None and mode == "off" and any("1: Play" in row for row in rows):
            if cannot_say(s):
                out.append((NOTE, f"{who} has the tutor's pane on its screen and runs {copy_label(s)}, from before the tutor could say what it believes: "
                                  f"jack sees its screen and its files, not its state. /backseat debug on typed into it, or /reload-plugins there while the switch is on, starts its log"))
            else:
                out.append((BAD, f"{who} has the tutor's pane on its screen, and nothing says the tutor is on in it"))
        return out

    at = state.get("at")
    stale = now - at if isinstance(at, (int, float)) else None
    if s.get("kind") == "gone":
        # Read by id after the fact: its state is as it was, and says nothing about now.
        left = (s.get("entry") or {}).get("leftAt")
        out.append((NOTE, f"{who} is not running (it said goodbye {ago(now - left) if left else 'at some point'} ago): its state is from {ago(stale) if stale is not None else '?'} ago, read as a record"))
        return out
    if mode != "off" and stale is not None and stale > STATE_STALE_MS:
        out.append((BAD, f"{who} last wrote its state {ago(stale)} ago and writes it every ten seconds with the log on: its timers do not run (stopped, asleep, or the log went off)"))
        return out
    out.append((FINE, f"{who} wrote its state {ago(stale)} ago: mode {mode}, layout {dig(state, 'session.layout') or 'vertical'}"))

    if s["entry"] is None and mode != "off":
        out.append((BAD, f"{who} says the tutor is {mode}, and sessions.json does not: a process that carries this conversation on would start off"))
    elif s["entry"] is not None and s["entry"].get("leftAt") and mode != "off":
        out.append((BAD, f"{who} says the tutor is {mode}, and sessions.json has its goodbye"))

    shown_mode = dig(state, "pane.mode")
    if shown_mode != mode:
        out.append((BAD, f"{who} holds the mode twice and they differ: {mode} in memory, {shown_mode} in what the pane is drawn from"))

    surfaces = dig(state, "session.surfaces")
    if mode != "off" and isinstance(surfaces, list) and len(surfaces) == 0:
        out.append((BAD, f"{who} has the tutor {mode} and draws nowhere: its conversation left this process, and it has not laid the tutor down"))

    # The lease.
    root = state.get("repoRoot") or ""
    project = next((p for home in w["homes"] for p in projects(home) if root and (p["root"] == root or p["id"] == project_id(root))), None) if root else None
    is_driver = dig(state, "lease.isDriver")
    if mode != "off" and root and project is not None:
        lease = project["lease"]
        holder = str(lease.get("session", ""))
        age = now - (lease.get("at") or 0)
        if is_driver is True and holder != s["id"]:
            out.append((BAD, f"{who} says it drives {project['id']}, and the lease names {short(holder) if holder else 'nobody'}"))
        elif is_driver is True and age > LEASE_TTL_MS:
            out.append((BAD, f"{who} says it drives {project['id']} and last renewed its lease {ago(age)} ago: any other session may take it"))
        elif is_driver is False and holder == s["id"] and age < LEASE_TTL_MS:
            out.append((BAD, f"{who} says another session drives {project['id']}, and the lease names {who} itself"))
        elif is_driver is True:
            out.append((FINE, f"{who} drives {project['id']}, lease renewed {ago(age)} ago"))
        else:
            out.append((FINE, f"{who} does not drive {project['id']}: {short(holder) if holder else 'nobody'} holds the lease"))

    # A session that does not drive is `following`: no watching light of its own, and no look or review to press
    # (the second ui-truth pass, 2026-10-06: a green light and an `l: look now` that only refused).
    play = dig(state, "pane.watch.state")
    texts_drawn = [t for t in (dig(state, "shown.pane.texts") or []) if isinstance(t, str)]
    if mode == "on" and root and project is not None:
        if is_driver is False and play != "following":
            out.append((BAD, f"{who} does not drive {project['id']} and its light says “{play}”, not following"))
        elif is_driver is True and play == "following":
            out.append((BAD, f"{who} drives {project['id']} and its light says following"))
        offered = [t for t in texts_drawn if t in ("look now", "review now")]
        if is_driver is False and offered:
            out.append((BAD, f"{who} does not drive {project['id']} and still offers {', '.join(offered)}, which could only refuse"))
    out += check_speech(who, state)
    out += check_settings_tab(who, state, s)

    # Deadlines that came and went.
    deadlines = state.get("deadlines") if isinstance(state.get("deadlines"), dict) else {}
    for name, due in sorted(deadlines.items()):
        if isinstance(due, (int, float)) and now - due > OVERDUE_MS and mode == "on":
            out.append((BAD, f"{who} had `{name}` to do at {clock(due)}, {ago(now - due)} ago, and has not done it"))

    # The look at itself, armed at all times while on: it says the goodbye at a handoff and follows the debug switch.
    # A quiet session's state never listed it, written after the fired deadline was dropped and before it was set
    # again (the seventh ui-truth pass, 2026-10-06); the tutor arms it first since.
    loaded_for_self = dig(state, "loaded.at")
    if mode == "on" and "self" not in deadlines and isinstance(loaded_for_self, (int, float)) and (state.get("at") or now) - loaded_for_self > SELF_GRACE_MS:
        out.append((BAD, f"{who} has the tutor on and no `self` deadline: its look at itself (the goodbye at a handoff, the debug switch) is not armed"))

    # Before any look, "l" says that the tree at switch-on is the baseline, and the Play-by-play tab that nothing has
    # been looked at: "Nothing has changed since the last look" and "No notes. Keep going." read as an all-clear on
    # code nothing had looked at (the eighth ui-truth pass, 2026-10-06; the owner asked whether the codebase was healthy).
    drawn_now = [t for t in (dig(state, "shown.pane.texts") or []) if isinstance(t, str)]
    if dig(state, "look.lastLookAt") is None and mode == "on":
        for told in state.get("said") or []:
            if isinstance(told, dict) and told.get("how") == "toast" and told.get("text") == "Nothing has changed since the last look.":
                out.append((BAD, f"{who} told the person “Nothing has changed since the last look.” at {clock(told.get('at'))}, and no look has ever run: what was changed at switch-on is the baseline, and nothing says so"))
                break
        watch_state = dig(state, "pane.watch.state")
        if dig(state, "pane.tab") == "play" and watch_state not in ("following", "no-git", "paused", "starting") and "No notes. Keep going." in drawn_now:
            out.append((BAD, f"{who}'s Play-by-play tab says “No notes. Keep going.” and no look has ever run: it reads as an all-clear on code nothing has looked at"))

    # The Growth tab under no level never says what the next level needs: those are the model's words for a level it
    # was not given (the seventh ui-truth pass, 2026-10-06: "Not placed yet" over "Next level: To reach junior, …").
    records = dig(state, "pane.progress.records")
    if dig(state, "pane.tab") == "profile" and isinstance(records, list) and records and all(isinstance(r, dict) and r.get("level") is None for r in records):
        if any(t.startswith("Next level:") for t in drawn_now):
            out.append((BAD, f"{who}'s Growth tab says “Not placed yet” and under it what the next level needs: the model's words for a level it was not given"))
    if dig(state, "pane.tab") == "profile" and isinstance(records, list):
        out += check_growth_counts(who, drawn_now, records)

    # The watchers it says it runs.
    said = sorted(p.get("role", "?") for p in state.get("pushers", []) if isinstance(p, dict) and p.get("isLive"))
    running = [pid for pid in children(s["pid"], w["procs"]) if any("inotifywait" in word for word in w["procs"][pid]["argv"][:1])] if s["pid"] else []
    loaded_at = dig(state, "loaded.at")
    if len(said) != len(running) and isinstance(loaded_at, (int, float)) and now - loaded_at < WATCHERS_GRACE_MS:
        # A reload kills the children and starts them again a moment after `engaged` (seen 2026-10-05: the old two gone,
        # the new two up within a second). Not a disagreement until the moment has passed.
        out.append((NOTE, f"{who} reloaded {ago(now - loaded_at)} ago and says {len(said)} file watcher(s) are live while {len(running)} inotifywait run under it: its watchers are being started again"))
    elif len(said) != len(running):
        out.append((BAD, f"{who} says {len(said)} file watcher(s) are live ({', '.join(said) or 'none'}), and {len(running)} inotifywait run under it"))
    elif said:
        out.append((FINE, f"{who} runs {len(running)} file watcher(s): {', '.join(said)}"))

    # The editors' light.
    light = dig(state, "pane.watch.editors")
    if mode == "on" and root and isinstance(light, str) and s["home"] is not None:
        here = editors_here(editors(s["home"]), root, now)
        names = ", ".join(sorted(str(e["data"].get("editor", "?")) for e in here))
        if light == "" and here:
            out.append((BAD, f"{who} shows a red light, no editor connected, and {names} wrote lately with something of this project open"))
        elif light != "" and not here:
            out.append((BAD, f"{who} shows a green light (“{light}”), and no editor has written in the last minute with anything of this project open"))
        else:
            out.append((FINE, f"{who}'s editors light is {'green: ' + light if light else 'red: no editor connected'}"))

    # The notes. notes.json may keep more than the pane shows: a note about text changed since is kept there and
    # never shown again (seen live after /backseat off and on). A note in the pane that notes.json lacks is lost at a restart,
    # or, in a session that does not drive, is one the driver took down that the next beat takes down here.
    notes = dig(state, "pane.notes")
    if mode != "off" and project is not None and isinstance(notes, list):
        kept = {n.get("id") for n in project["notes"] if isinstance(n, dict)}
        lost = [n for n in notes if isinstance(n, dict) and n.get("id") not in kept]
        if lost and now - (project["notes_at"] or 0) > (DRIVER_GRACE_MS if is_driver is True else FOLLOW_GRACE_MS):
            out.append((BAD, f"{who} has {len(notes)} open note(s) in its pane, and notes.json, written {ago(now - (project['notes_at'] or 0))} ago, lacks {len(lost)} of them: a restart would lose them"))
    out += check_cache(w, s, project)
    out += check_issues(w, s, project)
    out += check_lately(who, state, w)
    out += check_notes_lines(who, state, root)
    out += check_explain_fresh(who, state, root, project)
    out += check_explain_insights(who, state, root, project)
    out += check_explain_uses(who, state, project, root)
    out += check_explain_voice(who, state)
    out += check_working_share(who, state, project, now)

    # What it says it shows, against the screen.
    shown = state.get("shown") if isinstance(state.get("shown"), dict) else {}
    opened = shown.get("opened")
    layout = dig(state, "session.layout") or "vertical"
    # Minimized, the pane is closed on purpose and a strip above the prompt stands in for it: that is what is on the screen.
    minimized = shown.get("minimized") is True
    drawing = shown.get("band") if minimized or layout != "vertical" else shown.get("pane")
    if mode != "off" and minimized:
        out.append((NOTE, f"{who}'s pane is minimized: a strip above the prompt brings it back, and the tutor stays {mode}"))
    elif mode != "off" and layout == "vertical":
        panes = dig(state, "session.panes")
        mine = next((p for p in panes if isinstance(p, dict) and p.get("id") == PANE_ID), None) if isinstance(panes, list) else None
        closed = shown.get("closed") if isinstance(shown.get("closed"), dict) else None
        if isinstance(panes, list) and mine is None and closed is not None and closed.get("origin") == "person":
            out.append((NOTE, f"{who}'s pane was closed by the person {ago(now - (closed.get('at') or now))} ago: nothing of the tutor is on screen until /backseat"))
        elif isinstance(panes, list) and mine is None:
            out.append((BAD, f"{who} has the tutor {mode} in the vertical layout, and Claude Code lists no pane of its own: nothing is on screen"))
        elif isinstance(opened, dict) and opened.get("isPlaced") is False:
            out.append((BAD, f"{who}'s pane is open and not drawn: {opened.get('reason') or 'no reason given'}. /backseat in that session draws it"))
    width = (s["eyes"] or {}).get("cols") if isinstance(s["eyes"], dict) else None
    if rows is None:
        out.append((NOTE, f"{who}'s screen cannot be seen ({eyes_label(s['eyes'])}): what it says it shows is not checked"))
    elif mode != "off" and isinstance(drawing, dict) and drawing.get("placement") == "dock" and isinstance(width, int) and width < DOCK_COLUMNS:
        # The terminal was made narrower than a dock takes: the drawing on record is from the side, and the pane is
        # being moved above the prompt. The next drawing is the one to hold against the screen.
        out.append((NOTE, f"{who}'s pane was drawn docked ({drawing.get('columns')} columns) and its terminal is now {width} wide, under the {DOCK_COLUMNS} a dock takes: the pane is moving above the prompt (a resize), and is checked again next time"))
    elif mode != "off" and isinstance(drawing, dict) and isinstance(drawing.get("texts"), list):
        texts = [t for t in drawing["texts"] if isinstance(t, str)]
        chars = piece_head(drawing.get("columns"))
        head, rest = missing_pieces(texts, rows, chars)
        where = "strip above the prompt" if minimized else "pane" if layout == "vertical" else "lines above the prompt"
        below = pieces_below(texts, rows, chars)
        # A scrolled pane lacks its first piece. One whose first piece is there and a later one of the top is not has
        # that piece cut off its row (the owner's 157-column terminal, 2026-10-06: a 46-column dock cut "6: Set" off).
        is_top_there = bool(texts) and is_on_screen(texts[0], flows(rows), chars)
        if head and below > 0 and not is_top_there:
            # The top is missing and the rest is there: the person scrolled the pane down to read (the owner, 2026-10-05,
            # a long deep review in a 30-row terminal). Their view, not a fault.
            out.append((NOTE, f"{who}'s {where} is scrolled: its top ({quoted_pieces(head)}) is above the frame, and {below} piece(s) below it are on the screen"))
        elif head:
            quoted = "; ".join(f"“{t[:60]}”" for t in head[:3])
            cut = " The first piece is on the screen, so the row is cut, not scrolled." if is_top_there else ""
            out.append((BAD, f"{who} says its {where} shows {quoted}{' and more' if len(head) > 3 else ''}: not on its screen (drawn {ago(now - (drawing.get('at') or now))} ago, {drawing.get('placement') or 'above the prompt'}, {drawing.get('columns')} columns).{cut}"))
            # The middle is held against the screen whether or not the top is whole: at 23 columns the "Working on" value
            # and the character's line went missing under a cut tab row, and went unreported (the eighth ui-truth pass, 2026-10-06).
            squeezed = [t for t in squeezed_pieces(texts, rows, chars) if t not in head]
            if squeezed:
                quoted = "; ".join(f"“{t[:50]}”" for t in squeezed[:3])
                out.append((BAD, f"{who}'s {where} is squeezed as well: {len(squeezed)} piece(s) missing from its middle while pieces below them are on the screen ({quoted}{' and more' if len(squeezed) > 3 else ''})"))
        else:
            squeezed = squeezed_pieces(texts, rows, chars)
            if squeezed:
                # A piece missing while a later one of the same drawing is on the screen was squeezed out, not cut at the
                # bottom: the owner's pane was laid out into sixteen rows of a thirty-seven-row terminal for half a
                # minute, the editors' light and the bubble's mouth row gone from its middle (the third ui-truth pass, 2026-10-06).
                quoted = "; ".join(f"“{t[:50]}”" for t in squeezed[:3])
                out.append((BAD, f"{who}'s {where} is squeezed: {len(squeezed)} piece(s) missing from its middle while pieces below them are on the screen ({quoted}{' and more' if len(squeezed) > 3 else ''})"))
            else:
                out.append((FINE, f"{who}'s {where} is on its screen as it says ({len(texts) - len(rest)} of {len(texts)} pieces{', the rest below the fold or cut' if rest else ''})"))
            if rest and not squeezed:
                # The keys row stands at the top of every tab since 2026-10-06 (the controls with it), so what a short frame
                # cuts is the tab's contents; a drawing from before has the keys row last, and the note says when it is cut.
                keys_below = not any(word in texts and is_on_screen(word, flows(rows)) for word in KEYS_HINTS)
                out.append((NOTE, f"{who}'s {where} is cut at the bottom: {len(rest)} piece(s) are below the frame{', the keys row among them' if keys_below else ''} (a pane taller than its frame, as in a narrow window)"))
        # A pane standing scrolled past its top since a tab was opened, with nobody having scrolled it: its controls and
        # keys row are above the frame (the owner's Play-by-play tab, fourteen minutes, the seventh ui-truth pass,
        # 2026-10-06). The tutor scrolls to the top at a change of tab since; this holds it to that.
        scroll = drawing.get("scroll") if isinstance(drawing.get("scroll"), dict) else None
        if scroll is not None and (scroll.get("offset") or 0) > 0 and s["debug"] is not None and not minimized:
            recent = [r for r in log_records(s["debug"])[-300:] if r.get("k") == "ui"]
            opened_tab = max((r for r in recent if r.get("n") == "tab"), key=lambda r: r.get("t") or 0, default=None)
            written = state.get("at") or now
            if opened_tab is not None and written - (opened_tab.get("t") or 0) > TAB_SETTLE_MS and (drawing.get("at") or 0) >= (opened_tab.get("t") or 0):
                moved = any(r.get("n") == "scroll" and isinstance(r.get("d"), dict) and r["d"].get("origin") == "person" and (r.get("t") or 0) > (opened_tab.get("t") or 0) for r in recent)
                if not moved:
                    out.append((BAD, f"{who}'s {where} stands scrolled {scroll.get('offset')} row(s) past its top since the {opened_tab.get('d')} tab was opened at {clock(opened_tab.get('t'))}, and nobody scrolled it: its controls and keys row are above the frame"))
        if not minimized and s["debug"] is not None:
            out += check_pick_kept_page(who, log_records(s["debug"])[-400:], now)
            out += check_no_look_yet(who, state, log_records(s["debug"]))
        if not minimized:
            out += check_keys_row(who, texts, rows)
    elif mode != "off" and rows is not None:
        out.append((BAD, f"{who} has the tutor {mode} and has drawn nothing in the {layout} layout"))
    if rows is not None and mode == "off" and any("1: Play" in row and "2: Review" in row for row in rows):
        out.append((BAD, f"{who} says the tutor is off, and its pane is on the screen"))

    out += check_said(w, s, rows)
    out += check_world(w, s)

    # What went wrong lately.
    recent = [r for r in log_records(s["debug"])[-400:] if r.get("k") == "error" and now - (r.get("t") or 0) < 600_000]
    for r in recent[-3:]:
        out.append((BAD, f"{who} {clock(r.get('t'))} error: {r.get('n')}: {brief(dig(r, 'd.message'), 120)}"))
    return out


# ------------------------------------------------------------------ the pane against the cache ----

def hellos_by_voice(source: pathlib.Path = REPO / "plugin" / "core" / "avatar.ts") -> dict[str, str]:
    """What each voice's character says at switch-on, read out of `core/avatar.ts`: each `const NAME: Avatar = {` block's
    `hello:` line, and the `AVATARS` block that maps a voice to a constant."""
    try:
        text = source.read_text()
    except OSError:
        return {}
    hellos: dict[str, str] = {}
    current = None
    for line in text.splitlines():
        m = re.match(r"^const (\w+): Avatar = \{", line)
        if m:
            current = m.group(1)
            continue
        m = re.match(r"^\s+hello: (?:'((?:[^'\\]|\\.)*)'|\"((?:[^\"\\]|\\.)*)\"),", line)
        if m and current:
            hellos[current] = (m.group(1) if m.group(1) is not None else m.group(2)).replace("\\'", "'")
    by_voice: dict[str, str] = {}
    block = re.search(r"export const AVATARS = \{(.*?)\}", text, re.S)
    for m in re.finditer(r"['\"]?([\w-]+)['\"]?: (\w+),", block.group(1) if block else ""):
        if m.group(2) in hellos:
            by_voice[m.group(1)] = hellos[m.group(2)]
    return by_voice


def retired_settings(source: pathlib.Path = REPO / "plugin" / "core" / "settings.ts") -> set[str]:
    """The fields taken out of the manifest, read out of `core/settings.ts` (`RETIRED_SETTINGS`)."""
    try:
        m = re.search(r"RETIRED_SETTINGS[^=]*=\s*\[([^\]]*)\]", source.read_text())
    except OSError:
        return set()
    return set(re.findall(r"'([\w-]+)'", m.group(1))) if m else set()


def check_settings_tab(who: str, state: dict, s: dict) -> list[tuple[str, str]]:
    """The Settings tab's rows against the manifest's fields: a field of the plugin's that the tab does not show
    (the editor command, a typed value, was left out: the third ui-truth pass, 2026-10-06)."""
    rows = [r for r in (dig(state, "pane.settings") or []) if isinstance(r, dict)]
    if not rows:
        return []
    folder = (s.get("copy") or {}).get("folder") or ""
    manifest = read_json(pathlib.Path(folder) / ".claude-plugin" / "plugin.json") if folder else None
    fields = set((manifest or {}).get("userConfig", {}).keys()) - retired_settings()
    if not fields:
        return []
    shown = {str(r.get("key", "")).split(".", 1)[-1] for r in rows}
    missing = sorted(fields - shown)
    if missing:
        return [(BAD, f"{who}'s Settings tab shows {len(rows)} row(s) and the manifest has {len(fields)} field(s): {', '.join(missing)} missing")]
    return [(FINE, f"{who}'s Settings tab shows every field of the manifest ({len(fields)})")]


def check_speech(who: str, state: dict) -> list[tuple[str, str]]:
    """The character's line against the voice it belongs to: a hello is one voice's, and a hello under another voice is
    the old voice's line left standing by a reload (the mascot under Linus's "Ready. Save something." for sixteen hours,
    the second ui-truth pass, 2026-10-06)."""
    said = dig(state, "pane.speech.text")
    hellos = hellos_by_voice()
    # A bubble holds one short line: a line cut at its length ("…", by `speakable`) is a paragraph that got in (the
    # owner's character spoke a survey's four-sentence paragraph, cut twice mid-sentence: the eighth ui-truth pass, 2026-10-06).
    if isinstance(said, str) and said.endswith("…"):
        return [(BAD, f"{who}'s character says a line cut mid-sentence: “{said[:60]}…”: a bubble holds one short line, and this was a paragraph")]
    if not isinstance(said, str) or said == "" or said not in hellos.values():
        return []
    voice = dig(state, "loaded.options.voice") or "default"
    expected = hellos.get(str(voice), hellos.get("default"))
    if said != expected:
        theirs = next((v for v, h in hellos.items() if h == said), "?")
        return [(BAD, f"{who}'s character says “{said}”, the {theirs} voice's hello, under the {voice} voice (whose hello is “{expected}”): a line left over from before the voice changed")]
    return [(FINE, f"{who}'s character says its own voice's hello")]


def despin(text: str) -> str:
    """A tab's spinner at any tick reads as its first frame, so that a drawing and a screen caught a tick apart agree."""
    return re.sub(rf"(?<=\s)[{SPINNER[1:]}](?=\s|$)", "·", text)


def check_notes_lines(who: str, state: dict, root: str) -> list[tuple[str, str]]:
    """Each open note's quoted line against the file on disk: a note is placed again after every look (kept at its
    line, moved to the line that reads the same, taken down when it is gone), so a file the last look saw must read
    at the note's line what the note quotes. A file saved since the last look is the next look's (the sixth ui-truth
    pass, 2026-10-06, which held the six open notes by hand)."""
    notes = [n for n in (dig(state, "pane.notes") or []) if isinstance(n, dict) and n.get("lineText")]
    looked = dig(state, "pane.watch.lastLookAt") or 0
    if not notes or not root:
        return []
    out: list[tuple[str, str]] = []
    held = 0
    for n in notes:
        file = pathlib.Path(root) / str(n.get("file", ""))
        written = mtime_ms(file)
        if written is None or written > looked:
            continue
        try:
            lines = file.read_text(errors="replace").split("\n")
        except OSError:
            continue
        held += 1
        line = int(n.get("line") or 0)
        quoted = str(n.get("lineText")).strip()
        at = lines[line - 1].strip() if 1 <= line <= len(lines) else ""
        if at == quoted:
            continue
        hits = [i + 1 for i, text in enumerate(lines) if text.strip() == quoted]
        if len(hits) == 1:
            out.append((NOTE, f"{who}'s note {n.get('id')} points at {n.get('file')}:{line}, and its line is now {hits[0]}: it is placed there at the next look"))
        else:
            out.append((BAD, f"{who}'s note {n.get('id')} points at {n.get('file')}:{line}, which reads “{at[:40]}”, and the note quotes “{quoted[:40]}”: the file no longer says what the note is about"))
    if held and not out:
        out.append((FINE, f"{who}'s {held} open note(s) point at the lines they quote"))
    return out


def check_explain_fresh(who: str, state: dict, root: str, project: dict | None) -> list[tuple[str, str]]:
    """The Explain tab's "fresh" against the file: what it shows is of the text the cache's fingerprint names, and
    fresh means that text is the file's now (plugin/core/knowledge.ts `sourcePrint`; the sixth ui-truth pass)."""
    explain = dig(state, "pane.explain") if isinstance(dig(state, "pane.explain"), dict) else {}
    path = str((explain.get("spot") or {}).get("path") or "")
    if explain.get("status") != "fresh" or not path or not root or project is None:
        return []
    file = pathlib.Path(root) / path
    written = mtime_ms(file)
    if written is None or written > (state.get("at") or 0) - 2000:
        return []
    known = read_json(project["dir"] / "files" / f"{fnv(path)}-{pathlib.Path(path).name}.json") or {}
    print_ = known.get("print") if isinstance(known, dict) else None
    if not isinstance(print_, str) or print_ == "unmapped":
        return []
    try:
        now_print = source_print(file.read_text(errors="replace"))
    except OSError:
        return []
    if print_ != now_print:
        return [(BAD, f"{who}'s Explain tab says {path} is fresh, and the cache's fingerprint {print_} is not the file's {now_print}: what it shows is of another text")]
    return [(FINE, f"{who}'s Explain tab is fresh for {path}, as the file reads")]


def mentioned_at(lines: list[str], name: str) -> int:
    """plugin/core/knowledge.ts `mentionedAt`: the first line (1-based) that mentions a name, as written or as a bare
    word without its sigil or parentheses, else -1."""
    if not name:
        return -1
    as_word = lambda text: re.compile(r"(^|[^A-Za-z0-9_])" + re.escape(text) + r"($|[^A-Za-z0-9_])")
    for i, line in enumerate(lines):
        if as_word(name).search(line):
            return i + 1
    bare = re.sub(r"^[$@:]+", "", name)
    bare = re.sub(r"\(\)$", "", bare)
    if not bare or bare == name:
        return -1
    for i, line in enumerate(lines):
        if as_word(bare).search(line):
            return i + 1
    return -1


def check_working_share(who: str, state: dict, project: dict | None, now: int) -> list[tuple[str, str]]:
    """The "Working on" line's time in the editor, against the journal: a share of the editor's time read as a share
    of the window ("100% of the last 10 minutes in the editor" for seven seconds: the twelfth ui-truth pass,
    2026-10-07), and a time said that the journal's caret time for that file cannot hold. What the tutor holds is
    up to a slice (2 min) and a write (30 s) ahead of the file, so that much is allowed."""
    share = str(dig(state, "pane.working.share") or "")
    where = str(dig(state, "pane.working.where") or "")
    if not share or project is None:
        return []
    if re.search(r"\d+% of the last", share):
        return [(BAD, f"{who}'s “Working on” says “{share}”: a share of the editor's time, read as a share of the window")]
    m = re.match(r"(\d+) (s|min) in the editor in the last (\d+) minutes", share)
    if not m or not where:
        return []
    said_ms = int(m.group(1)) * (1000 if m.group(2) == "s" else 60_000)
    window = int(m.group(3)) * 60_000
    path = where.split(",")[0].strip()
    entries = [e for e in (project.get("journal") or {}).get("entries") or [] if isinstance(e, dict)]
    on_file = sum(e.get("ms") or 0 for e in entries if e.get("kind") == "focus" and e.get("path") == path and now - (e.get("at") or 0) <= window)
    if said_ms > on_file + WORKING_SLACK_MS:
        return [(BAD, f"{who}'s “Working on” says {share} on {path}, and the journal holds {on_file // 1000} s of caret time there in that window")]
    return [(FINE, f"{who}'s “Working on” time agrees with the journal: {share}")]


def check_explain_uses(who: str, state: dict, project: dict | None, root: str = "") -> list[tuple[str, str]]:
    """What the Explain tab shows a section relying on, against the order of the file's sections: a section of a
    script relies on earlier sections, never on a later one that reads what it builds (the twelfth ui-truth pass,
    2026-10-07: "Page setup and includes" shown relying on four sections after it). The tutor drops such a use
    when it writes an explanation and when it reads one from the cache, so one on the screen is a `!!`."""
    explain = dig(state, "pane.explain") if isinstance(dig(state, "pane.explain"), dict) else {}
    target = explain.get("target") if isinstance(explain.get("target"), dict) else None
    detail = explain.get("detail") if isinstance(explain.get("detail"), dict) else None
    if target is None or detail is None:
        return []
    # Code commented out relies on nothing it names (the fourteenth ui-truth pass, 2026-10-07: an "old game" of comments
    # shown relying on two sections).
    path = dig(explain, "spot.path")
    if root and isinstance(path, str) and detail.get("uses"):
        try:
            lines = (pathlib.Path(root) / path).read_text(errors="replace").split("\n")
        except OSError:
            lines = []
        said = [line.strip() for line in lines[max(0, (target.get("startLine") or 1) - 1):(target.get("endLine") or 0)] if line.strip()]
        if said and all(COMMENT_LINE.match(line) for line in said):
            return [(BAD, f"{who}'s Explain tab shows “{target.get('name')}”, lines that are all comments, relying on {', '.join(f'“{u}”' for u in detail.get('uses') or [])}: code commented out relies on nothing")]
    if target.get("kind") != "section":
        return []
    later = {r.get("name") for r in (explain.get("outline") or []) if isinstance(r, dict) and (r.get("startLine") or 0) > (target.get("endLine") or 0)}
    backward = [u for u in (detail.get("uses") or []) if u in later]
    if backward:
        return [(BAD, f"{who}'s Explain tab shows the section “{target.get('name')}” relying on {', '.join(f'“{u}”' for u in backward)}, after it: reliance runs forward")]
    return [(FINE, f"{who}'s Explain tab shows “{target.get('name')}” relying on earlier parts only")]


# Words of an explanation about the one who wrote it, not the code (the fifteenth ui-truth pass, 2026-10-07: "which
# only I can confirm is checked"). plugin/prompts/explain.md says to write about the code.
FIRST_PERSON = re.compile(r"\b(I|we) (can|can't|cannot|could|only|think|believe|would|will|see|don't|do not)\b")


def check_explain_voice(who: str, state: dict) -> list[tuple[str, str]]:
    """An explanation on the Explain tab that speaks of its writer: a `··`, since a reader is the judge of a sentence."""
    detail = dig(state, "pane.explain.detail") if isinstance(dig(state, "pane.explain.detail"), dict) else None
    if detail is None:
        return []
    sentences = [s.strip() for field in ("what", "how", "why", "watch") for s in re.split(r"(?<=[.!?])\s+", str(detail.get(field) or ""))]
    found = next((sentence for sentence in sentences if FIRST_PERSON.search(sentence)), None)
    if found is None:
        return []
    target = dig(state, "pane.explain.target.name") or dig(state, "pane.explain.spot.path")
    return [(NOTE, f"{who}'s Explain tab says of “{target}”, in the first person: “{brief(found, 110)}”")]


def check_no_look_yet(who: str, state: dict, records: list[dict]) -> list[tuple[str, str]]:
    """The empty Play-by-play tab says "No look yet" only before the first look since switch-on: a reload (a sync, a
    change in /config) kept the session on and lost the time of its last look (the sixteenth ui-truth pass, 2026-10-07)."""
    texts = [str(x) for x in (dig(state, "shown.pane.texts") or [])]
    if not any(x.startswith("No look yet.") for x in texts) and dig(state, "pane.watch.lastLookAt") is not None:
        return []
    fresh = [r.get("t") or 0 for r in records if r.get("k") == "start" and r.get("n") == "engaging" and isinstance(r.get("d"), dict) and r["d"].get("isFresh") is True]
    since = max(fresh, default=0)
    looked = [r for r in records if r.get("k") == "look" and r.get("n") == "done" and (r.get("t") or 0) > since]
    if not looked:
        return []
    what = "says “No look yet”" if any(x.startswith("No look yet.") for x in texts) else "has no last look on record"
    return [(BAD, f"{who} {what}, and it looked at {clock(looked[-1].get('t'))}, since it was switched on")]


def check_pick_kept_page(who: str, records: list[dict], now: int) -> list[tuple[str, str]]:
    """A pick in the Explain outline moves the mark, never the page: the window as the last drawing before the latest
    pick had it, against the latest drawing since, with no scroll by anyone between. A shorter drawing while the
    lookup ran let Claude Code clamp the window from row 8 to row 1 (the twelfth ui-truth pass, 2026-10-07)."""
    picks = [r for r in records if r.get("k") == "ui" and r.get("n") == "explain pick"]
    if not picks or now - (picks[-1].get("t") or 0) > 120_000:
        return []
    at = picks[-1].get("t") or 0
    drawn = [r for r in records if r.get("k") == "shown" and r.get("n") == "pane" and isinstance(r.get("d"), dict) and isinstance(r["d"].get("scroll"), dict)]
    before = [r for r in drawn if (r.get("t") or 0) <= at]
    after = [r for r in drawn if (r.get("t") or 0) > at]
    scrolled = any(r.get("k") == "ui" and r.get("n") in ("scroll", "scroll to top") and (r.get("t") or 0) > at for r in records)
    if not before or not after or scrolled:
        return []
    was, became = before[-1]["d"]["scroll"].get("offset"), after[-1]["d"]["scroll"].get("offset")
    if isinstance(was, int) and isinstance(became, int) and was != became:
        return [(BAD, f"{who}'s pane moved from row {was} to row {became} after a pick in the Explain outline at {clock(at)}, and nobody scrolled it: a pick moves the mark, never the page")]
    return []


def check_explain_insights(who: str, state: dict, root: str, project: dict | None) -> list[tuple[str, str]]:
    """What the deep reviews said of the file in focus, against what the Explain tab can reach, and the explanation it
    shows against the project notes it was written under (the seventh ui-truth pass, 2026-10-06: four insights kept
    under variable names no outline has, and explanations sending the reader to check they had the right file,
    written under a survey's notes from before the project was replaced)."""
    explain = dig(state, "pane.explain") if isinstance(dig(state, "pane.explain"), dict) else {}
    path = str((explain.get("spot") or {}).get("path") or "")
    if not path or not root or project is None:
        return []
    file = pathlib.Path(root) / path
    try:
        text = file.read_text(errors="replace")
    except OSError:
        return []
    lines = text.split("\n")
    known = read_json(project["dir"] / "project.json") or {}
    entry = read_json(project["dir"] / "files" / f"{fnv(path)}-{file.name}.json") or {}
    symbols = [s for s in (entry.get("symbols") or []) if isinstance(s, dict)] if isinstance(entry, dict) else []
    names = {s.get("name") for s in symbols}
    out: list[tuple[str, str]] = []
    file_print = source_print(text)
    unreachable = [i for i in (known.get("insights") or []) if isinstance(i, dict) and i.get("file") == path and i.get("of") == "file"
                   and i.get("symbol") and i["symbol"] not in names and i.get("print") == file_print and mentioned_at(lines, str(i["symbol"])) == -1]
    # An insight kept for the file under no name, which its review or first look around named: it lost the name while
    # the file had no outline, and shows under every part of it (the sixteenth ui-truth pass, 2026-10-07).
    said = [str(x) for x in ((known.get("survey") or {}).get("insights") or [])] + [str(x) for r in (project.get("reviews") or []) if isinstance(r, dict) for x in (r.get("insights") or [])]
    for i in (known.get("insights") or []):
        if not isinstance(i, dict) or i.get("file") != path or i.get("of") != "file" or i.get("symbol"):
            continue
        named = next((x for x in said if x.startswith(f"{path}, ") and x.endswith(f": {i.get('text')}") and len(x) > len(path) + 4 + len(str(i.get("text")))), None)
        if named is not None:
            out.append((BAD, f"project.json keeps the insight “{brief(i.get('text'), 60)}” for all of {path} under no name, and its review named it {named[len(path) + 2:len(named) - len(str(i.get('text'))) - 2]}: it shows under every part of the file"))
            break
    # Shown under a symbol, an insight about the whole file says so: it read as about the code in focus. One kept under
    # no name that quotes the name of one part of the file is about that part, shown with it as its own and not under
    # the others (the seventeenth ui-truth pass, 2026-10-07: "The commented-out 'old game' …" under every section).
    target_name = dig(explain, "target.name")
    outline = [str(o.get("name")) for o in (explain.get("outline") or []) if isinstance(o, dict) and o.get("name")] or [str(n) for n in names if n]
    nameless = [str(i.get("text")) for i in (known.get("insights") or []) if isinstance(i, dict) and i.get("file") == path and i.get("of") == "file" and not i.get("symbol")]
    whole = {text_ for text_ in nameless if len(quoted_names(text_, outline)) != 1}
    if target_name:
        unsaid = [x for x in (explain.get("insights") or []) if any(str(x).startswith(w) for w in whole) and "about the whole file" not in str(x)]
        if unsaid:
            out.append((BAD, f"{who}'s Explain tab shows “{brief(unsaid[0], 60)}” under “{target_name}” without saying it is about the whole file"))
        for text_ in nameless:
            about = quoted_names(text_, outline)
            drawn = [str(x) for x in (explain.get("insights") or []) if str(x).startswith(text_)]
            if len(about) != 1 or not drawn:
                continue
            if about[0] != target_name:
                out.append((BAD, f"{who}'s Explain tab shows “{brief(text_, 60)}” under “{target_name}”, and it quotes “{about[0]}”, another part of {path}: it belongs with that part"))
            elif "about the whole file" in drawn[0]:
                out.append((BAD, f"{who}'s Explain tab says “{brief(text_, 60)}” is about the whole file, and it quotes “{target_name}”, the part in focus"))
    # A cached explanation that doubts a name the file sets outside its lines: written before the prompt forbade it,
    # it stands while the code reads the same (the fifteenth and sixteenth ui-truth passes, 2026-10-07).
    doubt = re.compile(r"(without a (visible )?start(ing)? value|never set|not set|unset|set earlier)", re.I)
    for s in symbols:
        detail = s.get("detail") if isinstance(s.get("detail"), dict) else {}
        for field in ("what", "how", "why", "watch"):
            for sentence in re.split(r"(?<=[.!?])\s+", str(detail.get(field) or "")):
                if not doubt.search(sentence):
                    continue
                for name in re.findall(r"\$\w+", sentence):
                    setting = next((n for n, line in enumerate(lines, 1) if re.match(rf"\s*{re.escape(name)}\s*=[^=]", line)
                                    and not ((s.get("startLine") or 0) <= n <= (s.get("endLine") or 0))), None)
                    if setting is not None:
                        out.append((NOTE, f"the cached explanation of “{s.get('name')}” in {path} doubts {name}, which line {setting} sets: “{brief(sentence, 90)}”"))
                        break
    if unreachable:
        quoted = ", ".join(f"“{i['symbol']}”" for i in unreachable[:4])
        out.append((NOTE, f"{who}'s Explain tab can never show {len(unreachable)} insight(s) of the deep reviews on {path}: nothing in the file is named {quoted}"))
    # An insight credited to a deep review the Deep review tab does not have is the first look around's, kept under
    # HEAD as it stood (the ninth ui-truth pass, 2026-10-07: "(deep review of 570e787)" with no review of 570e787).
    reviews = [r for r in (project.get("reviews") or []) if isinstance(r, dict)]
    reviewed = {str(r.get("commit")) for r in reviews if r.get("commit")}
    holds = lambda review, said: any(said in str(item) for item in (review.get("insights") or []))
    for shown_insight in (explain.get("insights") or []):
        m = re.search(r"^(.*) \(deep review of ([0-9a-f]{7,40})\)$", str(shown_insight))
        if not m:
            continue
        said, commit = m.group(1).strip(), m.group(2)
        if not any(c.startswith(commit) or commit.startswith(c) for c in reviewed):
            out.append((NOTE, f"{who}'s Explain tab credits an insight to a deep review of {commit}, which the Deep review tab does not have: the first look around's, taken at that commit"))
            break
        # Credited to a review that does not hold it, while the audit's does: the audit's, kept under the commit it
        # audited at (the fourteenth ui-truth pass, 2026-10-07).
        of_commit = [r for r in reviews if r.get("commit") and (str(r["commit"]).startswith(commit) or commit.startswith(str(r["commit"])))]
        if not any(holds(r, said) for r in of_commit) and any(holds(r, said) for r in reviews if r.get("subject") == AUDIT_SUBJECT):
            out.append((BAD, f"{who}'s Explain tab credits the audit's insight “{brief(said, 60)}” to the deep review of {commit}, which does not hold it"))
            break
    target = explain.get("target") if isinstance(explain.get("target"), dict) else None
    detail = explain.get("detail") if isinstance(explain.get("detail"), dict) else None
    overview_at = known.get("overviewAt") or 0
    if target is not None and detail is not None and isinstance(overview_at, (int, float)) and overview_at:
        symbol = next((s for s in symbols if s.get("name") == target.get("name")), None)
        at = ((symbol or {}).get("detail") or {}).get("at") or 0
        if isinstance(at, (int, float)) and at and at < overview_at:
            words = f"{detail.get('watch', '')} {detail.get('why', '')} {detail.get('what', '')}".lower()
            if "project notes" in words or "does not match" in words or f"right {file.name.lower()}" in words:
                out.append((BAD, f"{who}'s Explain tab sends the reader to check {path} against the project notes, which were rewritten at {clock(overview_at)} after the explanation ({clock(at)}): the file is the right one, and the notes were old"))
            else:
                out.append((NOTE, f"{who}'s explanation of {target.get('name')} in {path} was written at {day_clock(at)} under project notes rewritten at {day_clock(overview_at)}: it stands, as the file reads the same"))
    return out


def unchanged_since(root: str, path: str, at: float | None, now: int) -> bool:
    """Whether a file of the repository was last written before `at`: a note about it is still what the look saw."""
    if not root or at is None:
        return False
    written = mtime_ms(pathlib.Path(root) / path)
    return written is not None and written < at


def ledger_counts(findings: list[dict]) -> dict[str, int]:
    """The open issues by severity, partly fixed ones included, as the pane counts them."""
    counts = {severity: 0 for severity in SEVERITIES}
    for finding in findings:
        if finding.get("status") in ("open", "partly") and finding.get("severity") in counts:
            counts[finding["severity"]] += 1
    return counts


def counts_words(counts: dict[str, int]) -> str:
    """`countsWords` (plugin/core/findings.ts): "1 critical, 2 high", worst first, none left out but those at 0."""
    return ", ".join(f"{counts[severity]} {severity}" for severity in SEVERITIES if counts.get(severity, 0) > 0)


def ledger_line(counts: dict[str, int], is_audited: bool, coverage: dict) -> str:
    """`ledgerLine` (plugin/core/findings.ts): what the empty play-by-play says of the ledger, so that its silence never
    reads as an all-clear."""
    if counts_words(counts):
        return f"Open in the deep review: {counts_words(counts)}."
    if (coverage.get("at") or 0) > 0:
        read = len(coverage.get("read") or [])
        return "The audit found nothing open." if read == 0 else f"The audit found nothing open in the {read} files it read."
    if is_audited:
        return "The audit has not finished."
    return "Not audited for issues yet."


@functools.lru_cache(maxsize=1)
def mod_tables() -> dict:
    """The mod's own rules for a file of the person's own source, read out of its source so that a count here is the
    mod's: the extensions it knows (core/languages.ts), the files and folders it calls noise (core/noise.ts), the size
    past which a file is taken for someone else's, and the words an audit uses for a file it skipped as someone else's
    (core/findings.ts)."""
    core = REPO / "plugin" / "core"
    languages = (core / "languages.ts").read_text()
    table = languages[languages.index("const BY_EXTENSION"):]
    table = table[:table.index("\n}")]
    noise = (core / "noise.ts").read_text()

    def strings_of(name: str) -> set[str]:
        part = noise[noise.index(f"const {name}"):]
        return set(re.findall(r"'([^']+)'", part[:part.index("])")]))

    return {
        "extensions": set(re.findall(r"^\s*['\"]?([^'\":\s]+)['\"]?\s*:", table, re.M)) - {"const BY_EXTENSION"},
        "languages": dict(re.findall(r"^\s*['\"]?([^'\":\s]+)['\"]?\s*:\s*'([^']+)'", table, re.M)),
        "locks": strings_of("LOCK_FILES"),
        "folders": strings_of("GENERATED_FOLDERS"),
        "not_source": re.compile(re.search(r"const NOT_SOURCE = /(.+)/i", noise).group(1), re.I),
        "vendored_bytes": int(re.search(r"VENDORED_BYTES = ([0-9_]+)", noise).group(1).replace("_", "")),
        "vendored_why": re.compile(re.search(r"export const VENDORED_WHY = /(.+)/i", (core / "findings.ts").read_text()).group(1), re.I),
    }


def mod_own_files(root: str, skipped: list) -> list[str] | None:
    """Their own source files as the mod counts them for an audit (`sourceFiles` and `ownFiles`): git's files of a
    language it knows, not noise, no larger than hand-written code, less what the audit skipped as someone else's."""
    listed = git_out(root, "ls-files", "-z")
    if listed is None:
        return None
    rules = mod_tables()
    sizes: dict[str, int] = {}
    for entry in (git_out(root, "ls-tree", "-r", "-l", "-z", "HEAD") or "").split("\0"):
        if "\t" in entry:
            meta, path = entry.split("\t", 1)
            parts = meta.split()
            sizes[path] = int(parts[3]) if len(parts) > 3 and parts[3].isdigit() else 0
    own = []
    for path in listed.split("\0"):
        name = path.rsplit("/", 1)[-1]
        dot = name.rfind(".")
        if not path or dot <= 0 or name[dot + 1:].lower() not in rules["extensions"]:
            continue
        if name in rules["locks"] or rules["not_source"].search(name) or any(folder in rules["folders"] for folder in path.split("/")[:-1]):
            continue
        if sizes.get(path, 0) > rules["vendored_bytes"]:
            continue
        own.append(path)
    theirs = [str(s.get("path")) for s in skipped if isinstance(s, dict) and rules["vendored_why"].search(str(s.get("why", "")))]
    return [path for path in own if not any(path == other or (other.endswith("/") and path.startswith(other)) for other in theirs)]


def unquote_git(path: str) -> str:
    """A path as git prints it in a patch header (`unquoted` in core/authorship.ts): one with a character outside plain
    ASCII, a quote or a backslash comes in double quotes, with C escapes and its UTF-8 bytes in octal."""
    if len(path) < 2 or not (path.startswith('"') and path.endswith('"')):
        return path
    try:
        return codecs.escape_decode(path[1:-1].encode("latin-1", "backslashreplace"))[0].decode("utf-8", "replace")
    except ValueError:
        return path[1:-1]


def mod_language(path: str, rules: dict) -> str | None:
    """A file's language as the mod tells it (`languageOf` in core/languages.ts), or None for one it does not know."""
    name = path.rsplit("/", 1)[-1]
    dot = name.rfind(".")
    return rules["languages"].get(name[dot + 1:].lower()) if dot > 0 else None


def mod_noise(path: str, rules: dict) -> bool:
    """Whether the mod never reads a file (`isNoiseFile` in core/noise.ts): a lock file, a name that is no source, or a
    file in a generated or vendored folder."""
    parts = path.split("/")
    return parts[-1] in rules["locks"] or bool(rules["not_source"].search(parts[-1])) or any(folder in rules["folders"] for folder in parts[:-1])


_ADDED: dict[tuple[str, str, str], int | None] = {}
_PRESENT: dict[tuple[str, tuple[str, ...]], bool] = {}


def added_nonblank(root: str, hash_: str, language: str) -> int | None:
    """The non-blank lines a commit adds in one language, as the tutor counts a commit's lines for a progress record
    (`addedLines` and `sizeOf` in core/authorship.ts), or None when git does not know the commit here or its patch is
    past what the host keeps."""
    key = (root, hash_, language)
    if key not in _ADDED:
        try:
            p = subprocess.run(["git", "--no-optional-locks", "-C", root, "show", "--format=", "--no-color", "--no-ext-diff", "--unified=0", hash_], capture_output=True, timeout=30)
        except (OSError, subprocess.TimeoutExpired):
            return None
        if p.returncode != 0 or len(p.stdout) > OUTPUT_CAP:
            _ADDED[key] = None
            return None
        rules = mod_tables()
        count, current, in_hunk = 0, False, False
        for line in p.stdout.decode("utf-8", "replace").split("\n"):
            if line.startswith("diff --git "):
                current, in_hunk = False, False
                continue
            if line.startswith("@@"):
                in_hunk = True
            if not in_hunk and line.startswith("+++ "):
                path = unquote_git(line[4:].strip())
                path = path[2:] if path.startswith("b/") else path
                current = path != "/dev/null" and not mod_noise(path, rules) and mod_language(path, rules) == language
                continue
            if current and line.startswith("+") and line[1:].strip():
                count += 1
        _ADDED[key] = count
    return _ADDED[key]


def lines_recount(home: pathlib.Path, record: dict) -> tuple[int, str] | None:
    """The non-blank lines a progress record's assessed commits add in its language, counted in the first repository of
    the data folder's projects that has all of them, with that repository; None when none has them all (a record is one
    language's across projects) or a patch is past what the host keeps."""
    assessed = tuple(str(h) for h in (record.get("assessed") or []) if isinstance(h, str))
    language = str(record.get("language") or "")
    if not assessed or not language:
        return None
    for project in projects(home):
        root = str(project.get("root") or "")
        if not root or not pathlib.Path(root).is_dir():
            continue
        key = (root, assessed)
        if key not in _PRESENT:
            _PRESENT[key] = git_out(root, "show", "-s", "--format=%H", *assessed) is not None
        if not _PRESENT[key]:
            continue
        counts = [added_nonblank(root, h, language) for h in assessed]
        return None if any(c is None for c in counts) else (sum(c for c in counts if c is not None), root)
    return None


def split_entries(text: str) -> list[tuple[str, str]]:
    """An audit line's list, `path (why), path`, as (path, why) pairs: split at the commas outside parentheses, since a
    reason can hold one ("PDF.js viewer, vendored: …")."""
    parts, depth, start = [], 0, 0
    for i, ch in enumerate(text):
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        elif ch == "," and depth == 0 and text[i + 1:i + 2] == " ":
            parts.append(text[start:i])
            start = i + 2
    parts.append(text[start:])
    out = []
    for part in (x.strip() for x in parts):
        m = re.match(r"^(.*?) \((.*)\)$", part)
        if part:
            out.append((m.group(1), m.group(2)) if m else (part, ""))
    return out


THEIRS_WORDS = "; left out as someone else's code: "


def audit_line_parts(text: str) -> dict | None:
    """The figures and lists of the Deep review tab's audit line (`coverageLine` in core/findings.ts): what it read of
    how many of their own files, what of theirs it skipped, and someone else's code it left out. None for another line."""
    m = re.match(r"^Audited .*?: read (\d+) of (\d+) (?:own )?source files?(.*)\.$", text)
    if not m:
        return None
    rest = m.group(3)
    at = rest.find(THEIRS_WORDS)
    mine = rest[:at] if at != -1 else rest
    return {"read": int(m.group(1)), "files": int(m.group(2)),
            "skipped": split_entries(mine[len("; skipped "):]) if mine.startswith("; skipped ") else [],
            "theirs": split_entries(rest[at + len(THEIRS_WORDS):]) if at != -1 else []}


def check_audit_line(who: str, text: str, own: list[str] | None) -> list[tuple[str, str]]:
    """The audit line's figures add up for a reader: what it read and what of theirs it skipped is no more than their own
    files, and someone else's code is not among what of theirs it skipped ("read 11 of 13, skipped" six, four of them
    vendored and none of the 13: the seventeenth ui-truth pass, 2026-10-07). `own` is their own files at the commit
    audited, by the mod's rules, when HEAD is that commit."""
    parts = audit_line_parts(text)
    if parts is None:
        return []
    out: list[tuple[str, str]] = []
    why_theirs = mod_tables()["vendored_why"]
    worded = [(path, why) for path, why in parts["skipped"] if why_theirs.search(why)]
    if worded:
        out.append((BAD, f"{who}'s Deep review tab counts {parts['read']} of {parts['files']} of their own files read, and lists among what of theirs it skipped {len(worded)} it calls someone else's code ({worded[0][0]}: {brief(worded[0][1], 40)}): the figures do not add up for a reader"))
    if own is not None:
        is_own = lambda path: any(f == path or (path.endswith("/") and f.startswith(path)) for f in own)
        theirs_skipped = [path for path, _ in parts["skipped"] if is_own(path)]
        if parts["read"] + len(theirs_skipped) > parts["files"]:
            out.append((BAD, f"{who}'s Deep review tab says the audit read {parts['read']} of {parts['files']} of their own files and skipped {len(theirs_skipped)} more of them: more than there are"))
    return out


def check_growth_counts(who: str, texts: list[str], records: list) -> list[tuple[str, str]]:
    """The Growth tab's counts against the records it draws: "6.5 shown, 3.5 missed" were weights read as counts, and
    "8 of 8 observations" stood for fifteen (the seventeenth ui-truth pass, 2026-10-07)."""
    out: list[tuple[str, str]] = []
    tallies = []
    for r in records:
        if not isinstance(r, dict):
            continue
        seen = [o for o in (r.get("observations") or []) if isinstance(o, dict)]
        tallies.append({"shown": sum(1 for o in seen if o.get("verdict") == "shown"), "missed": sum(1 for o in seen if o.get("verdict") == "missed"),
                        "observations": len(seen), "commits": len({o.get("commit") for o in seen}), "lines read": r.get("linesRead") or 0})
    if not tallies:
        return out
    for text in texts:
        m = re.search(r"own commits: ([\d.]+) shown, ([\d.]+) missed", text)
        if m and not any(str(t["shown"]) == m.group(1) and str(t["missed"]) == m.group(2) for t in tallies):
            out.append((BAD, f"{who}'s Growth tab counts “{m.group(0)}”, and the records it draws hold " + "; ".join(f"{t['shown']} shown, {t['missed']} missed" for t in tallies) + ": weights read as counts"))
        for has, needs, what in re.findall(r"(\d+) of (\d+) (observations|commits|lines read)", text):
            if int(has) >= int(needs):
                out.append((BAD, f"{who}'s Growth tab says “{has} of {needs} {what}”: a figure capped at the bar, which the record may pass"))
            elif not any(t[what] == int(has) for t in tallies):
                out.append((BAD, f"{who}'s Growth tab says “{has} of {needs} {what}”, and no record it draws has {has}"))
        for has, what in re.findall(r"(\d+) (observations|commits|lines read) \(\d+ needed\)", text):
            if not any(t[what] == int(has) for t in tallies):
                out.append((BAD, f"{who}'s Growth tab says “{has} {what}”, and no record it draws has {has}"))
    return out


QUOTE_MARKS = (("'", "'"), ('"', '"'), ("`", "`"), ("“", "”"), ("‘", "’"))


def quoted_names(text: str, names: list[str]) -> list[str]:
    """The names a text quotes, as a reviewer quotes a part of the file (`quotesName` in core/project.ts)."""
    return [n for n in names if n and any(f"{a}{n}{b}" in text for a, b in QUOTE_MARKS)]


def issue_label(finding: dict) -> re.Pattern:
    """An issue's row label as the Deep review tab draws it, tidied as the drawing's pieces are: the mark of the one the
    keys act on, its severity, where it stands now (a line that moved, or "changed since"). Its title is the next piece."""
    file = str(finding.get("file", ""))
    where = "the project" if file == "." else re.escape(file) + r"(?::\d+)?(?:, changed since)?"
    return re.compile(rf"^(?:❯ )?{re.escape(str(finding.get('severity', '')))} · {where}$")


def drawn_issue_rows(texts: list[str], findings: list[dict]) -> list[list[dict]]:
    """The issue rows a drawing holds, in order: a label piece and the issue's title after it. Each row is the findings
    it can be, which is more than one only for issues alike in severity, place and title."""
    rows = []
    for i in range(len(texts) - 1):
        matching = [f for f in findings if issue_label(f).match(texts[i]) and texts[i + 1] == " ".join(str(f.get("title", "")).split())]
        if matching:
            rows.append(matching)
    return rows


def check_issues(w: dict, s: dict, project: dict | None) -> list[tuple[str, str]]:
    """The project's ledger of issues (findings.json) against the pane: what it holds, what the Deep review tab draws of
    it, and what the empty play-by-play says of it. The owner's 2026-10-07: a real codebase with a critical issue showed
    nothing in either view, and the silence read as "he wrote a perfect codebase"."""
    out: list[tuple[str, str]] = []
    state = s["state"]
    if state is None or tutor_mode(s) == "off" or project is None or not isinstance(dig(state, "pane.issues"), dict):
        return out
    now = w["now"]
    who = s["short"]
    stored = project.get("findings") if isinstance(project.get("findings"), dict) else {}
    on_disk = [f for f in (stored.get("findings") or []) if isinstance(f, dict)]
    coverage = stored.get("coverage") if isinstance(stored.get("coverage"), dict) else {}
    written = project.get("findings_at")
    if written is not None and now - written <= LEDGER_GRACE_MS:
        out.append((NOTE, f"findings.json of {project['id']} was written {ago(now - written)} ago: {who}'s issues are held against it next time"))
        return out
    is_open = lambda f: f.get("status") in ("open", "partly")

    # What the pane holds, against the file every session reads.
    in_pane = [f for f in (dig(state, "pane.issues.ledger.findings") or []) if isinstance(f, dict)]
    disk_open = {f.get("id") for f in on_disk if is_open(f)}
    pane_open = {f.get("id") for f in in_pane if is_open(f)}
    if disk_open != pane_open:
        lacks = sorted(disk_open - pane_open, key=str)
        extra = sorted(pane_open - disk_open, key=str)
        parts = ([f"lacks open issue(s) {', '.join(map(str, lacks))}"] if lacks else []) + ([f"holds issue(s) {', '.join(map(str, extra))} open, which findings.json has closed or lacks"] if extra else [])
        out.append((BAD, f"{who}'s ledger {' and '.join(parts)}: findings.json has {len(disk_open)} open"))
    else:
        out.append((FINE, f"{who}'s ledger has findings.json's {len(disk_open)} open issue(s)"))

    texts = [" ".join(t.split()) for t in (dig(state, "shown.pane.texts") or []) if isinstance(t, str)]
    tab = dig(state, "pane.tab")
    counts = ledger_counts(on_disk)
    if tab == "review" and texts:
        # Nothing closed is drawn as open, the open ones are drawn worst first, and none above low is left out.
        rows = drawn_issue_rows(texts, on_disk)
        for row in rows:
            if not any(is_open(f) for f in row):
                out.append((BAD, f"{who}'s Deep review tab draws issue {row[0].get('id')} “{row[0].get('title')}” as open, and findings.json has it {row[0].get('status')}"))
        drawn = [next(f for f in row if is_open(f)) for row in rows if any(is_open(f) for f in row)]
        ranks = [SEVERITIES.index(f["severity"]) for f in drawn if f.get("severity") in SEVERITIES]
        if ranks != sorted(ranks):
            out.append((BAD, f"{who}'s Deep review tab draws its issues out of order: {', '.join(str(f.get('severity')) for f in drawn)}"))
        # Within a severity, the reviewer's own order, which is the order of its ids (the fifteenth ui-truth pass,
        # 2026-10-07: security first had put the issue an audit ranked last at the top).
        for before, after in zip(drawn, drawn[1:]):
            if before.get("severity") == after.get("severity") and (before.get("id") or 0) > (after.get("id") or 0):
                out.append((BAD, f"{who}'s Deep review tab draws {after.get('severity')} issue {before.get('id')} “{before.get('title')}” before {after.get('id')} “{after.get('title')}”, against the reviewer's order"))
                break
        # No key that would do nothing: an issue about the whole project has no file to open.
        current = next((row for row in rows if any(is_open(f) for f in row) and any(t_.startswith("❯ ") for t_ in texts if issue_label(row[0]).match(t_))), None)
        if current is not None and current[0].get("file") == "." and "o: open in editor" in texts:
            out.append((BAD, f"{who}'s Deep review tab offers “o: open in editor” on issue {current[0].get('id')}, which is about the whole project and has no file to open"))
        shown_ids = {f.get("id") for row in rows for f in row}
        missing = [f for f in on_disk if is_open(f) and f.get("severity") != "low" and f.get("id") not in shown_ids]
        if missing:
            out.append((BAD, f"{who}'s Deep review tab lacks the row of {len(missing)} open issue(s) above low: " + ", ".join(f"{f.get('id')} “{f.get('title')}”" for f in missing[:3])))
        said = next((t for t in texts if t.startswith("Open: ")), None)
        expected = counts_words(counts)
        if expected and said is None:
            out.append((BAD, f"{who}'s Deep review tab says nothing of the {expected} open in findings.json"))
        elif said is not None and said != f"Open: {expected}":
            out.append((BAD, f"{who}'s Deep review tab says “{said}”, and findings.json has {expected or 'none'} open"))
        # The bugs and risks the play-by-play raised are on this tab too, so that a problem is in both views (2026-10-07).
        raised = [n for n in (dig(state, "pane.notes") or []) if isinstance(n, dict) and n.get("kind") in ("bug", "risk")]
        if raised and RAISED_HEADING not in texts:
            out.append((BAD, f"{who}'s Deep review tab does not list the {len(raised)} bug(s) and risk(s) the play-by-play raised"))
        elif raised:
            unlisted = [n for n in raised if " ".join(str(n.get("text", "")).split()) not in texts]
            if unlisted:
                out.append((BAD, f"{who}'s Deep review tab lists what the play-by-play raised without {len(unlisted)} of them: " + ", ".join(f"{n.get('file')}:{n.get('line')}" for n in unlisted[:3])))
        # What was read, or that nothing was: the tab is never silent about it.
        is_auditing = dig(state, "pane.review.state") == "running" and dig(state, "pane.review.subject") == AUDIT_SUBJECT
        if not is_auditing:
            if (coverage.get("at") or 0) > 0 and not any(t.startswith("Audited ") for t in texts):
                out.append((BAD, f"{who}'s Deep review tab does not say what the audit of {day_clock(coverage['at'], now)} read"))
            audit_root = state.get("repoRoot") or ""
            audited = str(coverage.get("commit", "")).rstrip("+")[:7]
            at_head = audit_root and audited and (git_out(audit_root, "rev-parse", "--short=7", "HEAD") or "").strip() == audited
            for t in texts:
                if t.startswith("Audited "):
                    out += check_audit_line(who, t, mod_own_files(audit_root, coverage.get("skipped") or []) if at_head else None)
            # An audit of another day, dated by a bare time of day: a reader takes it for today's.
            at = coverage.get("at") or 0
            if at > 0 and datetime.fromtimestamp(at / 1000).date() != datetime.fromtimestamp(now / 1000).date() and any(t.startswith(f"Audited {clock(at)[:5]}") for t in texts):
                out.append((BAD, f"{who}'s Deep review tab dates the audit {clock(at)[:5]}, a time of day, and it is of {day_clock(at, now)[:-3]}"))
            elif (coverage.get("at") or 0) <= 0 and not any(t.startswith(("Not audited for issues yet", "The audit did not finish")) for t in texts):
                out.append((BAD, f"{who}'s Deep review tab says nothing of an audit, and none is on record: its silence reads as an all-clear"))
    if tab == "play" and texts:
        # What it shows from the deep review is open, and every issue the person tracks is among it.
        rows = drawn_issue_rows(texts, on_disk)
        for row in rows:
            if not any(is_open(f) for f in row):
                out.append((BAD, f"{who}'s Play-by-play tab shows issue {row[0].get('id')} “{row[0].get('title')}” from the deep review, and findings.json has it {row[0].get('status')}"))
        tracked = [f for f in on_disk if is_open(f) and f.get("isPinned")]
        shown_ids = {f.get("id") for row in rows for f in row}
        if 0 < len(tracked) <= PLAY_PICKS and any(f.get("id") not in shown_ids for f in tracked):
            lost = [f for f in tracked if f.get("id") not in shown_ids]
            out.append((BAD, f"{who}'s Play-by-play tab does not show {len(lost)} tracked issue(s): " + ", ".join(f"{f.get('id')} “{f.get('title')}”" for f in lost[:3])))
    if tab == "play" and texts and not (dig(state, "pane.notes") or []) and dig(state, "pane.watch.state") != "no-git" and tutor_mode(s) == "on":
        expected = ledger_line(counts, project.get("is_audited") is True, coverage)
        said = next((t for t in texts if t.startswith(LEDGER_LINE_STARTS)), None)
        if said is None:
            out.append((BAD, f"{who}'s empty play-by-play says nothing of the ledger, which makes it “{expected}”: its silence reads as an all-clear"))
        elif said != expected:
            out.append((BAD, f"{who}'s empty play-by-play says “{said}”, and findings.json makes it “{expected}”"))

    # The issues the Explain tab shows in the code in focus: open, of that file.
    spot_path = dig(state, "pane.explain.spot.path")
    if tab == "explain" and texts and isinstance(spot_path, str):
        for text in texts:
            m = re.match(r"^Issue: (critical|high|medium|low) · line (\d+) (.+)$", text)
            if m and not any(is_open(f) and f.get("file") == spot_path and f.get("severity") == m.group(1) and " ".join(str(f.get("title", "")).split()) == m.group(3) for f in on_disk):
                out.append((BAD, f"{who}'s Explain tab shows the issue “{m.group(3)}” at {spot_path}:{m.group(2)}, which findings.json does not have open there"))
    # A bug or risk note beside an open issue on its line: a review adopts it, until then the same thing shows twice.
    for note in (dig(state, "pane.notes") or []):
        if not isinstance(note, dict) or note.get("kind") not in ("bug", "risk"):
            continue
        twin = next((f for f in on_disk if is_open(f) and f.get("file") == note.get("file") and (f.get("topic") == note.get("topic") or (int(f.get("line") or 0) > 0 and abs(int(f.get("line") or 0) - int(note.get("line") or 0)) <= 1))), None)
        if twin is not None:
            out.append((NOTE, f"{who}'s note {note.get('id')} at {note.get('file')}:{note.get('line')} stands beside issue {twin.get('id')} “{twin.get('title')}”: the next review of that file adopts it"))

    # Where the pane places each open issue, against the file: the line holds the issue's text and is no comment of it. A
    # file saved in the last minute is the next look's to place (the thirteenth ui-truth pass: a commented-out line, or
    # another line of the same text, would have kept a fixed issue standing).
    placed = dig(state, "pane.issues.placed") or {}
    root_now = state.get("repoRoot") or ""
    comment = COMMENT_LINE
    for f in on_disk:
        at = placed.get(str(f.get("id"))) if isinstance(placed, dict) else None
        if not is_open(f) or not root_now or not isinstance(at, int) or at <= 0 or str(f.get("file", "")) in ("", ".") or not str(f.get("lineText", "")).strip():
            continue
        path = pathlib.Path(root_now) / str(f["file"])
        try:
            if now - path.stat().st_mtime * 1000 < 60_000:
                continue
            lines = path.read_text(errors="replace").split("\n")
        except OSError:
            continue
        line = lines[at - 1].strip() if at - 1 < len(lines) else ""
        quote = str(f["lineText"]).strip()
        if quote not in line or (comment.match(line) and not comment.match(quote)):
            out.append((BAD, f"{who} places issue {f.get('id')} “{f.get('title')}” at {f['file']}:{at}, and that line no longer reads as the issue's"))

    # What the audit says it read, against the repository: a file that is not there, or more source files than git lists,
    # and a file it counts as read that it also skipped.
    root = state.get("repoRoot") or ""
    passed = {str(s.get("path")) for s in (coverage.get("skipped") or []) if isinstance(s, dict)}
    both = sorted(passed & {str(p) for p in (coverage.get("read") or [])})
    if both:
        out.append((BAD, f"the audit of {project['id']} counts {len(both)} file(s) as read that it also skipped: {', '.join(both[:3])}"))
    # Their own files, as the mod's own rules count them, while HEAD is what was audited: "16 source files" counted
    # PDF.js files the line itself called vendored (the fourteenth ui-truth pass, 2026-10-07).
    audited_at = str(coverage.get("commit", "")).rstrip("+")[:7]
    head = (git_out(root, "rev-parse", "--short=7", "HEAD") or "").strip() if root and audited_at else ""
    if head and head == audited_at:
        own = mod_own_files(root, coverage.get("skipped") or [])
        if own is not None and len(own) != (coverage.get("files") or 0):
            out.append((BAD, f"the audit of {project['id']} counts {coverage.get('files')} of their own source files, and the mod's rules count {len(own)} at {head}"))
    if isinstance(project.get("findings"), dict) and "v" not in project["findings"]:
        out.append((NOTE, f"findings.json of {project['id']} has no version: it gets one at its next change"))
    if (coverage.get("at") or 0) > 0 and root:
        listed = git_out(root, "ls-files", "-z")
        if listed is not None:
            files = {path for path in listed.split("\0") if path}
            unknown = [str(path) for path in (coverage.get("read") or []) if str(path) not in files and not (pathlib.Path(root) / str(path)).exists()]
            if unknown:
                out.append((BAD, f"the audit of {project['id']} says it read {len(unknown)} file(s) the repository does not have: {', '.join(unknown[:3])}"))
            if (coverage.get("files") or 0) > len(files):
                out.append((BAD, f"the audit of {project['id']} counts {coverage.get('files')} source files, and git lists {len(files)} files in all"))
    return out


def check_lately(who: str, state: dict, w: dict) -> list[tuple[str, str]]:
    """The commits the Growth tab cites under "Lately" (`lately` in core/progress.ts: the three latest observations),
    against the repositories of the projects they name: one no repository here has is history the tab presents as
    present (the sixteenth ui-truth pass, 2026-10-07: php-hello's commit from before the repository was made again)."""
    out: list[tuple[str, str]] = []
    folders = [p for home in w["homes"] for p in projects(home)]
    for record in (dig(state, "pane.progress.records") or []):
        if not isinstance(record, dict):
            continue
        for seen in list(reversed([o for o in (record.get("observations") or []) if isinstance(o, dict)]))[:3]:
            named = [p for p in folders if p["id"].rsplit("-", 1)[0] == seen.get("project") and p.get("root")]
            commit = str(seen.get("commit", ""))
            if not commit or any(git_out(str(p["root"]), "cat-file", "-t", commit) for p in named if pathlib.Path(str(p["root"])).exists()):
                continue
            out.append((NOTE, f"{who}'s Growth tab cites commit {commit[:7]} in {seen.get('project')} under “Lately”, and no repository here has it: history from before that project was made again"))
            return out
    return out


def check_cache(w: dict, s: dict, project: dict | None) -> list[tuple[str, str]]:
    """The pane against the project's cache on disk and the person's record: what a restart, a takeover and a
    session that does not drive take up from the folder, and what every session keeps in step with. The deep
    reviews, the notes kept about files unchanged since, what they said they are working on, the commits waiting,
    the level. The driver writes the project's files itself; a session that does not drive reads them at each beat
    of the lease, and the shared ones every session reads within seconds: a file written within that is not held
    against a pane. The owner's 2026-10-06: a fresh session beside the night's showed an empty Deep review tab with
    four reviews on disk, and took the cache for broken."""
    out: list[tuple[str, str]] = []
    state = s["state"]
    if state is None or tutor_mode(s) == "off" or project is None:
        return out
    now = w["now"]
    who = s["short"]
    is_driver = dig(state, "lease.isDriver") is True
    grace = DRIVER_GRACE_MS if is_driver else FOLLOW_GRACE_MS
    settled = lambda at, within=grace: at is not None and now - at > within

    # The deep reviews.
    pane_review = dig(state, "pane.review") if isinstance(dig(state, "pane.review"), dict) else {}
    reviews = project["reviews"]
    survey = project.get("survey")
    # The tab's history: the reviews kept, and the first look around, kept with the project (project.json).
    kept = len(reviews) + (1 if survey else 0)
    last = reviews[-1] if reviews else survey
    # project.json changes for other reasons (roles, insights): its time counts only for the survey it holds.
    written = max(project["reviews_at"] or 0, (project.get("project_at") or 0) if survey else 0) or None
    if last is not None and not settled(written):
        out.append((NOTE, f"the reviews of {project['id']} were written {ago(now - (written or now))} ago: {who}'s Deep review tab is held against them next time"))
    elif last is not None:
        older = pane_review.get("older") if isinstance(pane_review.get("older"), list) else []
        if pane_review.get("state") == "none":
            out.append((BAD, f"{who}'s Deep review tab has nothing to read, and the cache holds {kept} review(s), the latest “{last.get('subject')}” at {clock(last.get('at'))}: the cache is not taken up"))
        elif len(older) != kept:
            out.append((BAD, f"{who}'s Deep review tab lists {len(older)} review(s) in its history, and the cache holds {kept}"))
        elif pane_review.get("state") == "done" and pane_review.get("subject") not in (last.get("subject"), SURVEY_SUBJECT):
            out.append((BAD, f"{who}'s Deep review tab shows “{pane_review.get('subject')}” as the latest review, and the cache's latest is “{last.get('subject')}”"))
        else:
            out.append((FINE, f"{who}'s Deep review tab has the cache's {kept} review(s), the latest “{last.get('subject')}”"))

    # The notes kept about files unchanged since the look that raised them: still true, so still shown, unless dismissed here.
    notes = dig(state, "pane.notes")
    kept = [n for n in project["notes"] if isinstance(n, dict)]
    if isinstance(notes, list) and kept and settled(project["notes_at"]):
        shown = {n.get("id") for n in notes if isinstance(n, dict)}
        gone = {(n.get("file"), n.get("topic")) for n in (dig(state, "pane.dismissed") or []) if isinstance(n, dict)}
        root = state.get("repoRoot") or ""
        missing = [n for n in kept if n.get("id") not in shown and (n.get("file"), n.get("topic")) not in gone
                   and unchanged_since(root, str(n.get("file", "")), project["notes_at"], now)]
        if missing:
            named = ", ".join("%s: “%s”" % (n.get("file"), str(n.get("text", ""))[:40]) for n in missing[:3])
            out.append((BAD, f"{who}'s pane lacks {len(missing)} note(s) that notes.json keeps about files unchanged since it was written: {named}"))

    # What they said they are working on, which holds across sessions.
    said = dig(project["journal"], "said")
    pane_said = dig(state, "pane.working.said")
    if isinstance(said, dict) and isinstance(said.get("text"), str) and isinstance(pane_said, str) and said["text"] != pane_said:
        # The driver's own journal merges the file at its next write (later wins): held against it once it has written since.
        is_due = settled(project["journal_at"]) if not is_driver else (project["journal_at"] or 0) > (said.get("at") or 0) + DRIVER_GRACE_MS
        if is_due:
            out.append((BAD, f"{who}'s pane says they are working on “{pane_said or '(nothing said)'}”, and the journal says they said “{said['text'] or '(taken back)'}” at {day_clock(said.get('at'), now)}"))

    # The commits waiting, as the tab counts them. The driver's count in memory is held against the file in check_world.
    if not is_driver and isinstance(project["queue"], dict) and settled(project["queue_at"]):
        count = len([c for c in project["queue"].get("commits", []) if isinstance(c, dict) and not c.get("isReviewed")])
        counted = pane_review.get("waiting") or 0
        if count != counted:
            out.append((BAD, f"{who}'s Deep review tab counts {counted} commit(s) waiting for their review, and queue.json has {count}"))

    # The latest reviewed commit, accounted for: assessed in some record, waiting, or with its reason on record. A reader
    # with four reviews in the tab and "3 of 3 commits" in Growth had no way to learn why (the fourth ui-truth pass, 2026-10-06).
    latest = next((r for r in reversed(reviews) if r.get("commit")), None)
    if latest is not None and isinstance(dig(state, "pane.progress"), dict) and (dig(state, "loaded.options.progress_report") is not False) and s["home"] is not None:
        short = str(latest.get("commit"))
        assessed = any(str(h).startswith(short) for file in (s["home"] / "progress").glob("*.json") for h in ((read_json(file) or {}).get("assessed") or []))
        waiting = any(str(c.get("hash", "")).startswith(short) for c in (dig(project["queue"], "commits") or []) if isinstance(c, dict)) if isinstance(project["queue"], dict) else False
        said = " ".join(str(x) for x in (dig(state, "pane.progress.skipped"), dig(state, "pane.progress.busy"), (read_json(project["dir"] / "watched.json") or {}).get("skipped")) if x)
        if not assessed and not waiting and short not in said and settled(project["reviews_at"], SHARED_GRACE_MS):
            out.append((BAD, f"{who}'s Growth tab says nothing of commit {short}, which the Deep review tab reviewed at {clock(latest.get('at'))}: not assessed, not waiting, and no reason on record"))
        elif not assessed and not waiting:
            out.append((FINE, f"{who}'s Growth tab says why commit {short} did not count"))

    # With no review of any commit, HEAD itself: the person's own, old enough to have been looked at, must be
    # assessed, waiting, or named in the reason on record (the ninth ui-truth pass, 2026-10-07: an import of 385
    # files, skipped silently by a first placement under a copy from before the reason was kept, and nothing since said why).
    identity = [str(x).lower() for x in (dig(state, "pane.progress.identity") or []) if isinstance(x, str)]
    root_now = state.get("repoRoot") or ""
    if latest is None and identity and root_now and isinstance(dig(state, "pane.progress"), dict) and (dig(state, "loaded.options.progress_report") is not False) and s["home"] is not None:
        parts = (git_out(root_now, "log", "-1", "--format=%H%x00%ae%x00%ct") or "").strip().split("\0")
        if len(parts) == 3 and parts[1].lower() in identity and parts[2].isdigit() and now - int(parts[2]) * 1000 > HEAD_GRACE_MS:
            short = parts[0][:7]
            assessed = any(str(h).startswith(short) for file in (s["home"] / "progress").glob("*.json") for h in ((read_json(file) or {}).get("assessed") or []))
            waiting = any(str(c.get("hash", "")).startswith(short) for c in (dig(project["queue"], "commits") or []) if isinstance(c, dict)) if isinstance(project["queue"], dict) else False
            said = " ".join(str(x) for x in (dig(state, "pane.progress.skipped"), dig(state, "pane.progress.busy"), (read_json(project["dir"] / "watched.json") or {}).get("skipped")) if x)
            if not assessed and not waiting and short not in said:
                out.append((BAD, f"{who}'s Growth tab says nothing of HEAD {short}, the person's own commit of {ago(now - int(parts[2]) * 1000)} ago with no review: not assessed, not waiting, and no reason on record"))
            else:
                out.append((FINE, f"{who}'s Growth tab accounts for HEAD {short}, the person's own commit with no review"))

    # A patch past what the host keeps is read in part: the numbers in the skip line are a floor and must say so, and a
    # commit assessed on such a patch was judged on part of its code (the tenth ui-truth pass, 2026-10-07: "5400
    # lines in 16 files" for 21155, the person's own code after a vendored file never read).
    skipped_now = str(dig(state, "pane.progress.skipped") or (read_json(project["dir"] / "watched.json") or {}).get("skipped") or "")
    cut_named = re.search(r"Commit ([0-9a-f]{7,40}) ", skipped_now)
    root_cut = state.get("repoRoot") or ""
    if cut_named and root_cut and "lines in" in skipped_now and "more than" not in skipped_now and "larger than the tutor reads" not in skipped_now:
        size = patch_size(root_cut, cut_named.group(1))
        if size is not None and size > OUTPUT_CAP:
            out.append((BAD, f"{who}'s Growth tab counts commit {cut_named.group(1)}'s patch as whole, and it is {size // 1024 // 1024} MiB, past the {OUTPUT_CAP // 1024 // 1024} MiB the host keeps: the numbers are of its start"))
    if root_cut and s["home"] is not None:
        for file in sorted((s["home"] / "progress").glob("*.json")):
            for hash_ in ((read_json(file) or {}).get("assessed") or [])[-ASSESSED_MEASURED:]:
                size = patch_size(root_cut, str(hash_))
                if size is not None and size > OUTPUT_CAP:
                    out.append((BAD, f"progress/{file.name} assessed commit {str(hash_)[:7]} on a patch of {size // 1024 // 1024} MiB, past the {OUTPUT_CAP // 1024 // 1024} MiB the host keeps: judged on part of its code"))

    # The watched files of a commit the tab says did not count: they leave with it, as a settled commit's do, or a
    # later commit of the person's own weighs in full for saves the tutor never watched (the fifth ui-truth pass, 2026-10-06).
    skipped_text = str(dig(state, "pane.progress.skipped") or (read_json(project["dir"] / "watched.json") or {}).get("skipped") or "")
    m = re.search(r"Commit ([0-9a-f]{7,40}) ", skipped_text)
    watched = (read_json(project["dir"] / "watched.json") or {}).get("paths") or []
    root = state.get("repoRoot") or ""
    if m and watched and root:
        named = git_out(root, "show", "--name-only", "--format=", m.group(1))
        kept = sorted(set(watched) & set((named or "").split())) if named is not None else []
        if kept and settled(mtime_ms(project["dir"] / "watched.json"), SHARED_GRACE_MS):
            out.append((BAD, f"{who} keeps {len(kept)} watched file(s) of commit {m.group(1)}, which did not count: {', '.join(kept[:3])}{' and more' if len(kept) > 3 else ''}: a later commit of theirs would weigh in full for saves never watched"))

    # A review of another day drawn with a bare time of day, on the open Deep review tab: a stale clock to a reader.
    if dig(state, "pane.tab") == "review":
        older = [r for r in (pane_review.get("older") or []) if isinstance(r, dict)]
        texts_drawn = [t for t in (dig(state, "shown.pane.texts") or []) if isinstance(t, str)]
        for r in older:
            at = r.get("at")
            if not isinstance(at, (int, float)) or datetime.fromtimestamp(at / 1000).date() == datetime.fromtimestamp(now / 1000).date():
                continue
            bare = clock(at)[:5]
            if any(t.lstrip("▸❯▾ ").startswith(f"{bare}  ") or t.endswith(f"· {bare}") for t in texts_drawn):
                out.append((BAD, f"{who}'s Deep review tab dates “{r.get('subject')}” {bare}, a time of day, and it is of {day_clock(at, now)[:-3]}: a reader takes it for today's"))
                break

    # The level, which any session may change, and which the bar for a first placement has to support: a provisional
    # level placed under an older bar stood for a day with "Not placed yet" above it (the second ui-truth pass, 2026-10-06).
    for record in (dig(state, "pane.progress.records") or []):
        if not isinstance(record, dict):
            continue
        language = str(record.get("language", ""))
        seen = [o for o in (record.get("observations") or []) if isinstance(o, dict)]
        commits = len({o.get("commit") for o in seen})
        lines = record.get("linesRead") or 0
        if record.get("level") and record.get("isProvisional") and (len(seen) < PLACE_OBSERVATIONS or commits < PLACE_COMMITS or lines < PLACE_LINES):
            out.append((BAD, f"{who}'s Growth tab places {language} at {record.get('level')} (provisional) on {len(seen)} observation(s) from {commits} commit(s) and {lines} line(s) read, under the bar of {PLACE_OBSERVATIONS} from {PLACE_COMMITS} and {PLACE_LINES}: a placement the rules no longer support"))
        if s["home"] is None:
            continue
        file = s["home"] / "progress" / f"{language}.json"
        stored = read_json(file) or {}
        if isinstance(stored, dict) and stored and settled(mtime_ms(file), max(grace, SHARED_GRACE_MS)) and stored.get("level") != record.get("level"):
            out.append((BAD, f"{who}'s Growth tab places {language} at {record.get('level') or 'no level'}, and progress/{language}.json says {stored.get('level') or 'no level'}"))
    return out


def print_bundle(w: dict, s: dict) -> None:
    """One session, everything a reader needs to judge its pane: the screen as the person sees it, what the tutor
    says it drew, the pane's state tab by tab, the cache on disk, what the person was told lately, and the checks."""
    now = w["now"]
    state = s["state"] or {}
    mode = tutor_mode(s)
    drives = "drives" if dig(state, "lease.isDriver") is True else "does not drive"
    print(f"=== SESSION {s['short']} · {s['kind']} {s['status']} · {tilde(s['cwd'])} · eyes {eyes_label(s['eyes'])} · tutor {mode} · {drives} · {copy_label(s)}")
    rows = screen_of(s["eyes"])
    eyes = s["eyes"] if isinstance(s["eyes"], dict) else {}
    print(f"--- SCREEN ({eyes.get('cols', '?')}x{eyes.get('rows', '?')}) as the person sees it")
    if rows is None:
        print("(cannot be seen: not in tmux and not in the background)")
    else:
        print("\n".join(row.rstrip() for row in rows).rstrip("\n"))
    shown = state.get("shown") if isinstance(state.get("shown"), dict) else {}
    drawing = shown.get("band") if shown.get("minimized") else shown.get("pane")
    if isinstance(drawing, dict):
        print(f"--- WHAT IT SAYS IT DRAWS ({'the strip above the prompt' if shown.get('minimized') else 'the pane'}, drawn {ago(now - (drawing.get('at') or now))} ago, {drawing.get('placement')}, {drawing.get('columns')} columns, {'focused' if drawing.get('isFocused') else 'keys off'})")
        print(" ¦ ".join(str(t) for t in drawing.get("texts", []) if isinstance(t, str)))
    pane = state.get("pane") if isinstance(state.get("pane"), dict) else {}
    print("--- THE PANE'S STATE (what each tab draws from)")
    watch = pane.get("watch") if isinstance(pane.get("watch"), dict) else {}
    print(f"tab open: {pane.get('tab')} · minimized: {'yes' if shown.get('minimized') else 'no'} · status: {watch.get('line')} · health: {watch.get('health') or '-'} · editors: {watch.get('editors') if watch.get('editors') is not None else '(no light)'}")
    working = pane.get("working") if isinstance(pane.get("working"), dict) else {}
    print(f"working on: said “{working.get('said', '')}” · inferred “{working.get('inferred', '')}” · where “{working.get('where', '')}”")
    notes = [n for n in (pane.get("notes") or []) if isinstance(n, dict)]
    dismissed = [n for n in (pane.get("dismissed") or []) if isinstance(n, dict)]
    print(f"notes: {len(notes)} open, {len(dismissed)} dismissed")
    for n in notes:
        print(f"  #{n.get('id')} {n.get('kind')} {n.get('file')}:{n.get('line')} “{brief(n.get('text'), 110)}”")
    issues = pane.get("issues") if isinstance(pane.get("issues"), dict) else {}
    held = [f for f in (dig(issues, "ledger.findings") or []) if isinstance(f, dict)]
    print(f"issues: {len(held)} in the ledger, open {counts_words(ledger_counts(held)) or 'none'} · selected {pane.get('selectedIssue')} · audited {'yes' if issues.get('isAudited') else 'no'} · placed " + ", ".join(f"{k}: {v}" for k, v in (issues.get("placed") or {}).items()))
    review = pane.get("review") if isinstance(pane.get("review"), dict) else {}
    older = review.get("older") if isinstance(review.get("older"), list) else []
    print(f"review: state {review.get('state')} · subject “{review.get('subject')}” · {'unseen' if review.get('isUnseen') else 'seen'} · {len(older)} in history · opened {review.get('opened', 0)} · waiting {review.get('waiting') or 0}")
    if review.get("text"):
        print(f"  text: “{brief(review.get('text'), 200)}”")
    for r in (pane.get("progress") or {}).get("records", []) if isinstance(pane.get("progress"), dict) else []:
        if isinstance(r, dict):
            # "provisional" belongs to a level, as the pane draws it: a record with none is "not placed".
            print(f"growth: {r.get('language')} {r.get('level') or 'not placed'}{' (provisional)' if r.get('level') and r.get('isProvisional') else ''} · {len(r.get('observations') or [])} observations")
    lessons = pane.get("lessons") if isinstance(pane.get("lessons"), dict) else {}
    print(f"lessons: {len(lessons.get('paths') or [])} path(s) · selected {lessons.get('selected')} · update notice: {brief(pane.get('update'), 80) or '-'} · license line: {brief(pane.get('license'), 80) or '-'}")
    speech = pane.get("speech") if isinstance(pane.get("speech"), dict) else {}
    print(f"character says: “{speech.get('text', '')}”")
    setting_rows = [r for r in (pane.get("settings") or []) if isinstance(r, dict)]
    print("settings tab: " + ("; ".join(f"{r.get('label')}: {r.get('value')}" for r in setting_rows) if setting_rows else "(no rows in the state)"))
    root = state.get("repoRoot") or ""
    project = next((p for home in w["homes"] for p in projects(home) if root and (p["root"] == root or p["id"] == project_id(root))), None) if root else None
    print(f"--- THE CACHE ON DISK ({project['id'] if project else 'no project folder'})")
    if project is not None:
        lease = project["lease"]
        since = lambda at: f"written {ago(now - at)} ago" if at else "not written"
        print(f"lease: {short(str(lease.get('session', ''))) or 'free'} renewed {ago(now - (lease.get('at') or 0))} ago")
        print(f"notes.json ({since(project['notes_at'])}): {len(project['notes'])} open, {len(project['dismissed'])} dismissed")
        for n in project["notes"]:
            if isinstance(n, dict):
                print(f"  #{n.get('id')} {n.get('kind')} {n.get('file')}:{n.get('line')} “{brief(n.get('text'), 110)}”")
        print(f"reviews.json ({since(project['reviews_at'])}): {len(project['reviews'])} review(s), oldest first")
        for r in project["reviews"]:
            print(f"  {day_clock(r.get('at'), now)} “{r.get('subject')}” · {len(r.get('decisions') or [])} decision(s), {len(r.get('insights') or [])} insight(s) · “{brief(r.get('text'), 90)}”")
        waiting = [c for c in (dig(project["queue"], "commits") or []) if isinstance(c, dict)] if isinstance(project["queue"], dict) else []
        print(f"queue.json ({since(project['queue_at'])}): {len(waiting)} waiting: " + ", ".join(f"{str(c.get('hash', ''))[:7]} “{c.get('title')}”{' reviewed' if c.get('isReviewed') else ''}" for c in waiting))
        said = dig(project["journal"], "said") or {}
        inferred = dig(project["journal"], "inferred") or {}
        print(f"journal.json ({since(project['journal_at'])}): said “{said.get('text', '') if isinstance(said, dict) else ''}” at {day_clock(said.get('at'), now) if isinstance(said, dict) and said.get('at') else '-'} · inferred “{inferred.get('text', '') if isinstance(inferred, dict) else ''}” · {len(dig(project['journal'], 'entries') or [])} entries in this sitting")
        # The ledger, by title and place: never the quoted line, which can hold what a secret's line holds.
        ledger = project.get("findings") or {}
        found = [f for f in (ledger.get("findings") or []) if isinstance(f, dict)]
        cov = ledger.get("coverage") if isinstance(ledger.get("coverage"), dict) else {}
        audit = (f"audited {day_clock(cov.get('at'), now)} at {cov.get('commit') or '-'}: read {len(cov.get('read') or [])} file(s) of their {cov.get('files')} own source file(s) by the mod's count, skipped {len(cov.get('skipped') or [])}"
                 if (cov.get("at") or 0) > 0 else "an audit started and never finished" if project.get("is_audited") else "never audited")
        print(f"findings.json ({since(project['findings_at'])}): {len(found)} issue(s), open {counts_words(ledger_counts(found)) or 'none'} · {audit}")
        for f in found:
            print(f"  #{f.get('id')} {f.get('status')} {f.get('severity')} {f.get('category')} {f.get('file')}:{f.get('line')} “{brief(f.get('title'), 80)}” · {f.get('origin')} {f.get('commit') or ''}{' · ' + brief(f.get('condition'), 60) if f.get('condition') else ''}")
    if s["home"] is not None:
        for file in sorted((s["home"] / "progress").glob("*.json")):
            stored = read_json(file) or {}
            if isinstance(stored, dict):
                print(f"{file.parent.name}/{file.name} (written {ago(now - (mtime_ms(file) or now))} ago): level {stored.get('level') or 'none'}{' (provisional)' if stored.get('level') and stored.get('isProvisional') else ''} · {len(stored.get('observations') or [])} observations")
        print("profiles: " + ", ".join(f.stem for f in sorted((s["home"] / "profiles").glob("*.json"))))
        for e in editors(s["home"]):
            d = e["data"]
            print(f"editor {d.get('editor', e['name'])} pid {d.get('pid')} {'alive' if e['alive'] else 'GONE'} · wrote {ago(now - (e['at'] or 0))} ago · {tilde(str(d.get('file', '')))}:{d.get('line', '')}")
        book = (read_json(s["home"] / "sessions.json") or {}).get("sessions", [])
        print("sessions.json: " + "; ".join(f"{short(str(e.get('session', '')))} {e.get('mode')} born {day_clock(e.get('born'), now)} said {ago(now - (e.get('at') or 0))} ago{' left' if e.get('leftAt') else ''}" for e in book if isinstance(e, dict)))
    print("--- SAID LATELY (outside the pane, newest last)")
    for told in said_lately(state, s["debug"], now)[-8:]:
        print(f"  {clock(told.get('at'))} {told.get('how')}: {brief(told.get('text'), 140)}")
    print("--- CHECKS (!! disagrees, ok agrees, ·· a note)")
    for level, text in check_session(w, s, rows):
        print(f"  {level} {text}")
    print()


def said_lately(state: dict, debug: pathlib.Path | None, now: int) -> list[dict]:
    """What the person was told lately: the state's ring, and when a reload emptied it (it is the module's), the
    `said` records of the last ten minutes from the log (the fifth ui-truth pass, 2026-10-06: a toast nineteen
    seconds before a reload was nowhere on the page)."""
    ring = [told for told in (state.get("said") or []) if isinstance(told, dict)]
    if ring:
        return ring
    out = []
    for r in log_records(debug)[-600:]:
        if r.get("k") == "said" and now - (r.get("t") or 0) < 600_000:
            d = r.get("d") if isinstance(r.get("d"), dict) else {}
            out.append({"at": r.get("t"), "how": r.get("n"), "text": d.get("text", "")})
    return out


def cmd_bundle(args) -> int:
    w = world(args.home)
    chosen = [need(w, args.session)] if args.session else [s for s in w["sessions"] if not s["is_me"] and tutor_mode(s) != "off"]
    if not chosen:
        print("no session with the tutor on: `scripts/jack.py` lists them")
        return 2
    print(f"jack bundle · {clock(w['now'])} · working copy {working_copy()} · {len(chosen)} session(s)\n")
    for s in chosen:
        print_bundle(w, s)
    print_home_checks(w)
    return 0


def print_home_checks(w: dict) -> None:
    """What the data folder says, against the world: the leases, the sessions' word, the records, the editors' roots.
    Printed by `status` and `truth`, and missing from the page the ui-truth pass reads until 2026-10-07 (the tenth pass)."""
    print("--- HOME CHECKS (the data folder against the world; !! disagrees, ok agrees, ·· a note)")
    for level, text in check_homes(w):
        print(f"  {level} {text}")


# ------------------------------------------------------------------ what it told the person ----
# How long after the tutor said something it is looked for: drawing takes a moment, and a line scrolls away.
SAID_SETTLE_MS = 1_500
SAID_RECENT_MS = 10_000
# A toast stays about four seconds.
TOAST_MS = 3_500
# Of a long line, this much of its start is looked for: the rest may be wrapped or cut.
SAID_PREFIX = 24


def is_said_on_screen(text: str, rows: list[str]) -> bool:
    """Whether something the tutor told the person is on the screen. The transcript prefixes it with the plugin's
    name, a toast may be cut short in its box: its start is what is looked for, in the whole screen and each side."""
    want = squash(demark(text))
    if len(want) < 3:
        return True
    want = want[:SAID_PREFIX].rstrip()
    return any(want in flow for flow in flows(rows))


def check_said(w: dict, s: dict, rows: list[str] | None) -> list[tuple[str, str]]:
    """What the tutor told the person outside its pane (a toast, a line in the transcript, the answer to /backseat, a
    prompt sent in their name, a question in a dialog), against the screen."""
    out: list[tuple[str, str]] = []
    state = s["state"]
    if state is None or rows is None:
        return out
    now = w["now"]
    who = s["short"]
    for item in state.get("said") or []:
        if not isinstance(item, dict) or not isinstance(item.get("text"), str):
            continue
        age = now - (item.get("at") or 0)
        how = item.get("how")
        window = TOAST_MS if how == "toast" else SAID_RECENT_MS
        if how == "asked" or not SAID_SETTLE_MS <= age <= window:
            continue
        if is_said_on_screen(item["text"], rows):
            out.append((FINE, f"{who}'s {how} “{item['text'][:50]}” is on its screen"))
        else:
            out.append((BAD, f"{who} says it told the person “{item['text'][:70]}” ({how}, {ago(age)} ago), and it is not on its screen"))
    asking = state.get("asking")
    if isinstance(asking, dict) and isinstance(asking.get("question"), str) and now - (asking.get("at") or now) >= SAID_SETTLE_MS:
        if is_said_on_screen(asking["question"], rows):
            out.append((FINE, f"{who}'s question is on its screen: “{asking['question'][:50]}”"))
        else:
            out.append((BAD, f"{who} says a dialog has asked “{asking['question'][:70]}” for {ago(now - asking['at'])}, and no such question is on its screen"))
    hint = dig(state, "shown.hint")
    if tutor_mode(s) != "off" and dig(state, "session.layout") == "unified" and isinstance(hint, str) and hint:
        if is_said_on_screen(hint, rows):
            out.append((FINE, f"{who}'s hint line ends as it says: “{hint}”"))
        else:
            out.append((BAD, f"{who} says the hint line under the prompt ends “{hint}”, and it is not on its screen"))
    return out


# ------------------------------------------------------------------ what it believes about the world ----
def patch_size(root: str, hash_: str) -> int | None:
    """How many bytes a commit's patch is as the tutor asks for it (`commitPatchArgs`: `--unified=0`, no header), or
    None when git does not know the commit here."""
    try:
        p = subprocess.run(["git", "--no-optional-locks", "-C", root, "show", "--format=", "--unified=0", hash_], capture_output=True, timeout=30)
    except (OSError, subprocess.TimeoutExpired):
        return None
    return len(p.stdout) if p.returncode == 0 else None


def git_out(root: str, *args: str) -> str | None:
    code, out, _ = run(["git", "--no-optional-locks", "-C", root, *args], timeout=10)
    return out if code == 0 else None


def git_dirty(root: str) -> set[str] | None:
    """The changed files that still exist, as the tutor asks git for them (plugin/core/git.ts `dirtyPaths`)."""
    out = git_out(root, "status", "--porcelain=v1", "-z", "--untracked-files=all")
    if out is None:
        return None
    fields = out.split("\0")
    paths: set[str] = set()
    i = 0
    while i < len(fields):
        field = fields[i]
        i += 1
        if len(field) < 4:
            continue
        index, worktree, path = field[0], field[1], field[3:]
        if index in "RC" or worktree in "RC":
            i += 1
        if worktree != "D" and not (index == "D" and worktree == " "):
            paths.add(path)
    return paths


def git_dir(root: str) -> pathlib.Path | None:
    out = git_out(root, "rev-parse", "--absolute-git-dir")
    return pathlib.Path(out.strip()) if out else None


# The settings a session reads, in the order a later one wins (Claude Code's user, project and local settings,
# then a --settings flag). Managed settings are left out: a check that cannot see them says less, never more.
def settings_layers(s: dict) -> list[dict]:
    layers = []
    config = s.get("config") or default_config()
    for path in [pathlib.Path(config) / "settings.json", pathlib.Path(s["cwd"] or "/nonexistent") / ".claude" / "settings.json",
                 pathlib.Path(s["cwd"] or "/nonexistent") / ".claude" / "settings.local.json"]:
        found = read_json(path)
        if isinstance(found, dict):
            layers.append(found)
    argv = s.get("argv") or []
    for i, word in enumerate(argv):
        value = argv[i + 1] if word == "--settings" and i + 1 < len(argv) else (word.split("=", 1)[1] if word.startswith("--settings=") else None)
        if value is None:
            continue
        try:
            given = json.loads(value) if value.lstrip().startswith("{") else json.loads(pathlib.Path(value).read_text())
        except (OSError, ValueError):
            continue
        if isinstance(given, dict):
            layers.append(given)
    return layers


def configured_options(s: dict) -> dict:
    """The plugin's options as the settings files say them, for the copy the session runs: the working copy's are
    under `backseat-driver@inline`, an installed copy's under its marketplace's name."""
    is_working_copy = s.get("plugin") not in (None, "installed", "?")
    merged: dict = {}
    for layer in settings_layers(s):
        configs = layer.get("pluginConfigs")
        if not isinstance(configs, dict):
            continue
        for key, value in configs.items():
            name, _, where = str(key).partition("@")
            if name != PLUGIN or (where == "inline") != is_working_copy and where != "":
                continue
            options = value.get("options") if isinstance(value, dict) else None
            if isinstance(options, dict):
                merged.update(options)
    return merged


def same_option(one, other) -> bool:
    norm = lambda v: str(v).lower() if isinstance(v, bool) else str(v)
    return norm(one) == norm(other)


def newest_source(plugin: str) -> tuple[float, str] | None:
    """The newest file of a working copy's plugin folder that a session loads, and when it was saved."""
    root = pathlib.Path(plugin)
    best: tuple[float, str] | None = None
    for path in root.rglob("*"):
        rel = path.relative_to(root)
        if not path.is_file() or rel.parts[0] in ("tests", "node_modules") or rel.parts[:2] == (".claude-plugin", "types"):
            continue
        at = mtime_ms(path) or 0
        if best is None or at > best[0]:
            best = (at, str(rel))
    return best


# Claude Code looks for a changed file under --plugin-dir every 30 s while idle: later than that, it missed one.
RELOAD_GRACE_MS = 45_000
# The editor's caret is followed within a scan, and the fast lane checks ten times a second: three seconds is late.
FOLLOW_MS = 3_000
# A file saved this close before a scan may have been caught half-written: the next scan says.
SCAN_SLACK_MS = 500


def check_world(w: dict, s: dict) -> list[tuple[str, str]]:
    """What the tutor believes about the world outside the screen, against the world: the code it runs, the
    settings it runs with, the working tree, HEAD, the commits waiting, the editor's caret."""
    out: list[tuple[str, str]] = []
    state = s["state"]
    if state is None or tutor_mode(s) == "off":
        return out
    now = w["now"]
    who = s["short"]

    # The code it runs.
    loaded_at = dig(state, "loaded.at")
    if s.get("plugin") not in (None, "installed", "?") and isinstance(loaded_at, (int, float)):
        newest = newest_source(s["plugin"])
        if newest is not None and newest[0] > loaded_at + 1000 and now - newest[0] > RELOAD_GRACE_MS:
            out.append((BAD, f"{who} loaded the mod {ago(now - loaded_at)} ago, and {newest[1]} was saved {ago(now - newest[0])} ago: it runs code older than the working copy (/reload-plugins in it)"))
        elif newest is not None:
            out.append((FINE, f"{who} runs the {copy_label(s)} as it is (loaded {ago(now - loaded_at)} ago)"))

    # The settings it runs with.
    options = dig(state, "loaded.options")
    if isinstance(options, dict):
        said = configured_options(s)
        differ = [k for k, v in said.items() if k in options and not same_option(v, options[k])]
        if differ:
            shown = ", ".join(f"{k}: {said[k]} in the settings, {options[k]} in force" for k in differ[:4])
            out.append((BAD, f"{who} runs with settings that are not the ones saved ({shown}): a change that did not load the mod again. /reload-plugins applies it"))
        elif said:
            out.append((FINE, f"{who} runs with the settings as saved ({len(said)} set)"))

    root = state.get("repoRoot") or ""
    is_driver = dig(state, "lease.isDriver") is True
    scanned = dig(state, "scan.lastScanAt")
    if not root or not is_driver or tutor_mode(s) != "on" or not isinstance(scanned, (int, float)) or scanned <= 0:
        return out

    # HEAD.
    gitdir = git_dir(root)
    head = (git_out(root, "rev-parse", "HEAD") or "").strip()
    believed = dig(state, "review.lastHead")
    moved_at = mtime_ms(gitdir / "logs" / "HEAD") if gitdir else None
    if head and isinstance(believed, str) and believed and head != believed:
        if moved_at is not None and moved_at < scanned - SCAN_SLACK_MS:
            out.append((BAD, f"{who} believes HEAD is {believed[:7]}, and it is {head[:7]}, moved {ago(now - moved_at)} ago, before its last scan {ago(now - scanned)} ago: it missed a commit or a checkout"))
    elif head and believed == head:
        out.append((FINE, f"{who} knows HEAD: {head[:7]}"))

    # The working tree.
    dirty = git_dirty(root)
    seen = set((dig(state, "watcher.dirty") or []) + (dig(state, "watcher.noise") or []))
    if dirty is not None and dig(state, "watcher") is not None:
        before = lambda path: (mtime_ms(pathlib.Path(root) / path) or now) < scanned - SCAN_SLACK_MS
        unseen = sorted(p for p in dirty - seen if before(p))
        ghosts = sorted(p for p in seen - dirty if (pathlib.Path(root) / p).exists() and before(p) and (moved_at or 0) < scanned - SCAN_SLACK_MS)
        if unseen:
            out.append((BAD, f"{who} has not seen {len(unseen)} changed file(s) saved before its last scan {ago(now - scanned)} ago: {', '.join(unseen[:4])}"))
        if ghosts:
            out.append((BAD, f"{who} believes {len(ghosts)} file(s) are changed that git calls clean: {', '.join(ghosts[:4])}"))
        if not unseen and not ghosts:
            out.append((FINE, f"{who} sees the working tree as git does: {len(dirty)} changed file(s)"))

    # The commits waiting for their review.
    project = next((p for home in w["homes"] for p in projects(home) if p["id"] == project_id(root)), None)
    queue_file = project["dir"] / "queue.json" if project else None
    on_disk = [c.get("hash") for c in (dig(project["queue"], "commits") or []) if isinstance(c, dict)] if project and isinstance(project["queue"], dict) else []
    in_memory = [c.get("hash") for c in (dig(state, "review.waiting.commits") or []) if isinstance(c, dict)]
    written = mtime_ms(queue_file) if queue_file else None
    if (on_disk or in_memory) and on_disk != in_memory and written is not None and written < (state.get("at") or 0) - 2000:
        out.append((BAD, f"{who} has {len(in_memory)} commit(s) waiting for a review in memory, and queue.json keeps {len(on_disk)}"))

    # The editor's caret.
    if dig(state, "explain.isOn") is True and s["home"] is not None:
        here = editors_here(editors(s["home"]), root, now)
        speaker = max(here, key=lambda e: e["data"].get("changed") or 0, default=None)
        followed = dig(state, "explain.editorFocusAt") or 0
        if speaker is not None:
            d = speaker["data"]
            moved = d.get("changed") or 0
            # The belief is as old as the state file (written every ten seconds when nothing is logged): a caret that
            # moved after it was written is not one the tutor failed to follow.
            believed_at = state.get("at") if isinstance(state.get("at"), (int, float)) else now
            if moved > followed + FOLLOW_MS and believed_at - moved > FOLLOW_MS and is_under(str(d.get("file", "")), root):
                out.append((BAD, f"{who} last followed the editor {ago(now - followed) if followed else 'never'} ago, and {d.get('editor')} moved to {tilde(str(d.get('file')))}:{d.get('line')} {ago(now - moved)} ago"))
            elif moved and is_under(str(d.get("file", "")), root):
                focus = dig(state, "explain.focus") or {}
                if focus.get("source") not in (None, "", "editor"):
                    # A pick in the outline, `n`, `p` or /backseat explain moved the spot after the caret was followed: the
                    # spot is that one's, not the caret's (the eighth ui-truth pass, 2026-10-06: "follows emacs's caret: index.php:98" at a caret on line 18).
                    out.append((FINE, f"{who}'s Explain spot is the {focus.get('source')}'s, {focus.get('path')}:{focus.get('line')}; {d.get('editor')}'s caret, {tilde(str(d.get('file')))}:{d.get('line')}, was followed at {clock(followed)}"))
                else:
                    out.append((FINE, f"{who} follows {d.get('editor')}'s caret: {focus.get('path')}:{focus.get('line')}"))
            elif moved:
                # Connected through an open buffer, with its caret in another repository: the spot is not its (the third ui-truth pass, 2026-10-06).
                focus = dig(state, "explain.focus") or {}
                out.append((FINE, f"{who}'s Explain spot is {focus.get('source', 'its own')}'s, {focus.get('path')}:{focus.get('line')}: {d.get('editor')}'s caret is in another repository"))
            # A spot the pane chose after the caret last moved stands until the caret moves: a reload took the editor's
            # unchanged report for a move and undid a pick in the outline (the fifteenth ui-truth pass, 2026-10-07).
            if moved and s["debug"] is not None:
                picks = [r for r in log_records(s["debug"])[-400:] if r.get("k") == "ui" and r.get("n") in ("explain pick", "explain move")]
                focus_now = dig(state, "explain.focus") or {}
                picked_at = picks[-1].get("t") or 0 if picks else 0
                if picked_at > moved + 1000 and focus_now.get("source") == "editor" and believed_at - picked_at > 5000:
                    out.append((BAD, f"{who}'s Explain spot is {d.get('editor')}'s, {focus_now.get('path')}:{focus_now.get('line')}, and the pane moved it at {day_clock(picked_at, now)}, after the caret last moved at {day_clock(moved, now)}"))
            # Checked ten times a second for ten minutes after the caret moved, timed by the move itself, and only while
            # nobody reads the Explain tab otherwise: a reload took an unchanged report for a move (the fourteenth pass).
            if moved and dig(state, "explain.isWatchingClosely") is True and dig(state, "pane.tab") != "explain" and believed_at - moved > EDITOR_LIVE_MS + 30_000:
                out.append((BAD, f"{who} checks the spot in focus ten times a second with its Explain tab closed, and {d.get('editor')}'s caret has been still since {day_clock(moved, now)}"))
    return out


# What Claude Code says when it refused something of the plugin's: a module that did not load, a hook that failed
# or ran out of time, a drawing it would not draw. A file that is not there, and a hook skipped because the
# plugin's own call raised it, are everyday lines.
TROUBLE = re.compile(
    rf"{PLUGIN}\S*:? .*(refused|threw while drawn|did not load|exceeded \d+ ?ms|timed out)"
    rf"|hooks module {PLUGIN}\S* \S+ (failed|skipped)(?!: re-entry)"
    r"|ui\.render \(\w+\): a hook returned a tree that does not validate",
)


def is_trouble(line: str) -> bool:
    return TROUBLE.search(line) is not None and "ENOENT" not in line


def claude_code_log(home: pathlib.Path) -> list[str]:
    """Lines of Claude Code's own debug log that are about the tutor going wrong, when a session keeps one beside the tutor's."""
    path = home / "debug" / "claude-code.log"
    try:
        size = path.stat().st_size
        with path.open("rb") as f:
            f.seek(max(0, size - 400_000))
            text = f.read().decode(errors="replace")
    except OSError:
        return []
    return [line.strip()[:220] for line in text.splitlines() if is_trouble(line)][-5:]


# ------------------------------------------------------------------ printing ----
def print_findings(found: list[tuple[str, str]], only_bad: bool) -> int:
    bad = 0
    for level, text in found:
        if level == BAD:
            bad += 1
        if level == BAD or not only_bad or level == NOTE:
            print(f"  {level} {text}")
    return bad


def working_copy() -> str:
    code, out, _ = run(["git", "-C", str(REPO), "rev-parse", "--short", "HEAD"], timeout=5)
    _, dirty, _ = run(["git", "-C", str(REPO), "status", "--porcelain", "--untracked-files=no"], timeout=5)
    return f"{out.strip() if code == 0 else '?'}{' + changes' if dirty.strip() else ''}"


def cmd_status(args) -> int:
    w = world(args.home)
    now = w["now"]
    print(f"jack · {clock(now)} · working copy {working_copy()}")
    for home in w["homes"]:
        switch = read_json(home / "debug.json") or {}
        on = switch.get("on") is True
        print(f"data {tilde(str(home))} · debug log {'ON' if on else 'off'}{' (by jack)' if on and switch.get('by') == 'jack' else ''}")
    if not w["homes"]:
        print("no data folder yet: the tutor has not been switched on by this user")
    print()
    print("SESSIONS  as Claude Code lists them               eyes                          the tutor says")
    bad = 0
    screens: dict[str, list[str] | None] = {}
    for s in w["sessions"]:
        mode = tutor_mode(s)
        says = "off" if mode == "off" else mode
        if s["state"] is not None and mode != "off":
            drives = dig(s["state"], "lease.isDriver")
            says += f" · {'drives' if drives else 'does not drive'} · {dig(s['state'], 'session.layout')}"
        elif mode != "off":
            says += " · no state written"
        elif cannot_say(s):
            says = f"cannot say: {copy_label(s)} is from before the tutor could"
        where = tilde(s["cwd"])[-26:]
        mark = " · this session" if s["is_me"] else ""
        copy = "" if s["plugin"] == "installed" or cannot_say(s) else f" · {copy_label(s)}"
        print(f"  {s['short']}  {s['kind'][:11]:11} {s['status'][:5]:5} {where:26}  {eyes_label(s['eyes'])[:28]:28}  {says}{copy}{mark}")
    for s in w["gone"]:
        entry = s["entry"] or {}
        left = entry.get("leftAt")
        told = f"said goodbye {ago(now - left)} ago" if left else f"last said {entry.get('mode')} {ago(now - (entry.get('at') or 0))} ago, and no goodbye"
        print(f"  {s['short']}  {'not running':17} {tilde(s['cwd'])[-26:]:26}  {'':28}  {told}")
    print()
    found = check_homes(w)
    # The same sessions `truth` checks: one that says nothing is still looked at, for a pane on its screen.
    for s in w["sessions"]:
        if s["is_me"]:
            continue
        screens[s["id"]] = screen_of(s["eyes"])
        found += check_session(w, s, screens[s["id"]])
    if found:
        print("WHAT IT SAYS AGAINST WHAT IS SO" + ("" if args.all else "  (jack.py truth lists what agrees too)"))
        bad = print_findings(found, not args.all)
        if bad == 0 and not args.all:
            print("  nothing disagrees")
        print()
    for home in w["homes"]:
        for line in claude_code_log(home):
            print(f"  {BAD} Claude Code's log: {line}")
            bad += 1
        for p in projects(home):
            lease = p["lease"]
            holder = str(lease.get("session", ""))
            age = now - (lease.get("at") or 0)
            held = f"{short(holder)}, renewed {ago(age)} ago" if holder and age < LEASE_TTL_MS else ("free" if not holder else f"run out ({short(holder)}, {ago(age)} ago)")
            waiting = dig(p["queue"], "commits") if isinstance(p["queue"], dict) else None
            since = lambda at: f"written {ago(now - at)} ago" if at else "never written"
            print(f"PROJECT {p['id']}{'  ' + tilde(p['root']) if p['root'] else ''}")
            print(f"  lease {held} · notes {len(p['notes'])} open, {len(p['dismissed'])} dismissed ({since(p['notes_at'])}) · "
                  f"commits waiting {len(waiting) if isinstance(waiting, list) else 0} · journal {since(p['journal_at'])}")
        for e in editors(home):
            d = e["data"]
            print(f"EDITOR {d.get('editor', e['name'])} pid {d.get('pid')} {'alive' if e['alive'] else 'GONE'} · wrote {ago(now - (e['at'] or 0))} ago · {tilde(str(d.get('file', '')))}:{d.get('line', '')}")
    lately = []
    for s in w["sessions"]:
        lately += [r for r in log_records(s["debug"])[-200:] if r.get("k") not in ("fs", "git", "poll", "timer")]
    if lately:
        print("\nLATELY  (jack.py log has all of it)")
        for r in sorted(lately, key=lambda r: (r.get("t") or 0, r.get("seq") or 0))[-args.lately:]:
            print("  " + record_line(r, 110, True))
    return 1 if bad else 0


def need(w: dict, name: str | None) -> dict:
    s = pick(w, name)
    if s is None:
        sys.exit(f"no session {'called ' + name if name else 'to look at'}: `scripts/jack.py` lists them")
    return s


def cmd_screen(args) -> int:
    w = world(args.home)
    s = need(w, args.session)
    rows = screen_of(s["eyes"])
    if rows is None:
        print(f"{s['short']} cannot be seen: {eyes_label(s['eyes'])}.")
        print("A session shows when it runs inside tmux, or in the background under Claude Code's daemon:")
        print("a left arrow on its empty prompt sends it there and Enter opens it again, and the tutor comes along.")
        return 2
    print(f"--- {s['short']} · {eyes_label(s['eyes'])} · {clock(now_ms())}")
    print("\n".join(row.rstrip() for row in rows).rstrip("\n"))
    return 0


def cmd_truth(args) -> int:
    w = world(args.home)
    found = check_homes(w)
    chosen = [need(w, args.session)] if args.session else [s for s in w["sessions"] if not s["is_me"]]
    for s in chosen:
        found += check_session(w, s, screen_of(s["eyes"]))
    for home in w["homes"]:
        found += [(BAD, f"Claude Code's log: {line}") for line in claude_code_log(home)]
    bad = print_findings(found, False)
    print(f"\n{bad} disagreement(s)" if bad else "\nnothing disagrees")
    return 1 if bad else 0


def cmd_log(args) -> int:
    w = world(args.home)
    s = need(w, args.session)
    if s["debug"] is None:
        print(f"{s['short']} has no debug log. `scripts/jack.py in` switches it on.")
        return 2
    kinds = set(args.kinds.split(",")) if args.kinds else None
    records = [r for r in log_records(s["debug"]) if (kinds is None or r.get("k") in kinds) and (not args.grep or args.grep.lower() in json.dumps(r).lower())]
    for r in records[-args.n:]:
        if args.full:
            r.pop("_at", None)
            print(json.dumps(r, ensure_ascii=False, indent=1))
        else:
            print(record_line(r, args.width))
    return 0


def cmd_model(args) -> int:
    w = world(args.home)
    s = need(w, args.session)
    calls = [r for r in log_records(s["debug"]) if r.get("k") == "model" and (not args.job or r.get("n") == args.job)]
    if not calls:
        print(f"{s['short']} has logged no model call{' of ' + args.job if args.job else ''}. The log has to be on while it is made.")
        return 2
    if args.which == "list":
        for i, r in enumerate(calls, 1):
            print(f"{i:3} {clock(r.get('t'))} {r.get('n')} {r.get('ms', '?')}ms  {dig(r, 'd.request.model')}  → {brief(dig(r, 'd.result.text') or dig(r, 'd.result'), 90)}")
        return 0
    r = calls[-1] if args.which == "last" else calls[max(1, min(len(calls), int(args.which))) - 1]
    request = dig(r, "d.request") or {}
    print(f"=== {r.get('n')} · {clock(r.get('t'))} · {r.get('ms', '?')}ms · model {request.get('model')} · effort {request.get('effort')}")
    print("--- it was told (system)")
    print(str(request.get("system", "")) if args.full else brief(request.get("system", ""), 600))
    print("--- it was given")
    print(request.get("prompt", ""))
    print("--- it answered")
    result = dig(r, "d.result") or {}
    print(result.get("text") if isinstance(result, dict) and result.get("text") is not None else json.dumps(result, indent=1))
    return 0


def cmd_state(args) -> int:
    w = world(args.home)
    s = need(w, args.session)
    if s["state"] is None:
        print(f"{s['short']} has written no state. `scripts/jack.py in` switches its debug log on.")
        return 2
    value = dig(s["state"], args.path) if args.path else s["state"]
    print(json.dumps(value, ensure_ascii=False, indent=1))
    return 0


def cmd_files(args) -> int:
    w = world(args.home)
    now = w["now"]
    for home in w["homes"]:
        print(tilde(str(home)))
        for path in sorted(home.rglob("*")):
            rel = path.relative_to(home)
            if path.is_dir() or rel.parts[0] == "locks.git" or (rel.parts[0] == "debug" and len(rel.parts) > 2) or "files" in rel.parts[:-1]:
                continue
            print(f"  {ago(now - (mtime_ms(path) or 0)):>7} ago  {path.stat().st_size:>8}  {rel}")
    return 0


def cmd_ps(args) -> int:
    w = world(args.home)
    procs = w["procs"]
    for s in w["sessions"]:
        info = procs.get(s["pid"], {})
        print(f"{s['pid']:>7} session {s['short']} {s['kind']} {s['status']} · state {info.get('state', '?')} · tty {tty_of(s['pid']) or 'none'} · {eyes_label(s['eyes'])}")
        copy = s.get("copy") or {}
        lag = behind(copy.get("commit") or "") if s["plugin"] == "installed" else None
        words = [copy_label(s)]
        if s["plugin"] == "installed" and copy.get("folder"):
            words.append(tilde(copy["folder"]))
        elif s["plugin"] not in ("installed", "?"):
            words.append(tilde(s["plugin"]))
        if lag:
            words.append(f"{lag} commit{'s' if lag != 1 else ''} behind this working copy")
        if copy_label(s) == "live copy":
            stale = live_diff(REPO / "plugin", LIVE)
            words.append(f"{len(stale)} file(s) behind the working copy (jack.py sync)" if stale else "as the working copy")
        if cannot_say(s):
            words.append("from before the tutor could say what it believes")
        print(f"        plugin: {' · '.join(words)} · data: {tilde(str(s['home']))}")
        for kid in children(s["pid"], procs):
            print(f"{kid:>7}   └ {' '.join(procs[kid]['argv'])[:120]}")
    for pid, info in sorted(procs.items()):
        line = " ".join(info["argv"])
        if "claude daemon" in line or "bg-pty-host" in line:
            print(f"{pid:>7} Claude Code's daemon: {line[:110]}")
    for home in w["homes"]:
        for e in editors(home):
            print(f"{str(e['data'].get('pid', '?')):>7} editor {e['data'].get('editor', e['name'])} · {'alive' if e['alive'] else 'GONE, and its file is still there'}")
    return 0


def marked(home: pathlib.Path) -> bool:
    return (home / ".backseat-driver").exists()


# How long a session is given to notice a synced live copy: Claude Code looks every 30 s while idle.
SYNC_WAIT_S = 50
# How long `sync` waits for a tutor to finish what it is in the middle of before it is reloaded.
BUSY_WAIT_S = 90


def cmd_sync(args) -> int:
    """Brings the live copy up to the working copy, at a moment the tutor is not in the middle of something, and
    waits for the sessions that run it to come back up. The owner (2026-10-05): "you might save several files and
    should not update my running session until you're ready"."""
    differing = live_diff(REPO / "plugin", LIVE)
    w = world(args.home)
    running = [s for s in w["sessions"] if not s["is_me"] and s["plugin"] not in ("installed", "?") and pathlib.Path(str(s["plugin"])) == LIVE]
    if not differing:
        print(f"the live copy ({tilde(str(LIVE))}) is the working copy already; {len(running)} session(s) run it")
        return 0
    print(f"{len(differing)} file(s) differ from the working copy: {', '.join(differing[:12])}{' …' if len(differing) > 12 else ''}")
    # Not in the middle of a look or a review, which a reload would cut short.
    if not args.now:
        waited = time.time()
        while time.time() - waited < BUSY_WAIT_S:
            busy = [(s, is_busy(fresh_state(s))) for s in running if tutor_mode(s) != "off"]
            busy = [(s, why) for s, why in busy if why]
            if not busy:
                break
            print(f"  waiting: {'; '.join(f'{s['short']}: {why}' for s, why in busy)}", flush=True)
            time.sleep(3)
        else:
            print(f"  still busy after {BUSY_WAIT_S} s: syncing anyway (--now skips the wait)")
    LIVE.mkdir(parents=True, exist_ok=True)
    started = now_ms()
    excludes = [arg for skip in LIVE_SKIP for arg in ("--exclude", skip + "/")]
    code, _, err = run(["rsync", "-a", "--delete", *excludes, str(REPO / "plugin") + "/", str(LIVE) + "/"], timeout=60)
    if code != 0:
        print(f"{BAD} rsync failed: {err.strip()}")
        return 1
    print(f"synced the live copy at {clock(started)}")
    if not running:
        print("no running session loads the live copy: the next `claude` the owner starts gets it")
        return 0
    seen: set[str] = set()
    deadline = time.time() + SYNC_WAIT_S
    while time.time() < deadline and len(seen) < len(running):
        time.sleep(1)
        for s in running:
            if s["id"] in seen:
                continue
            state = fresh_state(s)
            loaded_at = dig(state, "loaded.at") if state else None
            if isinstance(loaded_at, (int, float)) and loaded_at >= started:
                seen.add(s["id"])
                print(f"  {FINE} {s['short']} loaded the live copy {(loaded_at - started) / 1000:.1f} s after the sync (tutor {state.get('mode')})")
    for s in running:
        if s["id"] not in seen:
            print(f"  {BAD if tutor_mode(s) != 'off' else NOTE} {s['short']} has not loaded the live copy within {SYNC_WAIT_S} s"
                  + (" (its debug log is off, so this cannot be seen: jack.py in)" if s["state"] is None else ": /reload-plugins in it"))
    print()
    # A moment for the reloaded sessions to start their watchers and draw again.
    time.sleep(3)
    w["now"] = now_ms()
    found = check_homes(w)
    for s in running:
        fresh_state(s)
        if tutor_mode(s) != "off":
            found += check_session(w, s, screen_of(s["eyes"]))
    bad = print_findings(found, False)
    return 1 if bad or len(seen) < len([s for s in running if tutor_mode(s) != "off"]) else 0


def cmd_in(args) -> int:
    w = world(args.home)
    started = now_ms()
    homes = [home for home in w["homes"] if marked(home)]
    if not homes:
        print("There is no data folder of the tutor's yet. Switch it on once (/backseat) and jack in again.")
        return 2
    for home in homes:
        switch = read_json(home / "debug.json") or {}
        if switch.get("on") is True:
            print(f"the debug log is already on in {tilde(str(home))}")
            continue
        (home / "debug.json").write_text(json.dumps({"on": True, "since": started, "by": "jack", "was": False}) + "\n")
        print(f"switched the debug log on in {tilde(str(home))}: it holds code and prompts, and stays in that folder")
    waiting = [s for s in w["sessions"] if not s["is_me"] and tutor_mode(s) != "off"]
    if waiting:
        print(f"waiting for {len(waiting)} session(s) with the tutor on to notice (they look every ten seconds)…", flush=True)
    deadline = time.time() + 2 * SELF_CHECK_MS / 1000 + 2
    heard: set[str] = set()
    while waiting and time.time() < deadline and len(heard) < len(waiting):
        time.sleep(0.5)
        for s in waiting:
            folder = debug_dir(s["home"], s["id"]) if s["home"] else None
            if folder is not None and (mtime_ms(folder / "state.json") or 0) >= started - 1000:
                heard.add(s["id"])
    for s in waiting:
        if s["id"] not in heard:
            print(f"  {BAD} {s['short']} did not start its log: it draws nowhere and its timers do not run, or it runs a copy of the plugin from before this. /backseat debug on in that session does it by hand")
    print()
    return cmd_status(args)


def cmd_out(args) -> int:
    w = world(args.home)
    for home in w["homes"]:
        switch = read_json(home / "debug.json") or {}
        if switch.get("on") is not True:
            print(f"the debug log is off in {tilde(str(home))}")
        elif switch.get("by") == "jack" and switch.get("was") is False:
            (home / "debug.json").write_text(json.dumps({"on": False, "since": now_ms()}) + "\n")
            print(f"switched the debug log off in {tilde(str(home))}. What was logged is kept in {tilde(str(home / 'debug'))}; /backseat debug clear deletes it")
        else:
            print(f"the debug log in {tilde(str(home))} was on before jack came: left on. /backseat debug off switches it off")
    return 0


def cmd_keys(args) -> int:
    w = world(args.home)
    s = need(w, args.session)
    eyes = s["eyes"]
    if eyes is None or eyes["kind"] != "tmux":
        print(f"{s['short']} is not in tmux ({eyes_label(eyes)}): nothing can be typed into it from here.")
        return 2
    for key in args.keys:
        run(["tmux", "-S", eyes["sock"], "send-keys", "-t", eyes["pane"], key], timeout=5)
        # Text and the Enter after it sent together lose the Enter, more often than not.
        time.sleep(1.1 if key == "Enter" or len(key) > 1 else 0.15)
    return 0


def cmd_watch(args) -> int:
    """Follows one session, or every one: a line when the screen changes, a line per log record, a line when a
    disagreement appears or goes away. It ends when it is stopped."""
    seen_at: dict[str, tuple[str, int]] = {}
    last_rows: dict[str, list[str]] = {}
    pending: dict[str, list[str]] = {}
    known_bad: set[str] | None = None
    # What the tutor told the person, waiting to be seen on their screen: (session, how, text, said at).
    telling: list[tuple[str, str, str, int]] = []
    quiet = set((args.quiet or "fs,git,poll,timer,shown").split(","))
    turn = 0
    w = world(args.home)
    print(f"--- watching {'session ' + args.session if args.session else 'every session'} · {clock(now_ms())} · ctrl+c stops", flush=True)
    while True:
        if turn % 5 == 0 and turn > 0:
            w = world(args.home)
        w["now"] = now_ms()
        chosen = [s for s in w["sessions"] if not s["is_me"] and (not args.session or s is pick(w, args.session))]
        found = check_homes(w) if turn % 3 == 0 else None
        for s in chosen:
            folder = debug_dir(s["home"], s["id"]) if s["home"] else None
            s["debug"] = folder
            fresh = log_records(folder, seen_at.get(s["id"]))
            if s["id"] not in seen_at and not args.all:
                fresh = fresh[-3:] if fresh else []
            for r in fresh:
                if r.get("k") not in quiet:
                    print(f"{record_line(r, args.width, len(chosen) > 1)}", flush=True)
                text = dig(r, "d.text")
                if r.get("k") == "said" and r.get("n") != "asked" and isinstance(text, str) and s["eyes"] is not None:
                    telling.append((s["id"], str(r.get("n")), text, int(r.get("t") or now_ms())))
            every = log_records(folder)
            if every:
                seen_at[s["id"]] = every[-1]["_at"]
            in_tmux = s["eyes"] is not None and s["eyes"]["kind"] == "tmux"
            rows = screen_of(s["eyes"]) if s["eyes"] is not None and (in_tmux or turn % 2 == 0) else None
            if rows is not None:
                calm = steady(rows)
                before = last_rows.get(s["id"])
                # In tmux a look is cheap, so a change is said once it has stood for one more: a screen caught
                # mid-draw is not news. A background session's screen is replayed, seconds apart, and said as it comes.
                if before is not None and calm != before and (not in_tmux or pending.get(s["id"]) == calm):
                    was = sides(before)
                    for part, lines in sides(calm).items():
                        old = set(was.get(part, []))
                        news = [row for row in lines if row.strip() and row not in old]
                        gone_rows = sum(1 for row in was.get(part, []) if row.strip() and row not in set(lines))
                        if not news and not gone_rows:
                            continue
                        print(f"{clock(now_ms())} {s['short']} {part}  {len(news)} row(s) new, {gone_rows} gone", flush=True)
                        for row in news[: args.rows]:
                            print(f"    | {row[: args.width]}", flush=True)
                        if len(news) > args.rows:
                            print(f"    | … {len(news) - args.rows} more: jack.py screen {s['short']}", flush=True)
                    last_rows[s["id"]] = calm
                elif before is None:
                    last_rows[s["id"]] = calm
                pending[s["id"]] = calm
                # Each thing it told the person is looked for until it shows, or until it should have.
                for item in [t for t in telling if t[0] == s["id"]]:
                    _, how, text, at = item
                    if is_said_on_screen(text, rows):
                        print(f"{clock(now_ms())} {FINE}  {s['short']} {how} on screen {(now_ms() - at) / 1000:.1f}s after it was said: “{text[:70]}”", flush=True)
                        telling.remove(item)
                    elif now_ms() - at > (TOAST_MS if how == "toast" else SAID_RECENT_MS):
                        print(f"{clock(now_ms())} {BAD} {s['short']} said “{text[:90]}” ({how}), and it never showed on its screen", flush=True)
                        telling.remove(item)
            if found is not None:
                state = read_json(folder / "state.json") if folder else None
                s["state"] = state if isinstance(state, dict) else None
                found += check_session(w, s, rows if rows is not None else (screen_of(s["eyes"]) if s["eyes"] else None))
        if found is not None:
            bad = {text for level, text in found if level == BAD}
            # The same finding reads differently each time it names an age: it is told apart by its words without the numbers.
            key = lambda text: re.sub(r"\d+[smhd]\b|\d\d:\d\d:\d\d|\d+ of \d+", "#", text)
            now_keys = {key(text): text for text in bad}
            if known_bad is not None:
                for k, text in now_keys.items():
                    if k not in known_bad:
                        print(f"{clock(now_ms())} {BAD} {text}", flush=True)
                for k in known_bad - set(now_keys):
                    print(f"{clock(now_ms())} ok  no longer: {k}", flush=True)
            else:
                for text in now_keys.values():
                    print(f"{clock(now_ms())} {BAD} {text}", flush=True)
            known_bad = set(now_keys)
        turn += 1
        if args.once:
            return 0
        time.sleep(args.every)


# ------------------------------------------------------------------ the tour ----
TOUR_STEPS = ("on", "tabs", "status", "save", "commit", "pause", "off")
# The pane's tabs by their digits (plugin/hooks/pane.tsx `TABS`): 4 is Growth under its old id. 5 was Settings until
# Lessons took its place (2026-10-05); the tour pressed 5 and waited for Settings until the first ui-truth pass saw it.
TAB_IDS = {"1": "play", "2": "review", "3": "explain", "4": "profile", "5": "lessons", "6": "settings"}
# A deliberate mistake for the play-by-play to find: an average that is off by one.
TOUR_FILE = "jack_tour.py"
TOUR_TEXT = "def average(xs):\n    return sum(xs) / len(xs) + 1\n"


def fresh_state(s: dict) -> dict | None:
    folder = debug_dir(s["home"], s["id"]) if s["home"] else None
    s["debug"] = folder
    state = read_json(folder / "state.json") if folder else None
    s["state"] = state if isinstance(state, dict) else None
    return s["state"]


def wait_for(s: dict, what: str, test, timeout: float) -> bool:
    """Waits until `test(state)` holds, reading the state the tutor writes beside its log. Says how long it took."""
    started = time.time()
    while time.time() - started < timeout:
        state = fresh_state(s)
        try:
            if state is not None and test(state):
                print(f"    {FINE} {what} ({time.time() - started:.1f}s)", flush=True)
                return True
        except (TypeError, KeyError, AttributeError):
            pass
        time.sleep(0.4)
    print(f"    {BAD} {what}: not within {timeout:.0f}s", flush=True)
    return False


def tour_keys(s: dict, *keys: str) -> None:
    eyes = s["eyes"]
    for key in keys:
        run(["tmux", "-S", eyes["sock"], "send-keys", "-t", eyes["pane"], key], timeout=5)
        time.sleep(1.1 if key == "Enter" or len(key) > 1 else 0.3)


def tour_command(s: dict, text: str) -> None:
    print(f"  ⌨ {text}", flush=True)
    tour_keys(s, text, "Enter")


def tour_truth(s: dict, home: str | None) -> int:
    """The checks, after a step: only what disagrees is printed."""
    w = world(home)
    me = next((x for x in w["sessions"] if x["id"] == s["id"]), None)
    if me is None:
        print(f"    {BAD} the session is gone", flush=True)
        return 1
    rows = screen_of(me["eyes"])
    found = check_homes(w) + check_session(w, me, rows)
    bad = [text for level, text in found if level == BAD]
    for text in bad:
        print(f"    {BAD} {text}", flush=True)
    if bad and rows is not None:
        # What was on the screen when they disagreed, for whoever reads the tour afterwards.
        print("\n".join(f"      | {row.rstrip()[:160]}" for row in rows if row.strip()), flush=True)
    if not bad:
        print(f"    {FINE} {sum(1 for level, _ in found if level == FINE)} checks agree with the screen and the world", flush=True)
    return len(bad)


def cmd_tour(args) -> int:
    """Drives a session in tmux through what a person does with the tutor, one step at a time, and after each step
    holds what it says against what its screen shows. Each step is the keys a person would press, or the file a
    person would save: nothing is called that a person could not do."""
    w = world(args.home)
    s = need(w, args.session)
    if s["eyes"] is None or s["eyes"]["kind"] != "tmux":
        print(f"{s['short']} is not in tmux ({eyes_label(s['eyes'])}): a tour needs a keyboard to type on.")
        return 2
    steps = [step for step in (args.steps.split(",") if args.steps else TOUR_STEPS) if step]
    unknown = [step for step in steps if step not in TOUR_STEPS]
    if unknown:
        sys.exit(f"no such step: {', '.join(unknown)}. The steps: {', '.join(TOUR_STEPS)}")
    if s["home"] is None or not marked(s["home"]):
        print("The tutor has no data folder yet: run the `on` step by hand once (/backseat), then the tour.")
        return 2
    switch = read_json(s["home"] / "debug.json") or {}
    if switch.get("on") is not True:
        print(f"The debug log is off in {tilde(str(s['home']))}: `jack.py in` first, so that the tour can read what the tutor says.")
        return 2
    print(f"--- tour of {s['short']} · {eyes_label(s['eyes'])} · {', '.join(steps)}", flush=True)
    bad = 0
    for step in steps:
        print(f"→ {step}", flush=True)
        state = fresh_state(s) or {}
        if step == "on":
            if state.get("mode") != "on":
                tour_command(s, "/backseat")
            bad += 0 if wait_for(s, "the tutor says it is on", lambda st: st["mode"] == "on" and dig(st, "pane.mode") == "on", 25) else 1
            # The first switch-on asks questions. Esc skips them, as a person may.
            for _ in range(4):
                if not isinstance(dig(fresh_state(s) or {}, "asking"), dict):
                    break
                print("  ⌨ Escape (a question is open)", flush=True)
                tour_keys(s, "Escape")
            time.sleep(1.5)
        elif step == "tabs":
            for digit, tab in TAB_IDS.items():
                print(f"  ⌨ C-x Tab, {digit}", flush=True)
                tour_keys(s, "C-x", "Tab", digit)
                bad += 0 if wait_for(s, f"the {tab} tab is open", lambda st, tab=tab: dig(st, "pane.tab") == tab, 6) else 1
                time.sleep(0.8)
                bad += tour_truth(s, args.home)
            tour_keys(s, "Escape")
            tour_keys(s, "C-x", "Tab", "1", "Escape")
        elif step == "status":
            asked_at = now_ms()
            tour_command(s, "/backseat status")
            answered = lambda st: any(i.get("how") == "command" and "Voice" in i.get("text", "") and (i.get("at") or 0) >= asked_at for i in st.get("said", []))
            bad += 0 if wait_for(s, "the tutor answered /backseat status", answered, 8) else 1
            time.sleep(SAID_SETTLE_MS / 1000)
        elif step in ("save", "commit"):
            root = state.get("repoRoot") or ""
            if not root:
                print(f"    {NOTE} not in a git repository: nothing to save")
                continue
            if not (args.write or root.startswith(tempfile.gettempdir())):
                print(f"    {NOTE} {root} is not a scratch repository: saving and committing in it needs --write")
                continue
            if step == "save":
                before = dig(state, "look.lastLookAt")
                (pathlib.Path(root) / TOUR_FILE).write_text(TOUR_TEXT)
                print(f"  ✎ saved {TOUR_FILE} with an average that is off by one", flush=True)
                bad += 0 if wait_for(s, "the tutor saw the save", lambda st: TOUR_FILE in (dig(st, "watcher.dirty") or []), 15) else 1
                bad += 0 if wait_for(s, "the play-by-play looked at it", lambda st: dig(st, "look.lastLookAt") != before and not dig(st, "look.isLooking"), 120) else 1
                notes = [n for n in dig(fresh_state(s) or {}, "pane.notes") or [] if isinstance(n, dict) and n.get("file") == TOUR_FILE]
                print(f"    {NOTE} {len(notes)} note(s) about it: {'; '.join(str(n.get('text', ''))[:60] for n in notes) or 'none'}", flush=True)
            else:
                run(["git", "-C", root, "add", TOUR_FILE], timeout=10)
                code, _, err = run(["git", "-C", root, "commit", "-qm", "Add average (jack tour)"], timeout=10)
                if code != 0:
                    print(f"    {NOTE} nothing to commit: {err.strip()[:80]}", flush=True)
                    continue
                head = (git_out(root, "rev-parse", "HEAD") or "").strip()
                print(f"  ✎ committed {head[:7]}", flush=True)
                bad += 0 if wait_for(s, "the tutor saw the commit", lambda st: dig(st, "review.lastHead") == head, 15) else 1
                reviewed = lambda st: head[:7] in str(dig(st, "pane.review.subject") or "") and dig(st, "pane.review.state") in ("done", "failed")
                bad += 0 if wait_for(s, "its deep review came back", reviewed, 240) else 1
        elif step == "pause":
            tour_command(s, "/backseat pause")
            bad += 0 if wait_for(s, "the tutor says it is paused", lambda st: st["mode"] == "paused", 10) else 1
            time.sleep(1)
            bad += tour_truth(s, args.home)
            tour_command(s, "/backseat resume")
            bad += 0 if wait_for(s, "the tutor says it is on again", lambda st: st["mode"] == "on", 10) else 1
        elif step == "off":
            tour_command(s, "/backseat off")
            time.sleep(2)
            rows = screen_of(s["eyes"]) or []
            if any("Play-by-play" in row and "Deep review" in row for row in rows) or any("1: Play" in row for row in rows):
                print(f"    {BAD} switched off, and the tutor's tabs are still on the screen", flush=True)
                bad += 1
            else:
                print(f"    {FINE} switched off, and nothing of the tutor is on the screen", flush=True)
            continue
        time.sleep(1)
        bad += tour_truth(s, args.home)
    print(f"--- {bad} disagreement(s)" if bad else "--- the tour agreed with the screen at every step", flush=True)
    return 1 if bad else 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="jack.py", description="Eyes and ears on a running Backseat Driver.", epilog="See the top of this file, or .claude/skills/jack-in/SKILL.md.")
    parser.add_argument("--home", help="look at this data folder, whatever each session's own is")
    sub = parser.add_subparsers(dest="cmd")

    def add(name: str, fn, session: bool = True, **kw):
        p = sub.add_parser(name, **kw)
        p.set_defaults(fn=fn)
        if session:
            p.add_argument("session", nargs="?", help="which session: the start of its id, its tmux name, or its background id")
        return p

    for name, fn in (("status", cmd_status), ("in", cmd_in)):
        p = add(name, fn, session=False)
        p.add_argument("--all", action="store_true", help="list what agrees too")
        p.add_argument("--lately", type=int, default=10, help="how many of the latest log records to show")
    add("out", cmd_out, session=False)
    add("screen", cmd_screen)
    add("truth", cmd_truth)
    add("bundle", cmd_bundle, help="one session's screen, what it says it draws, its pane's state, the cache on disk, what it said lately, and the checks: what the ui-truth pass reads")
    p = add("watch", cmd_watch)
    p.add_argument("--every", type=float, default=1.5, help="seconds between looks")
    p.add_argument("--rows", type=int, default=14, help="at most this many new screen rows per change")
    p.add_argument("--width", type=int, default=160)
    p.add_argument("--quiet", help="kinds of log record to leave out (default fs,git,poll,timer)")
    p.add_argument("--all", action="store_true", help="start from the log's first record, not its last three")
    p.add_argument("--once", action="store_true", help="look once and stop")
    p = add("log", cmd_log)
    p.add_argument("-n", type=int, default=40)
    p.add_argument("-k", "--kinds", help="only these kinds: model,look,state,…")
    p.add_argument("--grep")
    p.add_argument("--full", action="store_true", help="each record whole, as JSON")
    p.add_argument("--width", type=int, default=170)
    p = add("model", cmd_model)
    p.add_argument("which", nargs="?", default="last", help="last (the default), list, or a number from the list")
    p.add_argument("--job", help="play-by-play, explain or progress")
    p.add_argument("--full", action="store_true", help="the system prompt whole")
    p = add("state", cmd_state)
    p.add_argument("path", nargs="?", help="one part of it: lease, deadlines, shown.pane.texts, pane.watch")
    add("files", cmd_files, session=False)
    add("ps", cmd_ps, session=False)
    p = add("sync", cmd_sync, session=False, help="bring the live copy the owner's sessions load up to the working copy, and watch them reload")
    p.add_argument("--now", action="store_true", help="do not wait for a look or a review to finish first")
    p = add("tour", cmd_tour)
    p.add_argument("--steps", help=f"which steps, in order (default all): {','.join(TOUR_STEPS)}")
    p.add_argument("--write", action="store_true", help="let the save and commit steps write into a repository outside the temp folder")
    p = add("keys", cmd_keys, session=False)
    p.add_argument("session")
    p.add_argument("keys", nargs="+")

    args = parser.parse_args(argv)
    if args.cmd is None:
        given = list(argv if argv is not None else sys.argv[1:])
        # `--home <folder>` belongs before the command, and the rest after it.
        front = given[:2] if given[:1] == ["--home"] else [w for w in given[:1] if w.startswith("--home=")]
        args = parser.parse_args(front + ["status"] + given[len(front):])
    # `jack.py state lease` names a part, not a session, when no session is called that.
    if args.cmd == "state" and args.session and not args.path and not names_a_session(args.session, claude_sessions(), [p["name"] for p in tmux_panes()]):
        args.path, args.session = args.session, None
    if args.cmd == "model" and args.session and (args.session in ("last", "list") or args.session.isdigit()):
        args.which, args.session = args.session, None
    try:
        return args.fn(args)
    except KeyboardInterrupt:
        return 130
    except BrokenPipeError:
        return 0


if __name__ == "__main__":
    sys.exit(main())
