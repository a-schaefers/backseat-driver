---
paths:
  - "plugin/core/progress.ts"
  - "plugin/core/progressing.ts"
  - "plugin/core/authorship.ts"
  - "plugin/core/growth.ts"
  - "plugin/core/lessons.ts"
  - "plugin/core/learning.ts"
  - "plugin/prompts/progress.md"
  - "plugin/lessons/**"
  - "kernel/src/Kernel/Growth.purs"
  - "plugin/tests/progress.test.ts"
  - "plugin/tests/progressing.test.ts"
  - "plugin/tests/growth.test.ts"
  - "plugin/tests/lessons.test.ts"
  - "plugin/tests/learning.test.ts"
---

# Progress, growth and lessons

## Progress

- The model observes, code decides. One `$.model.complete` on the deep review model (`prompts/progress.md`) returns observations (skill slug, `shown | missed`, the skill's level, a note), a proposed level, the report text.
- `decideLevel` (`progress.ts`):
  - No level before `PLACE_OBSERVATIONS` (8) from `PLACE_COMMITS` (3) commits and `PLACE_LINES` (80) own added non-blank lines (`record.linesRead`, from each assessed commit's `lines`, `sizeOf`). A record without `isLinesNonBlank` or `linesRead` is recounted once as read (`withLinesCounted`: one `git show -s` finds the commits in this repository, then `git show --unified=0` each; null elsewhere).
  - First placement capped at the highest level with 2 weight (`supportedLevel`). Beginner needs `DOWN_WEIGHT` (2) of misses at junior or below; else no level (`null`), never a default beginner.
  - A provisional level whose record misses the bar is withdrawn (`isPlaceable`): at the next assessment, and as read (`withdrawn` via `mendedRecord` in `setUpProgress`, written back once under the lock). `history` records levels reached, never one taken away (`LevelChange.to`). Withdrawal drops the model's report and marks `withdrawnAt`; an unmarked old withdrawal loses a report written under the last level reached.
  - Under no level the report keeps what is theirs and loses the model's words for the level it proposed, praise included (`unplaced`, on write and in `mendedRecord`; owner: "don't flatter them"). "Why" and "next level" only under a level (`recordText`, the tab).
  - One step at a time. Up: 4 weight of next-level evidence from 2 commits, and the model agrees. Down: 2 weight of misses at or below from 2 commits, and the model proposes lower or misses outweigh shown. Provisional until 12 observations from 4 commits. Every change goes in `history` with reason and count.
- Slipping is per commit: shown earlier, only missed in the latest commit touching it; both in one commit is mixed. A first placement keeps commits in time order.
- Whose work (`judge`, `authorship.ts`):
  - Author email `identity` (`git config --get user.email`, plus `--global` when different), re-read (`readIdentity`) before every assessment and first placement, not only at switch-on. A change updates the tab's line.
  - Not a merge; no `Co-authored-by` trailer or tool line. At most 600 added lines and 25 files. At least `MIN_LINES` (3) non-blank added lines in one language.
  - Only added lines are read (`git show --unified=0`); never lock files or generated folders. The tab says why the last commit didn't count.
  - A patch cut at the host's 4 MiB (`GitResult.isCut`) is a floor: said as one when already past the limits ("more than 5400 lines in 16 files"), else "larger than the tutor reads at once", never counted (`judge`'s `isCut`). An older reason that took a cut patch as whole is restated once at switch-on (`restateCutReason`).
- Weight 1 if the watcher saw at least half the commit's files change first (`watchedPaths`, `noteWatched` from `scan`), else 0.5; first-placement commits 0.5.
  - Emptied when an assessment settles, and for a commit judged not theirs or too small; at switch-on the driver releases the files of the commit the reason on record names (`releaseSkipped`).
  - Kept in `watched.json` (`loadWatched` in `setUpProgress`), with `skipped` (`noteSkipped`): weight and the skip reason survive reloads and sessions.
  - No reason on record and the latest reviewed commit assessed nowhere and not waiting: the driver judges it again at switch-on without a model (`explainUnassessed`) and says why. With no review at all, HEAD likewise (`headOf`; "has not been looked at for your progress yet" when it counts).
- When:
  - `assessCommit` from the review queue (`startAssessment`, see `deep-review.md`): after the review (with its text), after it was given up (without), or at once when after-commit reviews are off. Held back like a review, never dropped. No answer by Claude's fault is no try; else one of three, 60 s doubling. `assess`/`assessCommit` resolve false for "worth another try". A hand review of a commit not waiting is assessed from `turn.complete`.
  - `placeFirst`: fresh switch-on, first 2 languages in play without a level, up to 5 own commits of the last 30, one request. Counting none of theirs, it records why the newest didn't count (`noteSkipped`).
  - `ProgressState.queue` (a promise chain): one at a time, re-read before write. Full hashes in `assessed`: no commit counts twice anywhere. Observations keyed by full hash (kit short hashes are all `0000000`).
- `aboutPerson()` adds `progressText` to every prompt. `progress` tool answers "how am I doing?". Reviewer re-registered after each assessment.
- Tab id still `profile` (`tab-profile`, hotkey 4), labelled Growth; tests press that id.
- Setting `progress_report` turns it off. Stored in `progress/<language>.json`.
- Verified: live (another author's commits ignored; watched second commit placed junior, provisional; `Co-Authored-By: Claude` ruled out; `progress` tool). Tests only: the retries.

## Growth

- `Kernel.Growth` decides; `growth.ts` gathers facts (`growthFacts`) and words items. The pane computes it while the tab is open (`shownGrowth`, from progress, profiles, lessons atoms); `aboutPerson()` and the `progress` tool from module records. No state of its own. Weights are a first guess.
- Evidence per language: own commits (observations as recorded, weight 1 or 0.5); lessons of that language (`checkedStep` 0.5 by the tutor, `selfStep` 0.25 by their word, at the path's level, at most `lessonCap` (2) toward a level; `general` paths and unfinished steps count nothing); profile topics (`recurringTimes` (3)+ flags and none in `habitLooks` (12) looks = habit improved; raised within = still coming back; asking for an explanation is help, costs nothing).
- Level: none before `placeObservations` (8) from `placeCommits` (3) with `placeLines` (80) (`Facts.linesRead`). Then the highest level whose evidence (shown at or above, lessons capped, less missed at or below) reaches `reach` (4) with `ownAtLeast` (2) from own commits; else beginner with `beginnerNeeds` (2) missed at junior or below; else none (`toRaise`: `evidence`; before the bar `place`, `lines`). Lessons can never carry a level.
- Score: level × 100 + `toNext` (0–99): up to 80 from next-level evidence over `reach` (senior: own over twice that), +5 per habit improved, −5 per topic coming back (each capped at 20). Never out of its level.
- Headline ladder (`growthLadder`, `rungWord`, `LEVEL_NICKNAMES`, `growthMeterLabel`; `growthBar` in `pane.tsx`): four rungs of `(columns - 3) / 4 - 2` cells within `RUNG_MIN` 6..`RUNG_MAX` 14; nicknames over (Padawan, Apprentice, Journeyman, Gandalf), level words under, current bold. Passed rungs full green; current fills `toNext`/100 (≥1 cell once any way made, never full; red < 25, orange `#ff8700` < 50, yellow < 75, green); ahead empty. Under it `12% to mid · growth 112`, `· provisional` while so. Before a level, the headline alone.
- The record's level (`decideLevel`) is what the assessment and the level-change toast use, shown as "From your commits alone"; the headline is the growth level. They can differ by design.
- Counts by verdict, weights beside when different ("10 shown, 5 missed (weighing 6.5 and 3.5)", `growthCounts`, `verdictCounts`); past the bar said as is ("15 observations (8 needed)", `levelPhrase`).
- Lists (`Item`: kind, what, two counts):
  - work on: slipping skills, topics coming back, skills missed and never shown, lessons under way.
  - needed help: explanations asked, topics coming back (times asked as second count: one entry per topic), lesson steps walked through.
  - improved: habits, skills missed then shown, lessons finished.
  - to raise: `place` while observations or commits are short, `lines` while lines are; next-level skills missed; own work at the next level; up to two lessons (matching work-on first, then the next level's).
  - encouragement: first habit, else skill, else lesson improved; the model's line only when none.
- Open owner decision: whether these lists become rows `j`/`k` walk.
- Property test (`growth.test.ts`, 300 histories): a lesson never lowers the score; the score stays in its level.
- Verified: tests only.

## Lessons

- A path is `plugin/lessons/<id>.md`; merged there = approved, nothing lists them. Front matter (`title`, `language` id or `general`, `level`, `skills` comma list, `summary`), an intro, one `## ` per step (≤ 20, ≤ 6,000 characters each). Shipped steps end "Try it:" and "Done when:", the tutor's checklist. An unparseable file shows as "Not a lesson: …" with why.
- Read at switch-on (`loadLessons` in `engage`, after progress) and after a forget: one `$.fs.list`, a read per file, one store read per path. Nothing at session start.
- Records `lessons/<language>/<id>.json` (`{ v, id, language, steps: { "<n>": { startedAt, doneAt, by: tutor|self|'', helped } } }`) via `updateJson`. A step the tutor confirmed never goes back to `self`. Forgetting a language deletes `lessons/<language>/`.
- Tab: paths by language (in play, then `general`, then the rest; by level, then title); Enter opens; `s` starts or continues the next step, `c` done by their word, `b` back. `s` sends `stepRequest` via `$.prompt.submit` (step, intro on step 1, "I write it"), which skips the mod's own `prompt.submit` hook, so it carries everything.
- `lesson` tool: no path lists them; a path reads it with progress; `outcome: done|help` records a step (named, else next). The contract's "Lessons they start" and `SESSION_NOTES` say when. A change to `aboutPerson()` re-registers the reviewer (`lessonChanged`).
- Verified: tests only.
