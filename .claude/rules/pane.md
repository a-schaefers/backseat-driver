---
paths:
  - "plugin/hooks/pane.tsx"
  - "plugin/hooks/shown.ts"
  - "plugin/hooks/character.tsx"
  - "plugin/core/avatar.ts"
  - "plugin/core/sprite.ts"
  - "plugin/core/art/**"
  - "plugin/core/settings.ts"
  - "plugin/core/status.ts"
  - "plugin/core/clock.ts"
  - "kernel/src/Kernel/Status.purs"
  - "plugin/prompts/speech-bubble.md"
  - "scripts/persona-preview.ts"
  - "plugin/tests/pane.test.ts"
  - "plugin/tests/shown.test.ts"
  - "plugin/tests/keys.test.ts"
  - "plugin/tests/minimize.test.ts"
  - "plugin/tests/avatar.test.ts"
  - "plugin/tests/animation.test.ts"
  - "plugin/tests/settings.test.ts"
---

# Pane

## Pane placement

- The pane is the one place the tutor draws (no `horizontal`/`unified` layouts or `layout` setting: removed 2026-10-05). `showPane` (`openPane`, asking `PANE_COLUMNS` when docked) opens it while on, closes it when off: at switch-on, reload (`session.start`), `/backseat`, switch-off.
- Docked beside the conversation in a fullscreen terminal from 110 columns, else above the prompt (`placement` prop). Compact (`isCompact`, one-line character) off the terminal or above the prompt in a non-fullscreen terminal; otherwise whole (narrowing moves it, never changes its look; cut at the bottom until wide again).
- A change of tab scrolls to the top (`showTab` → `scrollToTop`, `$.ui.scroll({ in, to: 'start' })`): Claude Code keeps the offset across drawings. Recorded per drawing as `shown.pane.scroll` (`offset`, `bodyRows`); logged as `ui / scroll` (observe-only `ui.scroll` hook) and `ui / scroll to top` (with the refusal; the kit has no `$.ui.scroll` stub).
- Tabs always carry their digits (a bare digit never leaks into the prompt).
- Keys walk the rows (owner, 2026-10-07, see "Product"):
  - `j`/`k` (`row-next`, `row-previous`; `rowControls`, first among the controls when there is more than one row or one the keys are not on) move the focus ring through `rowKeysOf` (`shown.ts`): every keyless Button, in drawn order (any list a tab draws, folds, settings and options, `[ unmute ]`, `[ restore ]`). Starts from `ring` (per tab, `register.tsx`), else `currentRowKey`; wraps.
  - `putRing`: `$.ui.focus`, then `$.ui.scroll` (`nearest`); a note or issue there becomes what `e`, `d`, `t`, `m` act on (`selected`, `selectedIssue`, `playOn`). Enter presses the ring's row.
  - A press without the keyboard is a click; `touched` asks for it (`refocusPane`), except the strip, `x` and dialog-opening presses (`KEEPS_KEYBOARD`). A dialog asked from the pane (`w`, `q`) hands it back when answered (`refocusPane`: `$.ui.open` with `focus`).
  - The `ui.focus` hook refuses the person's ring moves (`{}` without `next`): Tab/Shift+Tab do nothing in the pane. The strip keeps Tab (its buttons have no keys).
  - The Explain symbol in focus is a row too (`❯` accent, name a plain Button), so the walk keeps its place after a pick.
  - Words: `j k` promised only where rows exist (`canWalkRows`; else `FOCUSED_HINT_NO_ROWS`: Growth, an empty Play-by-play tab, an opened lesson). Explain's `n`/`p` say "next symbol"/"previous symbol" (they explain; `j`/`k` only move the ring). A lesson's next step is `→`, not `▸` (no row). Nothing sends the person to Tab ("Ctrl+X Tab" aside; `/backseat settings` says "then j and k to it and Enter").
