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

import type { Hush, Mode, Note, Profile, Profiles, Review, Spot, Tab, Watch } from '../types'
import { personaPrompt, reframeInstructions, SESSION_NOTES, stripFrontmatter, tutorSections } from './contract'
import { dataHome, fileEntryPath, isRemovable, MARKER, MARKER_TEXT, profilePath, projectId } from './datahome'
import { createExplainer, NO_VIEW } from './explainer'
import type { Explainer, Intent } from './explainer'
import { describeSpot, parseFocusFile, parseTarget, relativeTo, viewFile, viewText } from './focus'
import type { Focus } from './focus'
import {
  confirmQuestion,
  describeScope,
  FORGET,
  isPhrase,
  KEEP,
  knownLanguages,
  LANGUAGE_QUESTION,
  parseScope,
  PHRASE_OPTIONS,
  PHRASE_QUESTION,
  SCOPE_EVERYTHING,
  SCOPE_LANGUAGE,
  SCOPE_PROJECT,
  SCOPE_QUESTION,
  scopeOf,
  scopePaths,
} from './forget'
import type { Scope } from './forget'
import { backoffMs, shouldLook, slowedGapMs, throttle, usagePressure } from './gate'
import type { Throttle } from './gate'
import { parseStatus } from './git'
import { DENIAL, isUsersFile } from './guard'
import { languageName, languageOf, mainLanguages } from './languages'
import { helpText, isModeRequest, parseRequest, transition } from './mode'
import { isNoiseFile } from './noise'
import { applyReply, parseReply, withDismissed } from './notes'
import { renderPane, reviewSchedule } from './pane'
import {
  ANSWER_LABELS,
  answerSubject,
  emptyProfile,
  GENERAL,
  isHushed,
  parseProfile,
  personText,
  storedSubject,
  withAnswer,
  withAnswers,
  withExplained,
  withFlagged,
  withHush,
  withoutHush,
} from './profiles'
import { explainAsk, explainContext, explainRequest, paneContext, playByPlayPrompt, reviewerSystem } from './prompts'
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
import { DEFAULT_PERSONA, readSettings } from './settings'
import type { Persona, Settings } from './settings'
import { readJson, writeJson } from './storage'
import type { Disk } from './storage'
import { createWatcher } from './watcher'
import type { Watcher } from './watcher'

const COMMANDS = ['backseat-driver', 'bsd'] as const

/** How often the watcher asks git what changed. A slow answer stretches this by skipping ticks. */
const POLL_MS = 2000
/** Each quarter second a poll takes skips one tick, up to this many. */
const SLOW_POLL_MS = 250
const MAX_SKIPPED_TICKS = 15

const IDLE: Watch = { state: 'idle', lastLookAt: null, detail: '' }
const STARTING: Watch = { state: 'starting', lastLookAt: null, detail: '' }
const NO_REVIEW: Review = { state: 'none', subject: '', text: '', isUnseen: false }
const NO_PROFILES: Profiles = { languages: [], subjects: {} }

const modeAtom = atom({ plugin: 'backseat-driver', key: 'mode' } as const, 'off')
const tabAtom = atom({ plugin: 'backseat-driver', key: 'tab' } as const, 'play')
const notesAtom = atom({ plugin: 'backseat-driver', key: 'notes' } as const, [])
const dismissedAtom = atom({ plugin: 'backseat-driver', key: 'dismissed' } as const, [])
const selectedAtom = atom({ plugin: 'backseat-driver', key: 'selected' } as const, null)
const watchAtom = atom({ plugin: 'backseat-driver', key: 'watch' } as const, IDLE)
const reviewAtom = atom({ plugin: 'backseat-driver', key: 'review' } as const, NO_REVIEW)
const profilesAtom = atom({ plugin: 'backseat-driver', key: 'profiles' } as const, NO_PROFILES)
const explainAtom = atom({ plugin: 'backseat-driver', key: 'explain' } as const, NO_VIEW)

/**
 * The mode is kept twice, because each copy is lost by a different event.
 * `$.state` survives a reload of this module but is reset by /clear, /resume
 * and /branch. This variable survives those but not a reload.
 */
let mode: Mode = 'off'

/**
 * Counts the times the tutor has been switched on or off. Setup runs in the
 * background, so each piece of it checks that its switch is still the latest
 * before it leaves anything behind.
 */
let engagement = 0

/** Text read from the plugin's own folder when the tutor is first needed. */
let contract = ''
/** The chosen persona's engineering half, then its voice. '' when both are the default. */
let persona = ''
let lookInstructions = ''
let reviewInstructions = ''
let explainInstructions = ''
/** The user's home directory, for telling their files from Claude Code's own. */
let home = ''
/** The folder the tutor keeps its own files in. '' until first needed, and when there is no home directory. */
let dataRoot = ''
/** True once this session has seen the folder's marker file, which is what allows deleting inside it. */
let isHomeMarked = false

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

