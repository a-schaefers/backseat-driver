---
name: ui-truth
description: Judge a RUNNING Backseat Driver's pane as the owner sees it, against what the tutor claims it shows and what its cache on disk holds, through an agent that reads `scripts/jack.py bundle`. Run at the start of a jack-in, after every sync, and about every 45 minutes while jacked in, as a job dispatched to an agent; never in `npm run check` or CI.
---

# ui-truth

The owner asked for it on 2026-10-06, after a fresh session showed an empty
Deep review tab with four reviews in the cache: *"it checks what app claims is
showing vs what you actually see via being jacked in and looking at the
running app in tmux, find discrepancies and fix … at startup of jacking in and
the jacking in session, periodically like every 45 minutes as a separate job
dispatched to an agent."*

`scripts/jack.py truth` holds the tutor's claims against the screen and the
files piece by piece, and never saw that empty tab: the tutor claimed to show
nothing, showed nothing, and the two agreed. What was missing was a reader who
knows what the pane is *supposed* to show, holding the screen against the
cache. That reader is an agent, and this skill is its brief.

## When

- At the start of every jack-in, right after `scripts/jack.py in`.
- After every `scripts/jack.py sync` (the owner's sessions just reloaded).
- About every 45 minutes while jacked in. Cron has no 45-minute period, so
  schedule it hourly with `CronCreate` in the jacked-in session (jobs live in
  that session and expire after 7 days):

  ```text
  cron: "23 * * * *"
  prompt: Run the ui-truth pass (the ui-truth skill): dispatch the agent on every
          session with the tutor on, then fix what it finds, with a check in
          scripts/jack.py and a test in scripts/test_jack.py for each finding.
  ```

- Never as part of `npm run check` or CI: it needs a running session and the
  owner's screen.

## How

Dispatch one agent (the `Agent` tool, `general-purpose`, read-only by
instruction) with this brief, and read its report:

```text
You are the ui-truth pass for Backseat Driver, a Claude Code mod whose pane is
described in /home/grok/repos/backseat-driver/CLAUDE.md under "Pane", "Pane
placement", "Several sessions", "Explain", "Growth" and "Lessons". Read those
sections first: they say what each tab is supposed to show.

Run `cd /home/grok/repos/backseat-driver && python3 scripts/jack.py bundle`
(add a session id to look at one). For each session in the output, read it as
the owner would read their terminal, and hold three accounts against each
other: the SCREEN; what the tutor SAYS IT DRAWS and THE PANE'S STATE; and THE
CACHE ON DISK. Report every place they disagree, and every row of the screen
that a person would take for wrong: an empty tab while the cache holds
something for it, a badge that contradicts its tab, a light or a status line
that contradicts the files, a stale clock, a row cut or wrapped so that its
meaning is lost, a line the tutor said that never showed, a count that does not
add up. The CHECKS at the end are the mechanical findings; a `!!` there is a
finding to explain, and a page with no `!!` may still be wrong to a reader.

For each finding give: the session, what the screen shows (quote the row), what
the state or the cache says (quote the path and the value), and which of them
you believe and why. Then say what a check in scripts/jack.py would have to
compare to catch it next time.

Rules: read only. Do not type into any session, do not change any file, do not
call a model besides yourself. The screen of a session that cannot be seen is
not checked: say so, and judge the state against the cache. End with
"NOTHING FOUND" or the numbered list.
```

Then, for each finding: explain it or fix it (the mod, or the check), add the
check to `scripts/jack.py` and its test to `scripts/test_jack.py`, and record it
in `CLAUDE.md`, in the same commit (the jack-in rules). A finding that is the
check's own mistake is fixed in the check, never silenced.

## What the agent sees, and does not

- `bundle` gives the whole page for each session with the tutor on: the exact
  screen (tmux or a background session; a plain terminal cannot be seen), the
  pieces the tutor last drew, every pane atom tab by tab, the project folder
  (notes, reviews, queue, journal, lease), the person's record (progress,
  profiles), the editors' files, `sessions.json`, what the person was told
  lately, and the checks.
- Only the open tab is on the screen. The other tabs are judged from the
  state against the cache, which is what they would draw from.
- The owner's session is theirs: the agent reads it and never drives it. A
  dev session (`scripts/dev-session.sh`) may be driven with `scripts/jack.py
  tour` instead.
