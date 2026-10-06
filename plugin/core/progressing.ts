/**
 * The look at the person's progress: whose commits count, which of them is
 * read for what, and how a reading is added to the record of a language. This
 * is the engine; the program it runs in gives it `ProgressPorts`, and what it
 * remembers is `ProgressState`.
 *
 * Moved out of `hooks/register.tsx` with each call made in the order it was
 * made there. The rules for a level are `progress.ts`'s.
 */

import type { LevelChange, ProgressRecord, ProgressView } from '../types'
import { addedLines, byLanguage, commitInfoArgs, commitPatchArgs, identityOf, judge, MIN_LINES, parseCommitInfo, parseRecent, RECENT_COMMITS_ARGS, sizeOf } from './authorship'
import type { Host } from './host'
import { languageName } from './languages'
import { progressPath, watchedPath } from './datahome'
import { ANSWER_LABELS, GENERAL } from './profiles'
import type { Profiles } from '../types'
import { assessmentRequest, emptyRecord, parseAssessment, parseRecord, withAssessment } from './progress'
import type { AssessedCommit, CommitForAssessment } from './progress'
import { shortHash } from './review'
import type { Settings } from './settings'
import { updateJson } from './store'

/** What the look at progress remembers: whose commits count, the watched files, the records in play, and the one-at-a-time queue. */
export type ProgressState = {
  /** The emails whose commits count as the person's. */
  identity: string[]
  /** The files the watcher saw change since the last commit: work it watched arrive counts in full. */
  watchedPaths: Set<string>
  /** The records of the languages in play. */
  records: Map<string, ProgressRecord>
  /** Runs one piece of progress work after the ones before it. */
  queue: Promise<void>
}

export function freshProgressState(): ProgressState {
  return { identity: [], watchedPaths: new Set<string>(), records: new Map<string, ProgressRecord>(), queue: Promise.resolve() }
}

/** What the look at progress needs from its host. Each is read or done when it is needed. */
export type ProgressPorts = Pick<
  Host,
  'now' | 'ask' | 'store' | 'repoRoot' | 'dataRoot' | 'isOn' | 'isDriver' | 'engagement' | 'readPressure' | 'toast' | 'fail'
> & {
  settings: Settings
  /** Runs git in the repository, or wherever the host is when there is none. -1 is git not answering. */
  git: (args: readonly string[]) => Promise<{ exitCode: number; stdout: string }>
  /** The project's name, without its hash. */
  projectName: () => string
  profiles: () => Profiles
  /** The instructions for the assessing model. */
  instructions: () => string
  /** Whether Claude is answering. */
  mayAsk: () => boolean
  /** Changes what the Progress tab says, and records the change. */
  setProgress: (change: Partial<ProgressView>) => Promise<void>
  registerReviewer: () => Promise<void>
}

/** Runs one piece of progress work after the ones before it, so that two never write one record at once. */
export function queueProgress(state: ProgressState, fail: ProgressPorts['fail'], work: () => Promise<void>): void {
  state.queue = state.queue.then(work).catch(error => {
    fail('progress failed', error)
  })
}

/** The Progress tab shows the records of the languages in play, main ones first. */
export async function showProgress(ports: ProgressPorts, state: ProgressState): Promise<void> {
  const shown = ports.profiles().languages.map(language => state.records.get(language) ?? emptyRecord(language))
  await ports.setProgress({ isOn: ports.settings.isProgressOn, identity: state.identity, records: shown })
}

export async function loadRecord(ports: Pick<ProgressPorts, 'store' | 'dataRoot'>, language: string): Promise<ProgressRecord> {
  if (ports.dataRoot() === '') return emptyRecord(language)

  return parseRecord(await ports.store().read(progressPath(ports.dataRoot(), language)), language)
}

/**
 * Whose commits count: the repository's `user.email`, and the global one when
 * it differs. Read again before every use, not once at switch-on: the person
 * may set it after the tutor is on (seen 2026-10-05: set between `/bsd` and
 * the first commit, which then counted for nothing). Resolves whether it changed.
 */
export async function readIdentity(ports: Pick<ProgressPorts, 'git'>, state: ProgressState): Promise<boolean> {
  // `git config` answers the repository's own setting, else the global one in ~/.gitconfig.
  const effective = (await ports.git(['config', '--get', 'user.email'])).stdout
  const global = (await ports.git(['config', '--global', '--get', 'user.email'])).stdout
  const identity = identityOf(effective, global)
  const isChanged = identity.join(' ') !== state.identity.join(' ')
  state.identity = identity

  return isChanged
}

/** The files the watcher saw change since the last commit, as kept in the project folder. */
type Watched = { v: 1; paths: string[] }

