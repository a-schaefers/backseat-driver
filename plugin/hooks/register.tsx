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
import type { EngineInterface, ModelCompleteRequest, ModelCompleteResult, Register, Timer } from 'claude-code'

import type { ExplainView, Hush, LevelChange, Mode, Note, Profile, Profiles, ProgressRecord, ProgressView, Review, SettingRow, Spot, Tab, Watch, Working } from '../types'
import {
  avatarFor,
  BLINK_MS,
  BLINK_SHUT_MS,
  closingLine,
  finished,
  isTalking,
  nextTick,
  QUIET_LOOKS_BEFORE_REMARK,
  SILENT,
  speech,
  TALK_MS,
} from './avatar'
import { personaPrompt, reframeInstructions, SESSION_NOTES, stripComments, stripFrontmatter, tutorSections } from './contract'
import {
  addedLines,
  byLanguage,
  commitInfoArgs,
  commitPatchArgs,
  identityOf,
  judge,
  MIN_LINES,
  parseCommitInfo,
  parseRecent,
  RECENT_COMMITS_ARGS,
  sizeOf,
} from './authorship'
import {
  dataHome,
  debugRoot,
  debugSwitchPath,
  fileEntryPath,
  focusPath,
  isOwnFolder,
  isRemovable,
  journalPath,
  leasePath,
  lockRepoPath,
  MARKER,
  MARKER_TEXT,
  profilePath,
  progressPath,
  projectDir,
  projectId,
  sharedFolders,
} from './datahome'
import { createDebugLog, createTracer, DEBUG_USAGE, FLUSH_MS, parseDebugRequest, parseSwitch, sessionFolder } from './debuglog'
import type { DebugRequest } from './debuglog'
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
import { HEALTHY, mayAsk, NO_PRESSURE, outcomeOf, outcomeOfError, pressureOf, stepHealth } from './health'
import type { Health, Outcome, Pressure } from './health'
import { parseStatus } from './git'
import { NO_ACTIVITY } from './glance'
import { DENIAL, isUsersFile } from './guard'
import { languageName, languageOf, mainLanguages } from './languages'
import { sourcePrint } from './knowledge'
import {
  isCheckDue,
  installedEntry,
  manifestRepository,
  manifestVersion,
  marketplaceLocation,
  newestRelease,
  parseUpdateRecord,
  parseVersion,
  shellLine,
  tagsArgs,
  UNINSTALL_ERASE,
  UNINSTALL_KEEP,
  UNINSTALL_ONLY,
  UNINSTALL_QUESTION,
  uninstallCommand,
  updateCommands,
  updateNotice,
  versionText,
} from './update'
import type { Install } from './update'
import { assessmentRequest, emptyRecord, parseAssessment, parseRecord, progressText, recordText, withAssessment } from './progress'
import type { AssessedCommit, CommitForAssessment } from './progress'
import { helpText, isModeRequest, parseRequest, SETTINGS_OFF, transition } from './mode'
import { isNoiseFile } from './noise'
import { isLookDue, playOf, wakeAt } from './play'
import type { Play, PlayFacts } from './play'
import { applyReply, isProblem, parseReply, withDismissed } from './notes'
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
import {
  emptyProject,
  insightLine,
  insightsFor,
  overviewLine,
  parseProject,
  parseReviews,
  projectBrief,
  reviewDigest,
  splitReview,
  withReview,
  withReviewNotes,
} from './project'
import type { Insight, KeptInsight, ProjectKnowledge, ReviewNotes, ReviewRecord } from './project'
import { explainAsk, explainContext, explainRequest, paneContext, playByPlayPrompt, reviewerSystem } from './prompts'
import type { Bubble } from './prompts'
import { firstRunQuestions, groupAnswers } from './questions'
import type { Question } from './questions'
import { createRecorder } from './recorder'
import { createScheduler } from './scheduler'
import type { Scheduler } from './scheduler'
import { claimed, nextLeaseCheck, parseLease, released } from './lease'
import type { Lease } from './lease'
import { FOCUS_SCAN_MS, focusGapMs, scanGapMs } from './sensor'
import { healthLine, playLine, watchOf } from './status'
import type { Recorder } from './recorder'
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
  shortHash,
  showCommitArgs,
  withReviewChange,
} from './review'
import type { ReviewScope } from './review'
import {
  commitSubject,
  current,
  EMPTY_QUEUE,
  failedText,
  heldText,
  isSpent,
  nextToAssess,
  nextToReview,
  parseQueue,
  retryMs,
  reviewed,
  settledIn,
  VERDICT_MS,
  WATCHDOG_LIMIT_MS,
  WATCHDOG_MS,
  withAttempt,
  withCommit,
  withoutCommit,
} from './reviewqueue'
import type { ReviewQueue, Waiting } from './reviewqueue'
import { configValue, DEFAULT_PERSONA, readSettings, settingRows, withSetting } from './settings'
import type { Persona, Settings } from './settings'
import { createLocks } from './locks'
import { memoryDisk } from './storage'
import type { Disk } from './storage'
import { createStore, plainStore, updateJson } from './store'
import type { Store } from './store'
import { createWatcher } from './watcher'
import type { Watcher } from './watcher'
import { chosen, parseWorking, tidy, WORKING_HEADER, WORKING_QUESTION, workingChoices } from './working'

const COMMANDS = ['backseat-driver', 'bsd'] as const

const IDLE: Watch = { state: 'idle', lastLookAt: null, line: playLine({ at: 'watching' }) }
const NO_REVIEW: Review = { state: 'none', subject: '', text: '', isUnseen: false, decisions: [], insights: [] }
const NO_PROFILES: Profiles = { languages: [], subjects: {} }
const NO_WORKING: Working = { said: '', saidAgo: '', inferred: '', where: '', share: '' }

const modeAtom = atom({ plugin: 'backseat-driver', key: 'mode' } as const, 'off')
const tabAtom = atom({ plugin: 'backseat-driver', key: 'tab' } as const, 'play')
const notesAtom = atom({ plugin: 'backseat-driver', key: 'notes' } as const, [])
const dismissedAtom = atom({ plugin: 'backseat-driver', key: 'dismissed' } as const, [])
const selectedAtom = atom({ plugin: 'backseat-driver', key: 'selected' } as const, null)
const watchAtom = atom({ plugin: 'backseat-driver', key: 'watch' } as const, IDLE)
const reviewAtom = atom({ plugin: 'backseat-driver', key: 'review' } as const, NO_REVIEW)
const profilesAtom = atom({ plugin: 'backseat-driver', key: 'profiles' } as const, NO_PROFILES)
const explainAtom = atom({ plugin: 'backseat-driver', key: 'explain' } as const, NO_VIEW)
const NO_PROGRESS: ProgressView = { isOn: true, identity: [], records: [], busy: '', skipped: '' }
const progressAtom = atom({ plugin: 'backseat-driver', key: 'progress' } as const, NO_PROGRESS)
const updateAtom = atom({ plugin: 'backseat-driver', key: 'update' } as const, '')
const speechAtom = atom({ plugin: 'backseat-driver', key: 'speech' } as const, SILENT)
const workingAtom = atom({ plugin: 'backseat-driver', key: 'working' } as const, NO_WORKING)
const settingsAtom = atom({ plugin: 'backseat-driver', key: 'settings' } as const, [])

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
/** What the play-by-play is told about the animated persona's speech bubble. */
let bubbleInstructions = ''
/** The user's home directory, for telling their files from Claude Code's own. */
let home = ''
/** The folder the tutor keeps its own files in. '' until first needed, and when there is no home directory. */
let dataRoot = ''
/** True once this session has seen the folder's marker file, which is what allows deleting inside it. */
let isHomeMarked = false

/** The play-by-play's working state. None of it outlives a reload: the watcher starts again from the tree as it is. */
let watcher: Watcher | null = null
/** False from the moment the tutor is switched on until the working tree has been read, or found not to be a repository. */
let isWatchReady = false
let nextNoteId = 1
let lastChangeAt: number | null = null
let lastLookAt: number | null = null
let isLooking = false
/** Looks in a row that got no answer, and why the last of them did not. */
let failures = 0
/**
 * What went wrong lately and how often, by the words it was reported with.
 * Something that fails twice within a few minutes is said in the pane.
 */
const failuresSeen = new Map<string, { count: number; at: number }>()
const FAILING_FOR_MS = 300_000
/** The pane's state as it was when the conversation was cleared, until it is put back (`carryPane`). */
let carried: {
  tab: Tab
  notes: Note[]
  dismissed: Note[]
  selected: number | null
  watch: Watch
  review: Review
  profiles: Profiles
  explain: ExplainView
  progress: ProgressView
  update: string
  working: Working
} | null = null
let lookFailure = ''

/**
 * The scan of the working tree: the one thing the mod has to go and look at,
 * because nothing tells it. One runs at a time, and the next is planned when
 * it has finished (`sensor.ts` says how soon).
 */
let isScanning = false
/** True when something asked for a scan while one was running: another follows at once. */
let isScanWanted = false
let lastScanMs = 0
/** When something last happened: a save, a commit, a caret move, a prompt, a key in the pane. */
let activeAt: number | null = null

/** What has to be done at a known time. One timer serves all of it. Null until the tutor is first switched on. */
let deadlines: Scheduler | null = null

/** Whether Claude is answering, as every background job reports it, and which jobs have a setting of their own that is refused. */
let health: Health = HEALTHY
const jobBlocks = new Map<string, string>()
/** Why the running deep review's subagent died, when an API error ended it. '' otherwise. */
let reviewFailure = ''
/**
 * The counting of that failure, while it is under way. The review's end
 * arrives at the same moment and waits for it, so that it finds Claude
 * already known not to be answering.
 */
let reviewFailureNoted: Promise<void> | null = null

/**
 * The profiles in play, as last read from the store. Kept here as well as in
 * `$.state` so that every prompt can use them without a round trip.
 */
let profiles: Profiles = NO_PROFILES
/** The model's tools are registered the first time the tutor is switched on, and only then. */
let areToolsRegistered = false

/**
 * Whether this session drives the project's background jobs: the looks, the
 * reviews, the journal, the editor's view (`lease.ts`). False while another
 * session holds the project's lease, and this one is then for the
 * conversation only. True where there is no lease to hold: outside a
 * repository, or with no data folder.
 */
let isDriver = true
/** The id this session holds the lease under. `/clear` gives a session another id, and the lease is still its own. */
let leaseHolder = ''
/**
 * The files that hold what is on record about the person, as last seen:
 * names, sizes and times in one string. Another session may change them.
 */
let sharedStamp: string | null = null
let sharedCheckedAt = 0
/** How often a scan looks at whether those files changed. One listing per folder. */
const SHARED_CHECK_MS = 5000

/** Explain: the lookup engine, and where the person is looking. */
let explainer: Explainer | null = null
let focus: Focus | null = null
/** When an editor last moved the focus, in clock milliseconds. A save does not move the focus away from a live editor. */
let editorFocusAt = 0
/**
 * True while the spot in focus is being checked ten times a second, which it
 * is for as long as someone can see the Explain view (`fastPoll`).
 */
let isWatchingClosely = false
/** The editor's focus file as last read: its size and modification time, and its text, null when it is not there. */
let focusStamp = ''
let focusText: string | null = null
/** Counts refreshes of the Explain view, so that a slower, older one does not overwrite a newer one. */
let viewRun = 0
/** The focused file's stamp when the view was last made. A different stamp now means the view may describe code that is gone. */
let viewedStamp = ''
let writtenView = ''
const EDITOR_LIVE_MS = 600_000
/** The lookup tool waits this long for what it was asked about. A hook has ten seconds of its own. */
const LOOKUP_WAIT_MS = 6000

/** The animated persona's timers: one moves its mouth while it talks, the other makes it blink now and then. */
let talkTimer: Timer | null = null
let blinkTimer: Timer | null = null
/** Looks in a row that gave it nothing to say. After enough of them, a look may give it a light remark. */
let quietLooks = 0

/** How close the plan's usage limit is: pushed by Claude Code when it measures the session, and read before anything is spent. */
let pressure: Pressure = NO_PRESSURE

/**
 * What is known about this project as a whole, which the deep review writes
 * and the other two jobs read, and the deep review's own recent reviews.
 */
let project: ProjectKnowledge | null = null

/**
 * Progress: whose commits count, the files the watcher saw change since the
 * last commit (work it watched arrive counts in full), the records of the
 * languages in play, and the queue that runs one assessment at a time.
 */
let identity: string[] = []
const watchedPaths = new Set<string>()
const records = new Map<string, ProgressRecord>()
let progressQueue: Promise<void> = Promise.resolve()
let progressInstructions = ''
let reviews: ReviewRecord[] = []

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
/** The running review's subagent, what it is reviewing, and when it started. One review runs at a time. */
let reviewAgentId: string | null = null
let reviewScope: ReviewScope | null = null
let reviewStartedAt = 0
/**
 * The commits waiting for their review, or for the look at the person's
 * progress after it. Kept in the project's folder, so that a commit made
 * while Claude was not answering is still reviewed later. This is the copy
 * in memory.
 */
let waiting: ReviewQueue = EMPTY_QUEUE
/** True while the look at the person's progress, for a waiting commit, is under way. */
let isAssessing = false
/** After a try that got no answer, when the next one may start: of a review, and of a look at the person's progress. */
let reviewRetryAt: number | null = null
let assessRetryAt: number | null = null
/**
 * True while a review is being started, or the end of one is being recorded.
 * With `reviewAgentId` and `endedReview` it is the one review slot: nothing
 * starts a review while any of them says it is taken, so that two events
 * arriving together cannot start the same review twice.
 */
let isReviewBusy = false
/** The review that ended a moment ago saying only "error", while its reason may still arrive. */
let endedReview: { agentId: string; scope: ReviewScope | null } | null = null

/** The journal of what they are doing in this project. Null while the tutor is off, and outside a repository. */
let recorder: Recorder | null = null
/** What the pane was last told they are working on, as JSON, so that it is told again only when that changes. */
let workingShown = ''

/**
 * The debug log. The tracer always keeps the latest records in memory, and
 * writes every one of them to a file while the log is switched on.
 */
const tracer = createTracer(() => Date.now())
let flushTimer: Timer | null = null
/** The tutor's state as last written beside the log, so that it is written again only when it changes. */
let stateWritten = ''
/** Polls that find nothing new are counted and summed up now and then, not logged one by one. */
let quiet = { polls: 0, stats: 0, renders: 0, composes: 0 }
let quietSince = 0
const QUIET_SUMMARY_MS = 30_000
/** What `git status` last answered, which is how a poll that found nothing new is told. */
let lastStatus = ''
/** What the tutor last put into the system prompt, so that it is logged only when it changes. */
let composedLast = ''

/** Records one thing the tutor did. Its details are worked out only while the debug log is on. */
function trace($: EngineInterface, kind: string, name: string, detail?: () => unknown, ms?: number): void {
  tracer.note(kind, name, detail, ms)
  if (!tracer.isOn() || flushTimer !== null) return
  flushTimer = $.clock.after(FLUSH_MS, () => {
    flushTimer = null
    void flushDebug($)
  })
}

/** Something went wrong and the tutor carried on. It is said in Claude Code's debug log and in the tutor's own. */
function fail($: EngineInterface, what: string, error: unknown): void {
  // Counted, so that something that keeps going wrong is said in the pane and not only in a log nobody reads.
  const at = Date.now()
  const seen = failuresSeen.get(what)
  failuresSeen.set(what, { count: seen !== undefined && at - seen.at < FAILING_FOR_MS ? seen.count + 1 : 1, at })
  $.ui.log(`${what}: ${String(error)}`, { to: 'debug' })
  trace($, 'error', what, () => ({ message: String(error), stack: error instanceof Error ? error.stack : undefined }))
}

/** What has gone wrong more than once in the last few minutes, in the words it was reported with. */
function failingNow(): string[] {
  const now = Date.now()

  return [...failuresSeen].filter(([, seen]) => seen.count >= 2 && now - seen.at < FAILING_FOR_MS).map(([what]) => what)
}

/** Sums up the polls that found nothing new since the last summary. */
function traceQuiet($: EngineInterface): void {
  const now = Date.now()
  if (now - quietSince < QUIET_SUMMARY_MS) return
  const counted = quiet
  if (counted.polls + counted.stats + counted.renders + counted.composes > 0) {
    trace($, 'poll', 'nothing new', () => ({ ...counted, overMs: quietSince === 0 ? null : now - quietSince }))
  }
  quiet = { polls: 0, stats: 0, renders: 0, composes: 0 }
  quietSince = now
}

/** What the tutor holds in memory that says what it is doing: the part of its state no pane shows. */
function snapshot(): Record<string, unknown> {
  return {
    mode,
    engagement,
    repoRoot,
    dataRoot,
    watcher: watcher === null ? null : { dirty: watcher.dirty(), changed: watcher.changed(), hasPending: watcher.hasPending() },
    look: { isWatchReady, isLooking, lastChangeAt, lastLookAt, failures, lookFailure, quietLooks },
    scan: { isScanning, isScanWanted, lastScanMs, activeAt },
    deadlines: deadlines?.all() ?? {},
    health,
    jobBlocks: Object.fromEntries(jobBlocks),
    pressure,
    lease: { isDriver, holder: leaseHolder },
    review: {
      agentId: reviewAgentId,
      scope: reviewScope === null ? null : scopeSubject(reviewScope),
      startedAt: reviewStartedAt,
      isBusy: isReviewBusy,
      ended: endedReview === null ? null : endedReview.agentId,
      waiting,
      isAssessing,
      retryAt: reviewRetryAt,
      assessRetryAt,
      reviewedHead,
      reviewedPrint,
      lastHead,
      headLog,
    },
    explain: { isOn: explainer !== null, waiting: explainer?.pending() ?? 0, focus, editorFocusAt, isWatchingClosely },
    timers: { talk: talkTimer !== null, blink: blinkTimer !== null },
    profiles: { languages: profiles.languages, subjects: Object.keys(profiles.subjects) },
    progress: { identity, records: [...records.keys()], watchedPaths: [...watchedPaths] },
    journal: recorder === null ? null : { working: workingShown },
    project: project === null ? null : { isSurveyed: project.isSurveyed, insights: project.insights.length },
    quiet,
  }
}

