---
paths:
  - "plugin/core/explainer.ts"
  - "plugin/core/knowledge.ts"
  - "plugin/core/explain-prompts.ts"
  - "plugin/core/focus.ts"
  - "plugin/core/following.ts"
  - "plugin/core/editors.ts"
  - "plugin/core/enclosing.ts"
  - "plugin/core/attention.ts"
  - "plugin/prompts/explain.md"
  - "plugin/tests/explain.test.ts"
  - "plugin/tests/explaining.test.ts"
  - "plugin/tests/editors.test.ts"
  - "plugin/tests/following.test.ts"
  - "editors/**"
---

# Explain and the editor protocol

## Explain

- Spot = whichever moved last: the caret of the editor that speaks for this project (`editors.ts`); `/backseat explain path:line[-end]`; `n`/`p` and an outline pick (both `source: 'pane'`, never `command`); the `lookup` tool; a save (to `firstChange` past blank lines; doesn't steal focus from an editor active in the last 10 min).
- Tab order: file and symbol, keys (`n`, `p`, `e`, `f`), the outline (current symbol marked, each row a button, `onExplainPick`), then what, how, why, watch, relies-on, the review's insight with its commit, the open issues. Outline near the top so `n` does not move the page.
- Never-stale, enforced in `knowledge.ts`/`explainer.ts`, not by callers:
  - A symbol stores fingerprints of its exact lines and first line. `freshSymbols` re-finds each wherever it moved and drops any whose text changed. Views are built only from those.
  - An explanation stores fingerprints of the symbols it relies on; `trusted()` drops it if any changed. Names resolve in the same file, or in another mapped file when exactly one has the name.
  - `placeSymbols`: each outline symbol must quote its first line, at the named line or within 5; else dropped.
  - A lookup reads the file before and after the model call; changed text means not stored (`stale`; a mapping returns `again`).
  - File and outline summaries show only while the file fingerprint matches.
- `createExplainer(ports)`: reads never wait on a model. `view(spot, intent)` answers from memory and disk and queues what's missing. A file held in memory stands until its entry on disk changes (`entryStamp`, a stat; without the port, once read is final); then it is read again and merged (`mergeKnowledge`: theirs plus what mine explains that theirs does not, same text). A write goes on top of the entry as on disk, through the same merge, never after a `reset()` the lookup began before (a blind write dropped another session's explanations and wrote into a forgotten folder).

  | Intent | From | Priority | Waits to settle | Stops near limit |
  | --- | --- | --- | --- | --- |
  | `asked` | `/backseat explain`, `n` `p` `f`, lookup tool | first | no | never |
  | `browsing` | editor cursor, refresh of a shown spot | first | yes | 95% |
  | `following` | save | after those | yes | 80% |
  | ahead | 2 unexplained symbols after a mapping | last | — | 80% |

- While the focused symbol's lookup runs, the tab holds the last explanation's rows (`estimatedRows` → `explainHold`), else Claude Code clamps the window and a pick moves the page.
- `uses` dropped when written and when a cached one is trusted (`forward`): a section naming a later section (reliance runs backwards only; `prompts/explain.md` says so), and any symbol whose lines are all comments (`isAllComment`, `noise.ts`).
- `SETTLE_MS` 2.5 s after a file's last change before mapping; a symbol never waits. Concurrency 2, plus 1 for a watched spot. `commit()` applies to the latest state synchronously and writes one at a time (two at once lost one). Re-check the cache just before the model call.
- Failed lookup: `RETRY_MS` (1 min), doubling to `MAX_RETRY_MS` (1 h); a failure older than that is forgotten.
- Browsing: one lookup waits per file (else a caret or growing selection queued one per line). Asked and ahead jobs stay queued.
- No timer pumps the queue: `readyAt(job)`; `pump` starts what may and calls `wakeAt` with the next time-ready moment (deadline `explain`); `wake()` is called by the deadline and by `wake` in `register.tsx`.
- `pressure()` `held` (Claude not answering, plan at its limit): only asked jobs start. A lookup failed while held is not marked failed; it is requeued and runs at `wake`, without the wait.
- `changed()` resolves when the next lookup ends. The `lookup` tool and `/backseat explain` wait on it (`lookUp`, `soonest`), up to `LOOKUP_WAIT_MS` (6 s) total, never a sleep loop.
- Issues (see `deep-review.md`): a symbol's request lists open issues inside its lines, worst first (`issuesWithin`, `issues` port); the prompt forbids saying the code handles what one says it does not. An older explanation stands while the code reads the same. The tab lists open issues inside the focused symbol or on the line between symbols (`issuesHere`: `Issue: high · line 95  title`, severity color), under the insights.
- `prompts/explain.md` also: never the first person; never "unset" for a name set outside the lines shown; the overview may predate a change, so never say the file does not match the notes (see `deep-review.md`, Project cache).
- A pane-chosen spot stands until the caret moves: the report as followed is kept in state (`followedEditor`, `lastFollowed`/`keepFollowed` ports). At a reload `startExplaining` follows the editor only when its report changed, or the restored spot is the caret's own.
- Fast lane timed by the caret's own move: `followEditor` sets `editorFocusAt` from the speaker's `changed` (`focusChangedAt` from `readFocus`), and starts only within `EDITOR_LIVE_MS` of it.
- Setting `explain`: `automatic | on request | off`. Near limits `automatic` degrades to on-request (saves first, then everything).
- `register.tsx`: `startExplaining` (in `engage`) builds the ports. `refreshView` builds the view into state and writes `view.json`; `writtenView` remembers the view and who set the spot, so `source` is rewritten when only it changed. `fastPoll` (tab open or editor live): stat of the focused file and listing of the editors' folder every 100 ms, stops when nobody watches (see `play-by-play.md`). `readFocus` is the only reader of the editors' files: one `$.fs.list`, a read of each changed file, `focusText` = the speaker's report without times (a beat is not a move); it writes the editors row; push sources call it. `pollFocus` feeds the journal, then `followEditor`.
- Verified: live (first explanation 6.6 s; cached `n`/`p` 40–80 ms; edit cleared the explanation ~60 ms; mapping 2.52 s after the scan; caret followed < 0.11 s). Tests only: `lookup` waiting on `changed()`.