function parseWatched(stored: unknown): Watched {
  const paths = typeof stored === 'object' && stored !== null && Array.isArray((stored as { paths?: unknown }).paths) ? (stored as { paths: unknown[] }).paths : []

  return { v: 1, paths: paths.filter((path): path is string => typeof path === 'string') }
}

type WatchedPorts = Pick<ProgressPorts, 'store' | 'dataRoot' | 'repoRoot'>

/**
 * The watched files are kept in the project folder (`watched.json`), not only
 * in memory: a reload or a restart between the saves and the commit emptied
 * them, and the commit then weighed half, as work the tutor never saw arrive
 * (the owner's first evening, 2026-10-05: both commits at 0.5).
 */
export async function loadWatched(ports: WatchedPorts, state: ProgressState): Promise<void> {
  if (ports.dataRoot() === '' || ports.repoRoot() === '') return
  for (const path of parseWatched(await ports.store().read(watchedPath(ports.dataRoot(), ports.repoRoot()))).paths) state.watchedPaths.add(path)
}

async function saveWatched(ports: WatchedPorts, state: ProgressState): Promise<void> {
  if (ports.dataRoot() === '' || ports.repoRoot() === '') return
  const paths = [...state.watchedPaths].sort()
  await updateJson(ports.store(), watchedPath(ports.dataRoot(), ports.repoRoot()), parseWatched, () => ({ v: 1, paths }))
}

/** The watcher saw these files change: what is in them counts in full when it is committed. */
export async function noteWatched(ports: WatchedPorts, state: ProgressState, paths: readonly string[]): Promise<void> {
  const before = state.watchedPaths.size
  for (const path of paths) state.watchedPaths.add(path)
  if (state.watchedPaths.size !== before) await saveWatched(ports, state)
}

/** A commit's files were weighed: they start over. */
export async function forgetWatched(ports: WatchedPorts, state: ProgressState, paths: readonly string[]): Promise<void> {
  let isChanged = false
  for (const path of paths) isChanged = state.watchedPaths.delete(path) || isChanged
  if (isChanged) await saveWatched(ports, state)
}

/** Whose commits count, the watched files, and the records of the languages in play. */
export async function setUpProgress(ports: ProgressPorts, state: ProgressState): Promise<void> {
  await readIdentity(ports, state)
  await loadWatched(ports, state)
  state.records.clear()
  for (const language of ports.profiles().languages) state.records.set(language, await loadRecord(ports, language))
  await showProgress(ports, state)
}

/** What they said about themselves in one language, in a line. It is never evidence. */
function saidAbout(profiles: Profiles, language: string): string {
  const answers = { ...profiles.subjects[GENERAL]?.answers, ...profiles.subjects[language]?.answers }

  return Object.entries(answers)
    .map(([id, answer]) => `${ANSWER_LABELS[id] ?? id}: ${answer}`)
    .join('; ')
}

/**
 * One assessment: the person's own lines from these commits go to the deep
 * review model, and what it saw is added to the record under the rules in
 * `progress.ts`. Commits already assessed add nothing.
 */
export async function assess(
  ports: ProgressPorts,
  state: ProgressState,
  language: string,
  commits: readonly (AssessedCommit & CommitForAssessment)[],
  review: string,
): Promise<boolean> {
  const settings = ports.settings
  const before = await loadRecord(ports, language)
  const fresh = commits.filter(commit => !before.assessed.includes(commit.hash))
  if (fresh.length === 0) return true
  const name = ports.projectName()
  const subject = fresh.length === 1 ? `commit ${fresh[0]?.short ?? ''}` : `${fresh.length} of your recent commits`
  await ports.setProgress({ busy: `Looking at ${subject} for your ${languageName(language)} progress.` })
  try {
    const result = await ports.ask('progress', {
      model: settings.deepReview.model,
      effort: settings.deepReview.thinking,
      system: ports.instructions(),
      prompt: assessmentRequest({ language, project: name, record: before, said: saidAbout(ports.profiles(), language), commits: fresh, review }),
      maxTokens: 3000,
      timeoutMs: 240_000,
    })
    if (!result.isAnswered) {
      // No answer: it is worth another try, later.
      await ports.setProgress({ skipped: `The look at ${subject} got no answer. It is tried again.` })

      return false
    }
    const assessment = parseAssessment(result.text)
    if (assessment === null) {
      await ports.setProgress({ skipped: `The look at ${subject} did not finish. Nothing was recorded.` })

      return true
    }
    // Added to the record as it stands on disk, in one step: another session may be adding to it too.
    // The file as it was is kept beside it, because the evidence cannot be gathered again.
    const at = await ports.now()
    const made: { change: LevelChange | null } = { change: null }
    const record = await updateJson(
      ports.store(),
      progressPath(ports.dataRoot(), language),
      stored => parseRecord(stored, language),
      latest => {
        const added = withAssessment(latest, assessment, fresh, name, at)
        made.change = added.change

        return added.record
      },
      { keepBackup: true },
    )
    const change = made.change
    state.records.set(language, record)
    await ports.setProgress({ skipped: '' })
    await showProgress(ports, state)
    await ports.registerReviewer()
    if (change !== null) ports.toast(`${languageName(language)}: ${change.to}${record.isProvisional ? ' (provisional)' : ''}. See the Growth tab.`)

    return true
  } finally {
    await ports.setProgress({ busy: '' })
  }
}

