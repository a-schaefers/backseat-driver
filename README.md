<div align="center">

# Backseat Driver

**The only backseat driver you'll actually want.**

A coding tutor that rides along while you write the code yourself.

[![tests](https://img.shields.io/github/actions/workflow/status/a-schaefers/backseat-driver/check.yml?branch=main&label=tests)](https://github.com/a-schaefers/backseat-driver/actions/workflows/check.yml)
[![newest Claude Code](https://img.shields.io/github/actions/workflow/status/a-schaefers/backseat-driver/nightly.yml?branch=main&label=newest%20Claude%20Code)](https://github.com/a-schaefers/backseat-driver/actions/workflows/nightly.yml)
[![version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fa-schaefers%2Fbackseat-driver%2Fmain%2Fplugin%2F.claude-plugin%2Fplugin.json&query=%24.version&label=version&color=blue)](plugin/.claude-plugin/plugin.json)
[![needs Claude Code 2.1.287+](https://img.shields.io/badge/Claude%20Code-2.1.287%2B-d97757)](https://code.claude.com/docs/en/plugins/mods/overview)
[![last commit](https://img.shields.io/github/last-commit/a-schaefers/backseat-driver)](https://github.com/a-schaefers/backseat-driver/commits/main)

</div>

Backseat Driver is a plugin for [Claude Code](https://claude.com/claude-code). Switch it on and Claude stops writing your code. You write it, in your own editor, and the tutor watches over your shoulder. It points out bugs and better ways to do things as you save, reviews each commit in depth, explains the code you are reading, and answers anything you ask.

You stay in the driver's seat.

## Why we made it

AI can write a lot of code now, and it is tempting to let it write all of it. We worry about what that costs in the long run. Skills you stop using fade. An engineer who only reviews generated code slowly loses the ability to write it, and to tell when it is wrong. We don't want to find out what the industry looks like when that happens to everyone.

We also just love this stuff. We're in it for the love of the game: the puzzle, the craft, the moment it clicks. We don't want AI to take that away. We want it to make us better at it. Let's make coding human again.

So Backseat Driver turns the usual arrangement around. You drive. The AI rides along, watches the road, and speaks up when it matters, like a good mentor in the passenger seat.

## Who it's for

- **Anyone who wants to keep writing their own code**, and get better at it while they do.
- **People learning a language.** It works out your skill level in each language from the code you write, keeps track of it across all your projects, and explains new ideas by comparison with a language you already know.
- **Experienced engineers who want a sparring partner**, not a ghostwriter.

It's not for having Claude write your code. If that's what you want, use Claude Code normally: `/bsd off` gives it back to you.

## How it works

```text
┌─ conversation ─────────────────────────┬─ Backseat ────────────────────────────────────┐
│                                        │ 1: Play  2: Review  3: Explain  4: Progress   │
│ > /backseat-driver                     │ On. Watching for your next save.              │
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

- **Play-by-play.** Save and pause, and a fast model reads what changed. If something deserves a comment, a short note appears in the side pane: a bug, a risky pattern, a better idiom. Notes are hints, not patches. Fix the code and the note goes away by itself.
- **Deep review.** After each commit, a stronger model reads the commit and the code around it, and writes a longer review.
- **Explain.** Reading unfamiliar code? The Explain tab says what the function under your cursor does, how and why. It is never stale: change the code and the old explanation is gone.
- **Progress.** An honest level for each language, from beginner to senior, with what the next level needs. It is judged only on commits you wrote yourself, and it can go down as well as up.
- **Talk back.** The conversation is still there. Ask about a note, or argue with it, and a contested point gets a second opinion. Tell it to hush about a topic, and it remembers.

The ground rules:

1. **Claude doesn't edit your files.** A hook enforces this, so it doesn't depend on the model behaving.
2. **Hints before answers.** First the concept, then an example if you ask. Never a patch.
3. **Few notes, and only ones that matter.** It doesn't flag anything a linter would catch, and it stays quiet when there is nothing worth saying.
4. **You have the last word.** "Do it my way" always stands.
5. **No exercises and no quizzes.** The project you chose to build is the lesson.

What it learns about you is kept per language, not per project: your level, what it has already explained, the mistakes that keep coming back, and the topics you told it to drop. So what it knows about your Python follows you to every Python project. Everything it keeps is plain JSON in `~/.local/share/backseat-driver/`, never in your repository.

## Get it

You need Claude Code 2.1.287 or newer (check with `claude --version`), git, and a Claude plan. The background reviews count against that plan.

```bash
claude plugin marketplace add a-schaefers/backseat-driver
claude plugin install backseat-driver@backseat-driver
```

Or run it straight from a clone:

```bash
git clone https://github.com/a-schaefers/backseat-driver
claude --plugin-dir ./backseat-driver/plugin
```

## Use it

Type `/bsd` in Claude Code. That's it. The first time you work in a language, it asks a few one-keypress questions about you, and Esc skips them.

| Command | What it does |
| --- | --- |
| `/bsd` | Switch the tutor on. `/backseat-driver` is the long form |
| `/bsd pause`, `/bsd off` | Quiet it for a while, or end the ride |
| `/bsd explain src/app.py:42` | Explain a spot in the code |
| `/bsd working on the parser` | Say what you're doing. It usually works this out by itself |
| `/bsd forget` | Erase what it remembers: one project, one language, or everything |
| `/bsd update`, `/bsd uninstall` | Fetch a newer release when the pane says there is one, or remove the plugin |
| `/bsd help` | Every command and key |

**The pane.** `Ctrl+X Tab` gives the pane the keyboard, and `Esc` gives it back. `1` to `4` switch tabs. On a note, `e` asks for an explanation, `d` dismisses it, `m` mutes the topic for good and `l` looks now. In a wide terminal the pane sits beside the conversation. In a narrow one it sits above the prompt.

**Settings** are all in `/config`, and none of them need changing. You can choose the model and thinking level for each job (Sonnet for the play-by-play and Opus for deep reviews, by default), how quickly it looks, and a persona. A persona is a voice and an engineering taste, chosen separately: `torvalds`, `knuth`, `primeagen` or `eli5-tldr-kiss-terse`. Each comes with a small animated ASCII caricature, which you can turn off.

## Good to know

- **It reads what you save.** It looks at files on disk, not at unsaved changes in your editor.
- **It costs usage.** Each look and each review is a model call on your plan. It waits for pauses in your work, backs off near your plan's limits, and can be set to look only when you ask.
- **It stays in its lane.** It runs git, reads your repository, keeps its memory in its own folder and draws a pane. Its only network request of its own is a check for a newer release, every six hours at most. It installs no git hooks and never writes to your working tree. [DESIGN.md](DESIGN.md#limits) has the full list.
- **Mods are new.** Claude Code's mod API is in early access. Panes draw in the terminal and in the desktop app's Code tab, not in the VS Code chat panel.

## Learn more

- [DESIGN.md](DESIGN.md) is the full design: every behavior, what it's built on, the settings, the roadmap, and the protocol an editor plugin uses to report where your cursor is.
- [CLAUDE.md](CLAUDE.md) has the working notes for building it.
- To hack on it, run `npm install`, then `npm run check`, then `scripts/dev-session.sh`.
- [learning-output-style](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/learning-output-style) is Anthropic's learning mode. There, Claude writes most of the code and leaves small pieces for you. Backseat Driver goes the rest of the way: you write all of it.
