<div align="center">

# Backseat Driver

**The only backseat driver you'll actually want.**

[![tests](https://img.shields.io/github/actions/workflow/status/a-schaefers/backseat-driver/check.yml?branch=main&label=tests)](https://github.com/a-schaefers/backseat-driver/actions/workflows/check.yml)
[![newest Claude Code](https://img.shields.io/github/actions/workflow/status/a-schaefers/backseat-driver/nightly.yml?branch=main&label=newest%20Claude%20Code)](https://github.com/a-schaefers/backseat-driver/actions/workflows/nightly.yml)
[![version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fa-schaefers%2Fbackseat-driver%2Fmain%2Fplugin%2F.claude-plugin%2Fplugin.json&query=%24.version&label=version&color=blue)](plugin/.claude-plugin/plugin.json)
[![needs Claude Code 2.1.287+](https://img.shields.io/badge/Claude%20Code-2.1.287%2B-d97757)](https://code.claude.com/docs/en/plugins/mods/overview)
[![last commit](https://img.shields.io/github/last-commit/a-schaefers/backseat-driver)](https://github.com/a-schaefers/backseat-driver/commits/main)

</div>

A [Claude Code](https://claude.com/claude-code) plugin that makes Claude your tutor, not your ghostwriter. You write the code. It watches, comments and answers.

Inspired by the ideas discussed in the [Enchant Games Journal](https://enchant.games/?slug=journal).

## Why

> We built machines to obey us.
>
> Now we ask them to think for us.

Backseat Driver reverses course.

It's not about speed. If it takes me longer but I grok it, I win. **It's about owning your understanding.**

Backseat Driver puts the machine where it belongs: in the back seat. You drive. It watches the road and speaks up when it matters.

## What it is

- **Play-by-play.** Save, pause, and a fast model reads what changed. If it's worth saying, a short note lands in the pane: a bug, a risky pattern, a better idiom. A hint, never a fix. Fix the code and the note goes away.
- **Decision points and insights.** When your code reaches a real choice, like how to handle errors or which data structure to use, the pane marks it as **your call** and lays out what each way costs. Then it gets out of the way. It also points out ★ insights about how your codebase does things.
- **Deep review.** Commit, and a stronger model reviews it in context, decision points first.
- **Explain.** What the code under your cursor does, how and why. Edit the code and the old explanation is gone.
- **Progress.** An honest level per language, beginner to senior, judged only on commits you wrote. It follows you across projects, and it can go down.
- **Conversation.** Ask anything. Push back, and a contested point gets a second opinion. Tell it to drop a topic, and it's dropped for good. You have the last word.

While it's on, a hook blocks Claude's editing tools, so your code stays yours no matter what the model decides. It installs no git hooks and never writes to your working tree. Got `inotifywait` on your PATH? It hears your saves and commits the moment they land. No `inotifywait`, it checks every few seconds instead. What it remembers stays in `~/.local/share/backseat-driver/`. Its only network request of its own is a check for a newer release, at most every six hours.

## Who it's for

- **Anyone who writes their own code** and wants to get better at it.
- **Learners.** It's a great time to learn the art of programming. It works out your level in each language from your own code, and explains new ideas in terms of a language you already know.
- **Seniors** who want a sparring partner, not a robot-babysitting job.

Want the machine to write it for you? That's fine. Be you. `/bsd off` gives you Claude Code back.

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

## License

MIT. The decision points and insights are adapted, with thanks, from Anthropic's [learning-output-style](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/learning-output-style) plugin, under its Apache 2.0 license. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