## Editor protocol

Plugins in `editors/` (dev side, not shipped): `neovim/` (`plugin/backseat-driver.lua` starts `lua/backseat-driver/init.lua`), `emacs/backseat-driver.el` (`backseat-driver-mode`, mode-line lighter " Backseat" so a mode toggled off shows), `vscode/` (`extension.js`, no build; `npx @vscode/vsce package --skip-license`). Mod side: `editors.ts`.

Each running editor keeps `editors/<editor>-<pid>.json` in the data folder, written whole (`.<name>.tmp`, then rename) on change (debounced 150 ms) and every `EDITOR_BEAT_MS` (20 s):

```json
{ "v": 1, "editor": "neovim", "pid": 4242, "at": 1759653120000, "changed": 1759653118000,
  "root": "/abs/repo", "file": "/abs/repo/src/stats.py", "line": 12, "column": 5, "endLine": 15,
  "modified": true, "buffers": ["/abs/..."], "visible": ["/abs/..."], "active": true }
```

- `at` = written, `changed` = what it says last changed (ms). `root` = nearest folder above the file with `.git`. Real paths (symlinks resolved): the tutor's root comes from git.
- `line`/`column` 1-based, column in characters. `endLine` only for a multi-line selection (`line` its first). `modified` = unsaved in the caret's buffer, `buffers` = open files, `visible` = other files on screen, `active: false` = no keyboard. Explain reads `file`/`line`, the journal the rest; `column` for later.
- A non-file buffer (terminal, help, `untitled:`, output) is not reported; the last file's report stands and beats. The three plugins agree on `visible`, `buffers`, `active`.
- An editor writes nothing until the data folder has its marker (`.backseat-driver`), makes `editors/` if missing, removes its file on exit, and at start removes files untouched for a day.
- A plugin caches a found `root`, never "no repository": a folder with none is looked at again each time.
- Tutor: `at` older than `EDITOR_TTL_MS` (60 s) = closed. Speaker = the connected editor whose caret is in the project (`root` equal, or without `root` the file inside it) with the latest `changed`. The editors row names connected editors with anything of the project open.
- A caret under `.git/` (`COMMIT_EDITMSG`) is nowhere: `relativeTo` null, Explain keeps its spot, the journal credits nothing, the editor still counts as connected.
- Editors never report durations; `attention.ts` credits time per report, and a beat is not a report.
- The shared `focus.json` is retired (two editors overwrote it): not read; kept in `REMOVABLE`.

`view.json`, written in answer and whenever knowledge of the spot changes: `{ v: 1, at, root, source, spot: {path, line}, status, fileSummary, outline: [{name, kind, startLine, endLine, summary}], isOutlineCurrent, isMappable, target, detail: {what, how, why, watch, uses} }`.

- `status`: `fresh | updating | waiting | held | failed | no-file | off`. Already checked against disk; editors show it as is.
- `target` null between symbols; `detail` null until it arrives.
