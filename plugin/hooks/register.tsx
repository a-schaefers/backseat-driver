/**
 * The hooks module: every effect the plugin has.
 *
 * Claude Code reads this file to list what the mod hooks and calls, and it
 * refuses a module that passes `$` into a function from another file. So
 * every call on `$` is written here, and the files beside this one hold only
 * pure logic: they take plain values and return plain values. Where that
 * logic needs an effect, it is handed a closure written here.
 */
import { atom, read, update } from 'claude-code'
import type { EngineInterface, ModelCompleteResult, Register, Timer } from 'claude-code'

import type { Hush, Mode, Note, Profile, Profiles, Review, Tab, Watch } from '../types'
import { reframeInstructions, SESSION_NOTES, stripFrontmatter, tutorSections } from './contract'
import { backoffMs, shouldLook } from './gate'
import { parseStatus } from './git'
import { DENIAL, isUsersFile } from './guard'
import { languageOf, mainLanguages } from './languages'
import { parseRequest, transition } from './mode'
import { isNoiseFile } from './noise'
import { applyReply, parseReply } from './notes'
import { renderPane, reviewSchedule } from './pane'
import {
  emptyProfile,
  GENERAL,
  isHushed,
  parseProfile,
  personText,
  subjectKey,
  withAnswers,
  withExplained,
  withFlagged,
  withHush,
  withoutHush,
} from './profiles'
import { explainRequest, paneContext, playByPlayPrompt, reviewerSystem } from './prompts'
import { firstRunQuestions, groupAnswers } from './questions'
import type { Question } from './questions'
import {
  commitTitle,
  fitReview,
  isCommit,
  isEmptyScope,
  parseReflog,
  REFLOG_ARGS,
  REVIEWER_DESCRIPTION,
  reviewRequest,
  scopePrint,
  scopeSubject,
  showCommitArgs,
} from './review'
import type { ReflogEntry, ReviewScope } from './review'
import { readSettings } from './settings'
import type { Settings } from './settings'
import { createWatcher } from './watcher'
import type { Watcher } from './watcher'

const COMMANDS = ['backseat-driver', 'bsd'] as const

/** How often the watcher asks git what changed. A slow answer stretches this by skipping ticks. */
const POLL_MS = 2000
/** Each quarter second a poll takes skips one tick, up to this many. */
const SLOW_POLL_MS = 250
const MAX_SKIPPED_TICKS = 15

const IDLE: Watch = { state: 'idle', lastLookAt: null, detail: '' }
const NO_REVIEW: Review = { state: 'none', subject: '', text: '', isUnseen: false }
const NO_PROFILES: Profiles = { languages: [], subjects: {} }

const modeAtom = atom({ plugin: 'backseat-driver', key: 'mode' } as const, 'off')
const tabAtom = atom({ plugin: 'backseat-driver', key: 'tab' } as const, 'play')
const notesAtom = atom({ plugin: 'backseat-driver', key: 'notes' } as const, [])
const selectedAtom = atom({ plugin: 'backseat-driver', key: 'selected' } as const, null)
const watchAtom = atom({ plugin: 'backseat-driver', key: 'watch' } as const, IDLE)
const reviewAtom = atom({ plugin: 'backseat-driver', key: 'review' } as const, NO_REVIEW)
const profilesAtom = atom({ plugin: 'backseat-driver', key: 'profiles' } as const, NO_PROFILES)

/**
 * The mode is kept twice, because each copy is lost by a different event.
 * `$.state` survives a reload of this module but is reset by /clear, /resume
 * and /branch. This variable survives those but not a reload.
 */
let mode: Mode = 'off'

/** Text read from the plugin's own folder when the tutor is first needed. */
let contract = ''
let persona = ''
let lookInstructions = ''
let reviewInstructions = ''
/** The user's home directory, for telling their files from Claude Code's own. */
let home = ''

/** The play-by-play's working state. None of it outlives a reload: the watcher starts again from the tree as it is. */
let watcher: Watcher | null = null
let timer: Timer | null = null
let nextNoteId = 1
let lastChangeAt: number | null = null
let lastLookAt: number | null = null
let isLooking = false
let isPolling = false
let ticksToSkip = 0
let failures = 0

