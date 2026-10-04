<div align="center">

# Backseat Driver

**The only backseat driver you'll actually want.**

[![tests](https://img.shields.io/github/actions/workflow/status/a-schaefers/backseat-driver/check.yml?branch=main&label=tests)](https://github.com/a-schaefers/backseat-driver/actions/workflows/check.yml)
[![newest Claude Code](https://img.shields.io/github/actions/workflow/status/a-schaefers/backseat-driver/nightly.yml?branch=main&label=newest%20Claude%20Code)](https://github.com/a-schaefers/backseat-driver/actions/workflows/nightly.yml)
[![version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fa-schaefers%2Fbackseat-driver%2Fmain%2Fplugin%2F.claude-plugin%2Fplugin.json&query=%24.version&label=version&color=blue)](plugin/.claude-plugin/plugin.json)
[![needs Claude Code 2.1.287+](https://img.shields.io/badge/Claude%20Code-2.1.287%2B-d97757)](https://code.claude.com/docs/en/plugins/mods/overview)
[![last commit](https://img.shields.io/github/last-commit/a-schaefers/backseat-driver)](https://github.com/a-schaefers/backseat-driver/commits/main)

</div>

A [Claude Code](https://claude.com/claude-code) plugin that turns Claude into a coding tutor. You write the code, and it watches, comments and answers.

## Why

AI can write most of the code now. But skills you don't use fade, and an engineer who only reviews generated code slowly loses the ability to write it, or to tell when it's wrong. We don't want to find out what the industry looks like when that happens to everyone.

And we love this stuff: the puzzle, the craft, the moment it clicks. We want AI to make us better at it, not take it away. Let's make coding human again.

## What it is

```text
┌─ conversation ─────────────────────────┬─ Backseat ────────────────────────────────────┐
│                                        │ 1: Play  2: Review  3: Explain  4: Progress   │
│ > /bsd                                 │ On. Watching for your next save.              │
│   Backseat Driver is on. You drive.    │ w: Working on adding an async cache           │
│                                        │                                               │
│ > why does note 1 matter? the tests    │ src/cache.rs                                  │
│   pass                                 │ > 1  risk · line 42                           │
│                                        │     This guard is still held when you reach   │
│ ● They pass because nothing in them    │     the .await on line 47. Who else is        │
│   competes for the lock. Look at what  │     waiting on it?                            │
│   is still alive when you reach the    │   2  idiom · line 18                          │
│   .await on line 47...                 │     This match only changes the Some case.    │
│                                        │     Option has a method for exactly that.     │
│ >                                      │ e: explain  d: dismiss  m: mute  l: look now  │
└────────────────────────────────────────┴───────────────────────────────────────────────┘
```

- **Play-by-play.** When you save and pause, a fast model reads the change. If something matters, a short note appears in the pane: a bug, a risky pattern, a better idiom. A note is a hint, not a fix. It clears when you fix the code.
- **Deep review.** After each commit, a stronger model reviews the commit in context.
- **Explain.** It says what the code under your cursor does, how it does it and why. Edit the code, and the old explanation is gone.
- **Progress.** An honest level for each language, from beginner to senior, judged only on commits you wrote. It follows you from project to project, and it can go down as well as up.
- **Conversation.** Ask anything. Push back on a note, and a contested point gets a second opinion. Tell it to drop a topic, and it never brings it up again. You have the last word.

## What it is not

- **Not a code writer.** While it's on, Claude does not edit your files. A hook blocks its editing tools, so this doesn't depend on the model behaving.
- **Not a course.** There are no exercises and no quizzes. The project you chose to build is the lesson.
- **Not a linter.** It stays quiet unless something matters.
- **Not in your repository.** It installs no git hooks and never writes to your working tree. What it remembers stays in `~/.local/share/backseat-driver/`. Its only network request of its own is a check for a newer release, at most every six hours.

## Who it's for

- **Anyone who wants to keep writing their own code** and get better at it.
- **People learning a language.** It explains new ideas in terms of a language you already know.
- **Experienced engineers** who want a sparring partner, not a ghostwriter.

It's not for anyone who wants Claude to write their code. `/bsd off` gives you Claude Code back as it was.

## How to use it

You need Claude Code 2.1.287 or newer, git, and a Claude plan. The background reviews count against your plan.

```bash
claude plugin marketplace add a-schaefers/backseat-driver
claude plugin install backseat-driver@backseat-driver
```

Type `/bsd` in Claude Code. The first time you work in a language, it asks a few one-keypress questions, and Esc skips them.

| Command | |
| --- | --- |
| `/bsd`, `/bsd pause`, `/bsd off` | Switch it on, quiet it, or switch it off |
| `/bsd explain src/app.py:42` | Explain a spot in the code |
| `/bsd forget` | Erase what it remembers |
| `/bsd update`, `/bsd uninstall` | Fetch a newer release when the pane announces one, or remove the plugin |
| `/bsd help` | Every command and key |

`Ctrl+X Tab` focuses the pane, and `Esc` leaves it. `1` to `4` switch tabs. The pane draws in the terminal and in the desktop app's Code tab. Models, pacing and persona (`torvalds`, `knuth`, `primeagen`, `eli5-tldr-kiss-terse`) are set in `/config`.

The full design is in [DESIGN.md](DESIGN.md).