/**
 * Explain: the lookup engine, where the person is looking, and the timer
 * that watches the file an editor writes its cursor to.
 */
let explainer: Explainer | null = null
let focus: Focus | null = null
/** When an editor last moved the focus, in clock milliseconds. A save does not move the focus away from a live editor. */
let editorFocusAt = 0
let focusTimer: Timer | null = null
let focusStamp = ''
/** Counts refreshes of the Explain view, so that a slower, older one does not overwrite a newer one. */
let viewRun = 0
/** The focused file's stamp when the view was last made. A different stamp now means the view may describe code that is gone. */
let viewedStamp = ''
let isFastPolling = false
let writtenView = ''
/**
 * How often the focused file and the editor's focus file are checked while
 * someone is watching the Explain view. A stat takes about a millisecond.
 * This is the longest the pane can show an explanation of code that was
 * just edited, and the longest an editor waits for its cursor to be noticed.
 */
const FOCUS_POLL_MS = 100
const EDITOR_LIVE_MS = 600_000

/** How close the plan's usage limit is, read at most twice a minute. */
let slowdown: Throttle = { gapFactor: 1, isHeld: false }
let slowdownReadAt = 0
const USAGE_READ_MS = 30_000

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

async function loadTutor($: EngineInterface, chosen: Persona): Promise<void> {
  const root = $.plugin.root
  const file = (path: string): Promise<string> => $.fs.read(`${root}/${path}`)
  // Read side by side: `/bsd` waits for these, and nothing else.
  const [skill, lookText, reviewText, explainText, engineering, voice] = await Promise.all([
    file('skills/tutor/SKILL.md'),
    file('prompts/play-by-play.md'),
    file('prompts/deep-review.md'),
    file('prompts/explain.md'),
    readPersona($, 'engineering', chosen.engineering),
    readPersona($, 'voice', chosen.voice),
    resolveHome($),
  ])
  contract = stripFrontmatter(skill)
  lookInstructions = lookText.trim()
  reviewInstructions = reviewText.trim()
  explainInstructions = explainText.trim()
  persona = personaPrompt({ engineering, voice })
}

/** One half of the persona, from `personas/<half>/<name>.md`, or '' for the default. */
async function readPersona($: EngineInterface, half: 'voice' | 'engineering', name: string): Promise<string> {
  if (name === DEFAULT_PERSONA) return ''
  try {
    return stripFrontmatter(await $.fs.read(`${$.plugin.root}/personas/${half}/${name}.md`))
  } catch {
    $.ui.log(`no ${half} persona called "${name}"`, { to: 'debug' })

    return ''
  }
}

/** Works out the user's home directory and the tutor's data folder. */
async function resolveHome($: EngineInterface): Promise<void> {
  if (dataRoot !== '') return
  const [own, profile, override, xdg] = await Promise.all([
    $.env.get('HOME'),
    $.env.get('USERPROFILE'),
    $.env.get('BACKSEAT_DRIVER_HOME'),
    $.env.get('XDG_DATA_HOME'),
  ])
  home = own ?? profile ?? ''
  dataRoot = dataHome({ override, xdg, home })
}

/**
 * The tutor's own files, through `$`. A read of a missing file is null and a
 * listing of a missing folder is empty. `remove` is the one place the mod
 * runs anything but git: `rm`, and only on a path inside its own folder.
 */
function diskOf($: EngineInterface): Disk {
  return {
    read: async path => {
      try {
        return await $.fs.read(path)
      } catch {
        return null
      }
    },
    write: (path, text) => $.fs.write(path, text),
    list: async path => {
      try {
        return (await $.fs.list(path)).map(entry => entry.name)
      } catch {
        return []
      }
    },
    remove: async path => {
      if (!isRemovable(dataRoot, path)) return false
      try {
        // The marker says the folder is the tutor's own. Without it nothing is deleted.
        if (!(await $.fs.exists(`${dataRoot}/${MARKER}`))) return false

        return (await $.process.run(['rm', '-rf', '--', path], { timeoutMs: 15_000 })).exitCode === 0
      } catch {
        return false
      }
    },
  }
}