/**
 * A commit of the person's, once it has been reviewed or made: the lines it
 * added, by language, if it is theirs. Resolves false when a request got no
 * answer, which is worth trying again, and true when there is nothing more
 * to do for this commit.
 */
export async function assessCommit(ports: ProgressPorts, state: ProgressState, hash: string, review: string): Promise<boolean> {
  if (!ports.settings.isProgressOn || ports.repoRoot() === '' || ports.dataRoot() === '' || !ports.isOn()) return true
  if (await readIdentity(ports, state)) await showProgress(ports, state)
  const asked = await ports.git(commitInfoArgs(hash))
  // Git did not answer: worth another try. A commit git says it does not have is let go.
  if (asked.exitCode === -1) return false
  const info = parseCommitInfo(asked.stdout)
  if (info === null) return true
  const files = addedLines((await ports.git(commitPatchArgs(hash))).stdout)
  const verdict = judge(info, state.identity, files)
  const short = shortHash(info.hash)
  if (!verdict.isYours) {
    await ports.setProgress({ skipped: `Commit ${short} does not count toward your progress: ${verdict.reason}.` })

    return true
  }
  // Work the tutor watched arrive in saves counts in full. Work it did not see counts half.
  const watched = verdict.files.filter(file => state.watchedPaths.has(file.path)).length
  const weight = watched * 2 >= verdict.files.length ? 1 : 0.5
  const title = info.message.split('\n')[0] ?? ''
  const languages = [...byLanguage(verdict.files)].filter(([, group]) => sizeOf(group) >= MIN_LINES).slice(0, 2)
  if (languages.length === 0) {
    await forgetWatched(ports, state, verdict.files.map(file => file.path))
    await ports.setProgress({ skipped: `Commit ${short} is too small to say anything about your progress.` })

    return true
  }
  let isSettled = true
  for (const [language, group] of languages) {
    if (!(await assess(ports, state, language, [{ hash: info.hash, short, weight, title, files: group }], review))) isSettled = false
  }
  // Kept until the commit is settled, so that another try weighs it the same.
  if (isSettled) await forgetWatched(ports, state, verdict.files.map(file => file.path))

  return isSettled
}

/** How many of the person's recent commits a first placement looks through, and how many it uses. */
const PLACEMENT_SCAN = 30
const PLACEMENT_COMMITS = 5

/**
 * A language with no level yet gets a first placement from up to five of the
 * person's recent commits in this project, read in one request. They count
 * half, because the tutor did not watch that work arrive.
 */
export async function placeFirst(ports: ProgressPorts, state: ProgressState, run: number): Promise<void> {
  if (!ports.settings.isProgressOn || ports.repoRoot() === '' || ports.dataRoot() === '' || !ports.isDriver()) return
  if (await readIdentity(ports, state)) await showProgress(ports, state)
  if (state.identity.length === 0) return
  const held = await ports.readPressure()
  if (held.level !== 'none' || !ports.mayAsk()) return
  const mine = parseRecent((await ports.git([...RECENT_COMMITS_ARGS])).stdout)
    .filter(commit => state.identity.includes(commit.email))
    .slice(0, PLACEMENT_SCAN)
  if (mine.length === 0) return

  for (const language of ports.profiles().languages.slice(0, 2)) {
    const record = await loadRecord(ports, language)
    if (record.level !== null || run !== ports.engagement()) continue
    const picked: (AssessedCommit & CommitForAssessment)[] = []
    for (const commit of mine) {
      if (picked.length >= PLACEMENT_COMMITS || run !== ports.engagement()) break
      if (record.assessed.includes(commit.hash)) continue
      const info = parseCommitInfo((await ports.git(commitInfoArgs(commit.hash))).stdout)
      if (info === null) continue
      const verdict = judge(info, state.identity, addedLines((await ports.git(commitPatchArgs(commit.hash))).stdout))
      const group = verdict.isYours ? byLanguage(verdict.files).get(language) : undefined
      if (group === undefined || sizeOf(group) < MIN_LINES) continue
      picked.push({ hash: info.hash, short: shortHash(info.hash), weight: 0.5, title: info.message.split('\n')[0] ?? '', files: group })
    }
    // Read newest first from git log; assessed oldest first, so that the record runs in time order.
    if (picked.length > 0 && run === ports.engagement()) await assess(ports, state, language, picked.reverse(), '')
  }
}
