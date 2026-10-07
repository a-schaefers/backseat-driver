<div align="center">

# Backseat Driver

**The only backseat driver you'll actually want.**

[![tests](https://img.shields.io/github/actions/workflow/status/a-schaefers/backseat-driver/check.yml?branch=main&label=tests)](https://github.com/a-schaefers/backseat-driver/actions/workflows/check.yml)
[![newest Claude Code](https://img.shields.io/github/actions/workflow/status/a-schaefers/backseat-driver/nightly.yml?branch=main&label=newest%20Claude%20Code)](https://github.com/a-schaefers/backseat-driver/actions/workflows/nightly.yml)
[![version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fa-schaefers%2Fbackseat-driver%2Fmain%2Fplugin%2F.claude-plugin%2Fplugin.json&query=%24.version&label=version&color=blue)](plugin/.claude-plugin/plugin.json)
[![needs Claude Code 2.1.287+](https://img.shields.io/badge/Claude%20Code-2.1.287%2B-d97757)](https://code.claude.com/docs/en/plugins/mods/overview)
[![last commit](https://img.shields.io/github/last-commit/a-schaefers/backseat-driver)](https://github.com/a-schaefers/backseat-driver/commits/main)

</div>

**A coding tutor that lives inside [Claude Code](https://claude.com/claude-code) and never writes your code.**

You write every line. It reads over your shoulder, comments on what you just saved, reviews every commit, explains the code you point at, and tells you how good you're getting. Claude stays in the passenger seat.

Inspired by the ideas discussed in the [Enchant Games Journal](https://enchant.games/?slug=journal).

## Why

Hand your work to an agent and the skill fades. You think you're driving. The LLM is.

> If it takes me longer but I grok it, I win.

So the LLM goes in the back seat. You drive, it watches the road.

## What it is

Type `/backseat`. A pane opens beside your conversation, with six tabs.

**1. Play-by-play.** Live commentary on your code as you write it. Save, pause for a few seconds, and a fast model reads what changed. Worth saying? A short note lands in the pane: a bug, a risky pattern, a better idiom for that language. One idea per note. A hint, never a fix. Fix the code and the note goes away on its own. Nothing worth saying, it says nothing.

- **Your call.** When your code hits a real design choice (how errors are handled, which data structure, what the user sees), the note says so, lays out what each way costs, and leaves the choice to you.
- **★ Insight.** Now and then, something about how *this* codebase does things. Never a lecture you could read anywhere.

**2. Deep review.** Everything wrong with your code, worst first. Switch it on in a project and a stronger model audits the codebase as it stands: critical to low, file and line, and what it read. Every commit after that gets reviewed against the whole project. New issues go on the list, fixed ones come off, dismissed ones stay gone. An empty list means nothing found in what it read, never "perfect code". In its own tab, not in your chat. Commits made while Claude is down or you're at your plan limit get reviewed when it's back.

**3. Explain.** Move your cursor (with an editor plugin, below), point at a line (`/backseat explain src/app.py:42`), or just save, and it tells you what that code does, how, why it's there, what to watch out for and what it relies on. Step through a file symbol by symbol with `n` and `p`. Change the code and the old explanation disappears before it can lie to you.

**4. Growth.** A level and a score per language, from beginner to senior. Your own commits count most: not imports, not generated code, not anything co-written with an AI. Lessons you finish, help you needed and habits you fixed count too. It says what to work on, where you needed help, what would raise the score and what you've already improved. It follows you across projects. It can go down. No flattery.

**5. Lessons.** Learning paths, done in your own code, one step at a time. Start a step and the tutor teaches it in chat; you write it. Skip them all and it costs you nothing. Each path is a markdown file in the plugin's `lessons` folder: merge a new one and everyone has it.

**6. Settings.** Change the voice, the models, how hard they think and how often it looks, right in the tab. Same rows as `/config`.

**And the conversation.** Claude is still there in chat, as a tutor. Ask it anything. Ask it to write your code and you get a nudge, then the concept, then a small example somewhere else, one step at a time. Questions about the language get straight answers. Push back and it weighs your argument; a point you contest goes to the deep reviewer for a second opinion. Tell it to drop a topic and it stays dropped, in every project in that language. You have the last word.

It knows what you're working on without being asked: which files, which functions, what you said you're up to. It learns your level from your code and explains new ideas in terms of a language you already know.

Pick who's riding along. A voice sets how it talks: `default`, `torvalds`, `knuth`, `primeagen`, or `eli5-tldr-kiss-terse`. An engineering persona sets what it cares about in code, chosen separately. A little pixel-art character speaks for the voice. Linus, Knuth, Prime, a penguin in a top hat. Hard on the code, never on you.

While it's on, a hook blocks Claude's editing tools, so your code stays yours no matter what the model decides. It installs no git hooks and never writes to your working tree. Set an editor command and every place a review or a note points at opens in your editor when you click it; that command is the one other program it ever runs, and only on your click. Got `inotifywait` on your PATH? It hears your saves and commits the moment they land. No `inotifywait`, it checks every few seconds instead. What it remembers stays in `~/.local/share/backseat-driver/`. Its only network requests of its own: a check for a newer release, at most every six hours, and, with a commercial key, a check of that key about once a week. Nothing stops working if either can't get through.

## Who it's for

Anyone who writes their own code and means to keep getting better at it. Beginner's mind, sharp tools, always learning.

- **Beginners.** Your own project is the lesson.
- **Juniors.** Find out where you stand and what gets you to the next level, from your own commits.
- **Seniors.** A sparring partner, not a robot-babysitting job. Iron sharpens iron.
- **Teams.** Juniors get a reviewer on every save and every commit, without pulling a senior off their own work. Everyone keeps the skills you hired them for. Your code goes only to the Claude your company already uses, and everything the tutor remembers stays on each developer's machine. Models and thinking levels are set per job, so you decide what each review costs. Commercial use needs a license, below.

Want the LLM to write it for you? That's fine. Be you. `/backseat off` gives you Claude Code back.

## How to use it

You need Claude Code 2.1.287 or newer, git, and a Claude plan. The background reviews count against your plan.

```bash
claude plugin marketplace add a-schaefers/backseat-driver
claude plugin install backseat-driver@backseat-driver
```

Type `/backseat` in Claude Code. The first time you work in a language, it asks a few one-keypress questions: your level, your goals, what to focus on. Esc skips them. Every setting has a default.

| Command | |
| --- | --- |
| `/backseat`, `/backseat pause`, `/backseat off` | Switch it on, quiet it, or switch it off |
| `/backseat explain src/app.py:42` | Explain a spot in the code |
| `/backseat working on the parser` | Tell it what you're working on |
| `/backseat settings` | Open the Settings tab |
| `/backseat forget` | Erase what it remembers: one project, one language, or everything |
| `/backseat license` | Switch between personal and commercial use, or add a key |
| `/backseat update`, `/backseat uninstall` | Fetch a newer release when it announces one, or remove the plugin |
| `/backseat help` | Every command and key |

`Ctrl+X Tab` hands it the keyboard, and `Esc` takes it back. `1` to `6` open the tabs. `x`, or the pane's own ×, puts it away as a strip above the prompt; a click on the strip brings it back, and only `/backseat off` switches it off. On a note, `e` explains it, `d` dismisses it, `m` mutes that topic for good. On an issue in Deep review, `e` and `d` do the same, `t` tracks it in the play-by-play, `a` audits the whole codebase again and `v` shows the map of the project. The worst issues in the files you're saving show up in the play-by-play too: one issue, both tabs, dismissed once. `l` looks at your changes now, `r` reviews now. It draws in the terminal and in the desktop app's Code tab. Send the conversation to the background and the tutor goes with it.

Models, thinking levels, pacing and personas live in tab `6`, Settings, or `/backseat settings`. They're in `/config` too.

### Editors

Plugins for Emacs, Neovim and VS Code live in [`editors/`](editors). They tell the tutor where your cursor is, what you've selected and what's open, so Explain follows your cursor and the tutor knows where you've been. A light in the tutor goes green when your editor connects and red when it's gone. Nothing to configure.

- **Neovim** (0.9+): `vim.opt.rtp:append('/path/to/backseat-driver/editors/neovim')` in `init.lua`.
- **Emacs** (27+): `(add-to-list 'load-path "/path/to/backseat-driver/editors/emacs")`, `(require 'backseat-driver)`, `(backseat-driver-mode 1)`.
- **VS Code**: in `editors/vscode`, `npx @vscode/vsce package --skip-license`, then `code --install-extension backseat-driver-0.1.0.vsix`.

## License

Source-available. Read it, change it, share it.

- **Personal use is free.** Learning, hobby projects, unpaid open source. Schools and charities too.
- **Commercial use is paid.** Using it for a business needs a [commercial license](COMMERCIAL-LICENSE.md). You pick personal or commercial the first time you switch it on, and `/backseat license` changes it. No lockouts. A missing key gets a note in the tutor, nothing more.

The terms are the [PolyForm Noncommercial License 1.0.0](LICENSE).