/** Makes sure the data folder carries its marker before anything is written into it. */
async function markHome($: EngineInterface): Promise<void> {
  if (isHomeMarked || dataRoot === '') return
  if (!(await $.fs.exists(`${dataRoot}/${MARKER}`))) await $.fs.write(`${dataRoot}/${MARKER}`, MARKER_TEXT)
  isHomeMarked = true
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
  if (dataRoot === '') return emptyProfile()
  try {
    return parseProfile(await readJson(diskOf($), profilePath(dataRoot, subject)))
  } catch {
    return emptyProfile()
  }
}

/**
 * Profiles used to live in the plugin's store, which is capped in size, is
 * separate for each way the plugin is installed and is cleared after a period
 * without use. This moves what is there into files, once, and empties the store.
 */
async function moveOutOfStore($: EngineInterface): Promise<void> {
  if (dataRoot === '') return
  try {
    for (const key of await $.store.keys()) {
      const subject = storedSubject(key)
      if (subject === null) continue
      const path = profilePath(dataRoot, subject)
      // A profile already in a file is the newer one.
      if ((await diskOf($).read(path)) === null) {
        await markHome($)
        await writeJson(diskOf($), path, parseProfile(await $.store.get(key)))
      }
      await $.store.delete(key)
    }
  } catch (error) {
    $.ui.log(`could not move profiles out of the store: ${String(error)}`, { to: 'debug' })
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

/** Changes one subject's profile on disk and everywhere it is shown or used. */
async function saveSubject(
  $: EngineInterface,
  settings: Settings,
  subject: string,
  change: (profile: Profile) => Profile,
): Promise<void> {
  // Read right before writing: another session may have changed this subject since it was loaded.
  const next = change(await loadSubject($, subject))
  if (dataRoot !== '') {
    await markHome($)
    await writeJson(diskOf($), profilePath(dataRoot, subject), next)
  }
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
    name: 'record',
    description:
      'Backseat Driver: record what the user tells you about themselves, so that it is kept across sessions and projects: how much of a language they have written (level), what they want from it (goals), what they want watched most closely in their code (focus), or which language they know best (knows). Call it when they tell you. Never record what you only infer from their code.',
    inputSchema: {
      type: 'object',
      properties: {
        about: { type: 'string', enum: ['level', 'goals', 'focus', 'knows'], description: 'Which of the four this is.' },
        language,
        answer: { type: 'string', description: "What they said, in a few of the user's own words." },
      },
      required: ['about', 'language', 'answer'],
    },
  })
  await $.tool.register({
    name: 'lookup',
    description:
      "Backseat Driver: what a function, class or file of this project does. Call this FIRST, before Read, whenever the user asks what a piece of this codebase does, how it works or why it is there. It answers at once from the tutor's cache, which is checked against the file on disk: what the code at that line does, how, why it is there, what to watch for and what it relies on. It also turns the pane's Explain tab to that spot, so the user sees what you are talking about.",
    inputSchema: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'The file: its path from the repository root, or an absolute path.' },
        line: { type: 'number', description: 'A line inside the function or class in question. Leave it out for the file as a whole.' },
      },
      required: ['file'],
    },
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

/** Reads how much of the plan's usage is spent. The call is free, and its answer is kept for half a minute. */
async function readSlowdown($: EngineInterface, now: number): Promise<Throttle> {
  if (slowdownReadAt !== 0 && now - slowdownReadAt < USAGE_READ_MS) return slowdown
  slowdownReadAt = now
  try {
    slowdown = throttle(usagePressure((await $.session.usage()).rateLimits))
  } catch {
    // No reading is no reason to hold back.
    slowdown = { gapFactor: 1, isHeld: false }
  }

  return slowdown
}

/**
 * One look: the pending changes go to the play-by-play model, and its reply
 * becomes notes. `isAsked` is true when the user pressed "look now".
 */