- Lists that open downward share `openList` (`jump:<subject>`, `setting:<key>`, `reviews`, ''); a change of tab folds it.
- Minimized (`minimized` atom; `isMinimized` for `/clear`, which empties state; `shown.minimized` for jack):
  - `x: minimize` (start of the keys row), the pane's ×, Ctrl+X X → `minimizePane`. The `ui.close` hook passes a person's close and marks it minimized (a mod cannot repaint the ×). While minimized `showPane` does not open it; a reload keeps it away.
  - `AbovePrompt` draws `renderMinimized`: `▸ Backseat`, the six tab names with the tab row's badges, each a keyless plain Button (a digit in an empty prompt would press a keyed band button), the name `autoFocus` (Ctrl+X Tab, Enter restores), then `STRIP_HINT` (fits under 143 columns).
  - `restoreFromStrip` reopens on the tab pressed, calling `$.ui.open` before any await: after one the open is the tutor's, not drawn under 144 columns after a close by hand (`x` keeps the 110 floor). `/backseat`, `/backseat settings`, `/backseat explain` restore too (`bringBack`); switch-off ends it.
  - The strip is `shown.band`, held against the screen while `shown.minimized`. Re-asked with `$.ui.invalidate('ui.render')`.
- Verified: live: minimize, keyboard restore, the ring, Tab inert, `w` returning the keyboard, a click taking it. Not seen: a mouse click on the strip, `/clear` or reload while minimized (tests cover `/clear`).

## Pane

- `pane.tsx` draws from plain data (`PaneView`); the `ui.render` hook reads every atom in one `Promise.all`.
- Tab badges (`tabBadge`): Play-by-play `(3)` open notes; Deep review `(new)` until opened, `(N)` open critical and high issues, `(!)` unfinished review; a spinner while a review, an Explain lookup or a progress look runs.
  - `SPINNER`: Claude Code's marks `· ✢ ✳ ✶ ✻ ✽`, bare after the name (`2: Deep review ✻`), one per tick of `spin`. `keepSpinning` ticks every `SPIN_MS` (150 ms) only during work, every `SPIN_SLOW_MS` (2 s) after `SPIN_FOR_MS` (1 min) (fast ticks timed out the kit's watchdog test). Kit views draw `·`. Never an ellipsis or parentheses.
