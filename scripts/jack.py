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
    scripts/jack.py keys S <keys>   type into a session in tmux (`keys bsd /bsd Enter`). Only when asked to.

S names a session: the start of its id, its tmux session's name, or the short
id `claude agents` gives a background one. Left out, it is the one session
with the tutor on, or else the one most lately busy.

Eyes: a session is seen when it runs inside tmux (exact), or in the
background under Claude Code's own daemon, where `claude logs` has its output
(a left arrow on an empty prompt sends any session there, and Enter opens it
again). A session in a plain terminal cannot be seen from outside: this says
so and checks the rest.

Reading is free and changes nothing. `in` and `out` write one small file in
the data folder, the same one `/bsd debug on` writes. `keys` types into
somebody's session: never without being asked. Nothing here calls a model.
"""

from __future__ import annotations

import argparse
import fcntl
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
EDITOR_TTL_MS = 60_000
SELF_CHECK_MS = 10_000
ALIVE_MS = 660_000
# A state file older than this, with the log on, is a session whose timers do not run.
STATE_STALE_MS = 3 * SELF_CHECK_MS
# A deadline this far past its time has not been met.
OVERDUE_MS = 15_000
# After a reload the watchers are killed and started again: this long, a mismatch with the processes is that.
WATCHERS_GRACE_MS = 5_000
# The first pieces of a drawing are the tabs and the status line: the top of the pane, which is never below the fold.
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


def fnv(text: str) -> str:
    """plugin/core/hash.ts `shortHash`: FNV-1a over the string's UTF-16 code units."""
    h = 0x811C9DC5
    units = text.encode("utf-16-le")
    for i in range(0, len(units), 2):
        h ^= units[i] | (units[i + 1] << 8)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return f"{h:08x}"


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
            "journal_at": mtime_ms(folder / "journal.json"),
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
        return "a deep review is running"
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


def is_on_screen(piece: str, where: list[str]) -> bool:
    """Whether a piece of text the tutor says it drew is there. Long text is cut or wrapped by the
    terminal, so its beginning is what is looked for; one or two characters say too little to judge."""
    want = squash(demark(piece))
    if len(want) < 3:
        return True
    want = want[:28].rstrip()
    return any(want in flow for flow in where)


def missing_pieces(texts: list[str], rows: list[str]) -> tuple[list[str], list[str]]:
    """The pieces not on the screen: those from the top of the drawing, and the rest."""
    where = flows(rows)
    head = [t for t in texts[:HEAD_PIECES] if not is_on_screen(t, where)]
    rest = [t for t in texts[HEAD_PIECES:] if not is_on_screen(t, where)]
    return head, rest


