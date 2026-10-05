---
name: jack-in
description: See into a RUNNING Backseat Driver. The screen as the owner sees it, what the tutor says it is doing and showing, what it really did (its debug log, every model call word for word), and every place where those disagree. Use when the owner says "jack in", when they report that the tutor looks wrong, stuck or empty, when monitoring a session they are working in, and before calling any change to the mod done.
---

# Jack in

`scripts/jack.py` is the engineer's console onto a running tutor. The owner asked
for it in these words (2026-10-05): *"give yourself eyes to see what I see, while
the ability to introspect the code and logs at will and hear from the program
verbosely telling you what it also claims and thinks it is doing, then when what
you see differs from what it SAYS you are able to dive in and fix."*

Three accounts of one session, side by side:

- **SAYS**: what the tutor believes. Its state, written beside its debug log and
  never more than ten seconds old while the log is on: mode, lease, deadlines,
  the pieces of text it last drew and where, everything it told the person
  outside its pane (toasts, lines in the transcript, `/bsd` answers, dialogs),
  the code and settings it runs with, what it thinks changed in the working
  tree, HEAD, and the editor's caret. And what it tells the other sessions in
  the data folder (`sessions.json`, `lease.json`).
- **DID**: the debug log. Every git call, file, model request and answer, in order.
- **IS**: read from outside the tutor. The screen, the files, the processes.

A line that starts with `!!` is a place where they disagree. Start there.

## First, always

```bash
scripts/jack.py in       # debug log on in every running session, wait for them, one screen
```

Sessions notice the switch within ten seconds, with no key typed into them, and
write what happened before it (`meta/before the log`). The log holds the owner's
code and prompts and stays in their data folder. When you are done:

```bash
scripts/jack.py out      # off again, if `in` switched it on
```

Read every `!!` line before anything else. Then `scripts/jack.py truth` for the
checks that passed too: a check that did not run proves nothing.

## Seeing

| Command | What you get |
| --- | --- |
| *(none)* / `status` | every session Claude Code lists, what the tutor says in each, how each can be seen, every disagreement, each project's lease and notes, connected editors, the latest log records |
| `screen [S]` | the session's screen right now, as the owner sees it |
| `truth [S]` | every check, passed or not. Exit 1 when anything disagrees |
| `watch [S]` | follows a session: new log records, screen rows that changed (the conversation and the pane apart), disagreements as they appear and go, and each thing the tutor told the person, until it shows on the screen or should have. Run it in the background or under Monitor while the owner works |
| `tour [S] [--steps …]` | drives a session in tmux as a person would (switch on, every tab, `/bsd status`, a save with a bug, a commit, pause, off) and runs every check after each step. Real model calls. Writes only into a scratch repository unless `--write` |
| `log [S] [-k kinds] [-n N] [--grep text] [--full]` | the debug log. Kinds: `cmd hook state look watch model agent tool guard ui shown said heard start push git fs store error meta`. `said` is what the person was told; `heard` what Claude Code and other plugins told them |
| `model [S] [last\|list\|N] [--job play-by-play\|explain\|progress] [--full]` | exactly what a model call was given and exactly what it answered. Start here for any "why did it say that" |
| `state [S] [path]` | the tutor's own state, or a part: `state lease`, `state deadlines`, `state shown.pane.texts`, `state session` |
| `files` | the data folder, with ages |
| `ps` | every session's process, its terminal, which copy of the plugin it runs, its data folder, its children |

`S` is the start of a session id, a tmux session's name, or a background
session's short id. Left out, it is the one session with the tutor on. A session
that is gone is still readable by id: `log 1788da52`.

## Eyes

- **tmux**: exact. `scripts/dev-session.sh` starts one. The owner's own session
  is seen when they start `claude` inside tmux.
- **Background sessions** (Claude Code's daemon): `claude logs` holds their
  terminal output, and the tool replays it into the screen it made. A left arrow
  on an empty prompt sends any session there and Enter opens it again, with the
  tutor still on. That is the way to see a session that was started in a plain
  terminal, and it costs the owner two keys.
- **A plain terminal**: cannot be seen from outside. The tool says so, checks
  everything else, and does not count the screen as checked. Ask the owner what
  they see, or for one of the two ways above. Never guess.

## Driving

`scripts/jack.py keys <S> <keys…>` types into a tmux session:
`keys bsd /bsd Enter`, `keys bsd C-x Tab`, `keys bsd Left`. Into your own dev
session, freely. Into a session the owner is working in, only when they ask:
it is their keyboard.

`scripts/jack.py tour <S>` is the whole run-through, as the owner would do it,
with the checks after every step. Run it on your own dev session after any
change to the mod, before calling the change done; on the owner's session only
when they ask (it types, saves and commits).

## When something looks wrong, in this order

1. `status`: is the session there, is the tutor on in it, does anything disagree?
2. `screen`: what does the owner actually see? Read it before believing a report or the state.
3. `state session` and `state shown`: where does the tutor think it draws, and what?
   `surfaces: []` is a process its conversation has left. `opened.isPlaced: false` is a
   pane Claude Code opened and did not draw.
4. `log -k error,state,hook,cmd -n 60`: what changed, and what failed.
5. `model last`: what was the model shown?
6. `ps`: which copy of the plugin runs there? An installed copy is pinned to its
   version and does not have what the working copy has (`plugin: installed`).
7. Only then the code. The recurring defect here is a thing believed and not
   checked: a pane taken to be on screen, a lease taken to be renewed, a session
   taken to be the one being looked at.

## Reproducing

```bash
BSD_SESSION=jack BSD_RIDE_DIR=/tmp/bsd-jack-ride BSD_DATA_DIR=/tmp/bsd-jack-home BSD_FULLSCREEN=1 \
  scripts/dev-session.sh --model haiku --settings '{"enabledPlugins":{"backseat-driver@backseat-driver":false},"pluginConfigs":{"backseat-driver@inline":{"options":{"play_by_play_model":"haiku","play_by_play_thinking":"low","deep_review_model":"haiku","deep_review_thinking":"low","quiet_time":"5 seconds","minimum_gap":"none"}}}}'
scripts/jack.py --home /tmp/bsd-jack-home in
scripts/jack.py keys jack /bsd Enter
```

- The owner has the plugin installed. A session on the working copy has to
  switch the installed one off (`enabledPlugins` above), or both load.
- `--home` keeps `in` and `out` to the scratch folder. Without it they also
  switch the log in the owner's real one.
- Real model calls are made on the owner's plan: haiku, short, and say what you spent.
- A fix is not done until `truth` passes on a live session that went through
  what the owner reported, and you have read its `screen`. `tour` is the quick
  way through the rest.
- In a cloud container, the thread's own session id is in the environment and a
  `claude` started under it takes it: unset it first (CLAUDE.md, "Live checks").

## Ground rules

- Reading is free and changes nothing. `in` and `out` write one small file, the
  one `/bsd debug on` writes. Nothing here calls a model.
- A `!!` is a finding to explain, not to silence. If a check is wrong, fix the
  check in `scripts/jack.py` and its test in `scripts/test_jack.py`, in the same commit.
- When the mod gains something it believes about the screen or the world, it
  gains a line in its state (`fullState` in `register.tsx`) and a check here.
- What you learn goes into `CLAUDE.md` in the same commit as the fix.