/**
 * The profiles in play, as last read from the store. Kept here as well as in
 * `$.state` so that every prompt can use them without a round trip.
 */
let profiles: Profiles = NO_PROFILES
/** The model's tools are registered the first time the tutor is switched on, and only then. */
let areToolsRegistered = false

/** The deep review's working state. */
let repoRoot = ''
/** The reflog file, whose fingerprint changes whenever HEAD moves. Empty outside a repository. */
let headLog = ''
let headLogStamp = ''
/** The commit HEAD pointed at when it was last looked at. */
let lastHead = ''
/** Where the previous deep review ended, and a fingerprint of what the previous timed review saw. */
let reviewedHead = ''
let reviewedPrint = ''
/** The running review's subagent and what it is reviewing. One review runs at a time. */
let reviewAgentId: string | null = null
let reviewScope: ReviewScope | null = null
/** A commit made while a review was running. Only the latest is kept. */
let queuedCommit: ReflogEntry | null = null
let reviewTimer: Timer | null = null

async function loadTutor($: EngineInterface, personaName: string): Promise<void> {
  const root = $.plugin.root
  contract = stripFrontmatter(await $.fs.read(`${root}/skills/tutor/SKILL.md`))
  lookInstructions = (await $.fs.read(`${root}/prompts/play-by-play.md`)).trim()
  reviewInstructions = (await $.fs.read(`${root}/prompts/deep-review.md`)).trim()
  persona = ''
  if (personaName !== 'none') {
    try {
      persona = stripFrontmatter(await $.fs.read(`${root}/personas/${personaName}.md`))
    } catch {
      $.ui.log(`no style sheet for persona "${personaName}"`, { to: 'debug' })
    }
  }
  home = (await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE')) ?? ''
}

async function openPane($: EngineInterface): Promise<void> {
  await $.ui.open({ id: 'backseat-driver', title: 'Backseat' })
}

/** Changes what the pane's status line says about the watcher. */
async function setWatch($: EngineInterface, change: Partial<Watch>): Promise<void> {
  await update($, watchAtom, (watch): Watch => ({ ...watch, ...change }))
}

async function setReview($: EngineInterface, change: Partial<Review>): Promise<void> {
  await update($, reviewAtom, (review): Review => ({ ...review, ...change }))
}

/** A file's size and modification time as one string, or '' when it is not there. */
async function fileStamp($: EngineInterface, path: string): Promise<string> {
  if (path === '') return ''
  try {
    const stat = await $.fs.stat(path)

    return `${stat.size}:${stat.mtimeMs}`
  } catch {
    return ''
  }
}

/** Git in `cwd`, never taking the index lock that the user's own git commands need. */
async function git(
  $: EngineInterface,
  cwd: string | undefined,
  args: readonly string[],
): Promise<{ exitCode: number; stdout: string }> {
  try {
    return await $.process.run(['git', '--no-optional-locks', ...args], { cwd, timeoutMs: 15_000 })
  } catch {
    // Git is missing, or took too long.
    return { exitCode: 1, stdout: '' }
  }
}

async function loadSubject($: EngineInterface, subject: string): Promise<Profile> {
  try {
    return parseProfile(await $.store.get(subjectKey(subject)))
  } catch {
    return emptyProfile()
  }
}

/**
 * Registers the deep reviewer, with the user's model and thinking level and
 * what is on record about them. A subagent this mod spawns cannot be given
 * any of that at spawn time, so it is registered again whenever a profile changes.
 */
async function registerReviewer($: EngineInterface, settings: Settings): Promise<void> {
  if (repoRoot === '') return
  await $.agent.register({
    name: 'deep-reviewer',
    description: REVIEWER_DESCRIPTION,
    prompt: reviewerSystem(reviewInstructions, [personText(profiles)], persona),
    tools: ['Read', 'Grep', 'Glob'],
    model: settings.deepReview.model,
    effort: settings.deepReview.thinking,
  })
}

/** Changes one subject's profile in the store and everywhere it is shown or used. */
async function saveSubject(
  $: EngineInterface,
  settings: Settings,
  subject: string,
  change: (profile: Profile) => Profile,
): Promise<void> {
  // Read right before writing: another session may have changed this subject since it was loaded.
  const next = change(await loadSubject($, subject))
  await $.store.set(subjectKey(subject), next)
  profiles = { ...profiles, subjects: { ...profiles.subjects, [subject]: next } }
  await update($, profilesAtom, () => profiles)
  await registerReviewer($, settings)
}

/** Loads the profiles of languages that have just come into play. */
async function bringIntoPlay($: EngineInterface, languages: readonly string[]): Promise<void> {
  const added = [...new Set(languages)].filter(language => !profiles.languages.includes(language))
  if (added.length === 0) return
  const subjects = { ...profiles.subjects }
  for (const language of added) subjects[language] = await loadSubject($, language)
  profiles = { languages: [...profiles.languages, ...added], subjects }
  await update($, profilesAtom, () => profiles)
}

/**
 * Asks the first-run questions in Claude Code's own question dialog.
 * Dismissing it skips the rest. Every subject asked about is marked as asked,
 * answered or not, so the questions never come back unprompted.
 */
async function ask($: EngineInterface, settings: Settings, questions: readonly Question[]): Promise<void> {
  if (questions.length === 0) return
  const answers: string[] = []
  for (const question of questions) {
    try {
      answers.push(await $.ui.ask(question.question, { options: question.options, header: question.header }))
    } catch {
      break
    }
  }
  for (const [subject, given] of Object.entries(groupAnswers(questions, answers))) {
    await saveSubject($, settings, subject, profile => withAnswers(profile, given))
  }
}

/** Finds the project's main languages and loads their profiles. */
async function setUpProfiles($: EngineInterface): Promise<string[]> {
  const listed = repoRoot === '' ? '' : (await git($, repoRoot, ['ls-files', '-z'])).stdout
  const main = mainLanguages(listed.split('\0'))
  profiles = { languages: [], subjects: { [GENERAL]: await loadSubject($, GENERAL) } }
  await bringIntoPlay($, main)
  await update($, profilesAtom, () => profiles)

  return main
}

/** The first-run questions for whichever of these languages, and the background, have never been asked. */
function unasked(languages: readonly string[]): Question[] {
  return firstRunQuestions(
    languages.filter(language => profiles.subjects[language]?.isAsked !== true),
    profiles.subjects[GENERAL]?.isAsked === true,
  )
}

/**
 * Stops the tutor bringing something up, now and in every later session.
 * Resolves to how many open notes that removed from the pane.
 */
async function hush($: EngineInterface, settings: Settings, subject: string, entry: Hush): Promise<number> {
  await saveSubject($, settings, subject, profile => withHush(profile, entry))
  const open = await read($, notesAtom)
  const kept = open.filter(
    note => note.topic !== entry.topic || (subject !== GENERAL && languageOf(note.file) !== subject),
  )
  await update($, notesAtom, () => kept)

  return open.length - kept.length
}

/** The tools the tutor uses to remember what the user tells it. Answered by the `tool.call` hooks below. */
async function registerTools($: EngineInterface): Promise<void> {
  if (areToolsRegistered) return
  areToolsRegistered = true
  const language = {
    type: 'string',
    description: 'The language id it applies to, lowercase, such as python, rust or typescript. Use "general" when it is not about one language.',
  }
  const topic = {
    type: 'string',
    description: 'A short slug for the idea, lowercase with dashes. For an open note, use the topic shown in parentheses on that note.',
  }
  await $.tool.register({
    name: 'hush',
    description:
      'Backseat Driver: record that the user does not want to hear about something again. Call it as soon as they say so ("stop warning me about X", "I don\'t care about Y"). It is remembered across sessions and projects, and matching notes leave the pane at once.',
    inputSchema: {
      type: 'object',
      properties: {
        note: {
          type: 'number',
          description: 'The number of the open note they mean, when they mean one. Its topic and language are then taken from the note.',
        },
        topic,
        language,
        what: { type: 'string', description: "What not to bring up, in a few of the user's own words." },
      },
      required: ['topic', 'language', 'what'],
    },
  })
  await $.tool.register({
    name: 'unhush',
    description: 'Backseat Driver: undo a hush, when the user wants to hear about a topic again.',
    inputSchema: { type: 'object', properties: { topic, language }, required: ['topic', 'language'] },
  })
  await $.tool.register({
    name: 'profile',
    description:
      'Backseat Driver: read what is on record about the user for a language that is not in play in this project, for example to explain an idea by comparison with a language they know.',
    inputSchema: { type: 'object', properties: { language }, required: ['language'] },
  })
}

function describeFailure(result: Exclude<ModelCompleteResult, { isAnswered: true }>): string {
  if (result.reason === 'api-error') return String(result.error).replaceAll('_', ' ')

  return result.reason === 'aborted' ? 'timed out' : 'empty reply'
}

/** One look: the pending changes go to the play-by-play model, and its reply becomes notes. */
async function look($: EngineInterface, settings: Settings): Promise<void> {
  const active = watcher
  if (isLooking || active === null) return
  isLooking = true
  try {
    const changes = await active.collect()
    if (changes.length === 0) {
      active.settle([])

      return
    }

    await setWatch($, { state: 'looking' })
    await bringIntoPlay(
      $,
      changes.map(change => languageOf(change.path)).filter(language => language !== null),
    )
    const { prompt, shown } = playByPlayPrompt(changes, await read($, notesAtom))
    const result = await $.model.complete({
      model: settings.playByPlay.model,
      effort: settings.playByPlay.thinking,
      system: reviewerSystem(lookInstructions, [personText(profiles)], persona),
      prompt,
      maxTokens: 2000,
      timeoutMs: 120_000,
    })
    const now = await $.clock.now()
    lastLookAt = now

    if (!result.isAnswered) {
      // Nothing is settled, so the same changes are tried again after the back-off.
      failures += 1
      await setWatch($, { state: 'failed', lastLookAt: now, detail: describeFailure(result) })

      return
    }

    failures = 0
    // What was shown has been looked at, whether or not the reply can be used.
    active.settle(shown)
    const parsed = parseReply(result.text)
    if (parsed !== null) {
      // The reviewer is told what was hushed. This makes sure of it.
      const reply = {
        ...parsed,
        notes: parsed.notes.filter(note => !isHushed(profiles, languageOf(note.file), note.topic)),
      }
      const firstId = nextNoteId
      nextNoteId += reply.notes.length
      const paths = shown.map(change => change.path)
      await update($, notesAtom, open => applyReply(open, reply, paths, firstId).notes)

      // Lesson memory: which ideas came up, by language.
      const raised = new Map<string, string[]>()
      for (const note of reply.notes) {
        const subject = languageOf(note.file) ?? GENERAL
        raised.set(subject, [...(raised.get(subject) ?? []), note.topic])
      }
      for (const [subject, topics] of raised) {
        await saveSubject($, settings, subject, profile => withFlagged(profile, topics))
      }
    }
    await setWatch($, { state: 'idle', lastLookAt: now, detail: '' })
  } catch (error) {
    failures += 1
    $.ui.log(`look failed: ${String(error)}`, { to: 'debug' })
    await setWatch($, { state: 'failed', detail: 'an error' })
  } finally {
    isLooking = false
  }
}

/**
 * The id of the reviewer a spawn started. Claude Code sets it on the spawn's
 * result. When another mod answered the spawn in Claude Code's place, the
 * result has no id, and the reviewer it started, if any, is found by its type.
 */
async function startedReviewer($: EngineInterface, spawnedId: string | undefined): Promise<string | undefined> {
  if (spawnedId !== undefined) return spawnedId
  try {
    const running = (await $.agent.list()).filter(
      agent => agent.type === 'backseat-driver:deep-reviewer' && (agent.status === 'pending' || agent.status === 'running'),
    )

    return running[running.length - 1]?.id
  } catch {
    return undefined
  }
}

/** Hands a scope to the deep reviewer. Its answer arrives later, at `turn.complete`. */
async function startReview($: EngineInterface, scope: ReviewScope): Promise<void> {
  const subject = scopeSubject(scope)
  await setReview($, { state: 'running', subject, text: '', isUnseen: false })
  try {
    const spawned = await $.agent.spawn({
      subagentType: 'backseat-driver:deep-reviewer',
      description: `Deep review of ${subject}`,
      prompt: reviewRequest(scope),
    })
    const agentId = spawned.deny === undefined ? await startedReviewer($, spawned.agentId) : undefined
    if (agentId === undefined) {
      await setReview($, { state: 'failed', text: spawned.deny ?? 'the reviewer did not start' })

      return
    }
    reviewAgentId = agentId
    reviewScope = scope
  } catch (error) {
    $.ui.log(`deep review did not start: ${String(error)}`, { to: 'debug' })
    await setReview($, { state: 'failed', text: 'the reviewer did not start' })
  }
}

async function reviewCommit($: EngineInterface, entry: ReflogEntry): Promise<void> {
  if (reviewAgentId !== null) {
    queuedCommit = entry

    return
  }
  const shown = await git($, repoRoot, showCommitArgs(entry.hash))
  await startReview($, { kind: 'commit', hash: entry.hash, title: commitTitle(entry), patch: shown.stdout })
}

/**
 * Reviews everything since the previous deep review, committed or not. The
 * timer calls this, and so does "review now" in the pane. Asked for by hand
 * with nothing new, it reviews the last commit again.
 */
async function reviewSince($: EngineInterface, isAsked: boolean): Promise<void> {
  if (mode === 'off' || (mode === 'paused' && !isAsked)) return
  if (reviewAgentId !== null) {
    if (isAsked) $.ui.toast('A deep review is already running.')

    return
  }
  if (repoRoot === '' || reviewedHead === '') {
    if (isAsked) $.ui.toast('A deep review needs a git repository with at least one commit.')

    return
  }

  const log = await git($, repoRoot, ['log', '--no-color', '--oneline', `${reviewedHead}..HEAD`])
  const diff = await git($, repoRoot, ['diff', '--no-color', reviewedHead])
  const status = await git($, repoRoot, ['status', '--porcelain=v1', '-z', '--untracked-files=all'])
  const untracked = parseStatus(status.stdout)
    .filter(entry => entry.index === '?' && !isNoiseFile(entry.path))
    .map(entry => entry.path)
  const scope: ReviewScope = { kind: 'since', from: reviewedHead, log: log.stdout, diff: diff.stdout, untracked }

  if (!isEmptyScope(scope) && scopePrint(scope) !== reviewedPrint) {
    await startReview($, scope)
  } else if (isAsked) {
    const last = parseReflog((await git($, repoRoot, ['log', '-1', '--format=%H%x00commit: %s'])).stdout)
    if (last !== null) await reviewCommit($, last)
  }
}

/** Notices when HEAD has moved, and starts a review when the move was a commit. */
async function checkHead($: EngineInterface, settings: Settings): Promise<void> {
  const stamp = await fileStamp($, headLog)
  if (stamp === headLogStamp) return
  headLogStamp = stamp

  const entry = parseReflog((await git($, repoRoot, REFLOG_ARGS)).stdout)
  if (entry === null || entry.hash === lastHead) return
  lastHead = entry.hash
  if (!isCommit(entry)) {
    // A checkout, pull, reset or rebase is not new work. Deep reviews start afresh from here.
    reviewedHead = entry.hash
    reviewedPrint = ''

    return
  }
  if (settings.deepReview.isAfterCommit) await reviewCommit($, entry)
}

/** One poll of the working tree. A poll never calls a model: it only decides whether a look is due. */
async function tick($: EngineInterface, settings: Settings): Promise<void> {
  const active = watcher
  if (isPolling || mode !== 'on' || active === null) return
  if (ticksToSkip > 0) {
    ticksToSkip -= 1

    return
  }

  isPolling = true
  try {
    const started = await $.clock.now()
    const hasChanged = await active.poll()
    const now = await $.clock.now()
    ticksToSkip = Math.min(MAX_SKIPPED_TICKS, Math.floor((now - started) / SLOW_POLL_MS))
    if (hasChanged) lastChangeAt = now

    const isDue = shouldLook({
      now,
      lastChangeAt,
      lastLookAt,
      hasPendingChange: active.hasPending(),
      isLookRunning: isLooking,
      quietMs: settings.playByPlay.quietMs,
      minGapMs: settings.playByPlay.minGapMs,
      backoffMs: backoffMs(failures),
    })
    if (settings.playByPlay.isAutomatic && isDue) void look($, settings)
    await checkHead($, settings)
  } catch (error) {
    $.ui.log(`poll failed: ${String(error)}`, { to: 'debug' })
  } finally {
    isPolling = false
  }
}

function stopWatching(): void {
  timer?.cancel()
  timer = null
  reviewTimer?.cancel()
  reviewTimer = null
  watcher = null
  // A review still running finishes in the background, and its answer is ignored.
  reviewAgentId = null
  reviewScope = null
  queuedCommit = null
}

/** Starts the watcher from the working tree as it stands now. */
async function startWatching($: EngineInterface, settings: Settings): Promise<void> {
  stopWatching()
  lastChangeAt = null
  lastLookAt = null
  failures = 0
  ticksToSkip = 0

  const top = await git($, undefined, ['rev-parse', '--show-toplevel'])
  const root = top.stdout.trim()
  if (top.exitCode !== 0 || root === '') {
    repoRoot = ''
    headLog = ''
    await setWatch($, { state: 'no-git', lastLookAt: null, detail: '' })

    return
  }

  const started = createWatcher({
    git: args => git($, root, args),
    read: async path => {
      try {
        return await $.fs.read(`${root}/${path}`)
      } catch {
        return null
      }
    },
    stat: async path => {
      try {
        const stat = await $.fs.stat(`${root}/${path}`)

        return stat.kind === 'file' ? { size: stat.size, mtimeMs: stat.mtimeMs } : null
      } catch {
        return null
      }
    },
  })
  await started.start()
  watcher = started
  await setWatch($, IDLE)

  repoRoot = root
  const gitDir = (await git($, root, ['rev-parse', '--absolute-git-dir'])).stdout.trim()
  headLog = gitDir === '' ? '' : `${gitDir}/logs/HEAD`
  headLogStamp = await fileStamp($, headLog)
  lastHead = (await git($, root, ['rev-parse', '--verify', '--quiet', 'HEAD'])).stdout.trim()
  // Deep reviews cover what happens from now on, not the history so far.
  reviewedHead = lastHead
  reviewedPrint = ''
  timer = $.clock.every(POLL_MS, () => {
    void tick($, settings)
  })
  if (settings.deepReview.everyMs > 0) {
    reviewTimer = $.clock.every(settings.deepReview.everyMs, () => {
      void reviewSince($, false)
    })
  }
}

/** Moves to `next`, with everything that has to change along with the mode. */
async function switchTo($: EngineInterface, next: Mode, settings: Settings): Promise<void> {
  const wasEngaged = mode !== 'off'
  const isEngaged = next !== 'off'
  if (isEngaged && contract === '') await loadTutor($, settings.persona)

  mode = next
  await update($, modeAtom, () => next)

  if (wasEngaged === isEngaged) return
  // The instruction files are framed differently while the tutor is on.
  $.ui.invalidate('prompt.context')
  if (isEngaged) {
    await openPane($)
    await startWatching($, settings)
    const main = await setUpProfiles($)
    await registerReviewer($, settings)
    await registerTools($)
    // Last, so that everything already works if the questions are dismissed.
    await ask($, settings, unasked(main))
  } else {
    stopWatching()
    await update($, notesAtom, () => [])
    await update($, selectedAtom, () => null)
    await update($, reviewAtom, () => NO_REVIEW)
    profiles = NO_PROFILES
    await update($, profilesAtom, () => NO_PROFILES)
    await $.ui.close({ id: 'backseat-driver' })
  }
}

export const register: Register = (on, options) => {
  const settings = readSettings(options)

  on('session.start', async ($, e, next) => {
    // The one thing the plugin does while switched off: Claude Code clears a
    // store that no session has touched for a while, and this read keeps the
    // profiles from expiring.
    try {
      await $.store.get(subjectKey(GENERAL))
    } catch {
      // No store, no profiles. The tutor works without them.
    }

    // After a reload, `$.state` still holds the mode and the notes.
    mode = await read($, modeAtom)
    if (mode !== 'off') {
      const open = await read($, notesAtom)
      nextNoteId = open.reduce((highest, note) => Math.max(highest, note.id), 0) + 1
      // A review that was running when the module reloaded can no longer be collected.
      if ((await read($, reviewAtom)).state === 'running') {
        await setReview($, { state: 'failed', text: 'the plugin reloaded while it was running' })
      }
      await loadTutor($, settings.persona)
      await openPane($)
      await startWatching($, settings)
      await setUpProfiles($)
      await registerReviewer($, settings)
      await registerTools($)
    }

    for (const name of COMMANDS) {
      try {
        await $.command.register({
          name,
          description: 'Turn the Backseat Driver tutor on, or off, pause, resume, status',
          argumentHint: '[off | pause | resume | status]',
          immediate: true,
        })
      } catch (error) {
        // A taken name throws. The other command still has to register.
        $.ui.log(`could not register /${name}: ${String(error)}`, { to: 'debug' })
      }
    }

    return next(e)
  })

  // /clear, /resume and /branch reset `$.state` and do not fire `session.start`.
  on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
    await update($, modeAtom, () => mode)

    return next(e)
  })

  // Spelled out so that `claude plugin validate` can print which commands this answers.
  on('command.run', { command: ['backseat-driver', 'bsd'] }, async ($, e) => {
    const request = parseRequest(e.args)
    const { to, text } = transition(mode, request)
    if (to !== mode) await switchTo($, to, settings)
    // Asking for "on" again brings back a pane the user closed by hand.
    else if (request === 'on') await openPane($)
    if (request !== 'status') return { text }

    return { text: `${text} Persona: ${settings.persona}.` }
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    if (mode === 'off' || contract === '') return composed

    return {
      sections: tutorSections(composed.sections, { contract, extras: [SESSION_NOTES, personText(profiles)], persona }),
    }
  })

  on('prompt.context', async ($, e, next) => {
    const context = await next(e)
    if (mode === 'off') return context

    return {
      blocks: context.blocks.map(block =>
        block.name === 'claudeMd' ? { ...block, text: reframeInstructions(block.text) } : block,
      ),
    }
  })

  // The conversation is told what the pane shows, so "explain note 2" means something.
  on('prompt.submit', async ($, e, next) => {
    if (mode === 'off') return next(e)
    const shown = paneContext(await read($, notesAtom), await read($, reviewAtom))
    if (shown === '') return next(e)

    return next({ ...e, context: [...(e.context ?? []), shown] })
  })

  // The deep reviewer's answer. It goes to the pane, never into the conversation.
  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined || e.agentId !== reviewAgentId) return next(e)
    const scope = reviewScope
    reviewAgentId = null
    reviewScope = null

    if (e.reason === 'answer' && e.answer.trim() !== '' && scope !== null) {
      reviewedHead = scope.kind === 'commit' ? scope.hash : lastHead
      reviewedPrint = scope.kind === 'commit' ? '' : scopePrint(scope)
      const isUnseen = (await read($, tabAtom)) !== 'review'
      await setReview($, { state: 'done', text: fitReview(e.answer), isUnseen })
      if (isUnseen) $.ui.toast(`Deep review ready: ${scopeSubject(scope)}`)
    } else {
      await setReview($, { state: 'failed', text: e.reason === 'answer' ? 'the reviewer said nothing' : e.reason })
    }

    const queued = queuedCommit
    queuedCommit = null
    if (queued !== null && mode === 'on') await reviewCommit($, queued)

    return next(e)
  })

  // The reviewer is only offered to the model while the tutor is on.
  on('agent.offer', { agent: 'backseat-driver:deep-reviewer' }, ($, e, next) =>
    mode === 'off' ? { isOffered: false } : next(e),
  )

  // The tutor's own tools. Answering here, without `next`, runs no other tool and raises no permission prompt.
  on('tool.call', { tool: 'mcp__backseat-driver__hush' }, async ($, e) => {
    if (mode === 'off') return { result: 'Backseat Driver is off, so nothing was recorded.' }
    // The model fills these in, so none of them is taken on trust. When it
    // names an open note, the note's own topic is used: that is the slug the
    // reviewer will use again, and the model's guess at it rarely matches.
    const noted = (await read($, notesAtom)).find(note => note.id === Number(e.note))
    const topic = noted?.topic ?? String(e.topic ?? '').trim()
    const subject =
      noted === undefined
        ? String(e.language ?? GENERAL).trim().toLowerCase() || GENERAL
        : (languageOf(noted.file) ?? GENERAL)
    if (topic === '') return { result: 'Nothing was recorded: give the topic as a short slug.' }
    const removed = await hush($, settings, subject, { topic, text: String(e.what ?? topic).trim() || topic })
    const pane = removed === 0 ? 'No open note matched, so the pane is unchanged.' : `Removed from the pane: ${removed}.`

    return {
      result: `Recorded. "${topic}" will not be brought up again for ${subject}, in this project or any other. ${pane}`,
    }
  })

  on('tool.call', { tool: 'mcp__backseat-driver__unhush' }, async ($, e) => {
    if (mode === 'off') return { result: 'Backseat Driver is off, so nothing was changed.' }
    const topic = String(e.topic ?? '').trim()
    const subject = String(e.language ?? GENERAL).trim().toLowerCase() || GENERAL
    await saveSubject($, settings, subject, profile => withoutHush(profile, topic))

    return { result: `Done. "${topic}" may be brought up again for ${subject}.` }
  })

  on('tool.call', { tool: 'mcp__backseat-driver__profile' }, async ($, e) => {
    if (mode === 'off') return { result: 'Backseat Driver is off.' }
    const subject = String(e.language ?? GENERAL).trim().toLowerCase() || GENERAL
    const text = personText({ languages: [subject], subjects: { [subject]: await loadSubject($, subject) } })

    return { result: text === '' ? `Nothing is on record for ${subject}.` : text }
  })

  // The one rule that does not rest on the model: Claude cannot edit the user's files.
  on('tool.call', { tool: ['Edit', 'Write', 'NotebookEdit'] }, ($, e, next) => {
    if (mode === 'off') return next(e)
    const path = e.tool === 'NotebookEdit' ? e.notebook_path : e.file_path

    return isUsersFile(path, home) ? { deny: DENIAL } : next(e)
  })

  on('ui.render', { component: 'Pane', requestId: 'backseat-driver' }, async ($, e) => {
    const view = {
      mode: await read($, modeAtom),
      tab: await read($, tabAtom),
      persona: settings.persona,
      notes: await read($, notesAtom),
      selected: await read($, selectedAtom),
      watch: await read($, watchAtom),
      isAutomatic: settings.playByPlay.isAutomatic,
      review: await read($, reviewAtom),
      reviewSchedule: reviewSchedule(settings.deepReview.isAfterCommit, settings.deepReview.everyMs),
      profiles: await read($, profilesAtom),
    }

    return renderPane($.ui.resolve(e), view, {
      onTab: (tab: Tab) => {
        void update($, tabAtom, () => tab)
        if (tab === 'review') void setReview($, { isUnseen: false })
      },
      onSelect: (id: number) => {
        void update($, selectedAtom, () => id)
      },
      onExplain: (note: Note) => {
        // Not awaited: it resolves when the turn starts, which may be after the one now running.
        void $.prompt.submit({ text: explainRequest(note), asUser: true })
        void saveSubject($, settings, languageOf(note.file) ?? GENERAL, profile => withExplained(profile, note.topic))
      },
      onMute: (note: Note) => {
        const entry = { topic: note.topic, text: note.topic.replaceAll('-', ' ') }
        void hush($, settings, languageOf(note.file) ?? GENERAL, entry)
      },
      onUnhush: (subject: string, topic: string) => {
        void saveSubject($, settings, subject, profile => withoutHush(profile, topic))
      },
      onAsk: (subject: string) => {
        void ask($, settings, firstRunQuestions(subject === GENERAL ? [] : [subject], subject !== GENERAL))
      },
      onDismiss: (note: Note) => {
        void update($, notesAtom, open => open.filter(other => other.id !== note.id))
      },
      onLook: () => {
        if (mode === 'on') void look($, settings)
      },
      onReview: () => {
        void reviewSince($, true)
      },
    })
  })
}