def pieces_below(texts: list[str], rows: list[str]) -> int:
    """How many pieces from below the top of the drawing are really on the screen: long enough to be told apart, and found."""
    where = flows(rows)
    return sum(1 for t in texts[HEAD_PIECES:] if len(squash(demark(t))) >= 3 and is_on_screen(t, where))


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
def check_homes(w: dict) -> list[tuple[str, str]]:
    """What the data folder says, against which sessions are really there."""
    out: list[tuple[str, str]] = []
    now = w["now"]
    live = {s["id"]: s for s in w["sessions"]}
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
                                  f"jack sees its screen and its files, not its state. /bsd debug on typed into it, or /reload-plugins there while the switch is on, starts its log"))
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

    # Deadlines that came and went.
    deadlines = state.get("deadlines") if isinstance(state.get("deadlines"), dict) else {}
    for name, due in sorted(deadlines.items()):
        if isinstance(due, (int, float)) and now - due > OVERDUE_MS and mode == "on":
            out.append((BAD, f"{who} had `{name}` to do at {clock(due)}, {ago(now - due)} ago, and has not done it"))

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
    # never shown again (seen live after /bsd off and on). A note in the pane that notes.json lacks is lost at a restart.
    notes = dig(state, "pane.notes")
    if mode != "off" and is_driver is True and project is not None and isinstance(notes, list):
        kept = {n.get("id") for n in project["notes"] if isinstance(n, dict)}
        lost = [n for n in notes if isinstance(n, dict) and n.get("id") not in kept]
        if lost and now - (project["notes_at"] or 0) > 5000:
            out.append((BAD, f"{who} has {len(notes)} open note(s) in its pane, and notes.json, written {ago(now - (project['notes_at'] or 0))} ago, lacks {len(lost)} of them: a restart would lose them"))

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
            out.append((NOTE, f"{who}'s pane was closed by the person {ago(now - (closed.get('at') or now))} ago: nothing of the tutor is on screen until /bsd"))
        elif isinstance(panes, list) and mine is None:
            out.append((BAD, f"{who} has the tutor {mode} in the vertical layout, and Claude Code lists no pane of its own: nothing is on screen"))
        elif isinstance(opened, dict) and opened.get("isPlaced") is False:
            out.append((BAD, f"{who}'s pane is open and not drawn: {opened.get('reason') or 'no reason given'}. /bsd in that session draws it"))
    width = (s["eyes"] or {}).get("cols") if isinstance(s["eyes"], dict) else None
    if rows is None:
        out.append((NOTE, f"{who}'s screen cannot be seen ({eyes_label(s['eyes'])}): what it says it shows is not checked"))
    elif mode != "off" and isinstance(drawing, dict) and drawing.get("placement") == "dock" and isinstance(width, int) and width < DOCK_COLUMNS:
        # The terminal was made narrower than a dock takes: the drawing on record is from the side, and the pane is
        # being moved above the prompt. The next drawing is the one to hold against the screen.
        out.append((NOTE, f"{who}'s pane was drawn docked ({drawing.get('columns')} columns) and its terminal is now {width} wide, under the {DOCK_COLUMNS} a dock takes: the pane is moving above the prompt (a resize), and is checked again next time"))
    elif mode != "off" and isinstance(drawing, dict) and isinstance(drawing.get("texts"), list):
        texts = [t for t in drawing["texts"] if isinstance(t, str)]
        head, rest = missing_pieces(texts, rows)
        where = "strip above the prompt" if minimized else "pane" if layout == "vertical" else "lines above the prompt"
        below = pieces_below(texts, rows)
        if head and below > 0:
            # The top is missing and the rest is there: the person scrolled the pane down to read (the owner, 2026-10-05,
            # a long deep review in a 30-row terminal). Their view, not a fault.
            out.append((NOTE, f"{who}'s {where} is scrolled: its top ({len(head)} piece(s), the tabs and the status line) is above the frame, and {below} piece(s) below it are on the screen"))
        elif head:
            quoted = "; ".join(f"“{t[:60]}”" for t in head[:3])
            out.append((BAD, f"{who} says its {where} shows {quoted}{' and more' if len(head) > 3 else ''}: not on its screen (drawn {ago(now - (drawing.get('at') or now))} ago, {drawing.get('placement') or 'above the prompt'}, {drawing.get('columns')} columns)"))
        else:
            out.append((FINE, f"{who}'s {where} is on its screen as it says ({len(texts) - len(rest)} of {len(texts)} pieces{', the rest below the fold or cut' if rest else ''})"))
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
    """What the tutor told the person outside its pane (a toast, a line in the transcript, the answer to /bsd, a
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
            out.append((FINE, f"{who} runs the working copy as it is (loaded {ago(now - loaded_at)} ago)"))

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
            elif moved:
                focus = dig(state, "explain.focus") or {}
                out.append((FINE, f"{who} follows {d.get('editor')}'s caret: {focus.get('path')}:{focus.get('line')}"))
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
        print("There is no data folder of the tutor's yet. Switch it on once (/bsd) and jack in again.")
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
            print(f"  {BAD} {s['short']} did not start its log: it draws nowhere and its timers do not run, or it runs a copy of the plugin from before this. /bsd debug on in that session does it by hand")
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
            print(f"switched the debug log off in {tilde(str(home))}. What was logged is kept in {tilde(str(home / 'debug'))}; /bsd debug clear deletes it")
        else:
            print(f"the debug log in {tilde(str(home))} was on before jack came: left on. /bsd debug off switches it off")
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
TAB_IDS = {"1": "play", "2": "review", "3": "explain", "4": "profile", "5": "settings"}
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
        print("The tutor has no data folder yet: run the `on` step by hand once (/bsd), then the tour.")
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
                tour_command(s, "/bsd")
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
            tour_command(s, "/bsd status")
            answered = lambda st: any(i.get("how") == "command" and "Voice" in i.get("text", "") and (i.get("at") or 0) >= asked_at for i in st.get("said", []))
            bad += 0 if wait_for(s, "the tutor answered /bsd status", answered, 8) else 1
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
            tour_command(s, "/bsd pause")
            bad += 0 if wait_for(s, "the tutor says it is paused", lambda st: st["mode"] == "paused", 10) else 1
            time.sleep(1)
            bad += tour_truth(s, args.home)
            tour_command(s, "/bsd resume")
            bad += 0 if wait_for(s, "the tutor says it is on again", lambda st: st["mode"] == "on", 10) else 1
        elif step == "off":
            tour_command(s, "/bsd off")
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
    if args.cmd == "state" and args.session and not args.path and not any(s["id"].startswith(args.session) or s["short"].startswith(args.session) for s in claude_sessions()):
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