/** The whole state: what is held in memory, and what the pane is drawn from. */
async function fullState($: EngineInterface): Promise<Record<string, unknown>> {
  return {
    ...snapshot(),
    pane: {
      mode: await read($, modeAtom),
      tab: await read($, tabAtom),
      notes: await read($, notesAtom),
      dismissed: await read($, dismissedAtom),
      selected: await read($, selectedAtom),
      watch: await read($, watchAtom),
      review: await read($, reviewAtom),
      explain: await read($, explainAtom),
      working: await read($, workingAtom),
      progress: await read($, progressAtom),
      update: await read($, updateAtom),
      speech: await read($, speechAtom),
    },
  }
}

/** Writes the debug log and, beside it, the tutor's whole state as it stands. */
async function flushDebug($: EngineInterface): Promise<void> {
  const log = tracer.log()
  if (log === null) return
  await log.flush()
  try {
    const text = JSON.stringify(await fullState($), null, 1)
    if (text === stateWritten) return
    stateWritten = text
    await $.fs.write(`${log.dir()}/state.json`, `${text}\n`)
  } catch {
    // The state file is a convenience. The log itself has been written.
  }
}

/** Whether the debug log's switch in the data folder says on. */
async function isDebugSwitchedOn($: EngineInterface): Promise<boolean> {
  try {
    return parseSwitch(JSON.parse(await $.fs.read(debugSwitchPath(dataRoot))))
  } catch {
    // No switch, or not JSON: off.
    return false
  }
}

/** The names in a folder of the debug log, or none when it is not there. */
async function debugNames($: EngineInterface, path: string): Promise<string[]> {
  try {
    return (await $.fs.list(path)).map(entry => entry.name)
  } catch {
    return []
  }
}

/** Starts this session's debug log, when the switch in the data folder says it is on. */
async function startDebug($: EngineInterface, settings: Settings): Promise<void> {
  if (tracer.isOn() || dataRoot === '') return
  try {
    if (!(await isDebugSwitchedOn($))) return
    const sessionId = await $.session.id()
    const root = debugRoot(dataRoot)
    const dir = `${root}/${sessionFolder(await debugNames($, root), Date.now(), sessionId)}`
    const log = createDebugLog({ write: (path, text) => $.fs.write(path, text), list: path => debugNames($, path) }, dir)
    await markHome($)
    await log.open()
    tracer.attach(log, sessionId)
    stateWritten = ''
    const [claudeCode, own] = await Promise.all([$.session.version(), ownVersion($)])
    trace($, 'meta', 'log started', () => ({
      sessionId,
      claudeCode,
      plugin: own.version === null ? null : versionText(own.version),
      pluginRoot: $.plugin.root,
      dataRoot,
      repoRoot,
      mode,
      settings,
    }))
  } catch (error) {
    $.ui.log(`could not start the debug log: ${String(error)}`, { to: 'debug' })
  }
}

/** Stops the debug log, writing what it still holds. */
async function stopDebug($: EngineInterface, why: string): Promise<void> {
  if (!tracer.isOn()) return
  trace($, 'meta', 'log stopped', () => ({ why }))
  flushTimer?.cancel()
  flushTimer = null
  await flushDebug($)
  tracer.detach()
}

/** `/bsd debug`: switches the debug log, says where it is, writes down what just happened, or deletes the logs. */
async function debugCommand($: EngineInterface, settings: Settings, request: DebugRequest): Promise<string> {
  await resolveHome($)
  if (dataRoot === '') return 'There is no home directory, so there is nowhere to keep a debug log.'
  const root = debugRoot(dataRoot)

  if (request === 'on' || request === 'off') {
    await markHome($)
    await $.fs.write(debugSwitchPath(dataRoot), `${JSON.stringify({ on: request === 'on', since: await $.clock.now() })}\n`)
    if (request === 'off') {
      await stopDebug($, 'switched off')

      return `The debug log is off. What was logged is kept in ${root}, and /bsd debug clear deletes it.`
    }
    if (mode !== 'off') await startDebug($, settings)
    const where = tracer.log()?.dir()

    return [
      `The debug log is on. It records everything the tutor does, your code and prompts included, in ${root}.`,
      where === undefined ? 'It starts when the tutor is switched on.' : `This session writes ${where}.`,
    ].join(' ')
  }

  if (request === 'status') {
    const isOn = await isDebugSwitchedOn($)
    const where = tracer.log()?.current()

    return [
      `The debug log is ${isOn ? 'on' : 'off'}.`,
      where !== undefined ? `This session is writing ${where}.` : isOn ? 'It starts when the tutor is switched on.' : '',
      `Logs are kept in ${root}.`,
    ]
      .filter(part => part !== '')
      .join(' ')
  }

  if (request === 'dump') {
    const latest = tracer.ring()
    const path = `${root}/dump-${sessionFolder([], Date.now(), await $.session.id())}.json`
    await markHome($)
    await $.fs.write(path, `${JSON.stringify({ at: await $.clock.now(), state: await fullState($), latest }, null, 1)}\n`)

    return `Wrote the tutor's state and its latest ${latest.length} records to ${path}.`
  }

  if ((await debugNames($, root)).length === 0) return `There are no debug logs in ${root}.`
  const wasOn = tracer.isOn()
  await stopDebug($, 'the logs were deleted')
  const isGone = await diskOf($).remove(root)
  if (wasOn) await startDebug($, settings)
  if (!isGone) return `Could not delete ${root}. Delete it by hand.`

  return wasOn ? `Deleted every debug log in ${root}. This session carries on in a new one.` : `Deleted every debug log in ${root}.`
}

/**
 * One request to a model. What was asked and what came back are kept for the
 * debug log, and how it went is told to everything that waits on Claude
 * answering.
 */
async function callModel(
  $: EngineInterface,
  settings: Settings,
  job: string,
  request: ModelCompleteRequest,
  signal?: AbortSignal,
): Promise<ModelCompleteResult> {
  // The first request after a wait is the one that finds out whether Claude is back.
  if (health.state === 'waiting' && (await $.clock.now()) >= health.until) health = stepHealth(health, { type: 'due' })
  if (health.state === 'recovering') health = stepHealth(health, { type: 'probing' })
  const started = Date.now()
  const result = signal === undefined ? await $.model.complete(request) : await $.model.complete(request, { signal })
  trace($, 'model', job, () => ({ request, result }), Date.now() - started)
  // Cut short by the tutor itself, as a lookup is when its file is saved again: that says nothing about Claude.
  if (signal?.aborted !== true) await noteOutcome($, settings, job, outcomeOf(result))
  else await probeEnded($, settings)

  return result
}

/** The one scheduler, made the first time something has to be done later. */
function schedulerOf($: EngineInterface): Scheduler {
  deadlines ??= createScheduler({
    now: () => $.clock.now(),
    after: (ms, fn) => $.clock.after(ms, fn),
    fail: (name, error) => fail($, `the ${name} deadline failed`, error),
  })

  return deadlines
}

/** Reads how close the plan's usage limit is. The call is free. */
async function readPressure($: EngineInterface): Promise<Pressure> {
  try {
    pressure = pressureOf((await $.session.usage()).rateLimits, await $.clock.now())
  } catch {
    // No reading is no reason to hold back.
    pressure = NO_PRESSURE
  }

  return pressure
}

/**
 * How a request went: a model's, a subagent's, or the conversation's own.
 * A failure that is the service's makes every background job wait, longer
 * after each one in a row. An answer ends the wait for all of them.
 */
async function noteOutcome($: EngineInterface, settings: Settings, job: string, outcome: Outcome): Promise<void> {
  const before = health
  const wasBlocked = jobBlocks.has(job)
  if (outcome.ok) {
    health = stepHealth(health, { type: 'answered' })
    jobBlocks.delete(job)
  } else if (outcome.trouble === 'job') {
    // This job's own setting is refused, such as a model that does not exist. The others carry on.
    if (job !== 'conversation') jobBlocks.set(job, outcome.detail)
  } else {
    // A rate limit is the plan's window when the plan says one is spent: the wait is then until it reopens.
    const spent = outcome.trouble === 'rate-limit' ? await readPressure($) : null
    health = stepHealth(health, {
      type: 'failed',
      trouble: outcome.trouble,
      detail: outcome.detail,
      at: await $.clock.now(),
      random: Math.random(),
      resetsAt: spent !== null && spent.percent >= 99 ? spent.resetsAt : null,
    })
  }
  if (health === before && wasBlocked === jobBlocks.has(job)) return

  trace($, 'state', 'health', () => ({ health, job, outcome, blocked: Object.fromEntries(jobBlocks) }))
  const plan = schedulerOf($)
  if (health.state === 'waiting') plan.set('health', health.until, () => healthDue($, settings))
  else plan.cancel('health')
  await wake($, settings)
}

/** The wait after a failure is over: the next job that wants to ask may, and finds out for the rest. */
async function healthDue($: EngineInterface, settings: Settings): Promise<void> {
  health = stepHealth(health, { type: 'due' })
  trace($, 'state', 'health', () => ({ health }))
  await wake($, settings)
}

/**
 * The request that was finding out whether Claude is back ended without
 * saying: it was cut short, or never started. The next job that wants to ask
 * finds out instead.
 */
async function probeEnded($: EngineInterface, settings: Settings): Promise<void> {
  if (health.state !== 'probing') return
  health = stepHealth(health, { type: 'abandoned' })
  trace($, 'state', 'health', () => ({ health, why: 'the request finding out did not say' }))
  await wake($, settings)
}

/** Something that held work back has changed. Everything that was waiting looks again at whether it can go. */
async function wake($: EngineInterface, settings: Settings): Promise<void> {
  if (mode === 'off') return
  await planLook($, settings)
  await planReview($, settings)
  await explainer?.wake()
  void refreshView($)
}

/** The facts the play-by-play's state is worked out from. */
function playFacts(settings: Settings): PlayFacts {
  return {
    mode: mode === 'paused' ? 'paused' : 'on',
    isReady: isWatchReady,
    hasRepo: repoRoot !== '',
    isFollowing: !isDriver,
    isAutomatic: settings.playByPlay.isAutomatic,
    hasPending: watcher?.hasPending() ?? false,
    lastChangeAt,
    lastLookAt,
    isLooking,
    failures,
    failure: lookFailure,
    quietMs: settings.playByPlay.quietMs,
    minGapMs: settings.playByPlay.minGapMs,
    health,
    pressure,
    jobBlock: jobBlocks.get('play-by-play') ?? '',
  }
}

/** Tells the pane what the play-by-play is doing, when that is not what it already says. */
async function showPlay($: EngineInterface, settings: Settings): Promise<Play> {
  const play = playOf(playFacts(settings))
  const next = watchOf(play, lastLookAt, healthLine({ play, health, pressure, lastScanMs, failing: failingNow() }))
  const shown = await read($, watchAtom)
  if (shown.state !== next.state || shown.line !== next.line || shown.lastLookAt !== next.lastLookAt || (shown.health ?? '') !== (next.health ?? '')) {
    trace($, 'state', 'watch', () => ({ ...next, play }))
    await update($, watchAtom, (): Watch => next)
  }

  return play
}

/**
 * Works out when a look is next due and sets the deadline for it. Called
 * whenever a fact that rests on has changed: a save, a look that ended, a
 * failure, the plan's limit. `notBefore` keeps a deadline that has just
 * fired without a look from firing again at once.
 */
async function planLook($: EngineInterface, settings: Settings, notBefore = 0): Promise<void> {
  const at = mode === 'on' ? wakeAt(playFacts(settings)) : null
  const plan = schedulerOf($)
  if (at === null) plan.cancel('look')
  else if (plan.at('look') !== Math.max(at, notBefore)) plan.set('look', Math.max(at, notBefore), () => lookIfDue($, settings))
  await showPlay($, settings)
}

/** The look's deadline: starts the look when it is due by the facts as they are now, and plans again when it is not. */
async function lookIfDue($: EngineInterface, settings: Settings): Promise<void> {
  if (mode !== 'on' || watcher === null) return
  // Free, and right before anything is spent: how close the plan's limit is.
  await readPressure($)
  const now = await $.clock.now()
  if (isLookDue(playFacts(settings), now)) await look($, settings, false)
  else await planLook($, settings, now + 1000)
}

/**
 * Something happened that Claude Code told the mod about (a prompt, the end
 * of a turn, a key in the pane), so the working tree is looked at now and
 * not at the next scan.
 */
async function kick($: EngineInterface, settings: Settings, why: string): Promise<void> {
  if (mode !== 'on' || watcher === null) return
  const now = await $.clock.now()
  activeAt = now
  trace($, 'scan', 'asked for', () => why)
  schedulerOf($).set('scan', now, () => scan($, settings))
}

/** A source file's text by its path from the repository root, or null when it cannot be read. */
async function readSource($: EngineInterface, root: string, path: string): Promise<string | null> {
  const started = Date.now()
  let text: string | null = null
  try {
    text = await $.fs.read(`${root}/${path}`)
  } catch {
    // Gone, or not something that can be read.
  }
  trace($, 'fs', 'source', () => ({ path, chars: text === null ? null : text.length }), Date.now() - started)

  return text
}

/** A key in the pane: recorded, and a reason to look at the working tree now. */
function touched($: EngineInterface, settings: Settings, name: string, detail?: () => unknown): void {
  trace($, 'ui', name, detail)
  void kick($, settings, 'a key in the pane')
}

/** What one of the tutor's own tools answers, kept for the debug log with what it was asked. */
function answered($: EngineInterface, input: { tool: string }, result: string): { result: string } {
  trace($, 'tool', input.tool.replace('mcp__backseat-driver__', ''), () => ({ input, result }))

  return { result }
}

async function loadTutor($: EngineInterface, chosen: Persona): Promise<void> {
  const root = $.plugin.root
  const file = (path: string): Promise<string> => $.fs.read(`${root}/${path}`)
  // Read side by side: `/bsd` waits for these, and nothing else.
  const [skill, lookText, reviewText, explainText, progressFile, bubbleText, engineering, voice] = await Promise.all([
    file('skills/tutor/SKILL.md'),
    file('prompts/play-by-play.md'),
    file('prompts/deep-review.md'),
    file('prompts/explain.md'),
    file('prompts/progress.md'),
    file('prompts/speech-bubble.md'),
    readPersona($, 'engineering', chosen.engineering),
    readPersona($, 'voice', chosen.voice),
    resolveHome($),
  ])
  // Credits in HTML comments stay in the files and never reach a model.
  contract = stripComments(stripFrontmatter(skill))
  lookInstructions = stripComments(lookText)
  reviewInstructions = stripComments(reviewText)
  explainInstructions = stripComments(explainText)
  progressInstructions = stripComments(progressFile)
  bubbleInstructions = stripComments(bubbleText)
  persona = personaPrompt({ engineering, voice })
}

/** One half of the persona, from `personas/<half>/<name>.md`, or '' for the default. */
async function readPersona($: EngineInterface, half: 'voice' | 'engineering', name: string): Promise<string> {
  if (name === DEFAULT_PERSONA) return ''
  try {
    return stripFrontmatter(await $.fs.read(`${$.plugin.root}/personas/${half}/${name}.md`))
  } catch {
    $.ui.log(`no ${half} persona called "${name}"`, { to: 'debug' })
    trace($, 'error', 'no such persona', () => ({ half, name }))

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
      const started = Date.now()
      let text: string | null = null
      try {
        text = await $.fs.read(path)
      } catch {
        // Not there.
      }
      trace($, 'fs', 'read', () => ({ path, chars: text === null ? null : text.length }), Date.now() - started)

      return text
    },
    write: async (path, text) => {
      const started = Date.now()
      try {
        await $.fs.write(path, text)
      } catch (error) {
        trace($, 'fs', 'write failed', () => ({ path, chars: text.length, error: String(error) }), Date.now() - started)
        throw error
      }
      trace($, 'fs', 'write', () => ({ path, chars: text.length }), Date.now() - started)
    },
    list: async path => {
      const started = Date.now()
      let names: string[] = []
      try {
        names = (await $.fs.list(path)).map(entry => entry.name)
      } catch {
        // No such folder.
      }
      trace($, 'fs', 'list', () => ({ path, names }), Date.now() - started)

      return names
    },
    remove: async path => {
      let isGone = false
      let why = ''
      if (!isRemovable(dataRoot, path)) why = 'not something the tutor may delete'
      else {
        try {
          // The marker says the folder is the tutor's own. Without it nothing is deleted.
          if (!(await $.fs.exists(`${dataRoot}/${MARKER}`))) why = 'the folder has no marker'
          else isGone = (await $.process.run(['rm', '-rf', '--', path], { timeoutMs: 15_000 })).exitCode === 0
        } catch (error) {
          why = String(error)
        }
      }
      trace($, 'fs', isGone ? 'remove' : 'remove refused', () => ({ path, why }))

      return isGone
    },
  }
}