async function look($: EngineInterface, settings: Settings, isAsked: boolean): Promise<void> {
  const active = watcher
  if (isLooking || active === null) return
  isLooking = true
  try {
    const changes = await active.collect()
    if (changes.length === 0) {
      active.settle([])
      if (isAsked) $.ui.toast('Nothing has changed since the last look.')

      return
    }

    await setWatch($, { state: 'looking' })
    await bringIntoPlay(
      $,
      changes.map(change => languageOf(change.path)).filter(language => language !== null),
    )
    const { prompt, shown } = playByPlayPrompt(changes, await read($, notesAtom), await read($, dismissedAtom))
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
      // Read again: a note dismissed while this look ran must not come back with it.
      const dismissed = await read($, dismissedAtom)
      await update($, notesAtom, open => applyReply(open, reply, paths, firstId, dismissed).notes)

      // Lesson memory: which ideas reached the pane, by language. A repeat
      // of a note that is already open is not a second time it came up.
      const added = (await read($, notesAtom)).filter(note => note.id >= firstId)
      const raised = new Map<string, string[]>()
      for (const note of added) {
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
  // The timer holds back near the plan limit. A review asked for by hand does not.
  if (!isAsked && (await readSlowdown($, await $.clock.now())).isHeld) return
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
  if (!settings.deepReview.isAfterCommit) return
  if ((await readSlowdown($, await $.clock.now())).isHeld) {
    await setReview($, {
      state: 'failed',
      subject: `commit ${entry.hash.slice(0, 7)}: ${commitTitle(entry)}`,
      text: 'you are close to your plan limit. Press r to run it anyway.',
      isUnseen: false,
    })

    return
  }
  await reviewCommit($, entry)
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

    const hasPendingChange = active.hasPending()
    // Usage is only looked up when there is something to look at.
    // Read before a save is followed, so that what the save sets going knows how close the limit is.
    const held = hasPendingChange || hasChanged || (explainer?.pending() ?? 0) > 0 ? await readSlowdown($, now) : slowdown
    if (hasChanged) await followSaves($, active.changed(), now)
    await explainer?.tick()
    // Until an editor has written its focus file, looking for it this often is enough.
    if (focusTimer === null) await pollFocus($)
    const isDue = shouldLook({
      now,
      lastChangeAt,
      lastLookAt,
      hasPendingChange,
      isLookRunning: isLooking,
      quietMs: settings.playByPlay.quietMs,
      minGapMs: slowedGapMs(settings.playByPlay.minGapMs, held.gapFactor),
      backoffMs: backoffMs(failures),
    })
    if (settings.playByPlay.isAutomatic && isDue) {
      if (!held.isHeld) void look($, settings, false)
      // Said once, not on every tick that a look stays due.
      else if ((await read($, watchAtom)).state !== 'held') await setWatch($, { state: 'held' })
    }
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
  focusTimer?.cancel()
  focusTimer = null
  explainer?.stop()
  explainer = null
  focus = null
  focusStamp = ''
  writtenView = ''
  viewedStamp = ''
  reviewTimer?.cancel()
  reviewTimer = null
  watcher = null
  // A review still running finishes in the background, and its answer is ignored.
  reviewAgentId = null
  reviewScope = null
  queuedCommit = null
}

/** Starts the watcher from the working tree as it stands now. `run` is the switch-on this belongs to. */
async function startWatching($: EngineInterface, settings: Settings, run: number): Promise<void> {
  stopWatching()
  lastChangeAt = null
  lastLookAt = null
  failures = 0
  ticksToSkip = 0
  slowdown = { gapFactor: 1, isHeld: false }
  slowdownReadAt = 0

  const top = await git($, undefined, ['rev-parse', '--show-toplevel'])
  if (run !== engagement) return
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
  const gitDir = (await git($, root, ['rev-parse', '--absolute-git-dir'])).stdout.trim()
  const log = gitDir === '' ? '' : `${gitDir}/logs/HEAD`
  const stamp = await fileStamp($, log)
  const tip = (await git($, root, ['rev-parse', '--verify', '--quiet', 'HEAD'])).stdout.trim()
  // Switched off, or on again, while git was answering: this start is no longer wanted.
  if (run !== engagement) return

  watcher = started
  await setWatch($, IDLE)
  repoRoot = root
  headLog = log
  headLogStamp = stamp
  lastHead = tip
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

/**
 * Shows what is known about the spot in focus, and writes it where an editor
 * can read it. `isAsked` is true when the person named the spot just now,
 * which fetches what is missing at once. Every other refresh is the tutor
 * keeping up: with a save, or with whatever else moved the focus there.
 */
async function refreshView($: EngineInterface, isAsked = false): Promise<void> {
  const engine = explainer
  const spot = focus
  if (engine === null || spot === null) return
  viewRun += 1
  const run = viewRun
  try {
    const intent: Intent = isAsked ? 'asked' : spot.source === 'save' ? 'following' : 'browsing'
    const stamp = await fileStamp($, `${repoRoot}/${spot.path}`)
    const view = await engine.view(spot, intent)
    // A newer refresh started while this one was reading the file: its answer is the one to show.
    if (run !== viewRun || engine !== explainer) return
    viewedStamp = stamp
    await update($, explainAtom, () => view)
    const text = JSON.stringify(view)
    if (text !== writtenView && dataRoot !== '') {
      writtenView = text
      await $.fs.write(`${dataRoot}/view.json`, viewFile(view, repoRoot, spot.source, await $.clock.now()))
    }
  } catch (error) {
    $.ui.log(`explain failed: ${String(error)}`, { to: 'debug' })
  }
}

async function setFocus($: EngineInterface, next: Focus, isAsked: boolean): Promise<void> {
  focus = next
  await refreshView($, isAsked)
}

/** Reads the file an editor writes its cursor to, when that file has changed. */
async function pollFocus($: EngineInterface): Promise<void> {
  if (explainer === null || dataRoot === '' || mode === 'off') return
  const stamp = await fileStamp($, `${dataRoot}/focus.json`)
  if (stamp === focusStamp) return
  focusStamp = stamp
  if (stamp === '') return
  try {
    const spot = parseFocusFile(await $.fs.read(`${dataRoot}/focus.json`), repoRoot)
    if (spot === null) return
    editorFocusAt = await $.clock.now()
    // An editor is reporting its cursor: from now on its file is checked four times a second.
    watchClosely($)
    await setFocus($, { ...spot, source: 'editor' }, false)
  } catch {
    // Caught half-written. The next poll reads it whole.
  }
}

/** Whether anyone can see the Explain view: the tab is open, or an editor is showing it. */
async function isWatched($: EngineInterface): Promise<boolean> {
  if ((await read($, tabAtom)) === 'explain') return true

  return focus?.source === 'editor' && (await $.clock.now()) - editorFocusAt < EDITOR_LIVE_MS
}

/**
 * While the Explain view is being watched, the file in focus is checked for
 * changes far more often than the two-second poll does, so that an edit takes
 * the old explanation off the screen in a tenth of a second, and a file that
 * has settled is mapped without waiting for the next slow poll.
 */
async function fastPoll($: EngineInterface): Promise<void> {
  if (isFastPolling || explainer === null) return
  isFastPolling = true
  try {
    await pollFocus($)
    const spot = focus
    if (spot !== null && (await fileStamp($, `${repoRoot}/${spot.path}`)) !== viewedStamp) await refreshView($)
    await explainer?.tick()
    if (!(await isWatched($))) {
      focusTimer?.cancel()
      focusTimer = null
    }
  } catch (error) {
    $.ui.log(`focus poll failed: ${String(error)}`, { to: 'debug' })
  } finally {
    isFastPolling = false
  }
}

function watchClosely($: EngineInterface): void {
  if (explainer === null) return
  focusTimer ??= $.clock.every(FOCUS_POLL_MS, () => {
    void fastPoll($)
  })
}

/** Saved files are mapped again, and the focus follows the save unless an editor is reporting its cursor. */
async function followSaves($: EngineInterface, saved: readonly string[], now: number): Promise<void> {
  const engine = explainer
  if (engine === null || saved.length === 0) return
  for (const path of saved) await engine.touch(path)
  const first = saved[0]
  const isEditorLive = focus?.source === 'editor' && now - editorFocusAt < EDITOR_LIVE_MS
  if (first === undefined || isEditorLive) {
    await refreshView($)

    return
  }
  await setFocus($, { path: first, line: await engine.where(first), source: 'save' }, false)
}

/** Starts the lookup engine for this repository. `run` is the switch-on this belongs to. */
async function startExplaining($: EngineInterface, settings: Settings, run: number): Promise<void> {
  if (repoRoot === '' || dataRoot === '') return
  if (settings.explain.mode === 'off') {
    await update($, explainAtom, (): typeof NO_VIEW => ({ ...NO_VIEW, status: 'off' }))

    return
  }
  const root = repoRoot
  await markHome($)
  if (run !== engagement) return

  explainer = createExplainer({
    read: async path => {
      try {
        return await $.fs.read(`${root}/${path}`)
      } catch {
        return null
      }
    },
    stamp: path => fileStamp($, `${root}/${path}`),
    disk: diskOf($),
    entryPath: path => fileEntryPath(dataRoot, root, path),
    complete: async (prompt, maxTokens, signal) => {
      const result = await $.model.complete(
        {
          model: settings.explain.model,
          effort: settings.explain.thinking,
          system: reviewerSystem(explainInstructions, [personText(profiles)], persona),
          prompt,
          maxTokens,
          timeoutMs: 90_000,
        },
        { signal },
      )

      return result.isAnswered ? result.text : null
    },
    now: () => $.clock.now(),
    project: () => ({ name: projectId(root).replace(/-[0-9a-f]{8}$/, ''), overview: '' }),
    insights: () => [],
    // Paused, nothing is fetched unless it is asked for.
    mode: () => (mode === 'off' ? 'off' : mode === 'paused' ? 'on request' : settings.explain.mode),
    pressure: () => (slowdown.isHeld ? 'held' : slowdown.gapFactor === 1 ? 'none' : 'slowed'),
    model: settings.explain.model,
    onChange: () => {
      void refreshView($)
    },
    log: line => $.ui.log(line, { to: 'debug' }),
  })
  // After a reload, the pane still holds the spot it was showing. The view is made again from the file as it is now.
  const shown = (await read($, explainAtom)).spot
  if (shown !== null) focus = { ...shown, source: 'pane' }
  else await update($, explainAtom, () => NO_VIEW)
  await refreshView($)
  await pollFocus($)
  if (await isWatched($)) watchClosely($)
}

/** Moves the Explain tab's focus through the file's symbols. */
async function moveFocus($: EngineInterface, step: 1 | -1): Promise<void> {
  const view = await read($, explainAtom)
  if (view.spot === null || view.outline.length === 0) return
  const { target, outline } = view
  const at = target === null ? -1 : outline.findIndex(row => row.startLine === target.startLine && row.endLine === target.endLine)
  // From between symbols, "next" is the first one below the line and "previous" the last one above it.
  const line = view.spot.line
  const below = outline.findIndex(row => row.startLine > line)
  const next =
    at !== -1
      ? Math.max(0, Math.min(outline.length - 1, at + step))
      : step === 1
        ? (below === -1 ? outline.length - 1 : below)
        : Math.max(0, (below === -1 ? outline.length : below) - 1)
  const row = outline[next]
  if (row !== undefined) await setFocus($, { path: view.spot.path, line: row.startLine, source: 'pane' }, true)
}

/** What the lookup tool and `/bsd explain` share: move the focus to a spot and say what is known about it. */
async function lookUp($: EngineInterface, spot: Spot): Promise<string> {
  const engine = explainer
  if (engine === null) return ''
  await setFocus($, { ...spot, source: 'command' }, true)
  let view = await engine.view(spot, 'asked')
  // A lookup takes the model a few seconds, and a hook has ten of its own. This waits for some of them.
  for (let turn = 0; turn < 12 && view.status === 'updating'; turn += 1) {
    await $.clock.sleep(500)
    view = await engine.view(spot, 'asked')
  }
  const known = viewText(view)
  const more =
    view.status === 'updating'
      ? 'More is being looked up and will be in the Explain tab shortly. Read the code itself for what is not covered here.'
      : view.status === 'failed'
        ? 'The lookup failed, so read the code itself.'
        : view.status === 'no-file'
          ? 'There is no such file in this project.'
          : ''

  return [known === '' && more === '' ? `Nothing is known about ${describeSpot(spot)} yet.` : known, more].filter(part => part !== '').join('\n\n')
}

/**
 * Everything the tutor needs once it is on: the watcher, the profiles, the
 * reviewer and the tools. `/bsd` does not wait for this, so that it answers
 * at once however slow git is. `isFresh` is false when the tutor was already
 * on and the module reloaded, in which case no questions are asked.
 */
async function engage($: EngineInterface, settings: Settings, run: number, isFresh: boolean): Promise<void> {
  try {
    await startWatching($, settings, run)
    if (run !== engagement) return
    await moveOutOfStore($)
    const main = await setUpProfiles($)
    await registerReviewer($, settings)
    await registerTools($)
    await startExplaining($, settings, run)
    // Last, so that everything already works if the questions are dismissed.
    if (isFresh && run === engagement) await ask($, settings, unasked(main))
  } catch (error) {
    $.ui.log(`could not finish starting: ${String(error)}`, { to: 'debug' })
  }
}

/** Moves to `next`, with everything that has to change along with the mode. */
async function switchTo($: EngineInterface, next: Mode, settings: Settings): Promise<void> {
  const wasEngaged = mode !== 'off'
  const isEngaged = next !== 'off'
  // Awaited, because the contract has to be in force from the first prompt after the command.
  if (isEngaged && contract === '') await loadTutor($, settings.persona)

  mode = next
  await update($, modeAtom, () => next)

  if (wasEngaged === isEngaged) return
  engagement += 1
  // The instruction files are framed differently while the tutor is on.
  $.ui.invalidate('prompt.context')
  if (isEngaged) {
    await setWatch($, STARTING)
    await openPane($)
    void engage($, settings, engagement, true)
  } else {
    stopWatching()
    await update($, notesAtom, () => [])
    await update($, dismissedAtom, () => [])
    await update($, selectedAtom, () => null)
    await update($, reviewAtom, () => NO_REVIEW)
    await update($, explainAtom, () => NO_VIEW)
    profiles = NO_PROFILES
    await update($, profilesAtom, () => NO_PROFILES)
    await $.ui.close({ id: 'backseat-driver' })
  }
}

/** Asks one question about forgetting, and answers null when the dialog is dismissed. */
async function choose($: EngineInterface, question: string, options: readonly string[]): Promise<string | null> {
  try {
    return await $.ui.ask(question, { options: [...options], header: 'Forget' })
  } catch {
    return null
  }
}

const NOTHING_FORGOTTEN = 'Nothing was forgotten.'

/** Asks what to forget. Resolves to the scope, or to the line to print when there is nothing to go on with. */
async function pickScope($: EngineInterface): Promise<Scope | string> {
  const picked = scopeOf((await choose($, SCOPE_QUESTION, [SCOPE_PROJECT, SCOPE_LANGUAGE, SCOPE_EVERYTHING])) ?? '')
  if (picked === null) return NOTHING_FORGOTTEN
  if (picked !== 'language') return { kind: picked }

  const disk = diskOf($)
  const known = knownLanguages([...(await disk.list(`${dataRoot}/profiles`)), ...(await disk.list(`${dataRoot}/progress`))])
  if (known.length === 0) return 'Nothing is on record for any language yet.'
  // The dialog takes two to four options. More languages than that are typed.
  const offered = known.length === 1 ? [known[0] ?? '', 'None of them'] : known.slice(0, 4)
  const language = (await choose($, LANGUAGE_QUESTION, offered))?.trim().toLowerCase() ?? ''

  return language === '' || language === 'none of them' ? NOTHING_FORGOTTEN : { kind: 'language', language }
}

/**
 * `/bsd forget`: erases what the tutor remembers, after asking. Every way out
 * of a dialog but the explicit one keeps everything.
 */
async function forget($: EngineInterface, settings: Settings, named: Scope | null): Promise<void> {
  const kept = (): void => $.ui.log(NOTHING_FORGOTTEN)
  try {
    await resolveHome($)
    if (dataRoot === '') {
      $.ui.log('There is no home directory, so nothing is kept and nothing can be forgotten.')

      return
    }
    const root = repoRoot !== '' ? repoRoot : (await git($, undefined, ['rev-parse', '--show-toplevel'])).stdout.trim()
    const projectName = root === '' ? 'no repository here' : projectId(root)

    const scope = named ?? (await pickScope($))
    if (typeof scope === 'string') {
      $.ui.log(scope)

      return
    }

    if ((await choose($, confirmQuestion(scope, projectName), [KEEP, FORGET])) !== FORGET) return kept()
    if (scope.kind === 'everything' && !isPhrase((await choose($, PHRASE_QUESTION, PHRASE_OPTIONS)) ?? '')) return kept()

    const disk = diskOf($)
    const failed: string[] = []
    for (const path of scopePaths(dataRoot, root, scope)) {
      if ((await disk.read(path)) === null && (await disk.list(path)).length === 0) continue
      if (!(await disk.remove(path))) failed.push(path)
    }
    if (failed.length > 0) {
      $.ui.log(`Could not delete ${failed.join(', ')}. Delete it by hand to finish.`)

      return
    }

    // What this session holds in memory goes too, so that the blank slate starts now.
    if (scope.kind !== 'language') {
      explainer?.reset()
      writtenView = ''
      await update($, explainAtom, () => NO_VIEW)
      await update($, notesAtom, () => [])
      await update($, dismissedAtom, () => [])
      await update($, selectedAtom, () => null)
      await update($, reviewAtom, () => NO_REVIEW)
    }
    if (scope.kind !== 'project' && mode !== 'off') {
      await setUpProfiles($)
      await registerReviewer($, settings)
    }
    $.ui.log(`Forgot ${describeScope(scope, projectName)}.`)
  } catch (error) {
    $.ui.log(`Forgetting failed (${String(error)}). Nothing more was deleted.`)
  }
}

export const register: Register = (on, options) => {
  const settings = readSettings(options)

  on('session.start', async ($, e, next) => {
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
      engagement += 1
      await engage($, settings, engagement, false)
    }

    for (const name of COMMANDS) {
      try {
        await $.command.register({
          name,
          description: 'Turn the Backseat Driver tutor on. /bsd help lists the rest',
          argumentHint: '[off | pause | resume | status | questions | help]',
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
    const { request, rest, unknown } = parseRequest(e.args)
    if (request === 'help') return { text: helpText(unknown) }
    if (request === 'questions') {
      if (mode === 'off') return { text: 'Backseat Driver is off. Run /bsd to start it.' }
      // Not awaited: the dialog stays open for as long as the person takes.
      void ask($, settings, firstRunQuestions(profiles.languages, false))

      return { text: 'Here are the questions again. Esc stops at any point, and the answers so far are kept.' }
    }
    if (request === 'explain') {
      if (mode === 'off') return { text: 'Backseat Driver is off. Run /bsd to start it.' }
      if (settings.explain.mode === 'off') return { text: 'Explain is switched off. Its setting is in /config.' }
      if (explainer === null) return { text: 'Explain needs a git repository, and a moment after /bsd to get ready.' }
      await update($, tabAtom, () => 'explain')
      watchClosely($)
      const spot = rest.trim() === '' ? focus : parseTarget(rest, repoRoot)
      if (spot === null) {
        return { text: rest.trim() === '' ? 'Name a file and a line: /bsd explain src/app.py:42' : `That is not a file in this project: ${rest.trim()}` }
      }
      // Not awaited: the answer goes to the pane as it arrives.
      void setFocus($, { path: spot.path, line: spot.line, ...(spot.endLine === undefined ? {} : { endLine: spot.endLine }), source: 'command' }, true)

      return { text: `Explaining ${describeSpot(spot)} in the pane.` }
    }
    if (request === 'forget') {
      // Not awaited: the dialogs stay open for as long as the person takes.
      void forget($, settings, parseScope(rest))

      return { text: 'Nothing is forgotten until you confirm it. Esc keeps everything.' }
    }
    if (!isModeRequest(request)) return { text: helpText() }

    const { to, text } = transition(mode, request)
    if (to !== mode) await switchTo($, to, settings)
    // Asking for "on" again brings back a pane the user closed by hand.
    else if (request === 'on') await openPane($)
    if (request !== 'status') return { text }

    return { text: `${text} Voice: ${settings.persona.voice}. Engineering: ${settings.persona.engineering}.` }
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
    const shown = [paneContext(await read($, notesAtom), await read($, reviewAtom)), explainContext(await read($, explainAtom))].filter(
      part => part !== '',
    )
    if (shown.length === 0) return next(e)

    return next({ ...e, context: [...(e.context ?? []), ...shown] })
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

  on('tool.call', { tool: 'mcp__backseat-driver__record' }, async ($, e) => {
    if (mode === 'off') return { result: 'Backseat Driver is off, so nothing was recorded.' }
    const about = String(e.about ?? '').trim()
    const answer = String(e.answer ?? '').trim().slice(0, 200)
    const subject = answerSubject(about, String(e.language ?? '').trim().toLowerCase())
    if (subject === null || answer === '') {
      return { result: 'Nothing was recorded: give `about` as level, goals, focus or knows, the language it is about, and the answer.' }
    }
    await saveSubject($, settings, subject, profile => withAnswer(profile, about, answer))
    const where = subject === GENERAL ? '' : ` for ${languageName(subject)}`

    return { result: `Recorded${where}: "${ANSWER_LABELS[about]}: ${answer}". It is kept across sessions and projects.` }
  })

  on('tool.call', { tool: 'mcp__backseat-driver__lookup' }, async ($, e) => {
    if (mode === 'off' || explainer === null) return { result: 'Nothing is cached, because Explain is not running. Read the file instead.' }
    const path = relativeTo(repoRoot, String(e.file ?? ''))
    if (path === null) return { result: 'That file is not in this project.' }
    const line = Math.floor(Number(e.line ?? 1))

    return { result: await lookUp($, { path, line: Number.isFinite(line) && line >= 1 ? line : 1 }) }
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
      explain: await read($, explainAtom),
      isFocused: e.props.isFocused,
      columns: e.props.bodyColumns,
    }

    return renderPane($.ui.resolve(e), view, {
      onTab: (tab: Tab) => {
        void update($, tabAtom, () => tab)
        if (tab === 'review') void setReview($, { isUnseen: false })
        if (tab === 'explain') watchClosely($)
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
      onQuestions: () => {
        void ask($, settings, firstRunQuestions(profiles.languages, false))
      },
      onExplainMove: (step: 1 | -1) => {
        void moveFocus($, step)
      },
      onExplainFetch: () => {
        void refreshView($, true)
      },
      onExplainAsk: () => {
        void read($, explainAtom).then(view => {
          const text = explainAsk(view)
          // A prompt the mod submits skips the mod's own `prompt.submit` hook. The text
          // names the file and the lines, and the tutor's lookup tool has the rest.
          if (text !== '') void $.prompt.submit({ text, asUser: true })
        })
      },
      onDismiss: (note: Note) => {
        void update($, notesAtom, open => open.filter(other => other.id !== note.id))
        // Remembered, so that the next look does not bring the same point back.
        void update($, dismissedAtom, dismissed => withDismissed(dismissed, note))
      },
      onLook: () => {
        if (mode === 'on') void look($, settings, true)
      },
      onReview: () => {
        void reviewSince($, true)
      },
    })
  })
}