- `tabRow` keeps badges while it fits: full names (84 columns), short names gap 2 then 1, only the review's badge (gap 2, 1), `tiny` names (`Expl`, `Set`), then that badge as `*`. `tabRows`: else two rows of three, three of two, one a row, the first whose every row fits, each with `tabRow`'s cascade and its own underline (`TabRowView`: `from`, `labels`, `gap`; a plain rule without the open tab). Asks `PANE_COLUMNS` (64); Claude Code decides (seen 23 to 73).
- Narrow: "Working on" puts its value on its own row when label and control leave under `WORKING_MIN_COLUMNS` (8), the control too when it does not fit by the label (`workingLayout`: `one`, `two`, `three`). The one-line character keeps its width.
- Press grammar (comment above `rule` in `pane.tsx`): keyed control = plain Button `k: label`; keyless = Button with chrome `[ label ]`; list row = plain Button starting `▸`, or `❯` for the one the keys act on (Explain's focus bold, accent mark). Single-width marks only (emojis misalign Ink).
- Every tab: tabs, status, "Working on", controls (`tabControls`, one wrapping row, gap 3), `keysRow`, a rule (`rule`, compact too), contents (not controls at the bottom: rejected 2026-10-06, a short frame cut the keys row). Review history and `Jump to` stand above the review; `p: older`/`n: newer` stand with `r: review now`.
- Explain outline is a table: `outlineRow` (name column `nameColumns`, cut at `NAME_COLUMNS` (24) by `outlineName`; summary dim, cut at the edge), then a rule. `outlineLine` stays for tests. Near the top so a press does not move the page.
- `tabUnderline`: dim rule, heavy accent (`claude`) segment under the open tab (`underlineSpans`: label + 3 for the digit, plus gap). Compact too. Tab buttons stay first in the tree (jack's first six pieces).
- Status light (`stateMark`): green `●` watching (`idle`), yellow `◐` looking/settling, yellow `◌` waiting, red `○` no repository, dim `◌` starting, dim `○` paused, dim `●` `following` (`Kernel.Status`'s `watchState` keeps `Following` apart from `idle`).
- A follower draws no `l: look now`/`r: review now`; one dim line says where looks and reviews run and when that session started, with its day if not today (`followingLine`, `Watch.driver` via `dayTime`, set by `showDriver` each beat, cleared in `startDriving`).
- "Working on:" is a label, the value beside it (`NOT_CLEAR` its own Text, tests find it), control at the end: `w: say what`, then `w: change`.
- `keysRow`: yellow `Keys off` + `KEYBOARD_HINT` ("Click here or press Ctrl+X Tab to use the keys.") without the keyboard (`e.props.isFocused`); green `Keys on` (non-shrinking Box) + `FOCUSED_HINT` ("1–6 tabs · j k move · Enter presses · ↑↓ PgUp PgDn scroll · Esc back to the prompt."); one line from 104 columns. Where it does not fit (`keysRowFits`) the hint wraps on its own line, never cut. Arrows scroll on 2.1.293 ("Mod API").
- Deep review tab, the review:
  - A finished review stays as `Review.last` while a newer runs, waits or fails (`withReviewChange` for every write; `readableReview` for tab and conversation). Above it: "Reviewing commit a1b2c3d: Title since 12:01." or why it failed, and `Review.waiting` (from `changeQueue`).
  - History: `Review.older` (`historyTexts`: `reviews.json` newest first, then the first look around from `project.json`; set at `keepReview`, restore, a follower's beat); `reviewHistory`; `Review.opened` (0 latest, reset when one lands); `shownReview`. With more than one: `▸ Review 2 of 5 · 19:57` (`reviewsHeading`) with `p`/`n`, opening downward (`openList` `reviews`, `onReviewsFold`): rows newest first (`reviewRow`: time via `dayTime` from `clock.ts` and `PaneView.now`, "yesterday 19:57", then subject); shown one `❯` bold, others `review-open-<n>` (`onReviewOpen`).
  - Jumps: every `path:line` in a review's decisions, text, insights (`spotsIn`, `reviewSpots`; `MAX_JUMPS` (4)). One is a row (`▸ Jump to stats.py:2`); more fold under `▸ Jump to a place (3)` (`jumpHeading`, `jumpList`; not a row of buttons: rejected 2026-10-05). Folds on a jump and a change of tab (`openList` `jump:<subject>`). `onJump` opens Explain there, as `/backseat explain path:line`.
- Deep review tab, the ledger (owned by `deep-review.md`), above the review:
  - `coverageLine` ("Audited 11:42 at 570e787: read 14 of 22 own source files; skipped …; left out as someone else's code: …"; "skipped" excludes `VENDORED_WHY`'s, so figures add up), else `NOT_AUDITED`/`AUDIT_UNFINISHED`/"Auditing this project since …"; then `Open: 1 critical, 2 high`.
  - A row per open issue, worst first (`issue-<id>`, short label: `❯` if current, severity, where its line stands or ", changed since"; title bold, text, category/origin/condition dim). `issues-low` and `issues-closed` (with `restore`) folded. `o` only for an issue with a file.
  - Keys: `a` audit (driver only), `e` asks about the issue, never for the fix (`issueQuestion`), `d`, `j`/`k`, `o`, `v` the overview, `r`, `p`, `n`.
  - "Raised while you worked" (`RAISED_HEADING`): open bug and risk notes, each a press to its tab (`onRaisedNote`); `t` tracks the current issue.
  - `placedNow` places issues when shown (one read per file); placement never changes a status. State `issues` (`{ ledger, placed, isAudited }`) and `selectedIssue`, carried across `/clear`.
- Play-by-play tab: empty, `ledgerLine` says what the ledger holds or that nothing was audited. Under notes, "From the deep review" (`FROM_REVIEW_HEADING`, only over an issue): tracked issues, then critical/high in files saved this sitting (`views.play`, max `PLAY_PICKS` (3); `IssuesState.savedFiles` via `savedPathsOf`, `noteSavedFiles`), then "N more on the Deep review tab.". Keys act on `currentPlayItem` (`playOn`: picked issue while shown, else current note, else first issue); `j`/`k` notes then issues (`onRowStep`); `t` pins (`onIssuePin`); `m` notes only.
- Health row (`Watch.health`, `healthLine` in `status.ts`), absent when well: Claude not answering until when, refused account, plan limit, a scan over 1.5 s, a `fail()` twice in 5 min ("Keeps failing: … /backseat debug dump saves the details."). Omits what the status line says.
- `restorePaneFromDisk` (`engage`, driver only) after a restart or off/on: open notes whose file reads as the look saw it (`notes.json`, `stillOpen`), dismissed notes, the last review. Never a note about changed text. The driver writes `notes.json` after every look, dismissal, hush. Followers: `sessions.md`.
- Editors' light (`editorLight`): green `●` + `Watch.editors` ("Neovim is connected.", `editorsLine` from `readFocus`) while a connected editor has this project open; red + "No editor is connected."; none until first read (`forgetEditors` at switch-on). Driver reads each scan; a follower each lease beat (`pollFocus`), and in the fast lane only while its Explain tab is open (`isWatched`, `followEditor`). `showPlay` keeps the field. Hidden while paused.
- New `$.state` fields are optional (`Watch.health`, `Watch.editors`, `Watch.driver`, `Review.since`, `Review.waiting`, `Review.last`): state may hold an older version's shape.
- Verified: live: badges, review in progress over the last one, `/clear` keeping notes and review, on-request and offline rows. Tests only: slow-git and keeps-failing rows, `(!)`, the two-line keys row.

### Settings tab

- Tab 6 (`settings`): the plugin's `/config` rows via `$.config.list()` (`showSettings`: pane open, tab open, after `/clear`) whose `provider.plugin` before `@` is `$.plugin.name` (`settingRows`; the provider is the id, `backseat-driver@inline`). A mod cannot add to `/config`; this tab is the way in.
- Rows open downward (not a `Select`: rejected 2026-10-05, a click could not collapse it or pick). `▸ Voice persona: knuth` (`settingHeading`, Button `setting-<key>`); options under it, current `❯` bold, others `option-<key>-<value>`; a press picks (`onSetting`) and folds.
- A pick is `$.config.set` (`changeSetting`), as `/config`, which reloads the mod; shown at once, reverted with a toast if refused. Locked rows and rows without options (typed values, the editor command) are text: `label: value · set it in /config` (`SET_IN_CONFIG`). Every manifest field appears (jack `check_settings_tab`).

### Settings, and when a change counts

- Any change (`/config`, the tab, `settings.json`) reloads the mod with the new options ("options changed — reloaded …", not quietable): module variables reset, `$.state` stays, `session.start` re-engages a tutor that was on (`engage`, `isFresh` false), every setting read afresh.
- `SETTING_EFFECTS` (`settings.ts`): per `userConfig` field, `now` or `next look | next review | next lookup` (a request under way finishes as begun). A missing field is reported each load (`unclassified`) and fails `settings.test.ts`. A field removed from `plugin.json` goes into `RETIRED_SETTINGS` (`layout`, `burn_tokens`): its value lingers in settings; `changedFields` skips it.
- `applied` (`$.state`): options last loaded (`noteSettings` in `session.start`; rewritten after `/clear`). A reload with other options while on says one transcript line naming each change and when it counts ("Voice persona: knuth, in effect now."). Off, or a code reload: silent.
- `catchUp`: a reload that switches on starts fresh-switch-on work: release check (`update_check`), first placement (`progress_report`), the look around. Questions and the license question stay at switch-on.
- No reload: `changeSetting` arms `RELOAD_WAIT_MS` (5 s) after an unrefused set; a reload cancels module timers, so it fires only without one: `notReloadedText` ("… /reload-plugins applies it."). Reloads come in 100–300 ms.
- Any reload costs: an unlooked-at save becomes the baseline; Explain's queue and a look in flight are dropped; the timed review restarts its interval. A running review is adopted (`adoptReview`). `changeSetting` writes the debug log before `$.config.set`.
- Verified: live (2.1.289), every setting in effect at the reload. Tests only: `notReloadedText`.

## Animated persona

- `avatar.ts` holds characters and rules; `register.tsx` moves them. Top of the Play-by-play tab only (off Deep review since 2026-10-05: it repeated the takeaway). One setting turns it off; no model calls of its own.
- Tiers:
  - Pixels on the terminal: a `Raster` of truecolor half blocks (`▀` top pixel color, bottom background; `▄` or space where see-through). Humans 20×22 px (20 cols × 11 rows), Tux 20×20, mascot 16×10. Each human has its own head shape and expression (props alone were not recognizable). One replaceable file per voice in `plugin/core/art/`: a letter palette and pixel rows, other poses giving only differing rows. `rasterCells` (`sprite.ts`) computes each pose once.
  - ASCII (`frames`): where the kit has no `Raster`; a floor for a future layout (non-terminal surfaces are compact today).
  - One line (`mini`): above the prompt, off the terminal.
  - Not `Image`: same as half blocks on kitty/Ghostty, dim `alt` text elsewhere (tmux), and undetectable beforehand.
  - 256-color terminals: downsampling trusted to the renderer (not seen).
- Dim at rest: Raster has no `dimColor`; `dimmed` greys colors toward the background, which `themeBackdrop` reads from the `theme` row of `$.config.list()` each render while shown (`light` in the name is light, else dark, `auto` included).
- `characterArt(kit, avatar, pose, isResting, backdrop)` (`character.tsx`) is a layout's one call; `artShape` gives size and the tail's row.
- Art conventions (`npm run persona` renders PNGs): likeness first, then readability on dark and light. Rest eyes forward, blink a dark line, talk opens the same mouth keeping its corners, think raises brows and eyes, dark characters get a slate rim facing the light.
- Lines:
  - The play-by-play reply's `say`. `prompts/speech-bubble.md` joins the reviewer's system prompt only while the setting is on. The request's last line asks `insight`, or `remark` after `QUIET_LOOKS_BEFORE_REMARK` (4) silent looks.
  - Each look's `say` replaces the line: quiet look, silence; never about outdated code.
  - A finished deep review gives its last line (`deep-review.md`), or its last sentence (`closingLine`); the first look around gives `SURVEY_LINE` ("I've had a look around. The Deep review tab has the map.").
  - Switch-on: `hello`. At a reload `lineAtReload` (`avatar.ts`; `startAnimating`, `isHello`) swaps in the new voice's hello and replaces a line cut mid-sentence ("…"). `/clear` keeps the line ("Mode").
- Motion:
  - `say` writes `speech` at tick 0 and starts `$.clock.every(TALK_MS)`; each tick reveals a word via `update` with `nextTick` (compare-and-set: a stale tick cannot overwrite a newer line); mouth on alternate ticks; stops when done. About 7 redraws/s talking, none at rest.
  - Blink every `BLINK_MS` (`$.clock.after` to reopen), only while `on` and silent.
  - Switch-off cancels both timers and resets speech. A reload loses timers; `startAnimating` marks a half-said line said.
- `poseOf` at render, from mode, watcher, speech: asleep (paused), talking, eyes up (look running), blinking, rest (dim).
- The bubble is sized to the whole line from the first word (no reflow), as narrow as it can be; `mini` frames above the prompt or off-terminal.
- Art rules (`avatar.test.ts`): poses one height, lines one width; printable ASCII plus the mascot's block elements only; pixel art with even rows, equal widths, every letter in its palette (unknown = hole), every pose unlike rest, `mouth` row inside; `bubbleColumn` pads so the tail meets the `mouth` row (pixel art: `art.mouth`); ASCII characters use the ASCII bubble (`bubbleStyle`), the mascot box lines.
- Tests find `{ type: 'Raster', key: 'persona' }` and compare `cells` with `rasterCells` for the pose. Kit sessions are dark (no theme).
- Verified: live: every ASCII character (hello, mouth, blink, sleep, tail), one-line mode, pixel art of `default`, `torvalds`, `knuth`. Colors and likeness on a real terminal: the owner's to judge.