/**
 * The tutor's JSON files. Every read and change of them goes through the
 * store, which keeps two sessions from undoing each other's changes and never
 * takes a half-written file for an empty one.
 */
let dataStore: Store | null = null
/** What stands in for the store where there is no data folder: nothing is kept. */
const NO_STORE = plainStore(memoryDisk())

function storeOf($: EngineInterface): Store {
  if (dataRoot === '') return NO_STORE
  if (dataStore !== null) return dataStore
  const disk = diskOf($)
  const locks = createLocks(
    {
      git: (args, stdin) => git($, undefined, args, false, stdin),
      modifiedAt: async path => {
        try {
          return (await $.fs.stat(path)).mtimeMs
        } catch {
          return null
        }
      },
      read: async path => {
        try {
          return await $.fs.read(path)
        } catch {
          return null
        }
      },
      write: (path, text) => $.fs.write(path, text),
      now: () => $.clock.now(),
      sleep: ms => $.clock.sleep(ms),
      random: () => Math.random(),
      owner: () => $.session.id(),
    },
    lockRepoPath(dataRoot),
  )
  dataStore = createStore({
    // The marker goes in before anything else does: it is what allows deleting inside the folder later.
    disk: {
      ...disk,
      write: async (path, text) => {
        await markHome($)
        await disk.write(path, text)
      },
    },
    locks: {
      acquire: async name => {
        await markHome($)

        return locks.acquire(name)
      },
      release: lock => locks.release(lock),
    },
    sleep: ms => $.clock.sleep(ms),
    note: (what, detail) => trace($, 'store', what, () => detail),
  })

  return dataStore
}

/** Makes sure the data folder carries its marker before anything is written into it. */
async function markHome($: EngineInterface): Promise<void> {
  if (isHomeMarked || dataRoot === '') return
  if (!(await $.fs.exists(`${dataRoot}/${MARKER}`))) await $.fs.write(`${dataRoot}/${MARKER}`, MARKER_TEXT)
  isHomeMarked = true
}

async function openPane($: EngineInterface): Promise<void> {
  await $.ui.open({ id: 'backseat-driver', title: 'Backseat' })
  // Not awaited: the Settings tab can wait for its rows, switching on cannot.
  void showSettings($)
}

/** Reads the plugin's own `/config` rows again, for the Settings tab. */
async function showSettings($: EngineInterface): Promise<void> {
  try {
    const rows = settingRows(await $.config.list(), $.plugin.name)
    await update($, settingsAtom, () => rows)
  } catch (error) {
    fail($, 'could not read the settings from /config', error)
  }
}

/**
 * Changes one of the plugin's `/config` rows from the Settings tab, as the
 * person would in `/config`. Claude Code then loads the mod again with the
 * new value, so the tab shows it at once and the rest follows the reload.
 */
async function changeSetting($: EngineInterface, row: SettingRow, picked: string): Promise<void> {
  await update($, settingsAtom, rows => withSetting(rows, row.key, picked))
  try {
    const { deny } = await $.config.set({ key: row.key, value: configValue(row, picked) })
    trace($, 'state', 'setting', () => ({ key: row.key, value: picked, deny }))
    if (deny !== undefined) {
      await update($, settingsAtom, rows => withSetting(rows, row.key, row.value))
      $.ui.toast(`${row.label} stays ${row.value}: ${deny}`)
    }
  } catch (error) {
    await update($, settingsAtom, rows => withSetting(rows, row.key, row.value))
    fail($, `could not change ${row.key}`, error)
  }
}

function stopTalking(): void {
  talkTimer?.cancel()
  talkTimer = null
}

function stopAnimating(): void {
  stopTalking()
  blinkTimer?.cancel()
  blinkTimer = null
}

/** Gives the animated persona a new line, which it says one word a tick. '' leaves it quiet. */
async function say($: EngineInterface, text: string): Promise<void> {
  const line = speech(text)
  if (text !== '') trace($, 'state', 'speech', () => text)
  await update($, speechAtom, () => line)
  stopTalking()
  // Switched off while the line was being written: nothing may keep running.
  if (line.text === '' || mode === 'off') return
  talkTimer = $.clock.every(TALK_MS, () => {
    void talkOn($)
  })
}

/** One tick of talking. The timer stops once the line is out. */
async function talkOn($: EngineInterface): Promise<void> {
  const said = await update($, speechAtom, nextTick)
  if (!isTalking(said)) stopTalking()
}

/** Shuts a resting character's eyes for a moment. */
async function blink($: EngineInterface): Promise<void> {
  if (mode !== 'on' || talkTimer !== null) return
  await update($, speechAtom, said => ({ ...said, isBlinking: true }))
  $.clock.after(BLINK_SHUT_MS, () => {
    void update($, speechAtom, said => ({ ...said, isBlinking: false }))
  })
}

/**
 * Brings the animated persona on stage. Switched on, it says hello. After a
 * reload, its timers are gone, so a line it was in the middle of is finished.
 */
async function startAnimating($: EngineInterface, settings: Settings, isFresh: boolean): Promise<void> {
  stopAnimating()
  if (!settings.isAnimated) {
    await update($, speechAtom, () => SILENT)

    return
  }
  blinkTimer = $.clock.every(BLINK_MS, () => {
    void blink($)
  })
  if (isFresh) await say($, avatarFor(settings.persona.voice).hello)
  else await update($, speechAtom, finished)
}

async function setReview($: EngineInterface, change: Partial<Review>): Promise<void> {
  trace($, 'state', 'review', () => change)
  await update($, reviewAtom, (review): Review => withReviewChange(review, change))
}

/** A file's size and modification time as one string, or '' when it is not there. */
async function fileStamp($: EngineInterface, path: string): Promise<string> {
  if (path === '') return ''
  quiet.stats += 1
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
  isNetwork = false,
  stdin?: string,
): Promise<{ exitCode: number; stdout: string; stderr?: string }> {
  const started = Date.now()
  // What git is asked to do, past any option that comes before it.
  const verb = args.find(arg => !arg.startsWith('--')) ?? ''
  try {
    // Over the network git must never ask for a password or a passphrase: there is nobody at its terminal.
    const env = isNetwork ? { GIT_TERMINAL_PROMPT: '0', GIT_SSH_COMMAND: 'ssh -o BatchMode=yes' } : undefined
    const result = await $.process.run(['git', '--no-optional-locks', ...args], { cwd, timeoutMs: isNetwork ? 30_000 : 15_000, env, stdin })
    // The watcher asks for the status at every poll. An answer that is the same as the last one is counted, not logged.
    const isQuietPoll = args[0] === 'status' && result.exitCode === 0 && result.stdout === lastStatus
    if (args[0] === 'status') lastStatus = result.stdout
    if (isQuietPoll) quiet.polls += 1
    else trace($, 'git', verb, () => ({ args, cwd, exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr }), Date.now() - started)

    return result
  } catch (error) {
    // Git is missing, or took too long.
    trace($, 'git', verb, () => ({ args, cwd, error: String(error) }), Date.now() - started)

    return { exitCode: 1, stdout: '' }
  }
}

/** `claude plugin ...`, for updating or removing an installed copy. Resolves to what it printed, or why it failed. */
async function claudeCli($: EngineInterface, argv: readonly string[]): Promise<{ ok: boolean; output: string }> {
  const started = Date.now()
  try {
    const result = await $.process.run(['claude', ...argv.slice(1)], { timeoutMs: 180_000 })
    trace($, 'process', 'claude', () => ({ argv, exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr }), Date.now() - started)

    return { ok: result.exitCode === 0, output: `${result.stdout}${result.stderr}`.trim() }
  } catch (error) {
    trace($, 'process', 'claude', () => ({ argv, error: String(error) }), Date.now() - started)

    return { ok: false, output: String(error) }
  }
}

/**
 * How this copy was installed. A clone counts only when its top folder is
 * this repository's own layout, so that a dotfiles repository around
 * ~/.claude is never mistaken for one and pulled.
 */
async function detectInstall($: EngineInterface): Promise<Install> {
  await resolveHome($)
  const root = $.plugin.root
  const top = (await git($, root, ['rev-parse', '--show-toplevel'])).stdout.trim()
  if (top !== '' && root === `${top}/plugin` && (await $.fs.exists(`${top}/.claude-plugin/marketplace.json`))) {
    return { kind: 'clone', top }
  }
  const config = (await $.env.get('CLAUDE_CONFIG_DIR')) ?? `${home}/.claude`
  if (root.startsWith(`${config}/plugins/synced/`)) return { kind: 'synced' }
  try {
    const entry = installedEntry(await $.fs.read(`${config}/plugins/installed_plugins.json`), root)
    if (entry !== null && entry.marketplace !== '') return { kind: 'installed', ...entry }
  } catch {
    // No such file: nothing is installed through a marketplace.
  }

  return { kind: 'unknown' }
}

/** The version Claude Code has installed for a plugin id, from `installed_plugins.json`, or ''. */
async function installedVersion($: EngineInterface, id: string): Promise<string> {
  const config = (await $.env.get('CLAUDE_CONFIG_DIR')) ?? `${home}/.claude`
  try {
    const data = JSON.parse(await $.fs.read(`${config}/plugins/installed_plugins.json`)) as { plugins?: Record<string, { version?: unknown }[]> }
    const version = data.plugins?.[id]?.[0]?.version

    return typeof version === 'string' ? version : ''
  } catch {
    return ''
  }
}

/** Claude Code's own clone of a marketplace, or '' when it keeps none. */
async function marketplaceClone($: EngineInterface, name: string): Promise<string> {
  const config = (await $.env.get('CLAUDE_CONFIG_DIR')) ?? `${home}/.claude`
  try {
    return marketplaceLocation(await $.fs.read(`${config}/plugins/known_marketplaces.json`), name)
  } catch {
    return ''
  }
}

/** This copy's version, from its own manifest. */
async function ownVersion($: EngineInterface): Promise<{ version: ReturnType<typeof manifestVersion>; repository: string }> {
  try {
    const manifest = await $.fs.read(`${$.plugin.root}/.claude-plugin/plugin.json`)

    return { version: manifestVersion(manifest), repository: manifestRepository(manifest) }
  } catch {
    return { version: null, repository: '' }
  }
}

/**
 * Asks upstream for a newer release, at most every six hours, and says so in
 * the pane. The answer is kept in `update.json`, so that the notice shows at
 * once in a new session without asking again.
 */
async function checkForUpdate($: EngineInterface, settings: Settings): Promise<void> {
  if (!settings.isUpdateCheckOn || dataRoot === '') return
  // The setting Claude Code itself uses to keep everything inessential off the network.
  if ((await $.env.get('CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC')) !== undefined) return
  try {
    const { version, repository } = await ownVersion($)
    if (version === null) return
    const stored = parseUpdateRecord(await storeOf($).read(`${dataRoot}/update.json`))
    const now = await $.clock.now()
    let latest = stored.latest
    if (isCheckDue(stored, now)) {
      // Releases come from where this copy came from: the clone's origin, or the marketplace's.
      const install = await detectInstall($)
      const from = install.kind === 'clone' ? install.top : install.kind === 'installed' ? await marketplaceClone($, install.marketplace) : ''
      const origin = from === '' ? '' : (await git($, from, ['remote', 'get-url', 'origin'])).stdout.trim()
      const url = origin === '' ? repository : origin
      if (url === '') return
      const listed = await git($, from === '' ? undefined : from, tagsArgs(url), true)
      const newest = listed.exitCode === 0 ? newestRelease(listed.stdout) : null
      // Offline, or no access: try again at the next switch-on, not in six hours.
      if (listed.exitCode !== 0) return
      latest = newest === null ? '' : versionText(newest)
      await storeOf($).update(`${dataRoot}/update.json`, () => ({ checkedAt: now, latest }))
    }
    await update($, updateAtom, () => updateNotice(version, parseVersion(latest)))
  } catch (error) {
    fail($, 'update check failed', error)
  }
}

/** `/bsd update`: fetches the newest release the way this copy was installed. */
async function runUpdate($: EngineInterface): Promise<void> {
  const install = await detectInstall($)
  if (install.kind === 'clone') {
    const changed = (await git($, install.top, ['status', '--porcelain', '--untracked-files=no'])).stdout.trim()
    if (changed !== '') {
      $.ui.log(`This copy, in ${install.top}, has changes of its own, so it was not updated. Commit or stash them, then run /bsd update again.`)

      return
    }
    const before = (await git($, install.top, ['rev-parse', 'HEAD'])).stdout.trim()
    const pulled = await git($, install.top, ['pull', '--ff-only'], true)
    if (pulled.exitCode !== 0) {
      $.ui.log(`git pull in ${install.top} did not work: ${(pulled.stderr ?? pulled.stdout).trim().split('\n')[0] ?? 'no reason given'}. Nothing was changed.`)

      return
    }
    await update($, updateAtom, () => '')
    const after = (await git($, install.top, ['rev-parse', 'HEAD'])).stdout.trim()
    $.ui.log(
      after === before
        ? `Already up to date: ${install.top} has everything its origin has.`
        : 'Updated. The plugin reloads by itself in a moment, and the tutor stays as it is.',
    )

    return
  }
  if (install.kind === 'installed') {
    const was = await installedVersion($, install.id)
    for (const argv of updateCommands(install)) {
      const result = await claudeCli($, argv)
      if (!result.ok) {
        $.ui.log(`${shellLine(argv)} did not work: ${result.output.split('\n')[0] ?? ''}. Run it in a terminal to see why.`)

        return
      }
    }
    await update($, updateAtom, () => '')
    const now = await installedVersion($, install.id)
    if (now !== '' && now === was) {
      $.ui.log(`Already up to date: ${now} is the newest release.`)

      return
    }
    $.ui.log(`Updated${now === '' ? '' : ` to ${now}`}. Reloading plugins: the tutor stays as it is.`)
    try {
      await $.command.run({ command: 'reload-plugins', args: '' })
    } catch {
      $.ui.log('Run /reload-plugins to start using the new version.')
    }

    return
  }
  if (install.kind === 'synced') {
    $.ui.log('This copy comes from your claude.ai organization, which sends updates by itself. Run /reload-plugins to start using one that has arrived.')

    return
  }
  $.ui.log('This copy was not installed from a marketplace or cloned with git, so it cannot update itself. Install it as the README says to get updates.')
}

/** Deletes the data folder itself, only when everything in it is the tutor's own. */
async function removeHome($: EngineInterface): Promise<boolean> {
  if (dataRoot === '') return true
  let names: string[]
  try {
    names = (await $.fs.list(dataRoot)).map(entry => entry.name)
  } catch {
    // Already gone.
    return true
  }
  if (!isOwnFolder(names)) return false
  try {
    return (await $.process.run(['rm', '-rf', '--', dataRoot], { timeoutMs: 15_000 })).exitCode === 0
  } catch {
    return false
  }
}

/** `/bsd uninstall`: removes the plugin after asking, and erases what it remembers when told to. */
async function runUninstall($: EngineInterface, settings: Settings): Promise<void> {
  await resolveHome($)
  const answer = await choose($, UNINSTALL_QUESTION, [UNINSTALL_KEEP, UNINSTALL_ERASE, UNINSTALL_ONLY])
  if (answer !== UNINSTALL_ERASE && answer !== UNINSTALL_ONLY) {
    $.ui.log('Nothing was removed.')

    return
  }
  if (answer === UNINSTALL_ERASE && !isPhrase((await choose($, PHRASE_QUESTION, PHRASE_OPTIONS)) ?? '')) {
    $.ui.log('Nothing was removed.')

    return
  }
  if (mode !== 'off') await switchTo($, 'off', settings)

  const said: string[] = []
  if (answer === UNINSTALL_ERASE) {
    said.push((await removeHome($)) ? 'Everything it remembered is erased.' : `Its data folder, ${dataRoot}, holds files it did not make, so it was left alone. Delete it by hand.`)
  } else if (dataRoot !== '') {
    said.push(`What it remembers is kept in ${dataRoot}. Delete that folder to erase it.`)
  }
  const install = await detectInstall($)
  if (install.kind === 'installed') {
    const argv = uninstallCommand(install)
    const result = await claudeCli($, argv)
    said.push(result.ok ? 'The plugin is uninstalled. It is gone from the next session on.' : `${shellLine(argv)} did not work. Run it in a terminal.`)
    said.push(`Its marketplace is still added. ${shellLine(['claude', 'plugin', 'marketplace', 'remove', install.marketplace])} removes it.`)
  } else if (install.kind === 'clone') {
    said.push(`This copy is loaded from ${install.top} with --plugin-dir. Stop passing that flag, and delete the folder if you no longer want it.`)
  } else if (install.kind === 'synced') {
    said.push('This copy comes from your claude.ai organization. Remove it there, under the organization plugin settings.')
  } else {
    said.push('This copy was not installed from a marketplace, so remove it the way you added it.')
  }
  said.push('Its settings, if you changed any, stay under pluginConfigs in your Claude Code settings.json.')
  $.ui.log(said.join(' '))
}



/** Tells the pane what they are working on, when that has changed since it was last told. */
async function showWorking($: EngineInterface, now: number): Promise<void> {
  const working = recorder === null ? NO_WORKING : recorder.working(now)
  const text = JSON.stringify(working)
  if (text === workingShown) return
  workingShown = text
  trace($, 'state', 'working', () => working)
  await update($, workingAtom, (): Working => working)
}

/** Writes the journal when it is due, or now when `isForced`. A write that fails is made again with the next one. */
async function flushJournal($: EngineInterface, journal: Recorder, now: number, isForced: boolean): Promise<void> {
  try {
    await journal.flush(now, isForced)
  } catch (error) {
    fail($, 'could not write the journal', error)
  }
}

