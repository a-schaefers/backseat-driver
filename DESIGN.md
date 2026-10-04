# Backseat Driver: design

This is the design spec: everything the tutor does, why it behaves the way it does, and what each part is built on. The [README](README.md) is the short version for people who want to use it, and [CLAUDE.md](CLAUDE.md) holds the working notes for building it.

Backseat Driver is a plugin for [Claude Code](https://claude.com/claude-code). Switch it on in any project and Claude stops writing your code. Instead it watches your working tree as you save, points out bugs, risky patterns and better idioms in a side pane, reviews each commit in more depth, and answers questions when you ask. You stay at the keyboard, because the goal is a better programmer rather than faster code.

You learn by building whatever you want to build. The tutor sets no exercises and runs no quizzes. It chimes in from the background, and how often, how deeply and in what voice is yours to tune.

## Why it exists

The owner's reasons, which every other decision here serves:

- **Outsourcing all of our thinking to AI has a long-term cost.** Skills that go unused fade. An engineer who only reviews generated code slowly loses the ability to write it, and to tell when it is wrong. An industry full of such engineers is fragile.
- **We want to stay in the driver's seat.** AI should make the person at the keyboard sharper, not replace the part of the work that keeps them sharp.
- **We love learning, and we are in it for the love of the game.** The puzzle and the craft are the point. A tutor that does the work for you takes the best part away.

So the arrangement is turned around: you drive, and the AI rides along, watches the road, and speaks up when it matters.

> **Status: part one built, part two under way.** Everything described here is built, except what is under [Part two](#part-two-being-built), which is being added now. Each part was tried in a real session on Claude Code 2.1.289, but only in short scripted ones. Nobody has done real work with it yet, so expect the prompts and defaults to need adjusting. Three things have only been run in tests: the slow-down near plan limits, the hook that refuses edits (the tutor declined before it was ever needed), and the deep review on its default model, because the live runs used a cheaper one. So have three parts of the journal: rolling up a sitting after an hour, two sessions keeping one journal, and the deep review reading it. The editor's side of it was tried with a script standing in for an editor. Installing from the marketplace has not been tried.

## Using it

One command starts it, and after that there is nothing to manage. Every setting has a default and every question can be skipped.

### Start

Run `claude` in a terminal next to your editor and type `/backseat-driver`, or `/bsd` for short. A Backseat pane opens beside the conversation, at once: the tutor finishes getting ready in the background. `/bsd help` lists every command and key.

### The first time

Backseat Driver works out the project's main languages from its tracked files.

- For a language it already knows you in, it picks up where you left off, even if that was in a different project.
- For a new one it asks a few quick questions, one keypress each: which language you know best, how much of this one you have written, what you most want from it, and what to watch most closely. That is four questions the first time, three for each language after that, and never more than ten. Press Esc to skip them. It then starts from sensible defaults and learns from your code instead.

You can answer the questions again whenever your answers change: `/bsd questions`, or `q` in the pane's Progress tab.

A language you only touch later, such as the one shell script in a Python project, never interrupts you with questions. The tutor uses defaults for it and offers the questions in the pane's Progress tab for when you have a minute. The pane is already open and watching while the questions are on screen, so skipping them costs nothing.

### While you work

- **You write code in your own editor.** Each time you save and then pause for a few seconds, a fast model reads what changed. If something deserves a comment, a note appears in the pane: a bug, a risky pattern, a more idiomatic way to say it in this language, or a standard-library or tooling feature that would have done the job. This running commentary is the play-by-play, and it is what the pane shows by default.
- **Notes are nudges, not patches.** A note says where to look and what to think about. You can ask for the concept behind it, and then for a small example. Typing the fix stays your job.
- **A note leaves when you deal with it.** Fix the code and the note clears itself at the next look. Press `d` to dismiss one you have read: it goes, and the same point is not raised about that file again until you switch the tutor off. To silence a whole topic for good, press `m` or say so (see [Talk back](#talk-back)).
- **Commits get a deeper review.** After each commit, a stronger model reads the whole commit together with the code around it and writes a longer review in the pane's Deep review tab. It can also run on a timer, or only when you ask.
- **It keeps track of what you are working on.** You never have to explain: it works that out from what you do, and shows it under the pane's status line. See [What you are working on](#what-you-are-working-on).
- **A character speaks up when it matters.** A small animated figure for your chosen voice stands at the top of the pane. When a look finds a critical point or a design decision in what you saved, it says one line about why it matters. It also passes on a deep review's takeaway, and now and then makes a joke. See [The animated persona](#the-animated-persona).

```text
┌─ conversation ─────────────────────────┬─ Backseat ────────────────────────────────────┐
│                                        │ 1: Play  2: Review  3: Explain  4: Progress   │
│ > /backseat-driver                     │ On. Watching for your next save. Voice:       │
│   Backseat Driver is on. You drive.    │ torvalds.                                     │
│                                        │ w: Working on adding an async cache           │
│                                        │ Worked out from your activity.                │
│                                        │                                               │
│ > why does note 1 matter? the tests    │    .,,,,.                                     │
│   pass                                 │   /      \                                    │
│                                        │  | [o]-[o] |  .-----------------------------. │
│ ● They pass because nothing in them    │  |    >    |  | A lock held across an await | │
│   competes for the lock. Look at what  │   \  `-'  /  -| turns a cache into a queue. | │
│   is still alive when you reach the    │    '-----'    '-----------------------------' │
│   .await on line 47. While this task   │                                               │
│   is parked there, what can every      │ src/cache.rs                                  │
│   other task that wants the cache do?  │ > 1  risk · line 42                           │
│                                        │     This guard is still held when you reach   │
│                                        │     the .await on line 47. Who else is        │
│                                        │     waiting on it?                            │
│                                        │   2  idiom · line 18                          │
│                                        │     This match only changes the Some case.    │
│                                        │     Option has a method for exactly that.     │
│                                        │                                               │
│                                        │ e: explain  d: dismiss  m: mute  l: look now  │
│ >                                      │                                               │
└────────────────────────────────────────┴───────────────────────────────────────────────┘
```

### What you are working on

The tutor keeps a journal of what you do in the project: which files you save and what each save changed, where your editor's caret stays and for how long, which files you have open and on screen, your commits, and the notes it raised, all in order. Every model the tutor calls reads it, so each one knows what is going on without you having to explain.

From the journal the tutor works out what you are working on, and the pane shows it under the status line, with how it knows. Until a look has said, it shows where your activity is, such as `stats.py, in median`, and how much of the last ten minutes went there. You never have to tell it. When it has it wrong, or you want to be precise:

- Press `w` in the pane. It asks its one question, "What are you working on right now?". Type your answer, or pick what it worked out.
- Run `/bsd working on the CSV parser`.
- Tell the tutor in the conversation, and it records your words.

What you say stands until you change it, in later sessions too, and the pane says when you said it once that was a while ago. `/bsd working clear`, or "Let the tutor work it out" under `w`, hands the job back to the tutor.

What reads the journal:

- **The play-by-play** reads it before your changes, so that a note fits what you are doing. Its reply says what you appear to be working on, and that is what the pane shows.
- **The deep review** reads it after the commit, to judge the change against what it was for.
- **The conversation.** Each question you type goes with a few lines on what you are working on and where your caret is, so "why does this fail?" means the code you were just in. The tutor can also read the whole journal, including what your latest saves changed.

Without an editor plugin the journal goes by your saves and commits. With one, it also knows where your attention is: see [The editor side](#the-editor-side).

The journal is kept per project in the tutor's data folder. It holds file paths, line numbers, the names of functions, commit titles and what you said you are working on, and never your code. Once a sitting is over, which is after an hour with nothing to record, it is rolled up into a few lines, so the file stays small. `/bsd forget project` erases it.

### While you read

The play-by-play is for when you write. The third tab, Explain, is for when you read. It shows what the tutor knows about the spot you are on: what the function or class does, how, why it is there, what to watch for and what it relies on, with an outline of the file beneath it.

```text
3: Explain
stats.py · variance
function, lines 10 to 12
What  How spread out the values are: the mean squared distance from the mean.
How   It calls mean(xs), sums the squared differences, and divides by the count.
Why   The standard deviation would be built on it.
Watch An empty list raises ZeroDivisionError, inside mean.
Relies on  mean

In this file
  mean      The average of a list.
  median    The middle value of a sorted copy.
> variance  How spread out the values are.

n: next   p: previous   e: ask about this
```

"The spot you are on" is whichever of these moved last:

- an editor that reports its cursor to the tutor. No such plugin exists yet: see [The editor side](#the-editor-side).
- `/bsd explain src/app.py:42`, or `:42-60` for a selection.
- `n` and `p` in the pane, which step through the file's symbols.
- the file you last saved.

Answers come from a cache on your machine. In a real session a cached explanation was on screen 40 to 80 milliseconds after the key. What is not cached is fetched in the background while you keep reading: a file is mapped in one request, and each function is explained in another when you get to it or when you have just changed it. A first lookup in a file the tutor had never seen took about seven seconds.

**It is never stale.** Every explanation records a fingerprint of the exact lines it explains, and of the other functions it says it relies on. Nothing is shown unless those fingerprints match the file as it is on disk at that moment. Edit a function and its explanation is gone from the screen within a tenth of a second. The file is mapped again once it has stopped changing for a few seconds, and an answer that arrives for text that has changed in the meantime is thrown away. An edit elsewhere in the file costs an unchanged function nothing. Where freshness and speed pull apart, freshness wins.

The tutor in the conversation uses the same cache. Ask it what a function does and it looks it up first, so what it tells you and what the tab shows agree. A question you type is sent along with what the tab is showing, so "why is this here?" means something.

In a narrow terminal the pane sits above the prompt instead of beside the conversation. The keys in the pane work once it has the keyboard: press Ctrl+X Tab or click it, and Esc to go back to the prompt. The pane says so while it does not have it.

### Talk back

The play-by-play and the deep review are not announcements to be read in silence. The prompt is a normal conversation, and the tutor has seen your recent changes, its own notes and the latest review.

- **Ask anything**, about a note, a review or the language in general.
- **Disagree.** Say why you think a note is wrong and the tutor weighs your argument. If you contest the point and the tutor still thinks it stands, it tells you it is sending it to the deep review model for a second opinion. That model reads the code itself, and its verdict comes back into the conversation: it concedes, explains, or says which part each side has right.
- **Do it your way.** You can always overrule the tutor, and it will not argue the point again. The play-by-play may still flag it.
- **Tell it to hush.** Say "stop warning me about missing type hints", or press `m` on a note. It stops at once and remembers, in this project and in every other project in that language.
- **Tell it where you stand.** Say "I have written Python for six years" or "what I want now is performance", and it updates your profile on the spot. You can also answer the first-run questions again from the pane's Progress tab.
- **Say what you are working on**, when the pane has it wrong. The tutor records your words, and the reviewers go by them too.

### Forget

The tutor keeps a growing record of you, so there are deliberate ways to erase it and no accidental ones.

`/bsd forget` asks what to forget: this project's journal and cache, one language's profile and progress, or everything. It then asks again, with keeping as the answer Enter gives. Forgetting everything also takes the words "forget everything", typed out. Esc at any point keeps everything. `/bsd forget project`, `/bsd forget python` and `/bsd forget everything` skip the first question and none of the others.

It works whether the tutor is on or off.

### Stop

`/bsd pause` silences it without closing anything. `/bsd off` ends the ride, and Claude Code behaves normally again. Each new session starts with it off. Clearing the conversation with `/clear` does not switch it off.

Nothing needs configuring, but the models, thinking levels, pacing, and the tutor's voice and engineering persona are all yours to change. See [Models and settings](#models-and-settings).

## What it remembers about you

Backseat Driver keeps one profile per language, not per project. Your Python profile is the same in every Python project, so the tutor picks up where you left off wherever you switch it on. A general profile holds what is not tied to one language.

A profile holds:

- **Where you are.** Your answers to the first-run questions, such as how much of the language you have written and which language you know best. "Rust, coming from Python" means Rust idioms get explained by comparison with the Python you already know.
- **Where you want to get to.** Your goals for that language.
- **What you don't want to hear about.** Everything you have told it to hush about.
- **What you have covered.** The ideas it has explained to you and the mistakes that keep coming back, so it stops repeating itself, builds on earlier lessons and can show you your recurring themes.

A profile comes into play when you work on a file in that language. In a project that mixes languages several can be active, and your Bash profile stays out of the way until you touch a shell script. The tutor can also look at your other profiles when that helps, for example to explain a Rust idea in terms of Python.

Profiles are saved automatically, on your machine and outside any project, as plain JSON files in one folder: `~/.local/share/backseat-driver/`, or under `$XDG_DATA_HOME` when that is set. They are never written into your repository. It is the same folder however the plugin was installed, and nothing in it expires. The pane's Progress tab shows what the tutor has on record for the languages in play. Beside each thing you hushed is a key to bring it back, and under each language a key to answer its questions again.

## What it learns about a project

Your profile is per language. What the tutor learns about the code is kept per project, and the three background jobs share it:

| Job | The question it answers | When it speaks |
| --- | --- | --- |
| Play-by-play | What should I look at in what I just wrote? | While you hack |
| Deep review | How was the work I just finished? | After a commit |
| Explain | What is this code I am looking at? | While you read |

- **The deep review writes the big picture.** Each review ends with notes you never see: an overview of the project, what each file it read is for, and a few insights on specific functions, such as an assumption one makes or why it is the way it is. The next review is also given what the last few said, so that it can follow up instead of repeating itself.
- **A new project gets a first look.** The first time you switch the tutor on in a project, the deep review model takes one look around and writes the overview, so that the faster models start from the big picture. It runs once per project, and not when deep reviews only run on request or your plan is near its limit.
- **The play-by-play reads it.** Before it looks at what you just saved, the faster model is told what the project is, what the file is for, and what the deep review said about the parts of it you did not just change. It can then keep to the detail of your change with the bigger picture in front of it.
- **Explain shows it.** Beside the function you are reading, the Explain tab shows what the last deep review said about it, with the commit it comes from.

The never-stale rule holds here too. An insight is kept with a fingerprint of the code it was written about, and it is shown or passed on only while that code is exactly what it was. Change the function and what was said about the old one goes. The overview is about the project as a whole, so it is labelled with the commit it was written at, and the next review corrects it when it is wrong.

Beside the cache sits the project's journal: what you have been doing in the code, in order, and what you are working on. The cache is about the code, and the journal is about your work on it. See [What you are working on](#what-you-are-working-on).

All of it is plain JSON in the data folder, under `projects/<name>-<hash>/`. `/bsd forget project` erases it.

## How you are doing

The fourth tab, Progress, keeps an honest record of your level in each language, the same in every project. For each language in play it shows:

- **A level**: beginner, junior, mid or senior, and a few sentences on why, citing your work.
- **What the next level needs**, concretely.
- **What you are working on**, the skills you have shown, and any that are slipping.
- **What you have been up to lately**: the last few things it saw, with the project and commit.
- **A word of encouragement**, kept apart from the level so that it can never soften it.

Your answers to the first-run questions and everything you have hushed are under each language, as before.

It is brought up to date after the deep review of each commit of yours, with the review for context, or as soon as you commit when deep reviews after commits are off. One request on the deep review model reads the lines you added and says which skills they show or miss. Rules in code, not the model, decide what that adds up to.

**Only your own work counts.**

- A commit counts when its author's email is yours: the one git uses in that repository, which is your `~/.gitconfig` one unless the repository sets its own. The tab says which email it is going by.
- A merge does not count, nor does a commit that names a co-author or says a tool wrote it, such as one with a `Co-Authored-By: Claude` line.
- Nor does a commit that adds more than 600 lines or touches more than 25 files at once, which reads as an import, a vendored library or generated code. Lock files and generated folders are never read.
- Only the lines a commit adds are judged, never the code around them. A small change in an excellent codebase shows exactly as much as the small change. In a real session in a project whose history was mostly a maintainer's polished, documented code, only the one modest commit of the person's own was read, and the report said plainly that a four-line function with a print in it was all there was to go on.
- A change of three lines or fewer says too little about anyone, so it is not assessed. The tab says so.

**Levels move slowly, and can come back down.**

- No level is shown before five observations from two commits.
- Work the tutor watched arrive, saved while it was on, counts in full. Other commits of yours count half.
- The first placement never outruns the evidence. When the tutor first meets a language in a project, it reads up to five of your recent commits there in one request, so that you do not start from nothing.
- A level moves one step at a time. A step up needs four observations' worth of new evidence at the next level, from at least two commits, and the model has to see it too. One good afternoon is not a level.
- A step down needs two observations' worth of missing what the current level assumes, from at least two commits. One bad commit is not a level either. A skill you showed once and then miss is marked slipping, which is how a level given too early comes back down.
- A level stays provisional until it rests on twelve observations from four commits. Every change is recorded with its reason.
- What you said about yourself in the questions is not evidence. It sets the tone until there is something to go on.

The tutor knows your observed level too. It goes into every prompt, so that notes, reviews and answers are pitched at what your code shows. Ask "how am I doing?" and the tutor looks the report up instead of guessing.

The report is one JSON file per language, `progress/<language>.json` in the data folder. `/bsd forget python` erases it, with the rest of what is on record for that language. A setting turns the report off.

## Ground rules

The tutor follows a short contract. It defines the project, so here it is in plain words:

1. **You drive.** While Backseat Driver is on, Claude does not edit your files. A hook refuses the editing tools, so this does not depend on the model behaving.
2. **Hints before answers.** Every note starts as a nudge. More comes only when you ask, one step at a time: first the concept, then a worked example of the idea. An example is not a patch for your file.
3. **Explain the why.** A note names the underlying idea, such as ownership, short-circuit evaluation or an N+1 query, so you can look it up and recognize it next time.
4. **Stay out of the way.** Few notes, ranked by how much they matter. Nothing a formatter or linter would catch. Silence when there is nothing worth saying. No exercises and no quizzes: the project you chose to build is the lesson.
5. **Always open to questions.** You never have to wait for a note before asking something.
6. **You have the last word.** The tutor reconsiders when you push back, gets a second opinion when you contest a point, and yields when you say to do it your way. Tell it to hush about something and it drops it for good.
7. **Your project's rules still count.** The project's own `CLAUDE.md` stays loaded so the advice fits your codebase. Where it conflicts with this contract, the contract wins.

## How it works

Backseat Driver is one Claude Code plugin with two layers:

- **The contract** is a skill: a Markdown file holding the ground rules above. A skill is the standard way for a plugin to carry instructions.
- **The live layer** is a [mod](https://code.claude.com/docs/en/plugins/mods/overview): TypeScript handlers that run inside Claude Code. A mod can draw panes, add commands, change the system prompt, intercept tool calls and call models in the background, which covers everything the ride-along needs.

The plugin is installed once and stays dormant in every session until you switch it on: no pane, no model calls, no prompt changes.

```text
PLAY-BY-PLAY

you save a file
      │
      ▼
watcher         Asks git what changed every couple of seconds. Nothing
      │         reaches a model at this stage.
      ▼
gate            Waits for the working tree to go quiet and for the minimum
      │         gap since the last look. Drops the look if nothing real
      │         changed.
      ▼
reviewer        One background request to the play-by-play model with the
      │         change since the last look, the code around it, your profile,
      │         the notes already open and what the journal says you have
      │         been doing. No tools, no turn in your chat.
      ▼
Play-by-play    New notes appear. Notes you have dealt with disappear.
tab


DEEP REVIEW

you commit, the timer fires, or you ask
      │
      ▼
watcher         Spots a new commit by polling git. No git hooks are installed
      │         in your repository.
      ▼
deep reviewer   A read-only subagent on the deep review model reads the commit
      │         and explores the code around it.
      ▼
Deep review     The written review replaces the previous one.
tab


CONVERSATION

Your questions go to the session's model, which is given your profile, the
open notes, the latest review and a few lines from the journal as context. A
point you contest goes to the deep review model for a second opinion.
```

### When the play-by-play looks

Saving a file does not call a model. The watcher only notices that something changed. A look happens when all of these hold:

- The working tree has been still for the quiet time, 10 seconds by default. A burst of saves, or an editor that autosaves as you type, counts once.
- The minimum gap since the previous look has passed, 1 minute by default.
- Something real changed since the previous look. An edit that only touches blank lines, trailing whitespace or line endings doesn't count, and neither do files that git ignores, binary files, generated files or lock files.
- No other look is still running.

A look covers the net change since the previous look, however many saves that took. Work that was already uncommitted when you switched the tutor on is the starting point, not something to review. After a look fails, for instance on a rate limit, the next one waits longer.

The background work also holds back as your plan's usage runs out. Once any usage window of your plan is 80% spent, looks are spaced four times further apart. From 95%, the play-by-play and the automatic deep reviews stop, the pane says so, and both still run when you ask from the pane.

### Why the watcher polls

The watcher asks git what changed every couple of seconds, and stretches that interval by itself in repositories where git is slow. Polling is the dependable option. Claude Code's own file watching is built for a short list of named files, such as `.env`, not for a whole working tree, and the tools that can watch a tree (inotify-tools, fswatch, Watchman) would each be an extra install. A poll costs one `git status` and never reaches a model.

### What each part is built on

| Behavior | Mechanism |
| --- | --- |
| `/backseat-driver` and `/bsd` | Two commands the mod registers with `$.command.register`, answered by the same hook. They run at once, without a model turn. |
| The tutor contract | `plugin/skills/tutor/SKILL.md`. While the mode is on, a `prompt.compose` hook adds it, and the profiles in play, to the system prompt. The same hook replaces Claude Code's own "Doing tasks" section, which tells Claude to find the code and modify it. |
| Voice and engineering persona | One Markdown file per voice in `plugin/personas/voice/`, and one per engineering persona in `plugin/personas/engineering/`. The chosen ones are added to the system prompt and to both review prompts, the engineering half first. |
| The animated persona | Text art in `plugin/hooks/avatar.ts`, one character per voice, drawn by the pane's `ui.render` hook. Its line comes in the play-by-play's reply, in a field that `plugin/prompts/speech-bubble.md` asks for, or is a deep review's last line. One `$.clock.every` timer moves its mouth while it talks and another makes it blink. What it says lives in `$.state`, so each tick redraws it. |
| The contract outranks the project's `CLAUDE.md` | A `prompt.context` hook keeps the project's instruction files loaded but reframes them as background that yields to the contract. |
| Claude never edits your files | A `tool.call` hook refuses `Edit`, `Write` and `NotebookEdit` while the mode is on. The only paths it lets through are Claude Code's own: its folder under your home directory, where it keeps its notes, and its scratch folder. |
| Noticing saves and commits | A `$.clock.every` timer runs `git status` through `$.process.run` for saves. For commits it checks the reflog file's size and modification time, and runs `git reflog` only when that changes. |
| Finding the project's languages | `git ls-files` and a table of file extensions. A language counts as a main one when it holds at least 15% of the source files, and the biggest always counts. |
| First-run questions | `$.ui.ask`, the same question dialog Claude uses. |
| Explain | `$.model.complete` on the explain model, with an abort signal so that a lookup overtaken by a save is cut short. What it learns is one JSON file per source file in the project's cache. While the tab or an editor is watching, the file in focus is checked for changes ten times a second with `$.fs.stat`. |
| Looking code up in conversation | A `lookup` tool the mod registers. It answers from the same cache and turns the tab to the spot. |
| The journal | One JSON file per project in the tutor's data folder. Each poll of the watcher adds what was saved, diffed in the mod with no model involved, and the time since the previous poll to where the editor's caret is. It is written at most every 30 seconds. Another session on the same project adds to it rather than overwriting it. |
| What you are working on | The play-by-play's reply says what you appear to be working on, in a field its prompt asks for. `w` and `/bsd working` ask with `$.ui.ask`, and a `working` tool records what you tell the tutor. An `activity` tool lets the tutor read the whole journal. |
| Profiles | One JSON file per language in the tutor's data folder, written with `$.fs.write`. Forgetting deletes with `rm`, because the mod API has no delete. |
| Play-by-play review | `$.model.complete` with the chosen model and thinking level: one request, no tools, no conversation history. |
| Deep review | A read-only subagent (`Read`, `Grep`, `Glob`) that the mod registers with `$.agent.register` on the chosen model and thinking level, and starts with `$.agent.spawn`. A `turn.complete` hook takes its answer to the pane, not into the conversation. |
| Second opinion on a contested point | The tutor hands the point to the same read-only subagent and reports its verdict in the conversation. |
| "Stop warning me about that" | A `hush` tool the mod registers with `$.tool.register`. The tutor calls it when you state a preference, and the mod saves it to the profile and drops the matching notes. No permission prompt appears, because the mod answers its own tool. An `unhush` tool undoes it, a `record` tool saves what you tell the tutor about yourself, and a `profile` tool lets the tutor read your profile for a language that is not in play. |
| The pane | `$.ui.open` plus a `ui.render` hook, with Play-by-play, Deep review, Explain and Progress tabs. Their contents live in `$.state`, so the pane redraws when they change. Buttons on a note send a question into the conversation with `$.prompt.submit`. |
| The conversation knows the notes | A `prompt.submit` hook attaches the open notes, the latest review, the character's last line and a few lines from the journal as context. |
| Settings | `userConfig` in `plugin.json`. Each setting is a row in `/config`, listed under [Models and settings](#models-and-settings). |

Why a mod and not a skill alone? A skill could carry the contract, and a plugin monitor (a background script whose output is fed to Claude) could report file changes. But every save would then become a turn in your conversation, paid for on your main model and mixed in with your questions. The mod reviews out of band, on the models you choose, and leaves the conversation for what you ask. Where mods are turned off, the skill still works alone as `/backseat-driver:tutor`: the same tutor, without the play-by-play and the automatic reviews.

## Models and settings

There are four jobs, and each runs on its own model:

| Job | Model | How it runs |
| --- | --- | --- |
| **Play-by-play**: running commentary on each settled change | Your choice. Sonnet by default | Background request that sees the change and the code around it |
| **Deep review**: a longer review of your commits, and second opinions | Your choice. Opus by default | Read-only subagent that can explore the codebase |
| **Explain**: what the code you are reading does | Your choice. Sonnet at low thinking by default | Background requests, one per file and one per function, kept in a cache |
| **Talk**: your questions, and "explain" on a note | The session's model and thinking level, set with `/model` and `/effort` | Normal conversation turn under the tutor contract |

Everything is configured in `/config`, and the three background jobs have separate settings. A change applies at once, without restarting the session.

| Setting | Choices | Default |
| --- | --- | --- |
| Voice persona | `default`, `torvalds`, `knuth`, `primeagen`, `eli5-tldr-kiss-terse` | `default` |
| Engineering persona | `default`, `torvalds`, `knuth`, `primeagen` | `default` |
| Animated persona | on, off | on |
| Play-by-play | automatic, on request | automatic |
| Play-by-play quiet time | 5, 10, 20, 30 or 60 seconds | 10 seconds |
| Play-by-play minimum gap | none, 30 seconds, 1, 2 or 5 minutes | 1 minute |
| Play-by-play model | `haiku`, `sonnet`, `opus`, `fable` | `sonnet` |
| Play-by-play thinking level | `low`, `medium`, `high`, `xhigh`, `max` | `medium` |
| Deep review after each commit | on, off | on |
| Deep review every | none, 5, 15, 30, 45, 60, 90 or 180 minutes | none |
| Deep review model | `haiku`, `sonnet`, `opus`, `fable` | `opus` |
| Deep review thinking level | `low`, `medium`, `high`, `xhigh`, `max` | `high` |
| Explain | `automatic`, `on request`, `off` | `automatic` |
| Explain model | `haiku`, `sonnet`, `opus`, `fable` | `sonnet` |
| Explain thinking level | `low`, `medium`, `high`, `xhigh`, `max` | `low` |
| Progress report | on, off | on |

The quiet time is how long the working tree must be still before the play-by-play looks, and the minimum gap is the shortest time between two looks. Lower both for commentary that keeps closer to your typing, or raise them for fewer interruptions and less usage. Set the play-by-play to "on request" and it looks only when you ask for a look from the pane.

How often the watcher polls, what counts as a real change, and the slow-down near your plan's limits are not settings. They adapt by themselves.

With Explain on `automatic`, the tutor looks up what your cursor is on and what you save. On `on request` it shows what it already has and fetches only what you ask for: `f` in the tab, `/bsd explain`, or a question in the conversation. Near your plan's limits it behaves as `on request` by itself, first for saves and then for everything.

The two deep review triggers are independent, so reviews can run after commits, on a timer, on both, or on neither. With both off, a deep review runs only when you ask for one from the pane.

What a deep review covers depends on what triggered it:

- **After a commit**: that commit.
- **On the timer**: everything since the previous deep review, meaning any commits made in between plus the uncommitted work on top of the last commit. A timed review is skipped when nothing has changed.

A deep review follows the same ground rules as a note. It explains and points, and it does not rewrite your code. While one runs, Claude Code's footer lists it as a background agent. When it finishes, a short notice appears and the tab is marked as new until you open it. One review runs at a time, and a commit made in the meantime is reviewed next.

Models are addressed by alias, so each setting follows the current model of that family. Thinking levels are Claude Code's effort levels. Everything runs through your existing Claude Code login. There is no API key to set up, and usage counts against the same plan.

### Personas

A persona shapes the notes, the deep reviews and the conversation alike. It comes in two halves, and you choose each on its own:

- **The voice** is how the tutor talks: its tone, its wording and its teaching style. It changes how a point is put, never which points are made.
- **The engineering persona** is whose judgment the tutor reviews with: what it values in code, what it flags, and which way it leans when there is more than one reasonable approach. `default` is Claude's own judgment, not tilted toward anyone's.

So `eli5-tldr-kiss-terse` can explain what `knuth` would worry about, or `torvalds` can deliver Claude's own verdicts in his manner. Choose the same name for both halves to get the whole persona. Both can be switched at any time.

| Voice | How it talks |
| --- | --- |
| `default` | Plain, calm and to the point. |
| `torvalds` | Blunt and plain. Says what is wrong in the first sentence, with no padding. Hard on the code, never on you. |
| `knuth` | Patient, precise and gently playful. Often nudges with a small case to trace by hand. |
| `primeagen` | Fast, energetic and funny. Nudges with a challenge, and celebrates a good fix in one line. |
| `eli5-tldr-kiss-terse` | The shortest plain-words version. One idea per note, and no jargon without a definition. |

| Engineering persona | What it values and which way it leans |
| --- | --- |
| `default` | Claude's own engineering judgment. |
| `torvalds` | Data structures first, and the version of the code in which the special case disappears. Against abstraction until it pays for itself, against breaking what works, and for practice over theory. |
| `knuth` | Correctness you can explain, the edge cases, and knowing what an algorithm costs. Optimizes only where measuring says it matters, and counts a comment that states an invariant as part of the program. |
| `primeagen` | Knowing what the machine does: no needless allocation or copying, the right data structure, plain functions over layers, errors handled as values, and few dependencies. |

The engineering personas disagree in useful ways. Shown a linear search through a list inside a loop, `primeagen` asks for a set at once, `knuth` asks how large the list can grow, and `torvalds` lets it pass unless it sits on a path that runs all the time.

Neither half changes the ground rules. The personas named after people are in their spirit: the tutor does not claim to be them or to quote them, and a voice does not bring its namesake's opinions about code along with it.

#### The animated persona

A small character stands at the top of the Play-by-play and Deep review tabs and speaks for the voice. For `default` it is Claude Code's own mascot. The others are ASCII caricatures, drawn in good fun: Linus in his square glasses for `torvalds`, Knuth in his round ones for `knuth`, ThePrimeagen in headphones and mustache for `primeagen`, and the KISS Linux penguin in its top hat for `eli5-tldr-kiss-terse`. It rests dimmed, looks up while a look runs, and lights up and talks, one word at a time, when it has something to say:

- **After a look**, one line about a critical point or a design decision in what you just saved, such as a choice of data structure, an interface or a way of handling errors: why it matters, never the fix.
- **After four quiet looks in a row**, a look may give it a light remark about the work instead.
- **When a deep review lands**, the review's closing line: the one thing most worth doing next.

A look with nothing worth saying leaves it quiet, so what it says is always about your latest change. It blinks now and then, sleeps while the tutor is paused, and takes a single line where the pane sits above the prompt. Its lines come in the play-by-play's own reply, so it costs no extra model calls, only a few more words per look. The tutor in the conversation knows what it last said, so you can ask about it. Set Animated persona to off for a plain pane.

## Limits

- **It sees saves, not keystrokes.** The plugin reads files on disk, not your editor's unsaved buffer. With autosave on, that is close to live.
- **It sees what you read only through an editor.** Without an editor plugin, the journal knows what you saved and committed, not where you were looking, and what you are working on is worked out from your saves alone.
- **It needs git.** Changes are found by diffing the working tree, and files that git ignores are never sent.
- **Explain is only as good as its model's reading.** It is told to say only what the code shown supports, and line numbers it gets wrong are caught, because every symbol has to quote its own first line. What it says about a function can still be mistaken. It knows the file it is in, and other files only once they have been mapped.
- **It spends usage in the background.** Every play-by-play look and every deep review is a model call on your plan. The play-by-play waits for a pause, sends only the change and its surroundings, runs one look at a time, slows down as your plan's usage runs out, and can be paused. A deep review costs more, because it runs a stronger model at a higher thinking level, so how often it runs is yours to set.
- **Mods are new.** The mod API is early access and can change between Claude Code releases. Panes are drawn by the terminal CLI and by the Code tab of the desktop app. The VS Code extension's chat panel runs mods but does not draw them, so use `claude` in the editor's integrated terminal there.
- **A mod is code that runs with your permissions.** This one is meant to stay small and auditable: it runs `git`, reads files inside the repository and its own plugin folder, calls models, keeps what it remembers in its own data folder and draws a pane. The only other program it runs is `rm`, only when you tell it to forget something, and only on paths inside that folder, which it marks as its own before it will delete anything there. It makes no network requests of its own, installs no git hooks and never writes to your working tree. `claude plugin validate` lists every event a mod hooks and every call it makes, so you can check that before installing.
- **The edit guard covers the editing tools.** A shell command can still write a file, so that part rests on the contract and on Claude Code's normal permission prompts.

## Install

The [README](README.md#get-it) has the commands. This repository is its own plugin marketplace, and its manifests validate, but installing from it has not been tried yet. The dependable way today is to load the working copy, as described under [Repository layout](#repository-layout).

Mods need Claude Code 2.1.287 or later. The design targets the mod API as of 2.1.289.

## Repository layout

```text
backseat-driver/
├── .claude-plugin/
│   └── marketplace.json        lets this repository be added as a marketplace
├── plugin/                     the plugin itself: everything a user installs
│   ├── .claude-plugin/
│   │   └── plugin.json         manifest and the settings shown in /config
│   ├── skills/
│   │   └── tutor/SKILL.md      the tutor contract
│   ├── personas/
│   │   ├── voice/              how the tutor talks, one file per voice
│   │   └── engineering/        whose judgment it reviews with, one file per persona
│   ├── prompts/                instructions for the reviewers
│   ├── hooks/
│   │   ├── hooks.json          points Claude Code at the mod
│   │   ├── register.tsx        the mod: every effect the plugin has
│   │   └── *.ts                pure logic that register.tsx calls
│   ├── types/index.d.ts        types for the state the pane reads
│   └── tests/                  run with `claude plugin test`
├── .github/workflows/
│   ├── check.yml               CI: npm run check on each push, on the pinned Claude Code
│   └── nightly.yml             the same check once a day, on the newest Claude Code
├── scripts/dev-session.sh      start a real session with the working copy, in tmux
├── package.json                dev tooling only: TypeScript for type checking
├── CLAUDE.md                   guidance for Claude Code when working on this repository
├── DESIGN.md                   this file: the design spec
└── README.md                   the short version: what it is, how to get it and use it
```

The development loop:

```bash
npm install             # once: TypeScript, the only dev dependency
npm run check           # validate both manifests, run the tests, type-check
scripts/dev-session.sh  # try the working copy in a real session, inside tmux
```

`npm run check` runs `claude plugin validate`, which also lists every event the mod hooks and every call it makes, then `claude plugin test`, then `tsc`. The type check needs the API types that Claude Code writes into `plugin/.claude-plugin/types/` the first time it loads the plugin, so run `scripts/dev-session.sh` once before it.

To use the working copy in a project of your own, start Claude Code there with `claude --plugin-dir /path/to/backseat-driver/plugin`. That loads the plugin for that session only and reloads the mod whenever one of its files is saved.

## Part two, being built

Everything above this heading exists. What is under it is decided and is being built in the order the [roadmap](#roadmap) gives. A feature here does not exist until its line in the roadmap is checked.

### Staying up to date

While the tutor is on, it checks at most every six hours whether a newer release is on GitHub, and says so in the pane. `/bsd update` (or `/backseat-driver-update`) fetches it, and the tutor comes back on by itself afterwards. A setting turns the check off.

### Uninstalling

`/bsd uninstall` will forget everything, remove the plugin, and say what is left in your settings.

### Where it is kept

The data folder that holds your profiles, and each project's journal and cache, will also hold the progress records:

```text
~/.local/share/backseat-driver/
  profiles/<language>.json      answers, hushes, lesson memory
  progress/<language>.json      evidence, level, report
  projects/<name>-<hash>/
    journal.json                what you have been doing, and what you are working on
    project.json                overview, what each file is for, insights
    reviews.json                the last few deep reviews
    files/<hash>-<name>.json    one source file: its outline and explanations
  focus.json                    written by an editor: where the cursor is, what is open
  view.json                     written by the tutor: what it knows about that spot
```

## The editor side

Plugins for vim and emacs are planned and not written. This is the whole of what one has to do, and it works today with anything that can write a file.

Both files live in the tutor's data folder, `~/.local/share/backseat-driver/`.

**The editor writes `focus.json`** whenever the cursor or the selection moves, and whenever any of the other fields change:

```json
{
  "file": "/home/you/project/src/stats.py",
  "line": 12,
  "endLine": 15,
  "modified": true,
  "buffers": ["/home/you/project/src/stats.py", "/home/you/project/tests/test_stats.py"],
  "visible": ["/home/you/project/tests/test_stats.py"],
  "active": true
}
```

- `file` is an absolute path. A file outside the repository the tutor is running in is ignored, so several sessions can share the one focus file.
- `line` is 1-based. `endLine` is there only while lines are selected.
- `file` and `line` are all Explain needs. The rest feed the journal and are optional: `modified` says the buffer with the cursor has changes that are not saved, `buffers` lists the files open in the editor, `visible` the other files on screen beside it, as in a split, and `active` is false while the editor's window does not have the keyboard.
- The editor reports only where things are, never how long. The tutor adds the time up itself, crediting each poll to where the cursor is. Time keeps counting for two minutes after the last write, so a cursor left still while you read counts, and one left overnight does not.
- A few writes a second is plenty. Write it to a temporary name and rename it into place, so that it is never read half-written.

**The tutor writes `view.json`** in answer, and again whenever what it knows about that spot changes:

```json
{
  "v": 1,
  "at": 1791142331000,
  "root": "/home/you/project",
  "source": "editor",
  "spot": { "path": "src/stats.py", "line": 12 },
  "status": "fresh",
  "fileSummary": "Small statistics helpers.",
  "outline": [{ "name": "mean", "kind": "function", "startLine": 1, "endLine": 2, "summary": "The average of a list." }],
  "isOutlineCurrent": true,
  "isMappable": true,
  "target": { "name": "variance", "kind": "function", "startLine": 10, "endLine": 12, "summary": "How spread out the values are." },
  "detail": { "what": "...", "how": "...", "why": "...", "watch": "...", "uses": ["mean"] }
}
```

- `status` is `fresh` when everything about the spot is there, `updating` while something is being fetched, `waiting` or `held` when it is not being fetched until asked for, `failed`, `no-file` or `off`.
- Everything in the file has already been checked against the source file on disk. An editor shows what is there and nothing else.
- `target` is null between symbols, and `detail` is null until the explanation has arrived.

Once the tutor has seen a focus file it checks it ten times a second. With a hand-written script standing in for an editor, `view.json` answered 40 to 80 milliseconds after the cursor moved.

## Roadmap

- [x] **Scaffold.** Plugin manifest, marketplace entry, settings, the `/backseat-driver` and `/bsd` commands, validation, tests and type checking.
- [x] **Tutor mode.** The contract as a skill, the `/backseat-driver` and `/bsd` switch, the system-prompt override, the edit guard, the personas and the pane with its three tabs. Useful by itself as a conversational tutor.
- [x] **Play-by-play.** Watcher, gate, reviewer on the chosen model and thinking level, and the Play-by-play tab with explain, dismiss and look now.
- [x] **Deep review.** Commit detection, the timer, the read-only reviewer with its own model and thinking level, and the Deep review tab with review now.
- [x] **Profiles.** Language detection, the first-run questions, one profile per language shared across projects, hushing in chat or by key, lesson memory and the Profile tab.
- [x] **Follow-through.** Explain and dismiss on each note, notes and reviews shared with the conversation, second opinions on contested points.
- [x] **Tuning.** Holding back near plan limits, keeping a dismissed note from coming back, telling the reviewers which language each file is in, and feeding the lesson memory into every prompt so that an idea already explained is referred back to.

Part two:

- [x] **Usability, first pass.** `/bsd` answers at once and sets up in the background, `/bsd help`, `/bsd questions` and the `q` key, and a line in the pane on how to give it the keyboard.
- [x] **Data home and forgetting.** State in `~/.local/share/backseat-driver/`, profiles moved out of the plugin store, and `/bsd forget`.
- [x] **Persona in two halves.** The voice and the engineering persona as separate settings, so that how the tutor talks and whose judgment it reviews with are chosen apart.
- [x] **Explain.** The lookup engine and its queue, the never-stale rule, the Explain tab, `/bsd explain`, the files an editor reads and writes, and a lookup tool for the tutor.
- [x] **Animated persona.** A small character for each voice at the top of the pane, which talks at the critical and decision points a look finds, passes on a deep review's takeaway, and jokes now and then. A setting turns it off.
- [x] **One cache for all three jobs.** Deep reviews write overviews and insights into the project's cache, a first look at each new project, and the play-by-play and Explain read from it, under the same never-stale rule.
- [x] **Journal.** A record per project of what you do in the code, read by every model the tutor calls, the "Working on" line in the pane with `w` and `/bsd working`, the editor's buffers and attention in `focus.json`, and the `working` and `activity` tools for the tutor.
- [x] **Progress.** Whose work it is, the evidence ledger, the rules for moving a level, the Progress tab, a first placement from past commits, and the observed level in every prompt.
- [ ] **Updates and uninstall.** Release tags, the update notice, `/bsd update` and `/bsd uninstall`.
- [ ] **Usability, second pass.** Every screen and command walked through in a real session.

## Related

- [learning-output-style](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/learning-output-style), Anthropic's learning mode plugin: Claude writes most of the code and hands you small pieces to fill in. Backseat Driver goes the rest of the way, and you write all of it.
- Claude Code docs: [Mods overview](https://code.claude.com/docs/en/plugins/mods/overview), [Mods reference](https://code.claude.com/docs/en/plugins/mods/reference), [Plugin components](https://code.claude.com/docs/en/plugins/components), [Plugin manifest reference](https://code.claude.com/docs/en/plugins/manifest-reference), [Create a marketplace](https://code.claude.com/docs/en/plugins/create-marketplace).