/**
 * The journal's part of a scan: what was just saved and what it changed, and
 * the time the caret has spent where it is. No model is involved. Writing
 * the journal is not part of it: that has a deadline of its own.
 */
async function keepJournal($: EngineInterface, active: Watcher, now: number): Promise<void> {
  const journal = recorder
  if (journal === null) return
  const saved = active.changed()
  if (saved.length > 0) await journal.saved(saved, now)
  journal.settle(active.dirty())
  await journal.tick(now)
  await showWorking($, now)
}

/**
 * The journal's deadline came: a write is due, or the time the caret has
 * spent somewhere is worth an entry. The journal says when the next one is.
 */
async function journalDue($: EngineInterface): Promise<void> {
  const journal = recorder
  if (journal === null || mode === 'off') return
  const now = await $.clock.now()
  await journal.tick(now)
  await showWorking($, now)
  await flushJournal($, journal, now, false)
}

/**
 * Starts the journal of this project, once the watcher has read the tree.
 * `isFresh` is false when the tutor was already on and the module reloaded.
 */
async function startJournal($: EngineInterface, run: number, isFresh: boolean): Promise<void> {
  const root = repoRoot
  if (root === '') return
  const started = createRecorder({
    store: storeOf($),
    file: dataRoot === '' ? '' : journalPath(dataRoot, root),
    root,
    read: path => readSource($, root, path),
    head: async path => {
      const shown = await git($, root, ['show', `HEAD:${path}`])

      return shown.exitCode === 0 ? shown.stdout : null
    },
    wakeAt: at => {
      // Only the journal in use keeps the deadline: one that was replaced, or never taken up, has no say.
      if (recorder !== null && recorder !== started) return
      if (at === null) deadlines?.cancel('journal')
      else schedulerOf($).set('journal', at, () => journalDue($))
    },
  })
  const branch = (await git($, root, ['rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim()
  const now = await $.clock.now()
  await started.start(now, isFresh ? branch : null, watcher?.dirty() ?? [])
  // Where the caret was left before the tutor was watching earns no time until the editor writes again.
  await readFocus($)
  started.editor(focusText, now, true)
  // Switched off, or on again, in the meantime: this journal is no longer wanted.
  if (run !== engagement) return

  recorder = started
  await showWorking($, now)
}

/** Records what they said they are working on, or takes it back with ''. It is saved at once. */
async function sayWorking($: EngineInterface, said: string): Promise<void> {
  const journal = recorder
  if (journal === null) return
  const now = await $.clock.now()
  journal.say(said, now)
  await showWorking($, now)
  await flushJournal($, journal, now, true)
}

/** Asks what they are working on. Dismissing the dialog leaves everything as it is. */
async function askWorking($: EngineInterface): Promise<void> {
  const journal = recorder
  if (journal === null) return
  const working = journal.working(await $.clock.now())
  let answer = ''
  try {
    answer = await $.ui.ask(WORKING_QUESTION, { options: workingChoices(working), header: WORKING_HEADER })
  } catch {
    return
  }
  const said = chosen(answer, working)
  if (said !== null) await sayWorking($, said)
}

async function loadSubject($: EngineInterface, subject: string): Promise<Profile> {
  if (dataRoot === '') return emptyProfile()
  try {
    return parseProfile(await storeOf($).read(profilePath(dataRoot, subject)))
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
      const kept = parseProfile(await $.store.get(key))
      // A profile already in a file is the newer one.
      await storeOf($).update(profilePath(dataRoot, subject), stored => stored ?? kept)
      await $.store.delete(key)
    }
  } catch (error) {
    fail($, 'could not move profiles out of the store', error)
  }
}

/**
 * Registers the deep reviewer, with the user's model and thinking level and
 * what is on record about them. A subagent this mod spawns cannot be given
 * any of that at spawn time, so it is registered again whenever a profile changes.
 */
async function registerReviewer($: EngineInterface, settings: Settings): Promise<void> {
  if (repoRoot === '') return
  const prompt = reviewerSystem(reviewInstructions, [aboutPerson()], persona)
  trace($, 'agent', 'register', () => ({ model: settings.deepReview.model, effort: settings.deepReview.thinking, prompt }))
  await $.agent.register({
    name: 'deep-reviewer',
    description: REVIEWER_DESCRIPTION,
    prompt,
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
  // Read, changed and written as one step: another session may be changing this subject too.
  // The file as it was is kept beside it, because nothing can work a profile out again.
  const next =
    dataRoot === ''
      ? change(profiles.subjects[subject] ?? emptyProfile())
      : await updateJson(storeOf($), profilePath(dataRoot, subject), parseProfile, change, { keepBackup: true })
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
  for (const language of added) records.set(language, await loadRecord($, language))
  await setProgress($, { records: profiles.languages.map(language => records.get(language) ?? emptyRecord(language)) })
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
    name: 'progress',
    description:
      "Backseat Driver: the user's observed level in a language (beginner, junior, mid or senior), why, what the next level needs, what they are working on and what they have done lately, from their own commits only. Call it when they ask how they are doing, or what to work on next.",
    inputSchema: { type: 'object', properties: { language }, required: ['language'] },
  })
  await $.tool.register({
    name: 'profile',
    description:
      'Backseat Driver: read what is on record about the user for a language that is not in play in this project, for example to explain an idea by comparison with a language they know.',
    inputSchema: { type: 'object', properties: { language }, required: ['language'] },
  })
  await $.tool.register({
    name: 'working',
    description:
      'Backseat Driver: record what the user says they are working on right now, in their own words. Call it when they tell you, whether you asked or not. It is shown in the pane and given to the background reviewers. Pass an empty string when they take it back or tell you to work it out yourself.',
    inputSchema: {
      type: 'object',
      properties: {
        on: { type: 'string', description: "What they are working on, in a few of the user's own words. Empty to take it back." },
      },
      required: ['on'],
    },
  })
  await $.tool.register({
    name: 'activity',
    description:
      "Backseat Driver: read the journal of what the user has been doing in this project's code: where the last few minutes went, the files and lines they saved, where their editor's caret is, their commits, the notes raised, in order, and what their previous sitting here was about. Use it when a question depends on what they were just doing, or when they ask what they have been up to.",
    inputSchema: { type: 'object', properties: {} },
  })
}

/**
 * One look: the pending changes go to the play-by-play model, and its reply
 * becomes notes. `isAsked` is true when the user pressed "look now".
 */
async function look($: EngineInterface, settings: Settings, isAsked: boolean): Promise<void> {
  const active = watcher
  if (!isDriver) {
    if (isAsked) $.ui.toast(FOLLOWING)

    return
  }
  if (isLooking || active === null) return
  isLooking = true
  schedulerOf($).cancel('look')
  try {
    // Said before anything is read, so that a press of "look now" is answered at once.
    await showPlay($, settings)
    const changes = await active.collect()
    if (changes.length === 0) {
      active.settle([])
      trace($, 'look', 'nothing to look at', () => ({ isAsked }))
      if (isAsked) $.ui.toast('Nothing has changed since the last look.')

      return
    }

    trace($, 'look', 'start', () => ({ isAsked, files: changes.map(change => change.path), failures, lastChangeAt, lastLookAt }))
    await bringIntoPlay(
      $,
      changes.map(change => languageOf(change.path)).filter(language => language !== null),
    )
    const bubble: Bubble | null = !settings.isAnimated
      ? null
      : quietLooks >= QUIET_LOOKS_BEFORE_REMARK
        ? 'remark'
        : 'insight'
    const changedFiles = changes.map(change => change.path)
    const current = await currentInsights($, changedFiles)
    const brief = project === null ? '' : projectBrief(project, changedFiles, insight => current.has(insight))
    // What the journal says they have been doing, so that the changes are read in the light of it.
    const doing = recorder?.glance(await $.clock.now()) ?? ''
    const { prompt, shown } = playByPlayPrompt(changes, await read($, notesAtom), await read($, dismissedAtom), bubble, brief, doing)
    const result = await callModel($, settings, 'play-by-play', {
      model: settings.playByPlay.model,
      effort: settings.playByPlay.thinking,
      system: reviewerSystem(
        lookInstructions,
        [bubble === null ? '' : bubbleInstructions, aboutPerson()],
        persona,
      ),
      prompt,
      maxTokens: 2000,
      timeoutMs: 120_000,
    })
    const now = await $.clock.now()
    lastLookAt = now

    const outcome = outcomeOf(result)
    if (!outcome.ok || !result.isAnswered) {
      // Nothing is settled, so the same changes are tried again after the back-off.
      failures += 1
      lookFailure = outcome.ok ? 'no answer' : outcome.detail

      return
    }

    failures = 0
    lookFailure = ''
    // What was shown has been looked at, whether or not the reply can be used.
    active.settle(shown)
    const parsed = parseReply(result.text)
    if (parsed === null) trace($, 'look', 'reply not understood', () => ({ text: result.text }))
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
      const dealtWith = (await read($, notesAtom)).filter(note => reply.resolved.includes(note.id))
      await update($, notesAtom, open => applyReply(open, reply, paths, firstId, dismissed).notes)

      // Lesson memory: which ideas reached the pane, by language. A repeat
      // of a note that is already open is not a second time it came up.
      const added = (await read($, notesAtom)).filter(note => note.id >= firstId)
      for (const note of dealtWith) recorder?.add({ at: now, kind: 'fixed', path: note.file, line: note.line, text: note.topic })
      for (const note of added) recorder?.add({ at: now, kind: 'note', path: note.file, line: note.line, text: note.topic })
      recorder?.infer(reply.workingOn, paths, now)
      trace($, 'look', 'done', () => ({ shown: paths, added, dealtWith, hushedOut: parsed.notes.length - reply.notes.length, say: reply.say, workingOn: reply.workingOn }))
      await showWorking($, now)
      const raised = new Map<string, string[]>()
      // A decision point or an insight is not a mistake, so it is no lesson that keeps coming back.
      for (const note of added.filter(item => isProblem(item.kind))) {
        const subject = languageOf(note.file) ?? GENERAL
        raised.set(subject, [...(raised.get(subject) ?? []), note.topic])
      }
      for (const [subject, topics] of raised) {
        await saveSubject($, settings, subject, profile => withFlagged(profile, topics))
      }

      // The persona's line is about this look, so a quiet look leaves it quiet.
      if (bubble !== null) {
        quietLooks = reply.say === '' ? quietLooks + 1 : 0
        await say($, reply.say)
      }
    }
  } catch (error) {
    failures += 1
    lookFailure = 'an error'
    fail($, 'look failed', error)
  } finally {
    isLooking = false
    // The pane's line and the next look both follow from how this one went.
    await planLook($, settings)
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

/** Whether a review may start: none is running, being started, or being wound up. */
function isReviewFree(): boolean {
  return reviewAgentId === null && !isReviewBusy && endedReview === null
}

/**
 * Holds the review slot while a review is started or the end of one is
 * recorded. When no review is running afterwards, whatever is waiting gets
 * its turn: that is where a retry is timed and the next commit is taken up.
 */
async function withReviewSlot($: EngineInterface, settings: Settings, work: () => Promise<unknown>): Promise<void> {
  isReviewBusy = true
  try {
    await work()
  } finally {
    isReviewBusy = false
  }
  if (reviewAgentId === null) await planReview($, settings)
}

/**
 * Hands a scope to the deep reviewer. Its answer arrives later, at
 * `turn.complete`. Resolves false when the reviewer did not start. The
 * caller holds the review slot.
 */
async function startReview($: EngineInterface, settings: Settings, scope: ReviewScope): Promise<boolean> {
  const subject = scopeSubject(scope)
  await setReview($, { state: 'running', subject, text: '', isUnseen: false, decisions: [], insights: [] })
  // After a wait, this review is the request that finds out whether Claude is back.
  if (health.state === 'recovering') health = stepHealth(health, { type: 'probing' })
  let refusal = 'the reviewer did not start'
  await setReview($, { since: await $.clock.now() })
  try {
    const prompt = reviewRequest(
      scope,
      { overview: project === null ? '' : overviewLine(project), earlier: reviewDigest(reviews) },
      recorder?.glance(await $.clock.now()) ?? '',
    )
    const started = Date.now()
    const spawned = await $.agent.spawn({
      subagentType: 'backseat-driver:deep-reviewer',
      description: `Deep review of ${subject}`,
      prompt,
    })
    const agentId = spawned.deny === undefined ? await startedReviewer($, spawned.agentId) : undefined
    trace($, 'agent', 'spawn', () => ({ subject, kind: scope.kind, prompt, spawned, agentId }), Date.now() - started)
    if (agentId !== undefined) {
      reviewAgentId = agentId
      reviewScope = scope
      reviewFailure = ''
      reviewFailureNoted = null
      reviewStartedAt = await $.clock.now()
      // A reviewer that never reports back would otherwise keep every later review waiting behind it.
      schedulerOf($).set('review-watchdog', reviewStartedAt + WATCHDOG_MS, () => reviewWatchdog($, settings))

      return true
    }
    refusal = spawned.deny ?? refusal
  } catch (error) {
    fail($, 'deep review did not start', error)
  }
  await reviewFailed($, settings, scope, refusal, 'own')

  return false
}

/**
 * `/clear` and `/resume` empty `$.state`, and with it everything the pane
 * shows, while this module and the tutor carry on. So the pane's state is
 * read out when the conversation ends, and written back when the next one
 * starts.
 */
async function carryPane($: EngineInterface): Promise<void> {
  const [tab, notes, dismissed, selected, watch, review, shownProfiles, explain, progress, release, working] = await Promise.all([
    read($, tabAtom),
    read($, notesAtom),
    read($, dismissedAtom),
    read($, selectedAtom),
    read($, watchAtom),
    read($, reviewAtom),
    read($, profilesAtom),
    read($, explainAtom),
    read($, progressAtom),
    read($, updateAtom),
    read($, workingAtom),
  ])
  carried = { tab, notes, dismissed, selected, watch, review, profiles: shownProfiles, explain, progress, update: release, working }
}

/** Puts back what `carryPane` read out. Without it, as after `/branch`, what this module can work out again is shown again. */
async function restorePane($: EngineInterface, settings: Settings): Promise<void> {
  const kept = carried
  carried = null
  void showSettings($)
  if (kept === null) {
    await update($, profilesAtom, () => profiles)
    await showProgress($, settings)
    await showPlay($, settings)
    await refreshView($)

    return
  }
  trace($, 'state', 'pane restored', () => ({ notes: kept.notes.length, review: kept.review.state, tab: kept.tab }))
  await Promise.all([
    update($, tabAtom, () => kept.tab),
    update($, notesAtom, () => kept.notes),
    update($, dismissedAtom, () => kept.dismissed),
    update($, selectedAtom, () => kept.selected),
    update($, watchAtom, (): Watch => kept.watch),
    update($, reviewAtom, (): Review => kept.review),
    update($, profilesAtom, () => kept.profiles),
    update($, explainAtom, () => kept.explain),
    update($, progressAtom, (): ProgressView => kept.progress),
    update($, updateAtom, () => kept.update),
    update($, workingAtom, (): Working => kept.working),
  ])
}

/** What a session that does not drive says when it is asked for a look or a review. */
const FOLLOWING = 'Another session is driving Backseat Driver in this project. Ask for it there.'

/**
 * Tries for the project's lease, or renews it, and takes up or lays down the
 * driving when that changes who drives. Called at switch-on, when the
 * `lease` deadline comes, and after `/clear`, which gives the session
 * another id.
 */
async function keepLease($: EngineInterface, settings: Settings, run: number): Promise<void> {
  if (run !== engagement || mode === 'off') return
  if (repoRoot === '' || dataRoot === '') {
    // No lease to hold: nothing else can be driving.
    isDriver = true

    return
  }
  const path = leasePath(dataRoot, repoRoot)
  const me = await $.session.id()
  const now = await $.clock.now()
  let lease: Lease
  try {
    // A session that is waiting reads first: it changes nothing while the lease is held, and so takes no lock.
    // The one that drives is here to renew, and goes straight to the change.
    const seen = isDriver && leaseHolder === me ? null : parseLease(await storeOf($).read(path))
    lease =
      seen !== null && claimed(seen, me, now, leaseHolder) === seen
        ? seen
        : await updateJson(storeOf($), path, parseLease, stored => claimed(stored, me, now, leaseHolder))
  } catch (error) {
    // With no lease to go by, this session carries on as it was.
    fail($, 'could not read the lease', error)
    lease = { v: 1, session: isDriver ? me : '', at: now }
  }
  // Switched off, or on again, while the lease was being read: whoever did that decides who drives.
  if (run !== engagement) return
  const wasDriver = isDriver
  isDriver = lease.session === me
  if (isDriver) leaseHolder = me
  schedulerOf($).set('lease', nextLeaseCheck(lease, me, now, Math.random()), () => keepLease($, settings, engagement))
  if (isDriver === wasDriver) return
  trace($, 'state', 'lease', () => ({ isDriver, lease, me }))
  if (isDriver) await startDriving($, settings, run)
  else await stopDriving($, settings)
}

/** Gives the lease back, so that a session waiting for it does not have to wait for it to run out. */
async function giveLease($: EngineInterface, path: string, holder: string): Promise<void> {
  if (holder === '') return
  try {
    await updateJson(storeOf($), path, parseLease, stored => released(stored, holder))
  } catch (error) {
    fail($, 'could not give the lease back', error)
  }
}

/**
 * The session that drove this project is gone, or gave the lease back, and
 * this one drives now. The working tree as it stands is where it starts
 * from, as when the tutor is switched on.
 */
async function startDriving($: EngineInterface, settings: Settings, run: number): Promise<void> {
  await startWatching($, settings, run)
  if (run !== engagement || !isDriver) return
  await startJournal($, run, false)
  await loadQueue($)
  await planReview($, settings)
}

/**
 * Another session drives this project now: nothing here scans, looks,
 * reviews or keeps the journal. What the journal held goes to disk, for the
 * session that does.
 */
async function stopDriving($: EngineInterface, settings: Settings): Promise<void> {
  const plan = schedulerOf($)
  for (const name of ['scan', 'look', 'review', 'assess', 'review-timer', 'journal']) plan.cancel(name)
  const leaving = recorder
  recorder = null
  waiting = EMPTY_QUEUE
  if (leaving !== null) await flushJournal($, leaving, await $.clock.now(), true)
  await showWorking($, await $.clock.now())
  await showPlay($, settings)
}

/** The shared files' names, sizes and times, in one string. One listing per folder. */
async function sharedPrint($: EngineInterface): Promise<string> {
  const parts: string[] = []
  for (const folder of sharedFolders(dataRoot)) {
    try {
      for (const entry of await $.fs.list(folder)) {
        if (entry.name.endsWith('.json')) parts.push(`${folder}/${entry.name}:${entry.size}:${entry.mtimeMs}`)
      }
    } catch {
      // Not there yet: nothing has been recorded.
    }
  }

  return parts.sort().join('\n')
}

/**
 * What is on record about the person is shared by every session, in every
 * project, and any of them may change it: an answer, a hush, a level. When
 * the files say one did, they are read again here, and an open note about
 * something that was just hushed elsewhere leaves the pane.
 */
async function refreshShared($: EngineInterface, settings: Settings): Promise<void> {
  if (dataRoot === '' || mode === 'off') return
  sharedCheckedAt = await $.clock.now()
  const print = await sharedPrint($)
  if (print === sharedStamp) return
  const isFirst = sharedStamp === null
  sharedStamp = print
  // The first reading is of what was loaded a moment ago.
  if (isFirst) return

  const subjects: Record<string, Profile> = { ...profiles.subjects }
  for (const subject of Object.keys(profiles.subjects)) subjects[subject] = await loadSubject($, subject)
  const areProfilesNew = JSON.stringify(subjects) !== JSON.stringify(profiles.subjects)
  if (areProfilesNew) {
    profiles = { ...profiles, subjects }
    await update($, profilesAtom, () => profiles)
    const open = await read($, notesAtom)
    const kept = open.filter(note => !isHushed(profiles, languageOf(note.file), note.topic))
    if (kept.length !== open.length) await update($, notesAtom, () => kept)
  }
  let isProgressNew = false
  if (settings.isProgressOn) {
    for (const language of profiles.languages) {
      const record = await loadRecord($, language)
      if (JSON.stringify(record) === JSON.stringify(records.get(language))) continue
      records.set(language, record)
      isProgressNew = true
    }
    if (isProgressNew) await setProgress($, { records: profiles.languages.map(language => records.get(language) ?? emptyRecord(language)) })
  }
  if (!areProfilesNew && !isProgressNew) return
  trace($, 'state', 'shared', () => ({ areProfilesNew, isProgressNew }))
  // The reviewer is told about the person when it is registered, so it is registered again.
  await registerReviewer($, settings)
}

/** The file that holds the commits waiting in this project. */
function queuePath(): string {
  return `${projectDir(dataRoot, repoRoot)}/queue.json`
}

/** Reads the waiting commits from the project's folder, without those that have waited too long. */
async function loadQueue($: EngineInterface): Promise<void> {
  const now = await $.clock.now()
  waiting = repoRoot === '' || dataRoot === '' ? EMPTY_QUEUE : current(parseQueue(await storeOf($).read(queuePath())), now)
}

/** Changes the waiting commits, in the project's folder and in memory. */
async function changeQueue($: EngineInterface, change: (queue: ReviewQueue) => ReviewQueue): Promise<void> {
  const now = await $.clock.now()
  if (repoRoot === '' || dataRoot === '') {
    waiting = change(current(waiting, now))

    return
  }
  try {
    waiting = await updateJson(storeOf($), queuePath(), parseQueue, stored => change(current(stored, now)))
  } catch (error) {
    // Not saved: it still waits for as long as this session runs.
    waiting = change(current(waiting, now))
    fail($, 'could not save the waiting commits', error)
  }
  // The tab says how many are waiting for their review.
  const count = waiting.commits.filter(commit => !commit.isReviewed).length
  if (count !== ((await read($, reviewAtom)).waiting ?? 0)) await setReview($, { waiting: count })
}

/** Reviews one commit now. Resolves false when no review started. The caller holds the review slot. */
async function reviewCommitNow($: EngineInterface, settings: Settings, commit: { hash: string; title: string }): Promise<boolean> {
  const shown = await git($, repoRoot, showCommitArgs(commit.hash))
  if (shown.exitCode !== 0 || shown.stdout.trim() === '') {
    // It is not in this repository any more: rebased away, or thrown out.
    trace($, 'agent', 'commit gone', () => ({ commit, exitCode: shown.exitCode }))
    await changeQueue($, queue => withoutCommit(queue, commit.hash))

    return false
  }

  return startReview($, settings, { kind: 'commit', hash: commit.hash, title: commit.title, patch: shown.stdout })
}

/**
 * A review ended without a review. For a commit that is waiting for one,
 * `how` says what that means:
 *
 * - `service`: Claude's doing, which `noteOutcome` has already been told. It
 *   is no try. The commit waits until Claude answers again, however long.
 * - `own`: nothing says why. It is one try: the next is timed, or the review
 *   is given up on.
 * - `final`: the person stopped it, or the model refused. It is not tried again.
 *
 * A commit whose review is given up on still counts toward the person's
 * progress. The caller holds the review slot, and what is next is planned
 * when it lets go.
 */
async function reviewFailed(
  $: EngineInterface,
  settings: Settings,
  scope: ReviewScope | null,
  detail: string,
  how: 'service' | 'own' | 'final',
): Promise<void> {
  // This review may have been the request finding out whether Claude is back, and it did not say.
  if (how !== 'service') await probeEnded($, settings)
  if (scope === null || scope.kind !== 'commit' || !settings.deepReview.isAfterCommit || !waiting.commits.some(commit => commit.hash === scope.hash)) {
    // Asked for by hand, timed, or the look around: nothing tries it again.
    await setReview($, { state: 'failed', ...(scope === null ? {} : { subject: scopeSubject(scope) }), text: detail })

    return
  }
  const subject = scopeSubject(scope)
  if (how === 'service' && (!mayAsk(health) || jobBlocks.has('deep-review'))) {
    reviewRetryAt = null
    await setReview($, { state: 'failed', subject, text: heldText(health, pressure, jobBlocks.get('deep-review'), null) })

    return
  }
  if (how !== 'final') await changeQueue($, queue => withAttempt(queue, scope.hash))
  if (how === 'final' || isSpent(waiting, scope.hash)) {
    await changeQueue($, queue => reviewed(queue, scope.hash))
    reviewRetryAt = null
    await setReview($, { state: 'failed', subject, text: how === 'final' ? detail : failedText(detail, null) })

    return
  }
  const attempts = waiting.commits.find(commit => commit.hash === scope.hash)?.attempts ?? 1
  reviewRetryAt = (await $.clock.now()) + retryMs(attempts)
  await setReview($, { state: 'failed', subject, text: failedText(detail, reviewRetryAt) })
}

/**
 * A review ended saying only "error", and its reason has arrived through
 * `classic.StopFailure`, or the moment it had for that has passed, in which
 * case `reason` is null.
 */
async function reviewVerdict($: EngineInterface, settings: Settings, reason: string | null): Promise<void> {
  const ended = endedReview
  if (ended === null) return
  schedulerOf($).cancel('review-verdict')
  await withReviewSlot($, settings, async () => {
    endedReview = null
    await reviewFailed($, settings, ended.scope, reason ?? 'error', reason === null ? 'own' : 'service')
  })
}

/** The running review has not reported back for a long time: it is looked for, and given up on when it is gone. */
async function reviewWatchdog($: EngineInterface, settings: Settings): Promise<void> {
  const agentId = reviewAgentId
  if (agentId === null) return
  const now = await $.clock.now()
  let status = 'gone'
  try {
    status = (await $.agent.list()).find(agent => agent.id === agentId)?.status ?? 'gone'
  } catch {
    // No list: it is taken to be gone.
  }
  // It reported back while the list was being read.
  if (reviewAgentId !== agentId) return
  trace($, 'agent', 'watchdog', () => ({ agentId, status, forMs: now - reviewStartedAt }))
  if ((status === 'running' || status === 'pending' || status === 'waiting') && now - reviewStartedAt < WATCHDOG_LIMIT_MS) {
    // Still at it. A hard review at a high thinking level takes long: it gets until the limit, and no longer.
    schedulerOf($).set('review-watchdog', reviewStartedAt + WATCHDOG_LIMIT_MS, () => reviewWatchdog($, settings))

    return
  }
  await withReviewSlot($, settings, async () => {
    const scope = reviewScope
    reviewAgentId = null
    reviewScope = null
    reviewFailure = ''
    reviewFailureNoted = null
    await reviewFailed($, settings, scope, 'the reviewer did not report back', 'own')
  })
}

/**
 * After a reload of the module, a review that was running is still running:
 * Claude Code runs it, not this module. When it is the review of the commit
 * that waits first, it is taken up again, so that its answer is collected and
 * the commit is not reviewed a second time. Any other review can no longer
 * be collected.
 */
async function adoptReview($: EngineInterface, settings: Settings): Promise<void> {
  if (reviewAgentId !== null || (await read($, reviewAtom)).state !== 'running') return
  const commit = nextToReview(waiting, { wantsReview: true, wantsAssessment: false })
  let agentId: string | undefined
  if (commit !== null) {
    const described = `Deep review of ${commitSubject(commit)}`
    try {
      agentId = (await $.agent.list()).find(agent => agent.description === described && (agent.status === 'running' || agent.status === 'pending' || agent.status === 'waiting'))?.id
    } catch {
      // No list: it cannot be found.
    }
  }
  trace($, 'agent', 'adopt', () => ({ commit, agentId }))
  if (commit === null || agentId === undefined || reviewAgentId !== null) {
    if (reviewAgentId === null) await setReview($, { state: 'failed', text: 'the plugin reloaded while it was running' })

    return
  }
  reviewAgentId = agentId
  reviewScope = { kind: 'commit', hash: commit.hash, title: commit.title, patch: '' }
  reviewFailure = ''
  reviewFailureNoted = null
  // When it started is not known any more. The time it gets counts from here.
  reviewStartedAt = await $.clock.now()
  schedulerOf($).set('review-watchdog', reviewStartedAt + WATCHDOG_MS, () => reviewWatchdog($, settings))
}

/** The look at the person's progress for a waiting commit, after the ones already under way. */
function startAssessment($: EngineInterface, settings: Settings, commit: Waiting): void {
  isAssessing = true
  queueProgress($, async () => {
    let isSettled = false
    try {
      // With its review for context, when it has one.
      const review = reviews.find(known => known.commit === shortHash(commit.hash))?.text ?? ''
      isSettled = await assessCommit($, settings, commit.hash, review)
    } finally {
      assessRetryAt = null
      if (isSettled) {
        await changeQueue($, queue => withoutCommit(queue, commit.hash))
      } else if (mayAsk(health) && !jobBlocks.has('progress')) {
        // Claude is answering, and nothing came of it all the same: that is one try.
        await changeQueue($, queue => withAttempt(queue, commit.hash))
        if (isSpent(waiting, commit.hash)) await changeQueue($, queue => withoutCommit(queue, commit.hash))
        else assessRetryAt = (await $.clock.now()) + retryMs(waiting.commits.find(known => known.hash === commit.hash)?.attempts ?? 1)
      }
      // Otherwise it was Claude's doing, which is no try: it waits until Claude answers again.
      isAssessing = false
      await planReview($, settings)
    }
  })
}

/**
 * Starts whatever the waiting commits need next, when nothing stands in the
 * way, and says in the Deep review tab what does when something stands.
 * Called whenever that may have changed: a commit, the end of a review,
 * Claude answering again, the plan's window reopening.
 */
async function planReview($: EngineInterface, settings: Settings): Promise<void> {
  const plan = schedulerOf($)
  if (mode !== 'on' || repoRoot === '' || !isDriver || waiting.commits.length === 0) {
    plan.cancel('review')
    plan.cancel('assess')

    return
  }
  const wanted = { wantsReview: settings.deepReview.isAfterCommit, wantsAssessment: settings.isProgressOn }
  // Under these settings nothing is left to do for these.
  const settled = settledIn(waiting, wanted)
  if (settled.length > 0) await changeQueue($, queue => settled.reduce(withoutCommit, queue))
  const now = await $.clock.now()
  await readPressure($)
  // What is held back waits, on disk. `wake` plans again when Claude answers, and the plan's window reopening is a deadline of its own.
  const reopens = pressure.level === 'held' ? pressure.resetsAt : null

  // The review of the oldest commit that has none yet. One review runs at a time, and its end plans again.
  if (isReviewFree()) {
    const commit = nextToReview(waiting, wanted)
    const held = commit === null ? '' : heldText(health, pressure, jobBlocks.get('deep-review'), reviewRetryAt !== null && reviewRetryAt > now ? reviewRetryAt : null)
    if (commit === null) plan.cancel('review')
    else if (held !== '') {
      if (reopens === null) plan.cancel('review')
      else plan.set('review', reopens, () => planReview($, settings))
      await setReview($, { state: 'failed', subject: commitSubject(commit), text: held, isUnseen: false })
    } else if (reviewRetryAt !== null && reviewRetryAt > now) {
      plan.set('review', reviewRetryAt, () => planReview($, settings))
    } else {
      plan.cancel('review')
      reviewRetryAt = null
      // One that does not start leaves a time for its next try, or a commit given up on: the slot plans that as it is let go.
      await withReviewSlot($, settings, () => reviewCommitNow($, settings, commit))
    }
  }

  // The look at the person's progress, for the oldest commit whose review is done with. It runs beside the next review.
  if (!isAssessing) {
    const commit = nextToAssess(waiting, wanted)
    if (commit === null) plan.cancel('assess')
    else if (heldText(health, pressure, jobBlocks.get('progress'), null) !== '') {
      if (reopens === null) plan.cancel('assess')
      else plan.set('assess', reopens, () => planReview($, settings))
    } else if (assessRetryAt !== null && assessRetryAt > now) {
      plan.set('assess', assessRetryAt, () => planReview($, settings))
    } else {
      plan.cancel('assess')
      assessRetryAt = null
      startAssessment($, settings, commit)
    }
  }
}

/** The fingerprint of the code an insight is about, as that code is now. Null when its file cannot be read. */
async function printForInsight($: EngineInterface, insight: Insight): Promise<{ print: string; of: 'symbol' | 'file' } | null> {
  if (explainer !== null) return explainer.printFor(insight.file, insight.symbol)
  try {
    return { print: sourcePrint(await $.fs.read(`${repoRoot}/${insight.file}`)), of: 'file' }
  } catch {
    return null
  }
}

/** The deep review's insights on these files whose code is still exactly what it was when they were written. */
async function currentInsights($: EngineInterface, files: readonly string[]): Promise<Set<KeptInsight>> {
  const current = new Set<KeptInsight>()
  for (const insight of project?.insights ?? []) {
    if (!files.includes(insight.file)) continue
    const now = await printForInsight($, insight)
    if (now !== null && now.of === insight.of && now.print === insight.print) current.add(insight)
  }

  return current
}

/** Reads what is known about this project from its cache. */
async function loadProject($: EngineInterface): Promise<void> {
  if (repoRoot === '' || dataRoot === '') {
    project = null
    reviews = []

    return
  }
  const folder = projectDir(dataRoot, repoRoot)
  project = parseProject(await storeOf($).read(`${folder}/project.json`), repoRoot)
  reviews = parseReviews(await storeOf($).read(`${folder}/reviews.json`))
}

/**
 * Keeps what a deep review said: its notes go into the project's cache, for
 * Explain and the play-by-play to read, and its text is kept for the next
 * review to follow up on. Resolves to the review as the person reads it.
 */
async function keepReview($: EngineInterface, scope: ReviewScope, answer: string): Promise<{ text: string; notes: ReviewNotes | null }> {
  const { text, notes } = splitReview(answer)
  if (repoRoot === '' || dataRoot === '') return { text, notes }
  try {
    const at = await $.clock.now()
    // A survey looked at the project as of HEAD. Work since a review may include uncommitted changes, so it names no commit.
    const commit = scope.kind === 'commit' ? shortHash(scope.hash) : scope.kind === 'survey' && lastHead !== '' ? shortHash(lastHead) : ''
    const prints = new Map<Insight, { print: string; of: 'symbol' | 'file' } | null>()
    for (const insight of notes?.insights ?? []) prints.set(insight, await printForInsight($, insight))

    const folder = projectDir(dataRoot, repoRoot)
    const root = repoRoot
    // Read, changed and written as one step: another session may be reviewing this project too.
    project = await updateJson(
      storeOf($),
      `${folder}/project.json`,
      stored => parseProject(stored, root),
      current => {
        const surveyed = scope.kind === 'survey' ? { ...current, isSurveyed: true } : current

        return notes === null ? surveyed : withReviewNotes(surveyed, notes, commit, at, insight => prints.get(insight) ?? null)
      },
    )
    if (scope.kind !== 'survey') {
      reviews = await updateJson(storeOf($), `${folder}/reviews.json`, parseReviews, kept =>
        withReview(kept, { commit, subject: scopeSubject(scope), at, text }),
      )
    }
  } catch (error) {
    fail($, "could not keep the deep review's notes", error)
  }

  return { text, notes }
}

/**
 * A project the tutor has not seen before gets one look around by the deep
 * review model, so that the faster models start from the big picture.
 */
async function maybeSurvey($: EngineInterface, settings: Settings, run: number): Promise<void> {
  if (project === null || project.isSurveyed || !isDriver || !isReviewFree()) return
  // With both triggers off, the deep review model runs only when asked, and that goes for this too.
  if (!settings.deepReview.isAfterCommit && settings.deepReview.everyMs === 0) return
  await withReviewSlot($, settings, async () => {
    const held = await readPressure($)
    if (held.level !== 'none' || !mayAsk(health) || run !== engagement || mode !== 'on') return
    await startReview($, settings, { kind: 'survey' })
  })
}

/**
 * Reviews everything since the previous deep review, committed or not. The
 * timer calls this, and so does "review now" in the pane. Asked for by hand
 * with nothing new, it reviews the last commit again.
 */
async function reviewSince($: EngineInterface, settings: Settings, isAsked: boolean): Promise<void> {
  if (mode === 'off' || (mode === 'paused' && !isAsked)) return
  if (!isDriver) {
    if (isAsked) $.ui.toast(FOLLOWING)

    return
  }
  // The timer holds back near the plan limit, and while Claude is not answering. A review asked for by hand does not.
  if (!isAsked && ((await readPressure($)).level === 'held' || !mayAsk(health))) return
  if (!isReviewFree()) {
    if (isAsked) $.ui.toast('A deep review is already running.')

    return
  }
  await withReviewSlot($, settings, () => startSince($, settings, isAsked))
}

/** What `reviewSince` starts, with the review slot held. */
async function startSince($: EngineInterface, settings: Settings, isAsked: boolean): Promise<void> {
  if (isAsked && repoRoot !== '') {
    // A commit that is waiting goes first. Asked for, it is tried whatever was holding it back.
    const commit = nextToReview(waiting, { wantsReview: true, wantsAssessment: false })
    if (commit !== null) {
      reviewRetryAt = null
      schedulerOf($).cancel('review')
      await reviewCommitNow($, settings, commit)

      return
    }
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
    await startReview($, settings, scope)
  } else if (isAsked) {
    const last = parseReflog((await git($, repoRoot, ['log', '-1', '--format=%H%x00commit: %s'])).stdout)
    if (last !== null) await reviewCommitNow($, settings, { hash: last.hash, title: commitTitle(last) })
  }
}

/** Sets the timer for the next timed deep review. */
function planTimedReview($: EngineInterface, settings: Settings, now: number): void {
  if (settings.deepReview.everyMs <= 0 || mode === 'off' || repoRoot === '' || !isDriver) return
  schedulerOf($).set('review-timer', now + settings.deepReview.everyMs, () => timedReview($, settings))
}

/** The timed deep review: everything since the previous one. Then the timer is set again. */
async function timedReview($: EngineInterface, settings: Settings): Promise<void> {
  await reviewSince($, settings, false)
  planTimedReview($, settings, await $.clock.now())
}

/** Notices when HEAD has moved, and starts a review when the move was a commit. */
async function checkHead($: EngineInterface, settings: Settings): Promise<void> {
  const stamp = await fileStamp($, headLog)
  if (stamp === headLogStamp) return
  headLogStamp = stamp

  const entry = parseReflog((await git($, repoRoot, REFLOG_ARGS)).stdout)
  if (entry === null || entry.hash === lastHead) return
  trace($, 'watch', 'head moved', () => ({ entry, isCommit: isCommit(entry), from: lastHead }))
  const previous = lastHead
  lastHead = entry.hash
  const movedAt = await $.clock.now()
  if (!isCommit(entry)) {
    // A checkout, pull, reset or rebase is not new work. Deep reviews start afresh from here.
    reviewedHead = entry.hash
    reviewedPrint = ''
    recorder?.add({ at: movedAt, kind: 'head', hash: entry.hash, text: entry.subject })
    recorder?.moved(movedAt)

    return
  }
  recorder?.add({ at: movedAt, kind: 'commit', hash: entry.hash, text: commitTitle(entry) })
  if (!settings.deepReview.isAfterCommit && !settings.isProgressOn) return
  // It waits, on disk, until it has been reviewed and looked at for the person's progress.
  // That happens at once when nothing stands in the way, and otherwise when Claude answers again or the plan allows.
  const isAmend = entry.subject.startsWith('commit (amend)')
  await changeQueue($, queue => withCommit(isAmend ? withoutCommit(queue, previous) : queue, { hash: entry.hash, title: commitTitle(entry) }, movedAt))
  await planReview($, settings)
}

/** Plans the next scan of the working tree, as soon after the last as `sensor.ts` says. */
function planScan($: EngineInterface, settings: Settings, now: number): void {
  if (mode !== 'on' || watcher === null || !isDriver) return
  schedulerOf($).set('scan', now + scanGapMs({ now, activeAt, lastScanMs }), () => scan($, settings))
}

/**
 * One scan of the working tree: what was saved, whether HEAD moved, where
 * the editor's caret is. A scan never calls a model. It tells the journal and
 * Explain what it found, and plans the look that a save makes due.
 */
async function scan($: EngineInterface, settings: Settings): Promise<void> {
  const active = watcher
  if (mode !== 'on' || active === null || !isDriver) return
  if (isScanning) {
    isScanWanted = true

    return
  }

  isScanning = true
  isScanWanted = false
  let now = 0
  try {
    const started = await $.clock.now()
    const hasChanged = await active.poll()
    now = await $.clock.now()
    lastScanMs = now - started
    if (hasChanged) {
      lastChangeAt = now
      activeAt = now
      trace($, 'watch', 'saved', () => ({ files: active.changed(), dirty: active.dirty(), scanMs: now - started }))
      // Read before the save is followed, so that what it sets going knows how close the limit is.
      await readPressure($)
      for (const path of active.changed()) watchedPaths.add(path)
      await followSaves($, active.changed(), now)
    }
    // Until an editor has written its focus file, looking for it this often is enough.
    if (!isWatchingClosely) await pollFocus($)
    await keepJournal($, active, now)
    await checkHead($, settings)
    // Another session may have changed what is on record about the person.
    if (now - sharedCheckedAt >= SHARED_CHECK_MS) await refreshShared($, settings)
    traceQuiet($)
    // A look is a deadline, set from what this scan found.
    await planLook($, settings)
  } catch (error) {
    fail($, 'looking at the working tree', error)
  } finally {
    isScanning = false
    if (now === 0) now = await $.clock.now()
    // Asked for again while this one ran: at once. Otherwise as soon as the cadence says.
    if (isScanWanted) schedulerOf($).set('scan', now, () => scan($, settings))
    else planScan($, settings, now)
  }
}

function stopWatching(): void {
  deadlines?.clear()
  isScanning = false
  isScanWanted = false
  isWatchReady = false
  health = HEALTHY
  jobBlocks.clear()
  reviewFailure = ''
  reviewFailureNoted = null
  isWatchingClosely = false
  isDriver = true
  leaseHolder = ''
  sharedStamp = null
  sharedCheckedAt = 0
  explainer?.stop()
  explainer = null
  watchedPaths.clear()
  project = null
  reviews = []
  focus = null
  focusStamp = ''
  focusText = null
  writtenView = ''
  viewedStamp = ''
  watcher = null
  // A review still running finishes in the background, and its answer is ignored.
  // The commits that were waiting stay in the project's folder, for the next time the tutor is on here.
  reviewAgentId = null
  reviewScope = null
  waiting = EMPTY_QUEUE
  isAssessing = false
  isReviewBusy = false
  reviewRetryAt = null
  assessRetryAt = null
  endedReview = null
}

/** Starts the watcher from the working tree as it stands now. `run` is the switch-on this belongs to. */
async function startWatching($: EngineInterface, settings: Settings, run: number): Promise<void> {
  stopWatching()
  lastChangeAt = null
  lastLookAt = null
  failures = 0
  lookFailure = ''
  lastScanMs = 0
  pressure = NO_PRESSURE

  const top = await git($, undefined, ['rev-parse', '--show-toplevel'])
  if (run !== engagement) return
  const root = top.stdout.trim()
  if (top.exitCode !== 0 || root === '') {
    repoRoot = ''
    headLog = ''
    isWatchReady = true
    await showPlay($, settings)

    return
  }

  const started = createWatcher({
    git: args => git($, root, args),
    read: path => readSource($, root, path),
    stat: async path => {
      quiet.stats += 1
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
  isWatchReady = true
  repoRoot = root
  headLog = log
  headLogStamp = stamp
  lastHead = tip
  // Deep reviews cover what happens from now on, not the history so far.
  reviewedHead = lastHead
  reviewedPrint = ''
  await showPlay($, settings)
  // Being switched on is something happening: the first scans come close together.
  const now = await $.clock.now()
  activeAt = now
  planScan($, settings, now)
  trace($, 'timer', 'watching started', () => ({ repoRoot: root, reviewEveryMs: settings.deepReview.everyMs, head: tip }))
  planTimedReview($, settings, now)
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
    // One file serves every session and every project. It is written by the session that drives this project,
    // and only while the editor's caret is in this project, or no editor has said where its caret is.
    const isOurs = isDriver && (focusText === null || parseFocusFile(focusText, repoRoot) !== null)
    if (text !== writtenView && dataRoot !== '' && isOurs) {
      writtenView = text
      await $.fs.write(`${dataRoot}/view.json`, viewFile(view, repoRoot, spot.source, await $.clock.now()))
    }
  } catch (error) {
    fail($, 'showing what Explain knows', error)
  }
}

async function setFocus($: EngineInterface, next: Focus, isAsked: boolean): Promise<void> {
  focus = next
  await refreshView($, isAsked)
}

/**
 * Reads the file an editor writes its cursor to, again when it has changed.
 * Resolves true when it had. One read serves the journal and Explain both.
 */
async function readFocus($: EngineInterface): Promise<boolean> {
  if (dataRoot === '') return false
  const path = focusPath(dataRoot)
  const stamp = await fileStamp($, path)
  if (stamp === focusStamp) return false
  let text: string | null = null
  if (stamp !== '') {
    try {
      text = await $.fs.read(path)
    } catch {
      // Gone between the stat and the read. The next poll looks again.
      return false
    }
  }
  focusStamp = stamp
  focusText = text

  return true
}

/** Explain follows the spot the editor's focus file names, when it names one in this repository. */
async function followEditor($: EngineInterface, now: number): Promise<void> {
  if (explainer === null || focusText === null) return
  // A file caught half-written does not parse. The editor's next write is read whole.
  const spot = parseFocusFile(focusText, repoRoot)
  if (spot === null) return
  editorFocusAt = now
  // An editor is reporting its cursor: from now on its file is checked ten times a second.
  watchClosely($)
  await setFocus($, { ...spot, source: 'editor' }, false)
}

/** Hands what an editor says, when it has said something new, to the journal and to Explain. */
async function pollFocus($: EngineInterface): Promise<void> {
  if (mode === 'off' || repoRoot === '' || !(await readFocus($))) return
  const now = await $.clock.now()
  activeAt = now
  recorder?.editor(focusText, now, false)
  await followEditor($, now)
}

/** Whether anyone can see the Explain view: the tab is open, or an editor is showing it. */
async function isWatched($: EngineInterface): Promise<boolean> {
  if ((await read($, tabAtom)) === 'explain') return true

  return focus?.source === 'editor' && (await $.clock.now()) - editorFocusAt < EDITOR_LIVE_MS
}

/**
 * While the Explain view is being watched, the file in focus is checked for
 * changes far more often than the working tree is scanned, so that an edit
 * takes the old explanation off the screen in a tenth of a second and an
 * editor's caret is followed as it moves. Each check plans the next, until
 * nobody is watching.
 */
async function fastPoll($: EngineInterface): Promise<void> {
  if (!isWatchingClosely) return
  let isStillWatched = false
  const started = await $.clock.now()
  try {
    if (explainer !== null) {
      await pollFocus($)
      const spot = focus
      if (spot !== null && (await fileStamp($, `${repoRoot}/${spot.path}`)) !== viewedStamp) await refreshView($)
      isStillWatched = explainer !== null && (await isWatched($))
    }
  } catch (error) {
    fail($, 'checking the spot in focus', error)
    isStillWatched = explainer !== null
  }
  // Switched off, or on again, while this check ran: whoever did that decides what runs now.
  if (!isWatchingClosely) return
  if (!isStillWatched) {
    trace($, 'timer', 'nobody is watching the focus')
    isWatchingClosely = false

    return
  }
  const now = await $.clock.now()
  schedulerOf($).set('focus', now + focusGapMs(now - started), () => fastPoll($))
}

function watchClosely($: EngineInterface): void {
  if (explainer === null || isWatchingClosely) return
  isWatchingClosely = true
  trace($, 'timer', 'watching the focus closely', () => ({ everyMs: FOCUS_SCAN_MS, focus }))
  // The first check is due at once: the scheduler runs a deadline whose time has passed straight away.
  schedulerOf($).set('focus', 0, () => fastPoll($))
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
    read: path => readSource($, root, path),
    stamp: path => fileStamp($, `${root}/${path}`),
    store: storeOf($),
    entryPath: path => fileEntryPath(dataRoot, root, path),
    complete: async (prompt, maxTokens, signal) => {
      const result = await callModel(
        $,
        settings,
        'explain',
        {
          model: settings.explain.model,
          effort: settings.explain.thinking,
          system: reviewerSystem(explainInstructions, [aboutPerson()], persona),
          prompt,
          maxTokens,
          timeoutMs: 90_000,
        },
        signal,
      )

      return result.isAnswered ? result.text : null
    },
    now: () => $.clock.now(),
    project: () => ({ name: projectId(root).replace(/-[0-9a-f]{8}$/, ''), overview: project === null ? '' : overviewLine(project) }),
    insights: (path, name, symbolPrint, filePrint) =>
      project === null ? [] : insightsFor(project, path, name, symbolPrint, filePrint).map(insightLine),
    // Paused, or with another session driving this project, nothing is fetched unless it is asked for.
    mode: () => (mode === 'off' ? 'off' : mode === 'paused' || !isDriver ? 'on request' : settings.explain.mode),
    // While Claude is not answering, or refuses this job's model, only what the person asks for is tried.
    pressure: () => (!mayAsk(health) || jobBlocks.has('explain') ? 'held' : pressure.level),
    model: settings.explain.model,
    onChange: () => {
      void refreshView($)
    },
    wakeAt: at => {
      if (at === null) deadlines?.cancel('explain')
      else schedulerOf($).set('explain', at, () => explainer?.wake())
    },
    log: line => {
      $.ui.log(line, { to: 'debug' })
      trace($, 'explain', 'log', () => line)
    },
  })
  // After a reload, the pane still holds the spot it was showing. The view is made again from the file as it is now.
  const shown = (await read($, explainAtom)).spot
  if (shown !== null) focus = { ...shown, source: 'pane' }
  else await update($, explainAtom, () => NO_VIEW)
  await refreshView($)
  // The journal may have read the focus file already. What it said is followed either way.
  await readFocus($)
  await followEditor($, await $.clock.now())
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

/** Resolves when `wanted` does, or after `ms`, whichever comes first. */
function soonest($: EngineInterface, wanted: Promise<void>, ms: number): Promise<void> {
  return new Promise(resolve => {
    const timer = $.clock.after(ms, () => resolve())
    void wanted.then(() => {
      timer.cancel()
      resolve()
    })
  })
}

/** What the lookup tool and `/bsd explain` share: move the focus to a spot and say what is known about it. */
async function lookUp($: EngineInterface, spot: Spot): Promise<string> {
  const engine = explainer
  if (engine === null) return ''
  await setFocus($, { ...spot, source: 'command' }, true)
  let view = await engine.view(spot, 'asked')
  // A lookup takes the model a few seconds, and a hook has ten of its own. This waits for the lookup to
  // land and answers the moment it does, or with what there is when the wait is over.
  const until = (await $.clock.now()) + LOOKUP_WAIT_MS
  while (view.status === 'updating' && engine.pending() > 0) {
    const left = until - (await $.clock.now())
    if (left <= 0) break
    await soonest($, engine.changed(), left)
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

/** What every prompt is told about the person: their profile, and what has been seen of their own work. */
function aboutPerson(): string {
  const seen = profiles.languages.map(language => records.get(language)).filter(record => record !== undefined)

  return [personText(profiles), progressText(seen)].filter(part => part !== '').join('\n\n')
}

/** Runs one piece of progress work after the ones before it, so that two never write one record at once. */
function queueProgress($: EngineInterface, work: () => Promise<void>): void {
  progressQueue = progressQueue.then(work).catch(error => {
    fail($, 'progress failed', error)
  })
}

async function setProgress($: EngineInterface, change: Partial<ProgressView>): Promise<void> {
  trace($, 'state', 'progress', () => change)
  await update($, progressAtom, (view): ProgressView => ({ ...view, ...change }))
}

/** The Progress tab shows the records of the languages in play, main ones first. */
async function showProgress($: EngineInterface, settings: Settings): Promise<void> {
  const shown = profiles.languages.map(language => records.get(language) ?? emptyRecord(language))
  await setProgress($, { isOn: settings.isProgressOn, identity, records: shown })
}

async function loadRecord($: EngineInterface, language: string): Promise<ProgressRecord> {
  if (dataRoot === '') return emptyRecord(language)

  return parseRecord(await storeOf($).read(progressPath(dataRoot, language)), language)
}

/** Whose commits count, and the records of the languages in play. */
async function setUpProgress($: EngineInterface, settings: Settings): Promise<void> {
  const where = repoRoot === '' ? undefined : repoRoot
  // `git config` answers the repository's own setting, else the global one in ~/.gitconfig.
  const effective = (await git($, where, ['config', '--get', 'user.email'])).stdout
  const global = (await git($, where, ['config', '--global', '--get', 'user.email'])).stdout
  identity = identityOf(effective, global)
  records.clear()
  for (const language of profiles.languages) records.set(language, await loadRecord($, language))
  await showProgress($, settings)
}

/** What they said about themselves in one language, in a line. It is never evidence. */
function saidAbout(language: string): string {
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
async function assess(
  $: EngineInterface,
  settings: Settings,
  language: string,
  commits: readonly (AssessedCommit & CommitForAssessment)[],
  review: string,
): Promise<boolean> {
  const before = await loadRecord($, language)
  const fresh = commits.filter(commit => !before.assessed.includes(commit.hash))
  if (fresh.length === 0) return true
  const name = projectId(repoRoot).replace(/-[0-9a-f]{8}$/, '')
  const subject = fresh.length === 1 ? `commit ${fresh[0]?.short ?? ''}` : `${fresh.length} of your recent commits`
  await setProgress($, { busy: `Looking at ${subject} for your ${languageName(language)} progress.` })
  try {
    const result = await callModel($, settings, 'progress', {
      model: settings.deepReview.model,
      effort: settings.deepReview.thinking,
      system: progressInstructions,
      prompt: assessmentRequest({ language, project: name, record: before, said: saidAbout(language), commits: fresh, review }),
      maxTokens: 3000,
      timeoutMs: 240_000,
    })
    if (!result.isAnswered) {
      // No answer: it is worth another try, later.
      await setProgress($, { skipped: `The look at ${subject} got no answer. It is tried again.` })

      return false
    }
    const assessment = parseAssessment(result.text)
    if (assessment === null) {
      await setProgress($, { skipped: `The look at ${subject} did not finish. Nothing was recorded.` })

      return true
    }
    // Added to the record as it stands on disk, in one step: another session may be adding to it too.
    // The file as it was is kept beside it, because the evidence cannot be gathered again.
    const at = await $.clock.now()
    const made: { change: LevelChange | null } = { change: null }
    const record = await updateJson(
      storeOf($),
      progressPath(dataRoot, language),
      stored => parseRecord(stored, language),
      latest => {
        const added = withAssessment(latest, assessment, fresh, name, at)
        made.change = added.change

        return added.record
      },
      { keepBackup: true },
    )
    const change = made.change
    records.set(language, record)
    await setProgress($, { skipped: '' })
    await showProgress($, settings)
    await registerReviewer($, settings)
    if (change !== null) $.ui.toast(`${languageName(language)}: ${change.to}${record.isProvisional ? ' (provisional)' : ''}. See the Progress tab.`)

    return true
  } finally {
    await setProgress($, { busy: '' })
  }
}

/**
 * A commit of the person's, once it has been reviewed or made: the lines it
 * added, by language, if it is theirs. Resolves false when a request got no
 * answer, which is worth trying again, and true when there is nothing more
 * to do for this commit.
 */
async function assessCommit($: EngineInterface, settings: Settings, hash: string, review: string): Promise<boolean> {
  if (!settings.isProgressOn || repoRoot === '' || dataRoot === '' || mode === 'off') return true
  const info = parseCommitInfo((await git($, repoRoot, commitInfoArgs(hash))).stdout)
  if (info === null) return true
  const files = addedLines((await git($, repoRoot, commitPatchArgs(hash))).stdout)
  const verdict = judge(info, identity, files)
  const short = shortHash(info.hash)
  if (!verdict.isYours) {
    await setProgress($, { skipped: `Commit ${short} does not count toward your progress: ${verdict.reason}.` })

    return true
  }
  // Work the tutor watched arrive in saves counts in full. Work it did not see counts half.
  const watched = verdict.files.filter(file => watchedPaths.has(file.path)).length
  const weight = watched * 2 >= verdict.files.length ? 1 : 0.5
  const title = info.message.split('\n')[0] ?? ''
  const languages = [...byLanguage(verdict.files)].filter(([, group]) => sizeOf(group) >= MIN_LINES).slice(0, 2)
  if (languages.length === 0) {
    for (const file of verdict.files) watchedPaths.delete(file.path)
    await setProgress($, { skipped: `Commit ${short} is too small to say anything about your progress.` })

    return true
  }
  let isSettled = true
  for (const [language, group] of languages) {
    if (!(await assess($, settings, language, [{ hash: info.hash, short, weight, title, files: group }], review))) isSettled = false
  }
  // Kept until the commit is settled, so that another try weighs it the same.
  if (isSettled) for (const file of verdict.files) watchedPaths.delete(file.path)

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
async function placeFirst($: EngineInterface, settings: Settings, run: number): Promise<void> {
  if (!settings.isProgressOn || identity.length === 0 || repoRoot === '' || dataRoot === '' || !isDriver) return
  const held = await readPressure($)
  if (held.level !== 'none' || !mayAsk(health)) return
  const mine = parseRecent((await git($, repoRoot, [...RECENT_COMMITS_ARGS])).stdout)
    .filter(commit => identity.includes(commit.email))
    .slice(0, PLACEMENT_SCAN)
  if (mine.length === 0) return

  for (const language of profiles.languages.slice(0, 2)) {
    const record = await loadRecord($, language)
    if (record.level !== null || run !== engagement) continue
    const picked: (AssessedCommit & CommitForAssessment)[] = []
    for (const commit of mine) {
      if (picked.length >= PLACEMENT_COMMITS || run !== engagement) break
      if (record.assessed.includes(commit.hash)) continue
      const info = parseCommitInfo((await git($, repoRoot, commitInfoArgs(commit.hash))).stdout)
      if (info === null) continue
      const verdict = judge(info, identity, addedLines((await git($, repoRoot, commitPatchArgs(commit.hash))).stdout))
      const group = verdict.isYours ? byLanguage(verdict.files).get(language) : undefined
      if (group === undefined || sizeOf(group) < MIN_LINES) continue
      picked.push({ hash: info.hash, short: shortHash(info.hash), weight: 0.5, title: info.message.split('\n')[0] ?? '', files: group })
    }
    // Read newest first from git log; assessed oldest first, so that the record runs in time order.
    if (picked.length > 0 && run === engagement) await assess($, settings, language, picked.reverse(), '')
  }
}

/**
 * Everything the tutor needs once it is on: the watcher, the profiles, the
 * reviewer and the tools. `/bsd` does not wait for this, so that it answers
 * at once however slow git is. `isFresh` is false when the tutor was already
 * on and the module reloaded, in which case no questions are asked.
 */
async function engage($: EngineInterface, settings: Settings, run: number, isFresh: boolean): Promise<void> {
  try {
    const started = Date.now()
    await startDebug($, settings)
    trace($, 'start', 'engaging', () => ({ run, isFresh }))
    await startAnimating($, settings, isFresh)
    if (run !== engagement) return
    await startWatching($, settings, run)
    if (run !== engagement) return
    tracer.inProject(repoRoot === '' ? '' : projectId(repoRoot))
    // Who drives this project is settled before anything that only the driver does.
    await keepLease($, settings, run)
    if (run !== engagement) return
    if (isDriver) await startJournal($, run, isFresh)
    if (run !== engagement) return
    await moveOutOfStore($)
    const main = await setUpProfiles($)
    await loadProject($)
    await setUpProgress($, settings)
    await registerReviewer($, settings)
    // Not waited for. Claude Code connects each tool before it answers, which took eight seconds a tool
    // behind a proxy in a live session, and nothing below needs them.
    void registerTools($).catch(error => fail($, 'could not register the tools', error))
    // The files as they are now are what was just loaded. A change from here on is another session's, or this one's own.
    sharedStamp = null
    await refreshShared($, settings)
    if (isDriver) {
      await loadQueue($)
      await adoptReview($, settings)
    }
    await startExplaining($, settings, run)
    // Commits that were left waiting, by an outage or a closed session, are taken up now.
    if (run === engagement) await planReview($, settings)
    trace($, 'start', 'engaged', () => ({ run, repoRoot, languages: profiles.languages, main }), Date.now() - started)
    if (isFresh) void maybeSurvey($, settings, run)
    if (isFresh) queueProgress($, () => placeFirst($, settings, run))
    if (isFresh) void checkForUpdate($, settings)
    // Last, so that everything already works if the questions are dismissed.
    if (isFresh && run === engagement) await ask($, settings, unasked(main))
  } catch (error) {
    fail($, 'could not finish starting', error)
  }
}

/** Moves to `next`, with everything that has to change along with the mode. */
async function switchTo($: EngineInterface, next: Mode, settings: Settings): Promise<void> {
  const wasEngaged = mode !== 'off'
  const isEngaged = next !== 'off'
  // Awaited, because the contract has to be in force from the first prompt after the command.
  if (isEngaged && contract === '') await loadTutor($, settings.persona)

  trace($, 'state', 'mode', () => ({ from: mode, to: next }))
  mode = next
  await update($, modeAtom, () => next)

  if (wasEngaged === isEngaged) {
    if (isEngaged) {
      // Paused, nothing is scanned and no look is due. Resumed, the tree is looked at straight away.
      if (next === 'paused') {
        deadlines?.cancel('scan')
        deadlines?.cancel('look')
        await showPlay($, settings)
      } else {
        await kick($, settings, 'resumed')
        await planLook($, settings)
      }
      // The commits that are waiting wait through a pause, and are taken up when it ends.
      await planReview($, settings)
    }

    return
  }
  engagement += 1
  // The instruction files are framed differently while the tutor is on.
  $.ui.invalidate('prompt.context')
  if (isEngaged) {
    isWatchReady = false
    await showPlay($, settings)
    await openPane($)
    void engage($, settings, engagement, true)
  } else {
    // The lease goes back at once, so that a session waiting for it takes over without waiting for it to run out.
    if (isDriver && repoRoot !== '' && dataRoot !== '') void giveLease($, leasePath(dataRoot, repoRoot), leaseHolder)
    stopWatching()
    stopAnimating()
    await update($, speechAtom, () => SILENT)
    // The journal is written one last time, with the attention added up so far. The command does not wait for it.
    const leaving = recorder
    recorder = null
    const now = await $.clock.now()
    if (leaving !== null) void flushJournal($, leaving, now, true)
    await showWorking($, now)
    await update($, notesAtom, () => [])
    await update($, dismissedAtom, () => [])
    await update($, selectedAtom, () => null)
    await update($, reviewAtom, () => NO_REVIEW)
    await update($, explainAtom, () => NO_VIEW)
    profiles = NO_PROFILES
    await update($, profilesAtom, () => NO_PROFILES)
    await $.ui.close({ id: 'backseat-driver' })
    await stopDebug($, 'the tutor was switched off')
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

    // The log would otherwise be written straight back into the folder that is about to go.
    if (scope.kind === 'everything') await stopDebug($, 'everything was forgotten')
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
      project = repoRoot === '' ? null : emptyProject(repoRoot)
      reviews = []
      waiting = EMPTY_QUEUE
      reviewRetryAt = null
      explainer?.reset()
      writtenView = ''
      await update($, explainAtom, () => NO_VIEW)
      await update($, notesAtom, () => [])
      await update($, dismissedAtom, () => [])
      await update($, selectedAtom, () => null)
      await update($, reviewAtom, () => NO_REVIEW)
      // Or the journal held in memory would be written straight back into the folder that was just deleted.
      recorder?.reset()
      await showWorking($, await $.clock.now())
    }
    if (scope.kind !== 'project' && mode !== 'off') {
      await setUpProfiles($)
      await setUpProgress($, settings)
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
      trace($, 'hook', 'session.start', () => ({ mode, cwd: e.cwd, isReload: true }))
      const open = await read($, notesAtom)
      nextNoteId = open.reduce((highest, note) => Math.max(highest, note.id), 0) + 1
      await loadTutor($, settings.persona)
      await openPane($)
      engagement += 1
      await engage($, settings, engagement, false)
    }

    try {
      await $.command.register({ name: 'backseat-driver-update', description: 'Fetch the newest release of Backseat Driver', immediate: true })
    } catch (error) {
      fail($, 'could not register /backseat-driver-update', error)
    }
    for (const name of COMMANDS) {
      try {
        await $.command.register({
          name,
          description: 'Turn the Backseat Driver tutor on. /bsd help lists the rest',
          argumentHint: '[off | pause | resume | status | explain | settings | questions | working | forget | update | uninstall | debug | help]',
          immediate: true,
        })
      } catch (error) {
        // A taken name throws. The other command still has to register.
        fail($, `could not register /${name}`, error)
      }
    }

    return next(e)
  })

  // /clear, /resume and /branch reset `$.state` and do not fire `session.start`.
  on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
    await update($, modeAtom, () => mode)
    // The pane's "Working on" line was reset with the rest of the state. The journal behind it was not.
    if (mode !== 'off') {
      trace($, 'hook', 'classic.SessionStart', () => ({ source: e.source }))
      // The notes, the review and the rest of the pane were emptied with the state. They come back.
      await restorePane($, settings)
      workingShown = ''
      await showWorking($, await $.clock.now())
      // The session may go by another id now. The lease is renewed under it.
      await keepLease($, settings, engagement)
    }

    return next(e)
  })

  // Spelled out so that `claude plugin validate` can print which commands this answers.
  on('command.run', { command: 'backseat-driver-update' }, $ => {
    void runUpdate($)

    return { text: 'Looking for a newer release.' }
  })

  on('command.run', { command: ['backseat-driver', 'bsd'] }, async ($, e) => {
    const { request, rest, unknown } = parseRequest(e.args)
    trace($, 'cmd', request, () => ({ args: e.args, mode }))
    if (request === 'help') return { text: helpText(unknown) }
    if (request === 'debug') {
      const asked = parseDebugRequest(rest)

      return { text: asked === null ? DEBUG_USAGE : await debugCommand($, settings, asked) }
    }
    if (request === 'questions') {
      if (mode === 'off') return { text: 'Backseat Driver is off. Run /bsd to start it.' }
      // Not awaited: the dialog stays open for as long as the person takes.
      void ask($, settings, firstRunQuestions(profiles.languages, false))

      return { text: 'Here are the questions again. Esc stops at any point, and the answers so far are kept.' }
    }
    if (request === 'settings') {
      if (mode === 'off') return { text: SETTINGS_OFF }
      await update($, tabAtom, () => 'settings')
      // Asking again brings back a pane the user closed by hand, and reads the rows again.
      await openPane($)

      return { text: 'The settings are in the pane. Ctrl+X Tab gives it the keyboard, then pick a row and press Enter.' }
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
    if (request === 'working') {
      if (mode === 'off') return { text: 'Backseat Driver is off. Run /bsd to start it.' }
      if (recorder === null) {
        return { text: 'There is no journal to put that in: the tutor is still getting ready, or this folder is not a git repository.' }
      }
      const said = parseWorking(rest)
      if (said === null) {
        // Not awaited: the dialog stays open for as long as the person takes.
        void askWorking($)

        return { text: 'Type it, or pick an answer. Esc leaves it as it is.' }
      }
      void sayWorking($, said)

      return { text: said === '' ? 'Cleared. The tutor goes by your activity again.' : `Noted. Working on: ${said}` }
    }
    if (request === 'update') {
      void runUpdate($)

      return { text: 'Looking for a newer release.' }
    }
    if (request === 'uninstall') {
      void runUninstall($, settings)

      return { text: 'Nothing is removed until you confirm it. Esc keeps everything.' }
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
    const person = aboutPerson()
    const sections = tutorSections(composed.sections, { contract, extras: [SESSION_NOTES, person], persona })
    // The system prompt is put together again and again. What the tutor adds is logged when it changes.
    const added = `${contract.length} ${persona.length} ${person}`
    if (added === composedLast) quiet.composes += 1
    else {
      composedLast = added
      trace($, 'hook', 'prompt.compose', () => ({ from: composed.sections.map(section => section.id), to: sections.map(section => section.id), person, contract, persona }))
    }

    return { sections }
  })

  on('prompt.context', async ($, e, next) => {
    const context = await next(e)
    if (mode === 'off') return context
    trace($, 'hook', 'prompt.context', () => ({ blocks: context.blocks.map(block => block.name) }))

    return {
      blocks: context.blocks.map(block =>
        block.name === 'claudeMd' ? { ...block, text: reframeInstructions(block.text) } : block,
      ),
    }
  })

  // The conversation is told what the pane shows, so "explain note 2" means something,
  // and what the person is doing in the code, so "why does this fail?" has a place.
  on('prompt.submit', async ($, e, next) => {
    if (mode === 'off') return next(e)
    // The character's hello says nothing about the code.
    const said = settings.isAnimated ? (await read($, speechAtom)).text : ''
    const isHello = said === avatarFor(settings.persona.voice).hello
    const shown = [
      paneContext(await read($, notesAtom), await read($, reviewAtom), isHello ? '' : said),
      explainContext(await read($, explainAtom)),
      recorder?.brief(await $.clock.now()) ?? '',
    ].filter(part => part !== '')
    // Another session may have recorded something about the person since the last look at the files.
    await refreshShared($, settings)
    trace($, 'hook', 'prompt.submit', () => ({ text: e.text, attached: shown }))
    // They are at the keyboard, here: what they saved a moment ago should not wait for the next scan.
    void kick($, settings, 'a prompt')
    if (shown.length === 0) return next(e)

    return next({ ...e, context: [...(e.context ?? []), ...shown] })
  })

  // The deep reviewer's answer. It goes to the pane, never into the conversation.
  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined && mode !== 'off') {
      // The conversation's own turn ended. An answer means Claude is answering, which ends any wait.
      if (e.reason === 'answer') await noteOutcome($, settings, 'conversation', { ok: true })
      // Whatever Claude's tools did to the working tree during the turn is looked at now.
      void kick($, settings, 'a turn ended')
    }
    const agentId = e.agentId
    if (agentId === undefined || agentId !== reviewAgentId) return next(e)
    // The slot is held until what this review leaves behind is on record, so that nothing starts in between.
    await withReviewSlot($, settings, async () => {
      const scope = reviewScope
      const failure = reviewFailure
      const noted = reviewFailureNoted
      reviewAgentId = null
      reviewScope = null
      reviewFailure = ''
      reviewFailureNoted = null
      schedulerOf($).cancel('review-watchdog')
      trace($, 'agent', 'finished', () => ({ agentId, reason: e.reason, subject: scope === null ? null : scopeSubject(scope), answer: e.reason === 'answer' ? e.answer : undefined }))

      if (e.reason === 'answer' && e.answer.trim() !== '' && scope !== null) {
        if (scope.kind !== 'survey') {
          reviewedHead = scope.kind === 'commit' ? scope.hash : lastHead
          reviewedPrint = scope.kind === 'commit' ? '' : scopePrint(scope)
        }
        // The notes at its end go to the project's cache, and never to the pane.
        const kept = await keepReview($, scope, e.answer)
        const shown = kept.text
        const isUnseen = (await read($, tabAtom)) !== 'review'
        // What the pane puts first: the decision points and insights the review's notes named.
        const decisions = kept.notes?.decisions ?? []
        const insights = (kept.notes?.insights ?? []).map(insight => `${insight.file}${insight.symbol === '' ? '' : `, ${insight.symbol}`}: ${insight.text}`)
        await setReview($, { state: 'done', text: fitReview(shown), isUnseen, decisions, insights })
        // A survey reviewed none of their work, so it is not part of the record of it.
        if (scope.kind !== 'survey') recorder?.add({ at: await $.clock.now(), kind: 'review', text: scopeSubject(scope) })
        if (isUnseen) $.ui.toast(`Deep review ready: ${scopeSubject(scope)}`)
        // The review ends on the one thing most worth doing next, which is worth saying out loud.
        // Its last line as shown: the notes after it are not for the person.
        if (settings.isAnimated) await say($, `${scope.kind === 'survey' ? "I've had a look around." : "Review's in."} ${closingLine(shown)}`)
        // What it said may be about the spot the Explain tab is on.
        void refreshView($)
        reviewRetryAt = null
        if (scope.kind === 'commit') {
          // A commit's review is also when the person's progress is brought up to date, with the review for context.
          // A waiting commit moves on to that. One reviewed by hand that was not waiting gets it directly.
          if (waiting.commits.some(commit => commit.hash === scope.hash)) await changeQueue($, queue => reviewed(queue, scope.hash))
          else queueProgress($, async () => void (await assessCommit($, settings, scope.hash, shown)))
        }
        // The reviewer answered, so Claude is answering.
        await noteOutcome($, settings, 'deep-review', { ok: true })
      } else if (e.reason === 'error' && failure === '') {
        // An API error says only "error" here. Which one arrives through `classic.StopFailure` at about the same
        // moment, so it gets one before this counts as a failure nobody can explain.
        endedReview = { agentId, scope }
        await setReview($, { state: 'failed', text: 'error' })
        schedulerOf($).set('review-verdict', (await $.clock.now()) + VERDICT_MS, () => reviewVerdict($, settings, null))
      } else if (e.reason === 'error') {
        // Why it died arrived a moment ago and may still be being counted. Seen live: without this wait
        // Claude still looked well here, and an outage was taken for a failure nobody could explain.
        await noted?.catch(() => undefined)
        await reviewFailed($, settings, scope, failure, 'service')
      } else if (e.reason === 'answer') {
        // It ended its turn with nothing to say. Claude is answering, though.
        await noteOutcome($, settings, 'deep-review', { ok: true })
        await reviewFailed($, settings, scope, 'the reviewer said nothing', 'own')
      } else {
        await reviewFailed($, settings, scope, e.reason === 'aborted' ? 'it was stopped' : 'the model refused', 'final')
      }
    })

    return next(e)
  })

  // An API error ended a turn: the conversation's, or a subagent's. Either way Claude is not answering.
  on('classic.StopFailure', async ($, e, next) => {
    if (mode !== 'off') {
      trace($, 'hook', 'classic.StopFailure', () => ({ error: e.error, details: e.error_details, agent: e.agent_id, type: e.agent_type }))
      const outcome = outcomeOfError(e.error)
      const isRunning = e.agent_id !== undefined && e.agent_id === reviewAgentId
      const isEnded = endedReview !== null && e.agent_id === endedReview.agentId
      // The review's own end, `turn.complete`, says only "error". This says which.
      if (isRunning && !outcome.ok) reviewFailure = outcome.detail
      // Any other subagent is one the conversation started: its trouble is not the deep review's setting.
      const noted = noteOutcome($, settings, isRunning || isEnded ? 'deep-review' : 'conversation', outcome)
      if (isRunning) reviewFailureNoted = noted
      await noted
      // The review ended a moment ago, and this is why.
      if (isEnded && !outcome.ok) await reviewVerdict($, settings, outcome.detail)
    }

    return next(e)
  })

  // Claude Code measured the session: how close the plan's limit is arrives here, without being asked for.
  on('session.measure', async ($, e, next) => {
    if (mode !== 'off' && e.changed.includes('rateLimits')) {
      const before = pressure.level
      pressure = pressureOf(e.rateLimits, await $.clock.now())
      trace($, 'hook', 'session.measure', () => ({ pressure, rateLimits: e.rateLimits }))
      if (pressure.level !== before) await wake($, settings)
    }

    return next(e)
  })

  // The session is ending, or its conversation is being cleared: what is held in memory goes to disk.
  // The whole chain of hooks has about a second and a half for this.
  on('session.end', async ($, e, next) => {
    if (mode !== 'off') {
      trace($, 'hook', 'session.end', () => ({ reason: e.reason }))
      // After /clear and /resume this process carries on, and so do its pane, its log and its lease.
      // The pane first: the state it lives in is emptied next, and this hook has a second and a half in all.
      if (e.reason === 'clear' || e.reason === 'resume') await carryPane($)
      const leaving = recorder
      if (leaving !== null) await flushJournal($, leaving, await $.clock.now(), true)
      if (e.reason === 'clear' || e.reason === 'resume') await flushDebug($)
      else {
        if (isDriver && repoRoot !== '' && dataRoot !== '') await giveLease($, leasePath(dataRoot, repoRoot), leaseHolder)
        await stopDebug($, `the session ended (${e.reason})`)
      }
    }

    return next(e)
  })

  // The reviewer is only offered to the model while the tutor is on.
  on('agent.offer', { agent: 'backseat-driver:deep-reviewer' }, ($, e, next) =>
    mode === 'off' ? { isOffered: false } : next(e),
  )

  // The tutor's own tools. Answering here, without `next`, runs no other tool and raises no permission prompt.
  on('tool.call', { tool: 'mcp__backseat-driver__hush' }, async ($, e) => {
    if (mode === 'off') return answered($, e, 'Backseat Driver is off, so nothing was recorded.')
    // The model fills these in, so none of them is taken on trust. When it
    // names an open note, the note's own topic is used: that is the slug the
    // reviewer will use again, and the model's guess at it rarely matches.
    const noted = (await read($, notesAtom)).find(note => note.id === Number(e.note))
    const topic = noted?.topic ?? String(e.topic ?? '').trim()
    const subject =
      noted === undefined
        ? String(e.language ?? GENERAL).trim().toLowerCase() || GENERAL
        : (languageOf(noted.file) ?? GENERAL)
    if (topic === '') return answered($, e, 'Nothing was recorded: give the topic as a short slug.')
    const removed = await hush($, settings, subject, { topic, text: String(e.what ?? topic).trim() || topic })
    const pane = removed === 0 ? 'No open note matched, so the pane is unchanged.' : `Removed from the pane: ${removed}.`

    return answered($, e, `Recorded. "${topic}" will not be brought up again for ${subject}, in this project or any other. ${pane}`)
  })

  on('tool.call', { tool: 'mcp__backseat-driver__unhush' }, async ($, e) => {
    if (mode === 'off') return answered($, e, 'Backseat Driver is off, so nothing was changed.')
    const topic = String(e.topic ?? '').trim()
    const subject = String(e.language ?? GENERAL).trim().toLowerCase() || GENERAL
    await saveSubject($, settings, subject, profile => withoutHush(profile, topic))

    return answered($, e, `Done. "${topic}" may be brought up again for ${subject}.`)
  })

  on('tool.call', { tool: 'mcp__backseat-driver__record' }, async ($, e) => {
    if (mode === 'off') return answered($, e, 'Backseat Driver is off, so nothing was recorded.')
    const about = String(e.about ?? '').trim()
    const answer = String(e.answer ?? '').trim().slice(0, 200)
    const subject = answerSubject(about, String(e.language ?? '').trim().toLowerCase())
    if (subject === null || answer === '') {
      return answered($, e, 'Nothing was recorded: give `about` as level, goals, focus or knows, the language it is about, and the answer.')
    }
    await saveSubject($, settings, subject, profile => withAnswer(profile, about, answer))
    const where = subject === GENERAL ? '' : ` for ${languageName(subject)}`

    return answered($, e, `Recorded${where}: "${ANSWER_LABELS[about]}: ${answer}". It is kept across sessions and projects.`)
  })

  on('tool.call', { tool: 'mcp__backseat-driver__lookup' }, async ($, e) => {
    if (mode === 'off' || explainer === null) return answered($, e, 'Nothing is cached, because Explain is not running. Read the file instead.')
    const path = relativeTo(repoRoot, String(e.file ?? ''))
    if (path === null) return answered($, e, 'That file is not in this project.')
    const line = Math.floor(Number(e.line ?? 1))

    return answered($, e, await lookUp($, { path, line: Number.isFinite(line) && line >= 1 ? line : 1 }))
  })

  on('tool.call', { tool: 'mcp__backseat-driver__progress' }, async ($, e) => {
    if (mode === 'off') return answered($, e, 'Backseat Driver is off.')
    if (!settings.isProgressOn) return answered($, e, 'The progress report is switched off in /config.')
    const language = String(e.language ?? '').trim().toLowerCase()
    const record = records.get(language) ?? (await loadRecord($, language))
    const whose = identity.length === 0 ? 'Git has no user.email here, so no commit can be confirmed as theirs.' : `Only commits by ${identity.join(' or ')} count.`

    return answered($, e, record.observations.length === 0 ? `Nothing is on record for ${language} yet. ${whose}` : `${recordText(record)}\n\n${whose}`)
  })

  on('tool.call', { tool: 'mcp__backseat-driver__profile' }, async ($, e) => {
    if (mode === 'off') return answered($, e, 'Backseat Driver is off.')
    const subject = String(e.language ?? GENERAL).trim().toLowerCase() || GENERAL
    const text = personText({ languages: [subject], subjects: { [subject]: await loadSubject($, subject) } })

    return answered($, e, text === '' ? `Nothing is on record for ${subject}.` : text)
  })

  on('tool.call', { tool: 'mcp__backseat-driver__working' }, async ($, e) => {
    if (mode === 'off' || recorder === null) return answered($, e, 'No journal is being kept here, so nothing was recorded.')
    // Only an empty string takes their words back. A call that left `on` out, as one did in a live session, changes nothing.
    if (typeof e.on !== 'string') {
      return answered($, e, 'Nothing was recorded: give `on`, what they said in their words, or an empty string when they take it back.')
    }
    const said = tidy(e.on)
    await sayWorking($, said)

    return answered(
      $,
      e,
      said === ''
        ? 'Cleared. What they are working on is worked out from their activity again.'
        : `Recorded: they are working on "${said}". The pane shows it, and the background reviewers are told.`,
    )
  })

  on('tool.call', { tool: 'mcp__backseat-driver__activity' }, async ($, e) => {
    if (mode === 'off' || recorder === null) return answered($, e, NO_ACTIVITY)
    const doing = recorder.activity(await $.clock.now())

    return answered($, e, doing === '' ? NO_ACTIVITY : doing)
  })

  // The one rule that does not rest on the model: Claude cannot edit the user's files.
  on('tool.call', { tool: ['Edit', 'Write', 'NotebookEdit'] }, ($, e, next) => {
    if (mode === 'off') return next(e)
    const path = e.tool === 'NotebookEdit' ? e.notebook_path : e.file_path
    const isDenied = isUsersFile(path, home)
    trace($, 'guard', isDenied ? 'denied' : 'let through', () => ({ tool: e.tool, path }))

    return isDenied ? { deny: DENIAL } : next(e)
  })

  on('ui.render', { component: 'Pane', requestId: 'backseat-driver' }, async ($, e) => {
    quiet.renders += 1
    // One round for everything the pane shows, not a dozen in a row for every frame.
    const [shownMode, tab, notes, selected, watch, review, shownProfiles, explain, working, progress, release, speech, shownSettings] = await Promise.all([
      read($, modeAtom),
      read($, tabAtom),
      read($, notesAtom),
      read($, selectedAtom),
      read($, watchAtom),
      read($, reviewAtom),
      read($, profilesAtom),
      read($, explainAtom),
      read($, workingAtom),
      read($, progressAtom),
      read($, updateAtom),
      read($, speechAtom),
      read($, settingsAtom),
    ])
    const view = {
      mode: shownMode,
      tab,
      persona: settings.persona,
      notes,
      selected,
      watch,
      isAutomatic: settings.playByPlay.isAutomatic,
      review,
      reviewSchedule: reviewSchedule(settings.deepReview.isAfterCommit, settings.deepReview.everyMs),
      profiles: shownProfiles,
      explain,
      working,
      progress,
      update: release,
      isFocused: e.props.isFocused,
      columns: e.props.bodyColumns,
      character: settings.isAnimated ? { avatar: avatarFor(settings.persona.voice), speech } : null,
      // Above the prompt rows are scarce, and other surfaces may not draw text art in a fixed-width font.
      isCompact: e.props.placement === 'inline' || e.surface !== 'terminal',
      settings: shownSettings,
    }

    return renderPane($.ui.resolve(e), view, {
      onTab: (tab: Tab) => {
        touched($, settings, 'tab', () => tab)
        void update($, tabAtom, () => tab)
        if (tab === 'review') void setReview($, { isUnseen: false })
        if (tab === 'explain') watchClosely($)
        // Read again each time: a change made in /config meanwhile shows.
        if (tab === 'settings') void showSettings($)
      },
      onSelect: (id: number) => {
        touched($, settings, 'select', () => id)
        void update($, selectedAtom, () => id)
      },
      onExplain: (note: Note) => {
        touched($, settings, 'explain', () => note)
        // Not awaited: it resolves when the turn starts, which may be after the one now running.
        void $.prompt.submit({ text: explainRequest(note), asUser: true })
        // A decision point or an insight is about this one spot in their code, not an idea now explained to them.
        if (isProblem(note.kind)) void saveSubject($, settings, languageOf(note.file) ?? GENERAL, profile => withExplained(profile, note.topic))
      },
      onMute: (note: Note) => {
        touched($, settings, 'mute', () => note)
        const entry = { topic: note.topic, text: note.topic.replaceAll('-', ' ') }
        void hush($, settings, languageOf(note.file) ?? GENERAL, entry)
      },
      onUnhush: (subject: string, topic: string) => {
        touched($, settings, 'unhush', () => ({ subject, topic }))
        void saveSubject($, settings, subject, profile => withoutHush(profile, topic))
      },
      onQuestions: () => {
        touched($, settings, 'questions')
        void ask($, settings, firstRunQuestions(profiles.languages, false))
      },
      onExplainMove: (step: 1 | -1) => {
        touched($, settings, 'explain move', () => step)
        void moveFocus($, step)
      },
      onExplainFetch: () => {
        touched($, settings, 'explain fetch')
        void refreshView($, true)
      },
      onExplainAsk: () => {
        touched($, settings, 'explain ask')
        void read($, explainAtom).then(view => {
          const text = explainAsk(view)
          // A prompt the mod submits skips the mod's own `prompt.submit` hook. The text
          // names the file and the lines, and the tutor's lookup tool has the rest.
          if (text !== '') void $.prompt.submit({ text, asUser: true })
        })
      },
      onDismiss: (note: Note) => {
        touched($, settings, 'dismiss', () => note)
        void update($, notesAtom, open => open.filter(other => other.id !== note.id))
        // Remembered, so that the next look does not bring the same point back.
        void update($, dismissedAtom, dismissed => withDismissed(dismissed, note))
        void $.clock.now().then(at => recorder?.add({ at, kind: 'dismissed', path: note.file, line: note.line, text: note.topic }))
      },
      onWorking: () => {
        touched($, settings, 'working')
        void askWorking($)
      },
      onSetting: (row: SettingRow, value: string) => {
        touched($, settings, 'setting', () => ({ key: row.key, value }))
        void changeSetting($, row, value)
      },
      onLook: () => {
        touched($, settings, 'look now')
        if (mode === 'on') void look($, settings, true)
      },
      onReview: () => {
        touched($, settings, 'review now')
        void reviewSince($, settings, true)
      },
    })
  })
}
