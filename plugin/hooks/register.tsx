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
import type { EngineInterface, ModelCompleteRequest, ModelCompleteResult, PluginOptions, Register, Timer, UiFocusResult } from 'claude-code'

import type { ExplainView, Hush, IssuesState, LessonsView, Mode, Note, Profile, Profiles, ProgressRecord, ProgressView, Review, ReviewText, SettingRow, Speech, Spot, Tab, Watch, Working } from '../types'
import { avatarFor, BLINK_MS, BLINK_SHUT_MS, closingLine, finished, isTalking, lineAtReload, nextTick, SILENT, speech, SURVEY_LINE, TALK_MS } from '../core/avatar'
import { backdropOf } from '../core/sprite'
import type { Backdrop } from '../core/sprite'
import { carryOn as carryOnOf, checkBound as checkBoundOf, checkSelf as checkSelfOf, freshCarryState, sayLeft as sayLeftOf, sayOff as sayOffOf, sayOn as sayOnOf } from '../core/carrying'
import type { CarryPorts, CarryState } from '../core/carrying'
import { personaPrompt, reframeInstructions, SESSION_NOTES, stripComments, stripFrontmatter, tutorSections } from './contract'
import {
  dataHome,
  fileEntryPath,
  isOwnFolder,
  isRemovable,
  journalPath,
  leasePath,
  lessonsDir,
  sessionsPath,
  licensePath,
  lockRepoPath,
  MARKER,
  MARKER_TEXT,
  profilePath,
  projectDir,
  projectId,
  sharedFolders,
} from '../core/datahome'
import { debugCommand as runDebugCommand, flushDebug as flushDebugLog, followSwitch as followDebugSwitch, freshDebuggingState, startDebug as startDebugLog, stopDebug as stopDebugLog, trace as noteTrace } from '../core/debugging'
import type { DebuggingPorts, DebuggingState } from '../core/debugging'
import type { Host } from '../core/host'
import { DEBUG_USAGE, parseDebugRequest } from '../core/debuglog'
import type { DebugRequest } from '../core/debuglog'
import { createExplainer, NO_VIEW } from '../core/explainer'
import { EDITORS_FOLDER, focusWatchArgv, ignoredFolders, isEstablished, lineSplitter, nudgesOf, treeWatchArgv, watcherComplaint } from '../core/filewatch'
import type { Nudge, WatchPlaces, WatchRole } from '../core/filewatch'
import { describeSpot, parseTarget, relativeTo } from '../core/focus'
import type { Focus } from '../core/focus'
import {
  fastPoll as fastPollOf,
  followEditor as followEditorOf,
  followSaves as followSavesOf,
  freshFollowState,
  isWatched as isWatchedOf,
  lookUp as lookUpOf,
  moveFocus as moveFocusOf,
  pollFocus as pollFocusOf,
  readFocus as readFocusOf,
  refreshView as refreshViewOf,
  setFocus as setFocusOf,
  startExplaining as startExplainingOf,
  watchClosely as watchCloselyOf,
} from '../core/following'
import type { FollowPorts, FollowState } from '../core/following'
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
} from '../core/forget'
import type { Scope } from '../core/forget'
import { HEALTHY, mayAsk, NO_PRESSURE, outcomeOf, outcomeOfError, pressureOf, stepHealth } from '../core/health'
import type { Health, Outcome, Pressure } from '../core/health'
import { parseStatus } from '../core/git'
import { briefText, glanceText, NO_ACTIVITY } from '../core/glance'
import { DENIAL, isUsersFile } from '../core/guard'
import { languageName, languageOf, mainLanguages } from '../core/languages'
import { sourcePrint } from '../core/knowledge'
import { freshLookState, runLook } from '../core/look'
import type { LookPorts, LookState } from '../core/look'
import {
  adoptReview as adoptRunningReview,
  freshReviewState,
  isReviewFree as reviewSlotFree,
  planReview as planWaitingReviews,
  reviewCommitNow as reviewCommit,
  reviewFailed as failReview,
  reviewVerdict as verdictOnReview,
  reviewWatchdog as watchReview,
  settleAssessment as settleAssessmentOf,
  withReviewSlot as holdReviewSlot,
} from '../core/reviewing'
import type { ReviewPorts, ReviewState } from '../core/reviewing'
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
} from '../core/update'
import type { Install } from '../core/update'
import { emptyRecord, progressText, recordText } from '../core/progress'
import { growthOf, growthText } from '../core/growth'
import type { Growth } from '../core/growth'
import { freshLearningState, lessonTool as lessonToolOf, lessonViews, loadLessons as loadLessonsOf, markDone as markDoneOf, selectLesson as selectLessonOf, showLessons as showLessonsOf, startStep as startStepOf } from '../core/learning'
import type { LearningPorts, LearningState } from '../core/learning'
import {
  assessCommit as assessCommitOf,
  freshProgressState,
  loadRecord as loadRecordOf,
  noteWatched as noteWatchedOf,
  placeFirst as placeFirstOf,
  queueProgress as queueProgressWork,
  setUpProgress as setUpProgressOf,
  showProgress as showProgressOf,
  explainUnassessed as explainUnassessedOf,
  releaseSkipped as releaseSkippedOf,
} from '../core/progressing'
import type { ProgressPorts, ProgressState } from '../core/progressing'
import { helpText, isModeRequest, parseRequest, REPOSITORY_APPEARED, SETTINGS_OFF, transition } from '../core/mode'
import { isNoiseFile, noiseRoot, VENDORED_BYTES } from '../core/noise'
import { isLookDue, playOf, wakeAt } from '../core/play'
import type { Play, PlayFacts } from '../core/play'
import { isProblem, keepNotes, parseKeptNotes, stillOpen, withDismissed } from '../core/notes'
import type { KeptNotes } from '../core/notes'
import {
  currentPlayItem,
  detailMarkdown,
  drawnOrder,
  estimatedRows,
  PLAY_PICKS,
  playPicks,
  renderMinimized,
  renderPane,
  reviewSchedule,
  steppedNote,
} from './pane'
import type { Kit, PaneView } from './pane'
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
  withHush,
  withoutHush,
} from '../core/profiles'
import {
  emptyProject,
  historyTexts,
  insightLine,
  insightLines,
  insightsFor,
  overviewLine,
  parseProject,
  parseReviews,
  projectBrief,
  reviewDigest,
  splitReview,
  withAudited,
  withNamesBack,
  withReview,
  withReviewNotes,
  withSurvey,
} from '../core/project'
import type { Insight, KeptInsight, ProjectKnowledge, ReviewNotes, ReviewRecord } from '../core/project'
import { editorArgv } from '../core/opening'
import { explainAsk, explainContext, explainRequest, paneContext, reviewerSystem } from '../core/prompts'
import { firstRunQuestions, groupAnswers } from '../core/questions'
import type { Question } from '../core/questions'
import {
  flushJournal as flushJournalOf,
  freshJournalState,
  journalDue as journalDueOf,
  keepJournal as keepJournalOf,
  NO_WORKING,
  sayWorking as sayWorkingOf,
  showStoredWorking as showStoredWorkingOf,
  showWorking as showWorkingOf,
  startJournal as startJournalOf,
  storedSeen as storedSeenOf,
} from '../core/journaling'
import type { JournalPorts, JournalState } from '../core/journaling'
import { createScheduler } from '../core/scheduler'
import type { Scheduler } from '../core/scheduler'
import { freshLeaseState, giveLease as giveLeaseOf, keepLease as keepLeaseOf } from '../core/leasing'
import type { LeasePorts, LeaseState } from '../core/leasing'
import { scanGapMs } from '../core/sensor'
import { parseSessions, SELF_CHECK_MS } from '../core/sessions'
import { isHello } from '../core/avatar'
import { parseLease } from '../core/lease'
import { clockTime, dayTime } from '../core/clock'
import { isSameShown, textsOf } from './shown'
import type { Shown } from './shown'
import { healthLine, playLine, watchOf } from '../core/status'
import type { Recorder } from '../core/recorder'
import {
  changedFilesOf,
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
  shownReview,
  withReviewChange,
} from '../core/review'
import type { ReviewScope } from '../core/review'
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
} from '../core/reviewqueue'
import type { ReviewQueue, Waiting } from '../core/reviewqueue'
import {
  catchUp,
  changedFields,
  changedText,
  configValue,
  DEFAULT_PERSONA,
  notReloadedText,
  readSettings,
  RELOAD_WAIT_MS,
  settingRows,
  unclassified,
  withSetting,
} from '../core/settings'
import type { ChangedRow, Persona, Settings } from '../core/settings'
import { createLocks } from '../core/locks'
import { memoryDisk } from '../core/storage'
import type { Disk } from '../core/storage'
import { createStore, plainStore, updateJson } from '../core/store'
import type { Store } from '../core/store'
import { createWatcher } from '../core/watcher'
import {
  checkUrl,
  COMMERCIAL_CHOICE,
  KEY_CHOICES,
  KEY_HEADER,
  KEY_QUESTION,
  LICENSE_SERVER,
  licenseFacts,
  licenseLine,
  licenseStanding,
  licenseStatus,
  nextLicenseCheck,
  parseAnswer,
  parseLicense,
  parseLicenseRequest,
  USE_CHOICES,
  USE_HEADER,
  USE_QUESTION,
  useOfAnswer,
  withKey,
} from '../core/license'
import type { LicenseRecord, LicenseRequest, Standing } from '../core/license'
import { checkKey, cleanKey, looksLikeKey } from '../core/licensekey'
import type { KeyCheck } from '../core/licensekey'
import type { Watcher } from '../core/watcher'
import { chosen, parseWorking, tidy, WORKING_HEADER, WORKING_QUESTION, workingChoices } from '../core/working'
import {
  anchorIssue,
  askedIssues,
  auditLine,
  coverageLine,
  coveredLedger,
  dismissedForRequest,
  EMPTY_LEDGER,
  FINDINGS_FILE,
  foundIssues,
  issueQuestion,
  issuesBrief,
  issuesForRequest,
  ledgerViews,
  lookIssues,
  MAX_FROM_AUDIT,
  MAX_FROM_REVIEW,
  ownFiles,
  parseFindingsFence,
  parseLedger,
  personIssue,
  placeIssues,
  ruledIssues,
} from '../core/findings'
import type { Candidate, Finding, Ledger, PersonAction } from '../core/findings'
import { parseJournal, savedPathsOf } from '../core/journal'

const IDLE: Watch = { state: 'idle', lastLookAt: null, line: playLine({ at: 'watching' }) }
const NO_REVIEW: Review = { state: 'none', subject: '', text: '', isUnseen: false, decisions: [], insights: [] }
const NO_PROFILES: Profiles = { languages: [], subjects: {} }

const modeAtom = atom({ plugin: 'backseat-driver', key: 'mode' } as const, 'off')
const tabAtom = atom({ plugin: 'backseat-driver', key: 'tab' } as const, 'play')
const notesAtom = atom({ plugin: 'backseat-driver', key: 'notes' } as const, [])
const dismissedAtom = atom({ plugin: 'backseat-driver', key: 'dismissed' } as const, [])
const selectedAtom = atom({ plugin: 'backseat-driver', key: 'selected' } as const, null)
/** The project's ledger of issues, as the pane holds it. Nothing before it is read from the project's folder. */
const NO_ISSUES: IssuesState = { ledger: EMPTY_LEDGER, placed: {}, isAudited: false }
const issuesAtom = atom({ plugin: 'backseat-driver', key: 'issues' } as const, NO_ISSUES)
const selectedIssueAtom = atom({ plugin: 'backseat-driver', key: 'selectedIssue' } as const, null)
/** What the Play-by-play tab's keys act on: the selected note, or the issue picked from the deep review. */
const playOnAtom = atom({ plugin: 'backseat-driver', key: 'playOn' } as const, 'note' as 'note' | 'issue')
/** What the editor said when Explain last followed it, which outlives a reload of the module. */
const followedEditorAtom = atom({ plugin: 'backseat-driver', key: 'followedEditor' } as const, null as string | null)
const watchAtom = atom({ plugin: 'backseat-driver', key: 'watch' } as const, IDLE)
const reviewAtom = atom({ plugin: 'backseat-driver', key: 'review' } as const, NO_REVIEW)
const profilesAtom = atom({ plugin: 'backseat-driver', key: 'profiles' } as const, NO_PROFILES)
const explainAtom = atom({ plugin: 'backseat-driver', key: 'explain' } as const, NO_VIEW)
const NO_PROGRESS: ProgressView = { isOn: true, identity: [], records: [], busy: '', skipped: '' }
const progressAtom = atom({ plugin: 'backseat-driver', key: 'progress' } as const, NO_PROGRESS)
const NO_LESSONS: LessonsView = { paths: [], selected: null, problems: [] }
const lessonsAtom = atom({ plugin: 'backseat-driver', key: 'lessons' } as const, NO_LESSONS)
const updateAtom = atom({ plugin: 'backseat-driver', key: 'update' } as const, '')
const licenseAtom = atom({ plugin: 'backseat-driver', key: 'license' } as const, '')
const speechAtom = atom({ plugin: 'backseat-driver', key: 'speech' } as const, SILENT)
const workingAtom = atom({ plugin: 'backseat-driver', key: 'working' } as const, NO_WORKING)
/** Which list opened downward is open: `jump:<subject>` in the Deep review tab, `setting:<key>` in Settings, or '' while every one is folded. */
const openListAtom = atom({ plugin: 'backseat-driver', key: 'openList' } as const, '' as string)
/** The spinner's tick behind a tab at work (owner, 2026-10-06: "some kind of animated claude style spinner"). */
const spinAtom = atom({ plugin: 'backseat-driver', key: 'spin' } as const, 0 as number)
/** True while the pane is minimized: closed, with a strip above the prompt to bring it back. The tutor stays on. */
const minimizedAtom = atom({ plugin: 'backseat-driver', key: 'minimized' } as const, false)
/** The same, kept beside the state for when the state is emptied (`/clear`). A reload reads it back from the state. */
let isMinimized = false

/** The pane's id. */
const PANE_ID = 'backseat-driver'
/** How wide the pane asks to be when Claude Code docks it beside the conversation. */
const PANE_COLUMNS = 64


const settingsAtom = atom({ plugin: 'backseat-driver', key: 'settings' } as const, [])
const appliedAtom = atom({ plugin: 'backseat-driver', key: 'applied' } as const, null)

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
let lastChangeAt: number | null = null
/** What looks remember from one to the next (`core/look.ts`): the failures in a row and why, when the last one was, the ids of notes. */
const lookState: LookState = freshLookState()
/**
 * What went wrong lately and how often, by the words it was reported with.
 * Something that fails twice within a few minutes is said in the pane.
 */
const failuresSeen = new Map<string, { count: number; at: number }>()
const FAILING_FOR_MS = 300_000
/** The pane's state as it was when the conversation was cleared, until it is put back (`carryPane`). */
let carried: {
  tab: Tab
  issues: IssuesState
  selectedIssue: number | null
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

/**
 * The scan of the working tree: the one thing the mod has to go and look at,
 * because nothing tells it. One runs at a time, and the next is planned when
 * it has finished (`sensor.ts` says how soon).
 */
let isScanning = false
/** True when something asked for a scan while one was running: another follows at once. */
let isScanWanted = false
let lastScanMs = 0
/** When the last scan of the working tree finished. What changed before it, the tutor has seen. */
let lastScanAt = 0
/** When something last happened: a save, a commit, a caret move, a prompt, a key in the pane. */
let activeAt: number | null = null

/**
 * File watchers that push changes instead of waiting for the scan to find
 * them (`filewatch.ts`): inotifywait, where it is on the person's PATH. One
 * child per role. `isLive` once every watch is in place: only then is the
 * scan a safety net. Nothing runs where no watcher is found, and the scan
 * does it all.
 */
type Pusher = { role: WatchRole; isLive: boolean; stop: () => void }
let pushers: Pusher[] = []
/** True once this watching run has tried to start its watchers. */
let isPushTried = false
/** Counts the times the watchers were stopped, so that a child's loop from before lets go. */
let pushRun = 0

/** What has to be done at a known time. One timer serves all of it. Null until the tutor is first switched on. */
let deadlines: Scheduler | null = null

/** Whether Claude is answering, as every background job reports it, and which jobs have a setting of their own that is refused. */
let health: Health = HEALTHY
const jobBlocks = new Map<string, string>()
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
const leaseState: LeaseState = freshLeaseState()
/**
 * Carrying the tutor on when Claude Code moves the conversation into another
 * process, and laying it down in the one the conversation left
 * (`core/carrying.ts`): what this session last said of itself in
 * `sessions.json`, and whether it still has somewhere to draw.
 */
const carryState: CarryState = freshCarryState()

/**
 * What the tutor says it is showing: each drawing as last handed to Claude
 * Code, by where it is drawn, the hint line's ending, and what Claude Code
 * answered when the pane was last opened. Whether any of it reached the
 * screen is not something the mod can see. `scripts/jack.py` checks it.
 */
const shown: {
  pane: Shown | null
  band: Shown | null
  hint: string
  opened: { at: number; isPlaced: boolean; reason: string } | null
  /** When the pane was last closed, and by whom: the person (its mark, or Esc), the plugin, or an unload. */
  closed: { at: number; origin: string } | null
  /** True while the pane is put away: what is on the screen is then the strip above the prompt (`band`). */
  minimized: boolean
} = {
  pane: null,
  band: null,
  hint: '',
  opened: null,
  closed: null,
  minimized: false,
}
/** The drawings as the debug log last recorded them, and the timer that records the next. */
const shownLogged: { pane: Shown | null; band: Shown | null } = { pane: null, band: null }
/** About how many rows the Explain tab's last explanation took: held while the next is looked up. */
let explainRows = 0
/** Where the pane's window last stood, as its last `ui.scroll` asked: a scroll that moves nothing is not logged. */
let lastScrollOffset = -1
let shownTimer: Timer | null = null
/** A drawing is written down once it has stood this long, so that a line being said word by word is one record and not ten. */
const SHOWN_SETTLE_MS = 500

/** How the person was told something outside the pane and the band (`noteSaid`). */
type SaidHow = 'toast' | 'transcript' | 'command' | 'asked' | 'prompt'
/** The latest things the person was told outside the pane and the band, oldest first. */
const saidLately: { at: number; how: SaidHow; text: string }[] = []
const SAID_KEPT = 12
/** The question a dialog is asking now, while it waits for the person. */
let asking: { at: number; question: string } | null = null

/**
 * This load of the module: when, which version, and with which options.
 * Saving a file under `plugin/` loads it again in a session on the working
 * copy, so a session whose load is older than the newest file runs old code.
 */
const loaded: { at: number; options: PluginOptions | null } = { at: Date.now(), options: null }

/**
 * The files that hold what is on record about the person, as last seen:
 * names, sizes and times in one string. Another session may change them.
 */
let sharedStamp: string | null = null
let sharedCheckedAt = 0
/** The lesson records' folders as last listed, so that a step recorded in another session shows here (the caching audit, 2026-10-06). */
let lessonsStamp: string | null = null
/** The journal file's size and time as the driver last took it up (`resyncJournal`). */
let journalStamp: string | null = null
/**
 * The project folder's files, each as its size and time, as a session that does not drive last took them up
 * (`followProject`), or null before it has: what tells it which of them to read again.
 */
let followedStamps: Record<string, string> | null = null
/** How often a scan looks at whether those files changed. One listing per folder. */
const SHARED_CHECK_MS = 5000

/** Explain: the lookup engine, and where the person is looking. */
const followState: FollowState = freshFollowState()

/** The animated persona's timers: one moves its mouth while it talks, the other makes it blink now and then. */
let talkTimer: Timer | null = null
/** Armed after a pick in the Settings tab, and cancelled by the reload that should follow it. */
let reloadWatch: Timer | null = null
let blinkTimer: Timer | null = null
/** The spinner's tick, running only while a review runs, Explain looks something up or the progress is being looked at. */
let spinTimer: Timer | null = null
const SPIN_MS = 150
/**
 * After this long in one stretch of work the spinner pulses every `SPIN_SLOW_MS` instead: a deep review can run a
 * quarter of an hour, and a pane redrawn seven times a second for that long serves nobody (it also timed the kit's
 * watchdog test out, which advances forty-five minutes while a review runs). It never stops while the work runs:
 * an ellipsis standing in for it read as nothing to the owner (2026-10-06, "(...) is not helpful to me").
 */
const SPIN_FOR_MS = 60_000
const SPIN_SLOW_MS = 2000
let spinSince = 0
/** True once the stretch's minute is up and the slow pulse is on, until the work ends. */
let isSpinSlow = false

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
const progressState: ProgressState = freshProgressState()

/** Lessons: the learning paths in the plugin's lessons folder, and where the person is in each. */
const learningState: LearningState = freshLearningState()

/** The fingerprint of each noted file's text as the look that raised its notes saw it, so that kept notes come back only while true. */
const notePrints = new Map<string, string>()
let progressInstructions = ''
let reviews: ReviewRecord[] = []
/** The project's ledger of issues, as last read or written (`findings.json`). */
let ledger: Ledger = EMPTY_LEDGER
/** The ledger file as last read or written, its size and time: another session's change to it is taken up. */
let findingsStamp = ''

/** The deep review's working state. */
let repoRoot = ''
/** The repository's git folder. Empty outside a repository. */
let gitDir = ''
/** The reflog file, whose fingerprint changes whenever HEAD moves. Empty outside a repository. */
let headLog = ''
let headLogStamp = ''
/** The commit HEAD pointed at when it was last looked at. */
let lastHead = ''
/** Where the previous deep review ended, and a fingerprint of what the previous timed review saw. */
let reviewedHead = ''
let reviewedPrint = ''
/**
 * The commits waiting for their review, the reviewer, and the one review slot
 * (`core/reviewing.ts`). The queue is kept in the project's folder, so that a
 * commit made while Claude was not answering is still reviewed later: this is
 * the copy in memory.
 */
const reviewState: ReviewState = freshReviewState()

/** The journal of what they are doing in this project. Null while the tutor is off, and outside a repository. */
const journalState: JournalState = freshJournalState()
/** What the pane was last told they are working on, as JSON, so that it is told again only when that changes. */

/**
 * The debug log: `core/debugging.ts` runs it, and this is what it remembers.
 * The tracer always keeps the latest records in memory, and writes every one
 * of them to a file while the log is switched on.
 */
const debugState: DebuggingState = freshDebuggingState(() => Date.now())
const tracer = debugState.tracer
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
  noteTrace(debugPortsOf($), debugState, kind, name, detail, ms)
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
    watcher: watcher === null ? null : { dirty: watcher.dirty(), noise: watcher.noise(), changed: watcher.changed(), hasPending: watcher.hasPending() },
    look: {
      isWatchReady,
      isLooking: lookState.isLooking,
      lastChangeAt,
      lastLookAt: lookState.lastLookAt,
      failures: lookState.failures,
      lookFailure: lookState.lookFailure,
      quietLooks: lookState.quietLooks,
    },
    scan: { isScanning, isScanWanted, lastScanMs, lastScanAt, activeAt },
    pushers: pushers.map(pusher => ({ role: pusher.role, isLive: pusher.isLive })),
    deadlines: deadlines?.all() ?? {},
    health,
    jobBlocks: Object.fromEntries(jobBlocks),
    pressure,
    lease: { isDriver: leaseState.isDriver, holder: leaseState.holder },
    review: {
      agentId: reviewState.reviewAgentId,
      scope: reviewState.reviewScope === null ? null : scopeSubject(reviewState.reviewScope),
      startedAt: reviewState.reviewStartedAt,
      isBusy: reviewState.isReviewBusy,
      ended: reviewState.endedReview === null ? null : reviewState.endedReview.agentId,
      waiting: reviewState.waiting,
      isAssessing: reviewState.isAssessing,
      retryAt: reviewState.reviewRetryAt,
      assessRetryAt: reviewState.assessRetryAt,
      reviewedHead,
      reviewedPrint,
      lastHead,
      headLog,
    },
    explain: {
      isOn: followState.explainer !== null,
      waiting: followState.explainer?.pending() ?? 0,
      focus: followState.focus,
      editorFocusAt: followState.editorFocusAt,
      focusText: followState.focusText,
      isWatchingClosely: followState.isWatchingClosely,
    },
    timers: { talk: talkTimer !== null, blink: blinkTimer !== null },
    profiles: { languages: profiles.languages, subjects: Object.keys(profiles.subjects) },
    progress: { identity: progressState.identity, records: [...progressState.records.keys()], watchedPaths: [...progressState.watchedPaths] },
    journal: journalState.recorder === null ? null : { working: journalState.workingShown },
    project: project === null ? null : { isSurveyed: project.isSurveyed, insights: project.insights.length },
    quiet,
  }
}

/** What the session is, and where it says it draws: checked from outside against what is so. */
async function selfState($: EngineInterface): Promise<Record<string, unknown>> {
  const asked = async <T,>(question: () => Promise<T>): Promise<T | string> => {
    try {
      return await question()
    } catch (error) {
      return `(could not be asked: ${String(error)})`
    }
  }

  return {
    id: await asked(() => $.session.id()),
    born: await asked(async () => (await $.session.usage()).startedAt),
    cwd: await asked(() => $.session.cwd()),
    surfaces: await asked(() => $.session.surfaces()),
    panes: await asked(() => $.ui.panes()),
    pluginRoot: $.plugin.root,
    said: { ...carryState },
  }
}

/** The whole state: what is held in memory, what the pane is drawn from, and what was last drawn. */
async function fullState($: EngineInterface): Promise<Record<string, unknown>> {
  return {
    ...snapshot(),
    session: await selfState($),
    loaded: { ...loaded },
    shown: { ...shown },
    said: [...saidLately],
    asking,
    pane: {
      mode: await read($, modeAtom),
      tab: await read($, tabAtom),
      notes: await read($, notesAtom),
      dismissed: await read($, dismissedAtom),
      selected: await read($, selectedAtom),
      watch: await read($, watchAtom),
      review: await read($, reviewAtom),
      issues: await read($, issuesAtom),
      selectedIssue: await read($, selectedIssueAtom),
      playOn: await read($, playOnAtom),
      explain: await read($, explainAtom),
      working: await read($, workingAtom),
      progress: await read($, progressAtom),
      lessons: await read($, lessonsAtom),
      update: await read($, updateAtom),
      license: await read($, licenseAtom),
      speech: await read($, speechAtom),
      settings: await read($, settingsAtom),
    },
  }
}

/**
 * Claude Code as the engines' host: every shared port, each made from `$`
 * and read at the moment an engine needs it. An engine's ports are this and
 * what is its own. `settings` is for the model calls, which only engines that
 * have settings take: without them, a request is refused before it is sent.
 */
function hostOf($: EngineInterface, settings: Settings | null): Host {
  return {
    now: async () => await $.clock.now(),
    after: (ms, run) => $.clock.after(ms, run),
    deadline: { set: (name, at, run) => schedulerOf($).set(name, at, run), cancel: name => void deadlines?.cancel(name) },
    trace: (kind, name, detail) => trace($, kind, name, detail),
    fail: (what, error) => fail($, what, error),
    toast: text => toastPerson($, text),
    sessionId: async () => await $.session.id(),
    mode: () => mode,
    isOn: () => mode !== 'off',
    isDriver: () => leaseState.isDriver,
    engagement: () => engagement,
    repoRoot: () => repoRoot,
    dataRoot: () => dataRoot,
    store: () => storeOf($),
    markHome: () => markHome($),
    list: async path => await $.fs.list(path),
    readFile: async path => await $.fs.read(path),
    writeFile: async (path, text) => void (await $.fs.write(path, text)),
    git: (root, args) => git($, root, args),
    ask: (job, request) =>
      settings === null ? Promise.reject(new Error(`no settings to ask the ${job} model with`)) : callModel($, settings, job, request),
    readPressure: () => readPressure($),
  }
}

/** What running the debug log needs from this session. `settings` is for the two that write them down. */
function debugPortsOf($: EngineInterface, settings: Settings | null = null): DebuggingPorts {
  const host = hostOf($, settings)

  return {
    ...host,
    settings,
    read: host.readFile,
    write: host.writeFile,
    remove: path => diskOf($).remove(path),
    resolveHome: () => resolveHome($),
    versions: async () => {
      const [claudeCode, own] = await Promise.all([$.session.version(), ownVersion($)])

      return { host: { claudeCode }, plugin: own.version === null ? null : versionText(own.version) }
    },
    pluginRoot: () => $.plugin.root,
    fullState: () => fullState($),
    log: text => $.ui.log(text, { to: 'debug' }),
  }
}

/** Writes the debug log and, beside it, the tutor's whole state as it stands. */
async function flushDebug($: EngineInterface): Promise<void> {
  await flushDebugLog(debugPortsOf($), debugState)
}

/** Starts this session's debug log, when the switch in the data folder says it is on. */
async function startDebug($: EngineInterface, settings: Settings): Promise<void> {
  await startDebugLog(debugPortsOf($, settings), debugState)
}

/** Stops the debug log, writing what it still holds. */
async function stopDebug($: EngineInterface, why: string): Promise<void> {
  await stopDebugLog(debugPortsOf($), debugState, why)
}

/** Starts or stops this session's log when the switch was changed from outside: another session's `/backseat debug`, or `scripts/jack.py`. */
async function followDebug($: EngineInterface, settings: Settings): Promise<void> {
  await followDebugSwitch(debugPortsOf($, settings), debugState)
  // While someone listens in, the state beside the log is never older than one look at itself, however quiet the session.
  await flushDebugLog(debugPortsOf($), debugState, true)
}

/** `/backseat debug`: switches the debug log, says where it is, writes down what just happened, or deletes the logs. */
async function debugCommand($: EngineInterface, settings: Settings, request: DebugRequest): Promise<string> {
  return runDebugCommand(debugPortsOf($, settings), debugState, request)
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
  let result: ModelCompleteResult
  try {
    result = signal === undefined ? await $.model.complete(request) : await $.model.complete(request, { signal })
  } catch (error) {
    // Refused before it was sent, which says nothing about Claude: if it was finding out, the next request does.
    await probeEnded($, settings)
    throw error
  }
  trace($, 'model', job, () => ({ request, result }), Date.now() - started)
  // Cut short by the tutor itself, as a lookup is when its file is saved again: that says nothing about Claude.
  if (signal?.aborted !== true) await noteOutcome($, settings, job, outcomeOf(result))
  else await probeEnded($, settings)

  return result
}

/**
 * Opens a place in the person's editor with their `editor_command` (owner, 2026-10-05). The command runs as given,
 * through no shell, in the repository; it is their own command, run only when they click a place. A command that
 * waits (an editor without -n) is cut off after `EDITOR_TIMEOUT_MS`, and told so.
 */
const EDITOR_TIMEOUT_MS = 10_000

function openInEditor($: EngineInterface, settings: Settings, path: string, line: number): void {
  const argv = editorArgv(settings.editorCommand, { file: repoRoot === '' ? path : `${repoRoot}/${path}`, line })
  if (argv === null) return
  const started = Date.now()
  toastPerson($, `Opening ${path}:${line} in your editor.`)
  void $.process
    .run(argv, { cwd: repoRoot === '' ? undefined : repoRoot, timeoutMs: EDITOR_TIMEOUT_MS })
    .then(result => {
      trace($, 'process', 'editor', () => ({ argv, exitCode: result.exitCode, stderr: result.stderr }), Date.now() - started)
      if (result.exitCode !== 0) toastPerson($, `The editor command ended with ${result.exitCode}: ${(result.stderr ?? '').trim().slice(0, 120) || argv[0]}`)
    })
    .catch((error: unknown) => {
      trace($, 'process', 'editor', () => ({ argv, error: String(error) }), Date.now() - started)
      toastPerson($, `The editor command could not run: ${String(error).slice(0, 120)}. Check editor_command in /config.`)
    })
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
    // Everything awaited before the step: what another outcome did to the health meanwhile is stepped on, not over.
    const at = await $.clock.now()
    health = stepHealth(health, {
      type: 'failed',
      trouble: outcome.trouble,
      detail: outcome.detail,
      at,
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
  try {
    await planLook($, settings)
    await planReview($, settings)
    await followState.explainer?.wake()
  } catch (error) {
    // Not the caller's failure: a look whose model answered would otherwise be counted as failed and its notes lost.
    fail($, 'could not plan what was waiting', error)
  }
  void refreshView($)
}

/** The facts the play-by-play's state is worked out from. */
function playFacts(settings: Settings): PlayFacts {
  return {
    mode: mode === 'paused' ? 'paused' : 'on',
    isReady: isWatchReady,
    hasRepo: repoRoot !== '',
    isFollowing: !leaseState.isDriver,
    isAutomatic: settings.playByPlay.isAutomatic,
    hasPending: watcher?.hasPending() ?? false,
    lastChangeAt,
    lastLookAt: lookState.lastLookAt,
    isLooking: lookState.isLooking,
    failures: lookState.failures,
    failure: lookState.lookFailure,
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
  const next = watchOf(play, lookState.lastLookAt, healthLine({ play, health, pressure, lastScanMs, failing: failingNow() }))
  const shown = await read($, watchAtom)
  if (shown.state !== next.state || shown.line !== next.line || shown.lastLookAt !== next.lastLookAt || (shown.health ?? '') !== (next.health ?? '')) {
    trace($, 'state', 'watch', () => ({ ...next, play }))
    // The row about connected editors is kept up by `readFocus`.
    await update($, watchAtom, (w): Watch => ({ ...next, ...(w.editors === undefined ? {} : { editors: w.editors }), ...(w.driver === undefined ? {} : { driver: w.driver }) }))
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

/**
 * Keeps one thing the person was told outside the pane and the band, and
 * writes it into the debug log (`said`). The latest few are part of the
 * state beside the log, so that `scripts/jack.py` can look for each of them
 * on the screen: a toast nobody saw is the same mystery as a pane nobody saw.
 */
function noteSaid($: EngineInterface, how: SaidHow, text: string, detail?: Record<string, unknown>): void {
  saidLately.push({ at: Date.now(), how, text })
  if (saidLately.length > SAID_KEPT) saidLately.shift()
  trace($, 'said', how, () => ({ text, ...detail }))
}

/** A toast, said and written down. */
function toastPerson($: EngineInterface, text: string): void {
  noteSaid($, 'toast', text)
  $.ui.toast(text)
}

/** A line in the transcript, said and written down. */
function tellPerson($: EngineInterface, text: string): void {
  noteSaid($, 'transcript', text)
  $.ui.log(text)
}

/** A prompt sent in the person's name, written down: it shows in the conversation as theirs. */
function submitForPerson($: EngineInterface, text: string): Promise<unknown> {
  noteSaid($, 'prompt', text)

  return $.prompt.submit({ text, asUser: true })
}

/** A question in a dialog, written down with the answer it got, or that it got none. */
async function askPerson($: EngineInterface, question: string, choices: { options: string[]; header: string }): Promise<string> {
  noteSaid($, 'asked', question, { options: choices.options, header: choices.header })
  const open = { at: Date.now(), question }
  asking = open
  try {
    const answer = await $.ui.ask(question, choices)
    trace($, 'ui', 'answered', () => ({ question, answer }))

    return answer
  } catch (error) {
    trace($, 'ui', 'not answered', () => ({ question, why: String(error) }))
    throw error
  } finally {
    if (asking === open) asking = null
  }
}

async function loadTutor($: EngineInterface, chosen: Persona): Promise<void> {
  const root = $.plugin.root
  const file = (path: string): Promise<string> => $.fs.read(`${root}/${path}`)
  // Read side by side: `/backseat` waits for these, and nothing else.
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
      } catch (error) {
        // Not there is nothing there. Not readable is not that: taken for nothing there, one failed read had the next
        // write reset a profile, with no backup (the caching audit, 2026-10-06). The file's existence tells the two apart.
        if (!/no such file|ENOENT|not found|does not exist/i.test(String(error)) && (await $.fs.exists(path))) {
          trace($, 'fs', 'read failed', () => ({ path, error: String(error) }), Date.now() - started)
          throw error
        }
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
  const path = `${dataRoot}/${MARKER}`
  // Written again when it says something else: a marker from before 2026-10-06 named /bsd forget, a command since
  // gone (the twelfth ui-truth pass, 2026-10-07).
  const isCurrent = (await $.fs.exists(path)) && (await $.fs.read(path).catch(() => '')) === MARKER_TEXT
  if (!isCurrent) await $.fs.write(path, MARKER_TEXT)
  isHomeMarked = true
}

/** Said once when the pane is open and Claude Code does not draw it: a tutor that is on with nothing on screen is otherwise a mystery. */
const PANE_WAITS = 'Backseat Driver is on. Its pane waits for a wider terminal: /backseat opens it now.'

/** Opens the pane, and keeps what Claude Code said of it: open is not yet drawn. */
async function openPane($: EngineInterface): Promise<void> {
  const opened = await $.ui.open({ id: PANE_ID, title: 'Backseat', columns: PANE_COLUMNS })
  const reason = opened.isPlaced ? '' : opened.reason
  const wasWaiting = shown.opened?.isPlaced === false
  shown.opened = { at: Date.now(), isPlaced: opened.isPlaced, reason }
  shown.closed = null
  trace($, 'ui', 'pane opened', () => ({ isPlaced: opened.isPlaced, reason }))
  if (!opened.isPlaced && !wasWaiting) tellPerson($, PANE_WAITS)
}

/** Closes the pane, when it is open. */
async function closePane($: EngineInterface): Promise<void> {
  if (shown.opened !== null) shown.closed = { at: Date.now(), origin: 'plugin' }
  shown.opened = null
  shown.pane = null
  try {
    if ((await $.ui.panes()).some(pane => pane.id === PANE_ID)) await $.ui.close({ id: PANE_ID })
  } catch (error) {
    // A process its conversation has left may have no pane to close.
    fail($, 'could not close the pane', error)
  }
}

/** Opens the pane while the tutor is on, and closes it when it is off. */
async function showPane($: EngineInterface): Promise<void> {
  // Not awaited: the Settings tab can wait for its rows, switching on cannot.
  if (mode !== 'off') void showSettings($)
  if (mode === 'off') await closePane($)
  // Put away, it stays put away until the person brings it back.
  else if (!isMinimized) await openPane($)
}

/**
 * Puts the pane away: it closes, and a strip above the prompt stands in for
 * it. The tutor stays on (owner, 2026-10-06: only /backseat off shuts it down).
 * The person's own close arrives here from `ui.close`, already under way.
 */
async function minimizePane($: EngineInterface, origin: 'person' | 'plugin'): Promise<void> {
  isMinimized = true
  shown.minimized = true
  await update($, minimizedAtom, () => true)
  trace($, 'ui', 'pane minimized', () => ({ origin }))
  if (origin === 'plugin') await closePane($)
  // The band's hook had read nothing of the state until now, so nothing else asks it again.
  $.ui.invalidate('ui.render')
}

/** Brings the pane back from the strip, on the tab asked for when one was. */
async function restoreFromStrip($: EngineInterface, tab: Tab | null): Promise<void> {
  isMinimized = false
  shown.minimized = false
  shown.band = null
  await update($, minimizedAtom, () => false)
  if (tab !== null) await showTab($, tab)
  trace($, 'ui', 'pane restored', () => ({ tab }))
  await openPane($)
  $.ui.invalidate('ui.render')
}

/** Shows the pane because the person asked for the tutor by name: one that was put away comes back. */
async function bringBack($: EngineInterface): Promise<void> {
  if (isMinimized) await restoreFromStrip($, null)
  else await showPane($)
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
/**
 * Keeps the settings this load of the module was given in `$.state`, which
 * outlives a reload, and says which of them changed since the load before
 * and from when they are in effect. Answers the settings as they were
 * before, or null when none changed: a first load, or a reload for a change
 * of code.
 */
async function noteSettings($: EngineInterface, options: PluginOptions): Promise<Settings | null> {
  const before = await read($, appliedAtom)
  await update($, appliedAtom, () => options)
  const missing = unclassified(options)
  if (missing.length > 0) fail($, 'settings without an entry in SETTING_EFFECTS', new Error(missing.join(', ')))
  if (before === null) return null
  const changed = changedFields(before, options)
  if (changed.length === 0) return null
  trace($, 'state', 'settings changed', () => ({ changed, settings: readSettings(options) }))
  if (mode !== 'off') void sayChanged($, changed)

  return readSettings(before)
}

/** One line in the transcript, while on: each changed setting as /config names it, its new value, and from when it counts. */
async function sayChanged($: EngineInterface, fields: readonly string[]): Promise<void> {
  try {
    const rows = settingRows(await $.config.list(), $.plugin.name)
    const named = fields.flatMap((field): ChangedRow[] => {
      const row = rows.find(candidate => candidate.key.endsWith(`.${field}`))

      return row === undefined ? [] : [{ field, label: row.label, value: row.value }]
    })
    const text = changedText(named)
    if (text !== '') tellPerson($, text)
  } catch (error) {
    fail($, 'could not say which settings changed', error)
  }
}

async function changeSetting($: EngineInterface, row: SettingRow, picked: string): Promise<void> {
  await update($, settingsAtom, rows => withSetting(rows, row.key, picked))
  try {
    // The change loads the module again, which cancels the write the debug log has waiting: it is written now.
    await flushDebug($)
    const { deny } = await $.config.set({ key: row.key, value: configValue(row, picked) })
    trace($, 'state', 'setting', () => ({ key: row.key, value: picked, deny }))
    if (deny !== undefined) {
      await update($, settingsAtom, rows => withSetting(rows, row.key, row.value))
      toastPerson($, `${row.label} stays ${row.value}: ${deny}`)

      return
    }
    // A reload cancels every timer of this module, so this one fires only when Claude Code did not load it again.
    reloadWatch?.cancel()
    reloadWatch = $.clock.after(RELOAD_WAIT_MS, () => {
      reloadWatch = null
      trace($, 'state', 'setting not reloaded', () => ({ key: row.key, value: picked }))
      Promise.resolve()
        .then(() => tellPerson($, notReloadedText(row.label, picked)))
        .catch(() => undefined)
    })
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
/** Whether the terminal's background is dark or light, by the theme in `/config`. Dark when it cannot be told. */
async function themeBackdrop($: EngineInterface): Promise<Backdrop> {
  try {
    return backdropOf((await $.config.list()).find(row => row.key === 'theme')?.value)
  } catch {
    return 'dark'
  }
}

async function say($: EngineInterface, text: string): Promise<void> {
  const line = speech(text)
  if (text !== '') trace($, 'state', 'speech', () => text)
  await update($, speechAtom, () => line)
  stopTalking()
  // Switched off while the line was being written: nothing may keep running.
  if (line.text === '' || mode === 'off') return
  // A tick that finds its host gone with the module (the kit unloads it at a file's end, timers armed) is nothing's.
  talkTimer = $.clock.every(TALK_MS, () => {
    talkOn($).catch(() => undefined)
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
    update($, speechAtom, said => ({ ...said, isBlinking: false })).catch(() => undefined)
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
    blink($).catch(() => undefined)
  })
  const hello = avatarFor(settings.persona.voice).hello
  if (isFresh) await say($, hello)
  else {
    // A hello another voice said, with the voice changed under it by a reload, is this voice's to say: the mascot
    // stood under Linus's "Ready. Save something." for sixteen hours (the second ui-truth pass, 2026-10-06).
    const shown = await read($, speechAtom)
    const instead = lineAtReload(shown.text, hello, isHello)
    if (instead !== null) await say($, instead)
    else await update($, speechAtom, finished)
  }
}

async function setReview($: EngineInterface, change: Partial<Review>): Promise<void> {
  trace($, 'state', 'review', () => change)
  await update($, reviewAtom, (review): Review => withReviewChange(review, change))
  await keepSpinning($)
}

/**
 * The spinner behind a tab at work: one tick every `SPIN_MS` while a review runs, Explain looks something up or
 * the progress is being looked at, and no timer at all otherwise (owner, 2026-10-06: the `(…)` badge "would be nice
 * if it was some kind of animated claude style spinner"). Looked at whenever one of those three changes.
 */
async function keepSpinning($: EngineInterface): Promise<void> {
  const [review, explain, progress] = await Promise.all([read($, reviewAtom), read($, explainAtom), read($, progressAtom)])
  const isBusy = mode !== 'off' && (review.state === 'running' || explain.status === 'updating' || progress.busy !== '')
  if (isBusy && spinTimer === null) {
    spinSince = await $.clock.now()
    isSpinSlow = false
    spinTimer = $.clock.every(SPIN_MS, () => {
      spinOnce($).catch(() => undefined)
    })
  } else if (!isBusy) {
    stopSpinning()
    if ((await read($, spinAtom)) !== 0) await update($, spinAtom, () => 0)
  }
}

/** One tick of the spinner. Its minute up, the ticks come every `SPIN_SLOW_MS` instead, for as long as the work runs. */
async function spinOnce($: EngineInterface): Promise<void> {
  if (spinTimer === null) return
  if (!isSpinSlow && (await $.clock.now()) - spinSince >= SPIN_FOR_MS) {
    isSpinSlow = true
    spinTimer.cancel()
    spinTimer = $.clock.every(SPIN_SLOW_MS, () => {
      spinOnce($).catch(() => undefined)
    })
  }
  await update($, spinAtom, (spin: number): number => spin + 1)
}

function stopSpinning(): void {
  spinTimer?.cancel()
  spinTimer = null
  isSpinSlow = false
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
/**
 * The directory the session is in, as Claude Code says: where git is asked
 * for the repository. A process run with no directory runs where the
 * process was started, which is not the session's directory when they
 * differ: the owner's session in `~/repos/php-hello/public_html`, where
 * `.git` is, was told the folder was not a repository (2026-10-06).
 * Undefined when the session cannot say, and git then runs where the process does.
 */
async function sessionCwd($: EngineInterface): Promise<string | undefined> {
  try {
    const cwd = await $.session.cwd()

    return cwd === '' ? undefined : cwd
  } catch {
    return undefined
  }
}

async function git(
  $: EngineInterface,
  cwd: string | undefined,
  args: readonly string[],
  isNetwork = false,
  stdin?: string,
): Promise<{ exitCode: number; stdout: string; stderr?: string; isCut?: boolean }> {
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
    // A file's text read through git is kept by its size, as a read through $.fs is: the log held every file an issue was
    // anchored in, a password literal with it (the thirteenth ui-truth pass, 2026-10-07).
    else if (args[0] === 'show' && args.some(arg => /^[^-][^:]*:./.test(arg))) {
      trace($, 'git', verb, () => ({ args, cwd, exitCode: result.exitCode, chars: result.stdout.length, stderr: result.stderr, isCut: result.isStdoutTruncated }), Date.now() - started)
    } else trace($, 'git', verb, () => ({ args, cwd, exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr, isCut: result.isStdoutTruncated }), Date.now() - started)

    // Claude Code keeps the first 4 MiB of what a process prints and says so: a patch cut there counted 5400 added
    // lines where there were 21155, and would miss a person's own code after a large vendored file (the tenth
    // ui-truth pass, 2026-10-07).
    return { exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr, isCut: result.isStdoutTruncated === true }
  } catch (error) {
    // Git is missing, or took too long. -1 is no exit code of git's: a caller can tell "git did not answer" from "git said no".
    trace($, 'git', verb, () => ({ args, cwd, error: String(error) }), Date.now() - started)

    return { exitCode: -1, stdout: '' }
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

// --- The license: personal or commercial use, and the commercial key. Nothing here ever stops the tutor.

/** `license.json` as it stands. */
async function readLicense($: EngineInterface): Promise<LicenseRecord> {
  await resolveHome($)

  return dataRoot === '' ? parseLicense(null) : parseLicense(await storeOf($).read(licensePath(dataRoot)))
}

/** Changes `license.json`, and the pane's line with it. */
async function changeLicense($: EngineInterface, change: (record: LicenseRecord) => LicenseRecord): Promise<LicenseRecord> {
  await resolveHome($)
  if (dataRoot === '') return change(parseLicense(null))
  const record = await updateJson(storeOf($), licensePath(dataRoot), parseLicense, change)
  trace($, 'state', 'license', () => ({ use: record.use, hasKey: record.key !== '', answer: record.answer }))

  return record
}

/** Whether a server may be asked about a key: there is one, and Claude Code's own switch for inessential traffic is not on. */
async function hasLicenseServer($: EngineInterface): Promise<boolean> {
  return LICENSE_SERVER !== '' && (await $.env.get('CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC')) === undefined
}

/** Where the person stands, worked out from the record and the key. */
async function standingOf($: EngineInterface, record: LicenseRecord): Promise<{ standing: Standing; check: KeyCheck | null }> {
  const check = record.key === '' ? null : await checkKey(record.key)
  const facts = licenseFacts(record, check, await $.clock.now(), await hasLicenseServer($))

  return { standing: licenseStanding(facts), check }
}

/** Puts the license's line under the pane's status line, or takes it away. */
async function showLicense($: EngineInterface, given?: LicenseRecord): Promise<void> {
  try {
    const record = given ?? (await readLicense($))
    const { standing, check } = await standingOf($, record)
    await update($, licenseAtom, () => licenseLine(standing, check, record))
  } catch (error) {
    fail($, 'could not show the license', error)
  }
}

/** At a fresh switch-on: the question, once ever, then a look at the key when one is due. */
async function startLicense($: EngineInterface): Promise<void> {
  let record = await readLicense($)
  if (!record.isAsked) record = await askLicense($)
  await showLicense($, record)
  void checkLicense($, record)
}

/**
 * Personal or commercial, and for commercial the key. Dismissing either
 * question is an answer too: nothing is chosen, and nothing is asked again
 * unprompted. `/backseat license` changes it at any time.
 */
async function askLicense($: EngineInterface): Promise<LicenseRecord> {
  let answer: string
  try {
    answer = await askPerson($, USE_QUESTION, { options: [...USE_CHOICES], header: USE_HEADER })
  } catch {
    return await changeLicense($, record => ({ ...record, isAsked: true }))
  }
  const use = useOfAnswer(answer)
  // A key typed straight into the first question is taken as commercial use with that key.
  if (use === null && looksLikeKey(answer)) return await addKey($, answer)
  const chosen = await changeLicense($, record => ({ ...record, isAsked: true, use: use ?? record.use }))
  if (answer !== COMMERCIAL_CHOICE || chosen.key !== '') return chosen
  try {
    const key = await askPerson($, KEY_QUESTION, { options: [...KEY_CHOICES], header: KEY_HEADER })
    if (looksLikeKey(key)) return await addKey($, key)
  } catch {
    // Later, then.
  }

  return chosen
}

/** Keeps a pasted key, says what was made of it, and asks the server about it when there is one. */
async function addKey($: EngineInterface, pasted: string): Promise<LicenseRecord> {
  const now = await $.clock.now()
  const record = await changeLicense($, stored => withKey(stored, cleanKey(pasted), now))
  await showLicense($, record)
  void checkLicense($, record)

  return record
}

/**
 * Asks the license server whether the key still stands, when that is due:
 * about once a week, a day after a try that got no answer. No answer is no
 * news: the key keeps counting as good. Only the key's id is sent.
 */
async function checkLicense($: EngineInterface, record: LicenseRecord): Promise<void> {
  try {
    if (record.key === '' || !(await hasLicenseServer($))) return
    const check = await checkKey(record.key)
    const now = await $.clock.now()
    const due = nextLicenseCheck(licenseFacts(record, check, now, true))
    if (due === null || due > now || check.state === 'malformed') return
    await changeLicense($, stored => (stored.key === record.key ? { ...stored, triedAt: now } : stored))
    let answer: ReturnType<typeof parseAnswer> = null
    try {
      const response = await $.http.fetch(checkUrl(LICENSE_SERVER, check.payload.id), { headers: { accept: 'application/json' } })
      answer = parseAnswer(response.status, response.text)
      trace($, 'license', 'checked', () => ({ status: response.status, answer }))
    } catch (error) {
      trace($, 'license', 'not reached', () => ({ error: String(error) }))
    }
    if (answer === null) return
    const kept = await changeLicense($, stored => (stored.key === record.key ? { ...stored, answer, answeredAt: now } : stored))
    await showLicense($, kept)
  } catch (error) {
    fail($, 'could not check the license key', error)
  }
}

/** `/backseat license`: where they stand, a change of use, a key, or the key taken away. Works while the tutor is off. */
async function licenseCommand($: EngineInterface, asked: LicenseRequest): Promise<string> {
  try {
    await resolveHome($)
    if (dataRoot === '') return 'There is no home directory, so there is nowhere to keep that.'
    let record: LicenseRecord
    switch (asked.kind) {
      case 'status':
        record = await readLicense($)
        break
      case 'use':
        record = await changeLicense($, stored => ({ ...stored, isAsked: true, use: asked.use }))
        break
      case 'clear-key':
        record = await changeLicense($, stored => ({ ...stored, key: '', keySince: 0, answer: null, answeredAt: 0, triedAt: 0 }))
        break
      case 'key':
        if (!looksLikeKey(asked.key)) return 'That is not a license key: one starts with BSD1. /backseat license personal, commercial or clear change the rest.'
        record = await addKey($, asked.key)
        break
    }
    await showLicense($, record)
    const { standing, check } = await standingOf($, record)

    return licenseStatus(standing, check)
  } catch (error) {
    fail($, 'could not change the license', error)

    return 'Could not do that just now. Nothing was changed.'
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
    // A release already known shows before the network is asked: offline, the check returned before it did (the caching audit, 2026-10-06).
    if (latest !== '') await update($, updateAtom, () => updateNotice(version, parseVersion(latest)))
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

/** `/backseat update`: fetches the newest release the way this copy was installed. */
async function runUpdate($: EngineInterface): Promise<void> {
  const install = await detectInstall($)
  if (install.kind === 'clone') {
    const changed = (await git($, install.top, ['status', '--porcelain', '--untracked-files=no'])).stdout.trim()
    if (changed !== '') {
      tellPerson($, `This copy, in ${install.top}, has changes of its own, so it was not updated. Commit or stash them, then run /backseat update again.`)

      return
    }
    const before = (await git($, install.top, ['rev-parse', 'HEAD'])).stdout.trim()
    const pulled = await git($, install.top, ['pull', '--ff-only'], true)
    if (pulled.exitCode !== 0) {
      tellPerson($, `git pull in ${install.top} did not work: ${(pulled.stderr ?? pulled.stdout).trim().split('\n')[0] ?? 'no reason given'}. Nothing was changed.`)

      return
    }
    await update($, updateAtom, () => '')
    const after = (await git($, install.top, ['rev-parse', 'HEAD'])).stdout.trim()
    tellPerson(
      $,
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
        tellPerson($, `${shellLine(argv)} did not work: ${result.output.split('\n')[0] ?? ''}. Run it in a terminal to see why.`)

        return
      }
    }
    await update($, updateAtom, () => '')
    const now = await installedVersion($, install.id)
    if (now !== '' && now === was) {
      tellPerson($, `Already up to date: ${now} is the newest release.`)

      return
    }
    tellPerson($, `Updated${now === '' ? '' : ` to ${now}`}. Reloading plugins: the tutor stays as it is.`)
    try {
      await $.command.run({ command: 'reload-plugins', args: '' })
    } catch {
      tellPerson($, 'Run /reload-plugins to start using the new version.')
    }

    return
  }
  if (install.kind === 'synced') {
    tellPerson($, 'This copy comes from your claude.ai organization, which sends updates by itself. Run /reload-plugins to start using one that has arrived.')

    return
  }
  tellPerson($, 'This copy was not installed from a marketplace or cloned with git, so it cannot update itself. Install it as the README says to get updates.')
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

/** `/backseat uninstall`: removes the plugin after asking, and erases what it remembers when told to. */
async function runUninstall($: EngineInterface, settings: Settings): Promise<void> {
  await resolveHome($)
  const answer = await choose($, UNINSTALL_QUESTION, [UNINSTALL_KEEP, UNINSTALL_ERASE, UNINSTALL_ONLY])
  if (answer !== UNINSTALL_ERASE && answer !== UNINSTALL_ONLY) {
    tellPerson($, 'Nothing was removed.')

    return
  }
  if (answer === UNINSTALL_ERASE && !isPhrase((await choose($, PHRASE_QUESTION, PHRASE_OPTIONS)) ?? '')) {
    tellPerson($, 'Nothing was removed.')

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
  tellPerson($, said.join(' '))
}



/** What keeping the journal needs from Claude Code. */
function journalPortsOf($: EngineInterface): JournalPorts {
  return {
    ...hostOf($, null),
    showWorking: async working => void (await update($, workingAtom, (): Working => working)),
    file: root => (dataRoot === '' ? '' : journalPath(dataRoot, root)),
    read: (root, path) => readSource($, root, path),
    readEditor: async () => {
      await readFocus($)

      return followState.focusText
    },
    watcher: () => watcher,
  }
}

/** Writes the journal when it is due, or now when `isForced`. A write that fails is made again with the next one. */
async function flushJournal($: EngineInterface, journal: Recorder, now: number, isForced: boolean): Promise<void> {
  await flushJournalOf(journalPortsOf($), journal, now, isForced)
}

/** Tells the pane what they are working on, when that has changed since it was last told. */
async function showWorking($: EngineInterface, now: number): Promise<void> {
  await showWorkingOf(journalPortsOf($), journalState, now)
}

/** The journal's part of a scan: what was just saved and what it changed, and the time the caret has spent where it is. */
async function keepJournal($: EngineInterface, active: Watcher, now: number): Promise<void> {
  await keepJournalOf(journalPortsOf($), journalState, active, now)
}

/** The journal's deadline came: a write is due, or the time the caret has spent somewhere is worth an entry. */
async function journalDue($: EngineInterface): Promise<void> {
  await journalDueOf(journalPortsOf($), journalState)
}

/** Starts the journal of this project, once the watcher has read the tree. */
async function startJournal($: EngineInterface, run: number, isFresh: boolean): Promise<void> {
  await startJournalOf(journalPortsOf($), journalState, run, isFresh)
}

/** Records what they said they are working on, or takes it back with ''. It is saved at once. */
async function sayWorking($: EngineInterface, said: string): Promise<void> {
  await sayWorkingOf(journalPortsOf($), journalState, said)
}

/**
 * What the journal says, for the conversation of a session that keeps none of
 * its own (one that does not drive): the brief that goes with a prompt, or the
 * glance the `activity` tool answers with. '' outside a repository.
 */
async function storedJournalText($: EngineInterface, as: 'brief' | 'glance'): Promise<string> {
  if (repoRoot === '') return ''
  try {
    const seen = await storedSeenOf(journalPortsOf($), repoRoot)

    return seen === null ? '' : as === 'brief' ? briefText(seen) : glanceText(seen)
  } catch (error) {
    fail($, 'could not read the journal', error)

    return ''
  }
}

/** Asks what they are working on. Dismissing the dialog leaves everything as it is. */
async function askWorking($: EngineInterface): Promise<void> {
  // A session that keeps no journal of its own (one that does not drive) asks from what its pane shows, and what
  // they answer goes into the journal on disk.
  const working = journalState.recorder?.working(await $.clock.now()) ?? (await read($, workingAtom))
  let answer = ''
  try {
    answer = await askPerson($, WORKING_QUESTION, { options: workingChoices(working), header: WORKING_HEADER })
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
  } catch (error) {
    // Not readable just now is not empty: what is held stands until the file reads again (the caching audit, 2026-10-06).
    fail($, 'could not read the profile', error)

    return profiles.subjects[subject] ?? emptyProfile()
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
  let next: Profile
  try {
    next =
      dataRoot === ''
        ? change(profiles.subjects[subject] ?? emptyProfile())
        : await updateJson(storeOf($), profilePath(dataRoot, subject), parseProfile, change, { keepBackup: true })
  } catch (error) {
    // The file could not be read or written: nothing of it changes, in memory either. A read that failed once must not
    // reset a profile (the caching audit, 2026-10-06), and a look does not fail for it.
    fail($, 'could not keep the profile', error)

    return
  }
  const before = aboutPerson()
  profiles = { ...profiles, subjects: { ...profiles.subjects, [subject]: next } }
  await update($, profilesAtom, () => profiles)
  // Every look counts itself in the profile. The reviewer is told only what changes what it is told.
  if (aboutPerson() !== before) await registerReviewer($, settings)
}

/** Loads the profiles of languages that have just come into play. */
async function bringIntoPlay($: EngineInterface, languages: readonly string[]): Promise<void> {
  const added = [...new Set(languages)].filter(language => !profiles.languages.includes(language))
  if (added.length === 0) return
  const subjects = { ...profiles.subjects }
  for (const language of added) subjects[language] = await loadSubject($, language)
  profiles = { languages: [...profiles.languages, ...added], subjects }
  await update($, profilesAtom, () => profiles)
  for (const language of added) progressState.records.set(language, await loadRecord($, language))
  await setProgress($, { records: profiles.languages.map(language => progressState.records.get(language) ?? emptyRecord(language)) })
  // The lessons of the languages in play are listed first.
  await showLessons($)
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
      answers.push(await askPerson($, question.question, { options: question.options, header: question.header }))
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
  if (kept.length !== open.length) void saveNotes($)

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
    name: 'lesson',
    description:
      'Backseat Driver: the learning paths (lessons) installed, and where the user is in each. Without a path it lists them. With a path and no outcome it reads that path to you, step by step, with what is done. With an outcome it records one step: "done" once the user has shown you, in their own code or their own words, that they can do it (never for work you did); "help" when they needed you to walk them through part of it. A step that is not named is the next one not done. Call it with no arguments when they ask what lessons there are or what to study.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'The path id, as the list gives it.' },
        step: { type: 'number', description: 'The step number, from 1. Leave it out for the next step not done.' },
        outcome: { type: 'string', enum: ['done', 'help'], description: 'What to record. Leave it out to read the path.' },
      },
    },
  })
  await $.tool.register({
    name: 'profile',
    description:
      'Backseat Driver: read what is on record about the user for a language that is not in play in this project, for example to explain an idea by comparison with a language they know.',
    inputSchema: { type: 'object', properties: { language }, required: ['language'] },
  })
  await $.tool.register({
    name: 'issue',
    description:
      "Backseat Driver: the issues the deep review keeps for this project, ranked. With no id, lists the open ones with their ids and what the last audit read. With an id, records the deep reviewer's verdict on an issue the user contested: status open (with severity when the reviewer weighs it otherwise), partly or resolved, and a note saying why. Only the reviewer's verdict: the user dismisses issues in the pane.",
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'The issue, by its id. Leave it out to list the open issues.' },
        status: { type: 'string', enum: ['open', 'partly', 'resolved'], description: "The reviewer's verdict." },
        severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', ''], description: 'How bad the reviewer now says it is, or empty for unchanged.' },
        note: { type: 'string', description: 'Why, in a few words: what remains, or why it is resolved.' },
      },
    },
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
 * becomes notes (`core/look.ts`). `isAsked` is true when the user pressed
 * "look now".
 */
async function look($: EngineInterface, settings: Settings, isAsked: boolean): Promise<void> {
  if (!leaseState.isDriver) {
    if (isAsked) toastPerson($, FOLLOWING)

    return
  }
  await runLook(lookPortsOf($, settings), lookState, isAsked)
}

/** What a look asks of Claude Code, each made from `$` and read at the moment the look needs it. */
function lookPortsOf($: EngineInterface, settings: Settings): LookPorts {
  return {
    ...hostOf($, settings),
    settings,
    watcher: () => watcher,
    lastChangeAt: () => lastChangeAt,
    showPlay: () => showPlay($, settings),
    holdDeadline: () => schedulerOf($).cancel('look'),
    planNext: () => planLook($, settings),
    bringIntoPlay: languages => bringIntoPlay($, languages),
    currentInsights: files => currentInsights($, files),
    brief: (files, isCurrent) => (project === null ? '' : projectBrief(project, files, isCurrent)),
    glance: async () => journalState.recorder?.glance(await $.clock.now()) ?? '',
    system: bubble =>
      reviewerSystem(lookInstructions, [bubble === null ? '' : bubbleInstructions, aboutPerson()], persona),
    profiles: () => profiles,
    notes: {
      open: () => read($, notesAtom),
      dismissed: () => read($, dismissedAtom),
      change: apply => update($, notesAtom, apply),
    },
    notePrints,
    saveNotes: () => saveNotes($),
    saveSubject: (subject, change) => saveSubject($, settings, subject, change),
    issues: {
      forLook: texts => lookIssues(ledger, texts),
      rule: async rulings => {
        // Nothing to say: the files changed, so the issues are placed again.
        if (rulings.length === 0) return void (await showIssues($))
        const at = await $.clock.now()
        trace($, 'state', 'issues ruled by the look', () => ({ rulings }))
        await changeIssues($, current => ruledIssues(current, 'look', at, rulings.map(ruling => ({ ...ruling, severity: '' as const }))).ledger)
      },
    },
    recorder: () => journalState.recorder,
    showWorking: now => showWorking($, now),
    say: text => say($, text),
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
  return reviewSlotFree(reviewState)
}

/** Holds the review slot while a review is started or the end of one is recorded (`core/reviewing.ts`). */
async function withReviewSlot($: EngineInterface, settings: Settings, work: () => Promise<unknown>): Promise<void> {
  await holdReviewSlot(reviewPortsOf($, settings), reviewState, work)
}

/**
 * Hands a scope to the deep reviewer. Its answer arrives later, at
 * `turn.complete`. Resolves false when the reviewer did not start. The
 * caller holds the review slot.
 */
async function startReview($: EngineInterface, settings: Settings, scope: ReviewScope): Promise<boolean> {
  const subject = scopeSubject(scope)
  await setReview($, { state: 'running', subject, text: '', isUnseen: false, decisions: [], insights: [] })
  // Not the request that finds out whether Claude is back after a wait: a reviewer says so only when it ends,
  // minutes later, and every look and lookup would wait that long. The first model request finds out.
  let refusal = 'the reviewer did not start'
  await setReview($, { since: await $.clock.now() })
  try {
    const prompt = reviewRequest(
      scope,
      { overview: project === null ? '' : overviewLine(project), earlier: reviewDigest(reviews), issues: issuesContext(scope), notes: await notesForReview($, scope) },
      journalState.recorder?.glance(await $.clock.now()) ?? '',
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
      reviewState.reviewAgentId = agentId
      reviewState.reviewScope = scope
      reviewState.reviewFailure = ''
      reviewState.reviewFailureNoted = null
      reviewState.reviewStartedAt = await $.clock.now()
      // A reviewer that never reports back would otherwise keep every later review waiting behind it.
      schedulerOf($).set('review-watchdog', reviewState.reviewStartedAt + WATCHDOG_MS, () => reviewWatchdog($, settings))

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
  const [tab, issues, selectedIssue, notes, dismissed, selected, watch, review, shownProfiles, explain, progress, release, working] = await Promise.all([
    read($, tabAtom),
    read($, issuesAtom),
    read($, selectedIssueAtom),
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
  carried = { tab, issues, selectedIssue, notes, dismissed, selected, watch, review, profiles: shownProfiles, explain, progress, update: release, working }
}

/** Puts back what `carryPane` read out. Without it, as after `/branch`, what this module can work out again is shown again. */
async function restorePane($: EngineInterface, settings: Settings): Promise<void> {
  const kept = carried
  carried = null
  void showSettings($)
  void showLessons($)
  if (kept === null) {
    await update($, profilesAtom, () => profiles)
    await showProgress($, settings)
    await showPlay($, settings)
    await refreshView($)
    // The notes and the review went with the state, and nothing was read out before: they come back from the project's folder.
    try {
      if (leaseState.isDriver) await restorePaneFromDisk($, true)
      else {
        followedStamps = null
        await followProject($, settings)
      }
    } catch (error) {
      fail($, 'could not take the pane up from disk', error)
    }

    return
  }
  trace($, 'state', 'pane restored', () => ({ notes: kept.notes.length, review: kept.review.state, tab: kept.tab }))
  await Promise.all([
    update($, tabAtom, () => kept.tab),
    update($, issuesAtom, (): IssuesState => kept.issues),
    update($, selectedIssueAtom, () => kept.selectedIssue),
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

/** Shows a tab. */
async function showTab($: EngineInterface, tab: Tab): Promise<void> {
  await update($, tabAtom, () => tab)
  if (tab === 'review') await setReview($, { isUnseen: false })
  if (tab === 'explain') watchClosely($)
  void scrollToTop($)
}

/**
 * The pane's window back to its top. Claude Code keeps a pane's offset across
 * a change of what it draws, so a tab opened after a long review had been
 * read stood scrolled past its own controls and keys row (the seventh
 * ui-truth pass, 2026-10-06: fourteen minutes with the tabs, the status and
 * `❯ 2` above the frame, and nobody had scrolled it). A refusal, as with no
 * pane open, is nothing.
 */
async function scrollToTop($: EngineInterface): Promise<void> {
  try {
    const result = await $.ui.scroll({ in: PANE_ID, to: 'start' })
    trace($, 'ui', 'scroll to top', () => result)
  } catch (error) {
    // A host that cannot scroll a pane (the kit has no stub for it) says so in the log, and nothing is told.
    trace($, 'ui', 'scroll to top', () => ({ refused: String(error) }))
  }
}

/** Said once in a process that carries the tutor on from the one its conversation left. */
const CARRIED_ON = 'Backseat Driver is still on. It came along with the conversation.'

/** What carrying the tutor from one process of a conversation to the next needs from Claude Code. */
function carryPortsOf($: EngineInterface, settings: Settings): CarryPorts {
  return {
    ...hostOf($, settings),
    born: async () => (await $.session.usage()).startedAt,
    cwd: async () => await $.session.cwd(),
    surfaces: async () => (await $.session.surfaces()).length,
    comeUp: (to, from) => comeUp($, settings, to, from),
    standDown: () => standDown($, settings),
  }
}

/**
 * For a process that started by forking or resuming a conversation: the tutor
 * comes up as that conversation had it a moment ago, in the process it left.
 * One read of one small file, and nothing more when it was not on there.
 */
async function carryOn($: EngineInterface, settings: Settings): Promise<void> {
  await resolveHome($)
  await carryOnOf(carryPortsOf($, settings), carryState)
}

/**
 * The conversation this process continues had the tutor on a moment ago:
 * it is switched on here as it was there, with no questions asked again. The
 * lease that session held is this one's from the start.
 */
async function comeUp($: EngineInterface, settings: Settings, to: 'on' | 'paused', from: string): Promise<void> {
  await switchTo($, to, settings, { carriedFrom: from })
  tellPerson($, CARRIED_ON)
}

/**
 * The conversation left this process, which draws nowhere now. The tutor is
 * laid down here, lease and all, as when it is switched off. What it said of
 * itself in `sessions.json` stays, marked as gone, for the process that
 * carries on from it.
 */
async function standDown($: EngineInterface, settings: Settings): Promise<void> {
  try {
    await switchTo($, 'off', settings, { isStandingDown: true })
  } catch (error) {
    fail($, 'could not lay the tutor down', error)
  }
}

/** Says, where every session reads it, that this one has the tutor on, or that its mode changed. */
async function sayOn($: EngineInterface, settings: Settings, isChanged: boolean): Promise<void> {
  await sayOnOf(carryPortsOf($, settings), carryState, isChanged)
}

/** Whether this session still draws anywhere. One that does not lays the tutor down. */
async function checkBound($: EngineInterface, settings: Settings): Promise<void> {
  await checkBoundOf(carryPortsOf($, settings), carryState)
}

/**
 * What a session with the tutor on looks at about itself, now and then:
 * whether it still draws anywhere, whether it is time to say again that it
 * is on, and whether the debug log was switched from outside. Nothing tells
 * it any of the three.
 */
async function checkSelf($: EngineInterface, settings: Settings, firedAt: number | null = null): Promise<void> {
  await checkSelfOf(
    carryPortsOf($, settings),
    carryState,
    async () => {
      await followDebug($, settings)
      await noticeRepository($, settings)
    },
    firedAt,
  )
}

/** True while a repository that appeared is being taken up, so that two looks at itself do not both start. */
let isNoticingRepository = false

/**
 * A folder that becomes a repository while the tutor is on is taken up at
 * the next look at itself: the owner switched on in `~/repos/php-hello/public_html`
 * before `git init`, and the session never noticed the repository, the first
 * commit or the saves (the ninth ui-truth pass, 2026-10-07). Taken up as at
 * a fresh switch-on, so that the project gets its first look around.
 */
async function noticeRepository($: EngineInterface, settings: Settings): Promise<void> {
  if (mode !== 'on' || repoRoot !== '' || isNoticingRepository) return
  isNoticingRepository = true
  try {
    const top = await git($, await sessionCwd($), ['rev-parse', '--show-toplevel'])
    if (top.exitCode !== 0 || top.stdout.trim() === '' || mode !== 'on' || repoRoot !== '') return
    trace($, 'watch', 'repository appeared', () => ({ root: top.stdout.trim() }))
    engagement += 1
    await engage($, settings, engagement, true, null, null)
    toastPerson($, REPOSITORY_APPEARED)
  } finally {
    isNoticingRepository = false
  }
}

/** What a session that does not drive says when it is asked for a look or a review. */
const FOLLOWING = 'Another session is driving Backseat Driver in this project. Ask for it there.'

/**
 * When the session that drives began, as a clock time, when `sessions.json`
 * knows it, else '': the pane of a session that does not drive says so under
 * its controls, since the usual driver is the person's own session left on
 * from the night before (owner, 2026-10-06: "if that's you then that's
 * fine"). Two small reads, at every beat.
 */
async function showDriver($: EngineInterface): Promise<void> {
  if (repoRoot === '' || dataRoot === '') return
  let driver = ''
  try {
    const lease = parseLease(await storeOf($).read(leasePath(dataRoot, repoRoot)))
    const entry = parseSessions(await storeOf($).read(sessionsPath(dataRoot))).sessions.find(entry => entry.session === lease.session)
    if (entry !== undefined) driver = clockTime(entry.born)
  } catch {
    // Nothing to say, then.
  }
  if ((await read($, watchAtom)).driver === driver) return
  await update($, watchAtom, (w): Watch => ({ ...w, driver }))
}

/**
 * Tries for the project's lease, or renews it, and takes up or lays down the
 * driving when that changes who drives. Called at switch-on, when the
 * `lease` deadline comes, and after `/clear`, which gives the session
 * another id.
 */
async function keepLease($: EngineInterface, settings: Settings, run: number): Promise<void> {
  await keepLeaseOf(leasePortsOf($, settings), leaseState, run)
}

/** Gives the lease back, so that a session waiting for it does not have to wait for it to run out. */
async function giveLease($: EngineInterface, path: string, holder: string): Promise<void> {
  await giveLeaseOf({ store: () => storeOf($), fail: (what, error) => fail($, what, error) }, path, holder)
}

/** What holding the lease needs from Claude Code. */
function leasePortsOf($: EngineInterface, settings: Settings): LeasePorts {
  return {
    ...hostOf($, settings),
    startDriving: run => startDriving($, settings, run),
    stopDriving: () => stopDriving($, settings),
    followDriver: () => followDriver($, settings),
  }
}

/**
 * The session that drove this project is gone, or gave the lease back, and
 * this one drives now. The working tree as it stands is where it starts
 * from, as when the tutor is switched on.
 */
async function startDriving($: EngineInterface, settings: Settings, run: number): Promise<void> {
  if (run !== engagement) return
  // Everything starts again, as at a reload, this time as the driver: the watcher, the journal, what is known of
  // the project, Explain, the lease's own renewal. What the pane showed for the driver before comes back from the
  // project's folder. Starting the watcher alone laid all of that down and left this session driving without it.
  followedStamps = null
  await update($, watchAtom, (w): Watch => {
    const { driver: _driver, ...rest } = w

    return rest
  })
  engagement += 1
  await engage($, settings, engagement, false, null, '')
}

/**
 * Another session drives this project now: nothing here scans, looks,
 * reviews or keeps the journal. What the journal held goes to disk, for the
 * session that does.
 */
async function stopDriving($: EngineInterface, settings: Settings): Promise<void> {
  const plan = schedulerOf($)
  for (const name of ['scan', 'look', 'review', 'assess', 'review-timer', 'journal']) plan.cancel(name)
  stopPushing()
  const leaving = journalState.recorder
  journalState.recorder = null
  reviewState.waiting = EMPTY_QUEUE
  if (leaving !== null) await flushJournal($, leaving, await $.clock.now(), true)
  await showWorking($, await $.clock.now())
  await showPlay($, settings)
}

/**
 * What the beat of the lease also does in a session that does not drive, each
 * of which the driver does from its scan: what is on record about the person
 * (another session may have changed it), the editors' files (the light), and
 * what the driver keeps in the project's folder for the pane.
 */
async function followDriver($: EngineInterface, settings: Settings): Promise<void> {
  if (mode === 'off' || leaseState.isDriver) return
  await refreshShared($, settings)
  // The editors' files: the light, and the caret for the Explain tab (there is no journal here for it to feed).
  await pollFocus($)
  await followProject($, settings)
  await showDriver($)
}

/** The files the driver writes for the pane. A change in one is what makes a session that does not drive read it again. */
const FOLLOWED_FILES: readonly string[] = ['notes.json', 'reviews.json', 'queue.json', 'journal.json', 'project.json', FINDINGS_FILE]

/** Those files as they are now, each as its size and time. One listing. */
async function projectStamps($: EngineInterface): Promise<Record<string, string>> {
  const stamps: Record<string, string> = {}
  try {
    for (const entry of await $.fs.list(projectDir(dataRoot, repoRoot))) {
      if (FOLLOWED_FILES.includes(entry.name)) stamps[entry.name] = `${entry.size}:${entry.mtimeMs}`
    }
  } catch {
    // No folder yet: nothing has been written about this project.
  }

  return stamps
}

/**
 * The pane of a session that does not drive shows what the driver keeps in
 * the project's folder: its open notes, the last deep review and the ones
 * before it, how many commits wait for theirs, and what the journal says
 * they are working on. Taken up at switch-on, and again at each beat of the
 * lease for every file that changed since. Until 2026-10-06 such a session
 * showed nothing of the project: the owner opened one beside a session left
 * on from the night before, found the Deep review tab empty, and took the
 * cache for broken.
 */
async function followProject($: EngineInterface, settings: Settings): Promise<void> {
  if (mode === 'off' || leaseState.isDriver || repoRoot === '' || dataRoot === '') return
  const stamps = await projectStamps($)
  const before = followedStamps
  followedStamps = stamps
  const isFirst = before === null
  const isChanged = (name: string): boolean => before === null || stamps[name] !== before[name]
  try {
    if (isChanged('notes.json')) await followNotes($, isFirst)
    if (isChanged('reviews.json') || isChanged('queue.json') || isChanged('project.json')) await followReviews($, settings, isFirst)
    if (isChanged('journal.json')) {
      await showStoredWorkingOf(journalPortsOf($), journalState, repoRoot)
      await noteSavedFiles($)
    }
    if (isChanged(FINDINGS_FILE)) await loadIssues($)
  } catch (error) {
    fail($, 'could not take up what the driver wrote', error)
  }
}

/** The driver's open notes: those still true of the files, less any dismissed here. */
async function followNotes($: EngineInterface, isFirst: boolean): Promise<void> {
  const kept = parseKeptNotes(await storeOf($).read(notesPath()))
  const now = await printsNow($, kept)
  const dismissed = await read($, dismissedAtom)
  const open = stillOpen(kept, now).filter(note => !dismissed.some(gone => gone.file === note.file && gone.topic === note.topic))
  if (JSON.stringify(await read($, notesAtom)) !== JSON.stringify(open)) {
    trace($, 'state', 'notes taken up', () => ({ notes: open.length, of: kept.notes.length, isFirst }))
    await update($, notesAtom, () => open)
  }
  if (open.length > 0) lookState.nextNoteId = Math.max(lookState.nextNoteId, ...open.map(note => note.id + 1))
  if (isFirst && dismissed.length === 0 && kept.dismissed.length > 0) await update($, dismissedAtom, () => kept.dismissed)
}

/** The driver's last deep review and the ones before it, and how many commits wait for theirs. One that landed since the last beat is news. */
async function followReviews($: EngineInterface, settings: Settings, isFirst: boolean): Promise<void> {
  const folder = projectDir(dataRoot, repoRoot)
  reviews = parseReviews(await storeOf($).read(`${folder}/reviews.json`))
  project = parseProject(await storeOf($).read(`${folder}/project.json`), repoRoot)
  const waiting = current(parseQueue(await storeOf($).read(queuePath())), await $.clock.now())
  const count = waiting.commits.filter(commit => !commit.isReviewed).length
  const last = reviews.at(-1) ?? project.survey ?? undefined
  const review = await read($, reviewAtom)
  const isNews = last !== undefined && (review.subject !== last.subject || review.text !== last.text)
  const landed: Partial<Review> =
    last !== undefined && isNews
      ? {
          state: 'done',
          subject: last.subject,
          text: last.text,
          isUnseen: !isFirst && ((await read($, tabAtom)) !== 'review' || !(await isTabShown())),
          decisions: last.decisions ?? [],
          insights: last.insights ?? [],
        }
      : {}
  const change: Partial<Review> = {
    ...landed,
    ...(isNews || (review.older?.length ?? 0) !== historyOf().length ? { older: historyOf() } : {}),
    ...(count !== (review.waiting ?? 0) ? { waiting: count } : {}),
  }
  if (Object.keys(change).length === 0) return
  trace($, 'state', 'reviews taken up', () => ({ review: last?.subject ?? null, isNews, isFirst, waiting: count, older: reviews.length }))
  await setReview($, change)
  if (last === undefined || !isNews || isFirst) return
  if (landed.isUnseen === true) toastPerson($, `Deep review ready: ${last.subject}`)
  // The driver's character spoke the review's closing line there. This pane's does here.
  if (settings.isAnimated) await say($, `Review's in. ${closingLine(last.text)}`)
}

/** The lesson records' folders of the languages in play, each file's name, size and time in one string. */
async function lessonsPrint($: EngineInterface): Promise<string> {
  const parts: string[] = []
  for (const language of [...profiles.languages, 'general']) {
    try {
      for (const entry of await $.fs.list(lessonsDir(dataRoot, language))) {
        if (entry.name.endsWith('.json')) parts.push(`${language}/${entry.name}:${entry.size}:${entry.mtimeMs}`)
      }
    } catch {
      // No record of that language yet.
    }
  }

  return parts.sort().join('\n')
}

/**
 * The driver takes up what another session wrote into the journal (what they
 * said they are working on, from a session that keeps none of its own),
 * without a write of its own: an idle driver never flushes, so it never
 * merged (the caching audit, 2026-10-06). One stat at each look at the shared files.
 */
async function resyncJournal($: EngineInterface): Promise<void> {
  const journal = journalState.recorder
  if (journal === null || repoRoot === '' || dataRoot === '') return
  const stamp = await fileStamp($, journalPath(dataRoot, repoRoot))
  if (stamp === journalStamp) return
  journalStamp = stamp
  try {
    await journal.resync(await $.clock.now())
    await showWorking($, await $.clock.now())
  } catch (error) {
    fail($, 'could not take up the journal', error)
  }
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
  await resyncJournal($)
  // An issue dismissed or brought back in another session: the ledger is read again.
  if (leaseState.isDriver && findingsPath() !== '' && (await fileStamp($, findingsPath())) !== findingsStamp) await loadIssues($)
  const print = await sharedPrint($)
  const lessons = await lessonsPrint($)
  const areLessonsNew = lessonsStamp !== null && lessons !== lessonsStamp
  lessonsStamp = lessons
  if (print === sharedStamp && !areLessonsNew) return
  const isFirst = sharedStamp === null
  sharedStamp = print
  // The first reading is of what was loaded a moment ago.
  if (isFirst && !areLessonsNew) return
  if (areLessonsNew) await loadLessons($)

  const subjects: Record<string, Profile> = { ...profiles.subjects }
  for (const subject of Object.keys(profiles.subjects)) subjects[subject] = await loadSubject($, subject)
  const areProfilesNew = JSON.stringify(subjects) !== JSON.stringify(profiles.subjects)
  if (areProfilesNew) {
    profiles = { ...profiles, subjects }
    await update($, profilesAtom, () => profiles)
    const open = await read($, notesAtom)
    const kept = open.filter(note => !isHushed(profiles, languageOf(note.file), note.topic))
    if (kept.length !== open.length) {
      await update($, notesAtom, () => kept)
      void saveNotes($)
    }
  }
  let isProgressNew = false
  if (settings.isProgressOn) {
    for (const language of profiles.languages) {
      const record = await loadRecord($, language)
      if (JSON.stringify(record) === JSON.stringify(progressState.records.get(language))) continue
      progressState.records.set(language, record)
      isProgressNew = true
    }
    if (isProgressNew) await setProgress($, { records: profiles.languages.map(language => progressState.records.get(language) ?? emptyRecord(language)) })
  }
  if (!areProfilesNew && !isProgressNew && !areLessonsNew) return
  trace($, 'state', 'shared', () => ({ areProfilesNew, isProgressNew, areLessonsNew }))
  // The reviewer is told about the person when it is registered, so it is registered again.
  await registerReviewer($, settings)
}

/** Where the project's open and dismissed notes are kept, or '' where there is no project folder. */
function notesPath(): string {
  return repoRoot === '' || dataRoot === '' ? '' : `${projectDir(dataRoot, repoRoot)}/notes.json`
}

/**
 * Keeps the open and dismissed notes in the project's folder, so that a
 * session that is closed, or a machine that restarts, finds them again.
 * Only the driver writes them: it is the one that looks.
 */
async function saveNotes($: EngineInterface): Promise<void> {
  const path = notesPath()
  if (path === '' || !leaseState.isDriver || mode === 'off') return
  try {
    const [notes, dismissed] = await Promise.all([read($, notesAtom), read($, dismissedAtom)])
    const kept = keepNotes(notes, dismissed, notePrints)
    await updateJson(storeOf($), path, parseKeptNotes, () => kept)
  } catch (error) {
    fail($, 'could not keep the notes', error)
  }
}

/** The fingerprint today of each file the kept notes are about, and none for a file that is gone. */
async function printsNow($: EngineInterface, kept: KeptNotes): Promise<Map<string, string>> {
  const now = new Map<string, string>()
  for (const file of Object.keys(kept.prints)) {
    const text = await readSource($, repoRoot, file)
    if (text !== null) now.set(file, sourcePrint(text))
  }

  return now
}

/**
 * Takes up what the project's folder holds from an earlier session: the notes
 * whose files still read as they did when the notes were raised, the
 * dismissed notes, and, when the tab has nothing to show, the last deep
 * review. A note about text that has changed since is left out: the next look
 * at that file says what is true of it. The driver's; a session that does not
 * drive takes the folder up in `followProject`, and keeps taking it up.
 */
async function restorePaneFromDisk($: EngineInterface, isFresh: boolean): Promise<void> {
  const path = notesPath()
  if (path === '') return
  await loadIssues($)
  await mendCoverage($)
  await mendInsightNames($)
  const kept = parseKeptNotes(await storeOf($).read(path))
  const now = await printsNow($, kept)
  for (const [file, print] of Object.entries(kept.prints)) {
    if (!notePrints.has(file) && now.get(file) === print) notePrints.set(file, print)
  }
  if (!isFresh) return
  const open = stillOpen(kept, now)
  if (open.length > 0 && (await read($, notesAtom)).length === 0) {
    await update($, notesAtom, () => open)
    lookState.nextNoteId = Math.max(lookState.nextNoteId, ...open.map(note => note.id + 1))
  }
  if (kept.dismissed.length > 0 && (await read($, dismissedAtom)).length === 0) await update($, dismissedAtom, () => kept.dismissed)
  const last = reviews.at(-1) ?? project?.survey ?? undefined
  if (last !== undefined && (await read($, reviewAtom)).state === 'none') {
    await setReview($, { state: 'done', subject: last.subject, text: last.text, isUnseen: false, decisions: last.decisions ?? [], insights: last.insights ?? [], older: historyOf() })
  }
  trace($, 'state', 'pane taken up from disk', () => ({ notes: open.length, of: kept.notes.length, review: last?.subject ?? null }))
}

/** A time of day with its day once it is not today's, as `now` sees it. */
function dayClock(now: number): (ms: number) => string {
  return ms => dayTime(ms, now)
}

/** A review's text with the issues it found, for the look at the person's progress that follows it. */
function withIssues(text: string, issues: readonly string[]): string {
  return issues.length === 0 ? text : `${text}\n\nIssues this review found:\n${issues.join('\n')}`
}

/** The project's ledger of issues. '' outside a repository or without a data folder. */
function findingsPath(): string {
  return repoRoot === '' || dataRoot === '' ? '' : `${projectDir(dataRoot, repoRoot)}/${FINDINGS_FILE}`
}

/** A file of the repository as lines, or null when it cannot be read. */
async function repoLines($: EngineInterface, file: string): Promise<string[] | null> {
  try {
    return (await $.fs.read(`${repoRoot}/${file}`)).split('\n')
  } catch {
    return null
  }
}

/** Where each open issue's line stands in its file now: one read per file with an open issue. Placement changes no status. */
async function placedNow($: EngineInterface, of: Ledger): Promise<Record<string, number | null>> {
  const placed: Record<string, number | null> = {}
  const isOpen = (finding: Finding) => finding.status === 'open' || finding.status === 'partly'
  for (const file of new Set(of.findings.filter(isOpen).map(finding => finding.file))) {
    if (file === '.') continue
    const lines = await repoLines($, file)
    const stands = lines === null ? new Map<number, number | null>() : placeIssues(of, file, lines)
    for (const finding of of.findings) if (finding.file === file && isOpen(finding)) placed[String(finding.id)] = stands.get(finding.id) ?? null
  }
  for (const finding of of.findings) if (finding.file === '.' && isOpen(finding)) placed[String(finding.id)] = 0

  return placed
}

/** Shows the ledger in the pane, each open issue where its line stands now. */
async function showIssues($: EngineInterface): Promise<void> {
  const placed = await placedNow($, ledger)
  await update($, issuesAtom, (state): IssuesState => ({ ...state, ledger, placed, isAudited: project?.isAudited ?? false }))
}

/**
 * The files saved this sitting, as the journal has them, for the
 * play-by-play's picks among the issues: the driver's journal in memory, or
 * the project's file in a session that keeps none.
 */
async function noteSavedFiles($: EngineInterface): Promise<void> {
  let saved: string[] = []
  if (journalState.recorder !== null) saved = journalState.recorder.savedPaths()
  else if (repoRoot !== '' && dataRoot !== '') saved = savedPathsOf(parseJournal(await storeOf($).read(journalPath(dataRoot, repoRoot)).catch(() => null)))
  await update($, issuesAtom, (state): IssuesState => (JSON.stringify(state.savedFiles ?? []) === JSON.stringify(saved) ? state : { ...state, savedFiles: saved }))
}

/** Reads the ledger from the project's folder and shows it. */
async function loadIssues($: EngineInterface): Promise<void> {
  const path = findingsPath()
  ledger = path === '' ? EMPTY_LEDGER : parseLedger(await storeOf($).read(path))
  findingsStamp = await fileStamp($, path)
  await showIssues($)
}

/**
 * Changes the ledger in the project's folder, on top of what is written
 * there, and shows it. Any session may: what the person does to an issue in
 * a session that does not drive reaches every session. `step` may run again.
 */
async function changeIssues($: EngineInterface, step: (current: Ledger) => Ledger): Promise<void> {
  const path = findingsPath()
  try {
    // Kept with its version, as every file of a project is.
    ledger = path === '' ? step(ledger) : await updateJson(storeOf($), path, parseLedger, current => ({ v: 1 as const, ...step(current) }))
    findingsStamp = await fileStamp($, path)
  } catch (error) {
    fail($, 'could not keep the issues', error)
  }
  await showIssues($)
}

/** What the person does to one issue, from either view: written once, gone or back everywhere. */
async function personOnIssue($: EngineInterface, action: PersonAction, id: number): Promise<void> {
  const at = await $.clock.now()
  trace($, 'state', `issue ${action}`, () => ({ id }))
  await changeIssues($, current => personIssue(current, action, id, at))
}

/**
 * A review's issues into the ledger: each placed at the line it quotes (in
 * the file as it is now, else as the reviewed commit left it), the rulings
 * on issues on record applied, and what an audit read kept. Resolves the
 * lines that tell a progress look what this review found.
 */
async function keepIssues($: EngineInterface, scope: ReviewScope, answer: string, commit: string, at: number): Promise<string[]> {
  const fence = parseFindingsFence(answer)
  // An audit that says nothing is still an audit that finished: it is kept as one, with no account of its reading.
  if (scope.kind !== 'audit' && fence.issues.length === 0 && fence.rulings.length === 0 && fence.coverage === null) return []
  const ref = scope.kind === 'commit' ? scope.hash : 'HEAD'
  const texts = new Map<string, { now: string[] | null; then: string[] | null }>()
  const candidates: Candidate[] = []
  for (const issue of fence.issues.slice(0, scope.kind === 'audit' ? MAX_FROM_AUDIT : MAX_FROM_REVIEW)) {
    if (issue.file !== '.' && !texts.has(issue.file)) {
      const shown = await git($, repoRoot, ['show', `${ref}:${issue.file}`])
      texts.set(issue.file, { now: await repoLines($, issue.file), then: shown.exitCode === 0 ? shown.stdout.split('\n') : null })
    }
    const lines = texts.get(issue.file)
    const placed = anchorIssue(issue, lines?.now ?? null, lines?.then ?? null)
    if (placed !== null) candidates.push(placed)
  }
  const origin = scope.kind === 'audit' ? 'audit' : 'review'
  // An audit's account of its reading, kept as a reader counts it: their source files it read and did not also call
  // skipped (the first live audit's "read 13 of 16" counted a config file, and a vendored one it had skipped too). An
  // audit adopted after a reload has no list of its own: the files are listed again, as they stand.
  const sources = scope.kind !== 'audit' ? [] : scope.files.length > 0 ? scope.files : (await sourceFiles($)).own
  const skipped = fence.coverage?.skipped ?? []
  const passed = new Set(skipped.map(skip => skip.path))
  // Their own: less what the audit itself skipped as someone else's code (the fourteenth ui-truth pass).
  const own = ownFiles(sources, skipped)
  const read = (fence.coverage?.read ?? []).filter(path => own.includes(path) && !passed.has(path))
  // Changes not yet committed were read with the commit: `+` says so (the first live audit's high issue was in one).
  const isDirty = scope.kind === 'audit' && (watcher?.dirty().length ?? 0) > 0
  let raised: number[] = []
  await changeIssues($, current => {
    const found = foundIssues(current, 'review', at, origin, commit, candidates)
    raised = [...found.added, ...found.matched]
    const ruled = ruledIssues(found.ledger, 'review', at, fence.rulings).ledger

    return scope.kind === 'audit' ? coveredLedger(ruled, { at, commit: isDirty ? `${commit}+` : commit, files: own.length, read, skipped }) : ruled
  })
  trace($, 'state', 'issues kept', () => ({
    subject: scopeSubject(scope),
    issues: fence.issues.length,
    placed: candidates.length,
    forTheFile: candidates.filter(candidate => candidate.line === 0 && candidate.file !== '.').length,
    raised,
    rulings: fence.rulings.length,
    coverage: fence.coverage,
  }))

  return issuesForRequest(ledger, raised)
}

/** The issues on record a review is told about: those of the files it looks at, or all of them for an audit. */
function issuesContext(scope: ReviewScope): { open: string[]; dismissed: string[] } | undefined {
  if (scope.kind === 'survey') return undefined
  const files = scope.kind === 'commit' ? changedFilesOf(scope.patch) : scope.kind === 'since' ? changedFilesOf(scope.diff) : []
  if (scope.kind !== 'audit' && files.length === 0) return undefined
  const asked = askedIssues(ledger, files)

  return { open: issuesForRequest(ledger, asked.open), dismissed: dismissedForRequest(ledger, asked.dismissed) }
}

/** The play-by-play's open bugs and risks in the files a review looks at, all of them for an audit, as its request lists them: without their ids, which are no issue's. */
async function notesForReview($: EngineInterface, scope: ReviewScope): Promise<string[]> {
  if (scope.kind === 'survey') return []
  const files = scope.kind === 'commit' ? changedFilesOf(scope.patch) : scope.kind === 'since' ? changedFilesOf(scope.diff) : null
  const open = (await read($, notesAtom)).filter(note => (note.kind === 'bug' || note.kind === 'risk') && (files === null || files.includes(note.file)))

  return open.map(note => `- [${note.kind}] ${note.file}:${note.line} (${note.topic}) ${note.text}`)
}

/**
 * The play-by-play's bugs and risks that an open issue now covers leave the
 * pane: the same file, and the same topic or a line within one of the
 * issue's. The issue stands in their place, in both views (2026-10-07).
 */
async function adoptNotes($: EngineInterface): Promise<void> {
  const covers = (note: Note) =>
    ledger.findings.some(
      finding => (finding.status === 'open' || finding.status === 'partly') && finding.file === note.file && (finding.topic === note.topic || (finding.line > 0 && Math.abs(finding.line - note.line) <= 1)),
    )
  const adopted = (await read($, notesAtom)).filter(note => (note.kind === 'bug' || note.kind === 'risk') && covers(note))
  if (adopted.length === 0) return
  await update($, notesAtom, (notes: Note[]): Note[] => notes.filter(note => !adopted.some(gone => gone.id === note.id)))
  trace($, 'state', 'notes adopted as issues', () => ({ notes: adopted.map(note => `${note.file}:${note.line} ${note.topic}`) }))
  void saveNotes($)
}

/** Their source files as git lists them, and the folders among them that look generated or vendored. */
async function sourceFiles($: EngineInterface): Promise<{ own: string[]; vendored: string[] }> {
  const listed = await git($, repoRoot, ['ls-files', '-z'])
  if (listed.exitCode !== 0) return { own: [], vendored: [] }
  // The sizes of the committed files: one far larger than hand-written code is someone else's (PDF.js's viewer, 427 KB,
  // went to the first live audit as the person's own source, 2026-10-07).
  const tree = await git($, repoRoot, ['ls-tree', '-r', '-l', '-z', 'HEAD'])
  const sizes = new Map<string, number>()
  for (const entry of tree.exitCode === 0 ? tree.stdout.split('\0') : []) {
    const tab = entry.indexOf('\t')
    if (tab !== -1) sizes.set(entry.slice(tab + 1), Number(entry.slice(0, tab).trim().split(/\s+/)[3] ?? 0))
  }
  const own: string[] = []
  const vendored = new Set<string>()
  for (const path of listed.stdout.split('\0')) {
    if (path === '' || languageOf(path) === null) continue
    if (isNoiseFile(path)) vendored.add(noiseRoot(path))
    else if ((sizes.get(path) ?? 0) > VENDORED_BYTES) vendored.add(path)
    else own.push(path)
  }

  return { own, vendored: [...vendored].slice(0, 40) }
}

/**
 * An audit's reading as a reader counts it: their source files it read and
 * did not also skip. One kept before 2026-10-07 counted a vendored file it
 * had skipped and a config file ("read 13 of 16" for eleven): counted again
 * at switch-on, in the driver, and written back when it changes.
 */
async function mendCoverage($: EngineInterface): Promise<void> {
  const coverage = ledger.coverage
  if (coverage.at <= 0 || !leaseState.isDriver) return
  await mendAuditInsights($, coverage.at)
  if (coverage.read.length === 0) return
  const passed = new Set(coverage.skipped.map(skip => skip.path))
  // Their own files as the rules count them now: less what the audit skipped as someone else's, and no file too large
  // to be hand-written (the fourteenth ui-truth pass: "16 source files" counted PDF.js files the line called vendored).
  const own = ownFiles((await sourceFiles($)).own, coverage.skipped)
  const read = coverage.read.filter(path => !passed.has(path) && own.includes(path))
  if (read.length === coverage.read.length && own.length === coverage.files) return
  trace($, 'state', 'audit reading counted again', () => ({ was: coverage.read.length, now: read.length, files: coverage.files, own: own.length }))
  await changeIssues($, current => coveredLedger(current, { ...current.coverage, files: own.length, read: current.coverage.read.filter(path => read.includes(path)) }))
}

/**
 * An audit's insights kept before 2026-10-07 were credited to "the deep
 * review of" the commit it audited at, which holds no such insight: marked as
 * the audit's once, by the audit's time, which they share with its coverage.
 */
async function mendAuditInsights($: EngineInterface, auditAt: number): Promise<void> {
  if (project === null || repoRoot === '' || dataRoot === '') return
  if (!project.insights.some(insight => insight.at === auditAt && insight.commit !== '' && insight.source === undefined)) return
  const root = repoRoot
  try {
    project = await updateJson(storeOf($), `${projectDir(dataRoot, repoRoot)}/project.json`, stored => parseProject(stored, root), current => ({
      ...current,
      insights: current.insights.map(insight => (insight.at === auditAt && insight.commit !== '' && insight.source === undefined ? { ...insight, source: 'audit' as const } : insight)),
    }))
    trace($, 'state', "audit's insights credited to the audit", () => ({ at: auditAt }))
  } catch (error) {
    fail($, "could not credit the audit's insights", error)
  }
}

/** An insight that lost its name while its file had no outline takes it back from what its review said, once (`withNamesBack`). */
async function mendInsightNames($: EngineInterface): Promise<void> {
  if (project === null || repoRoot === '' || dataRoot === '' || !leaseState.isDriver) return
  const said = [...(project.survey?.insights ?? []), ...reviews.flatMap(review => review.insights ?? [])]
  if (withNamesBack(project, said) === project) return
  const root = repoRoot
  try {
    project = await updateJson(storeOf($), `${projectDir(dataRoot, repoRoot)}/project.json`, stored => parseProject(stored, root), current => withNamesBack(current, said))
    trace($, 'state', 'insights named again', () => ({ said: said.length }))
  } catch (error) {
    fail($, 'could not name the insights again', error)
  }
}

/** Marks the project audited, when its audit starts: one that fails is not started again at every switch-on. */
async function markAudited($: EngineInterface): Promise<void> {
  if (repoRoot === '' || dataRoot === '' || project === null) return
  const root = repoRoot
  try {
    project = await updateJson(storeOf($), `${projectDir(dataRoot, repoRoot)}/project.json`, stored => parseProject(stored, root), current => withAudited(current))
  } catch (error) {
    fail($, 'could not mark the project audited', error)
  }
  await update($, issuesAtom, (state): IssuesState => (state.isAudited ? state : { ...state, isAudited: true }))
}

/**
 * One audit per project: the codebase as it is, for issues, ranked (owner,
 * 2026-10-07: in a real codebase the pane said nothing, and its silence read
 * as "he wrote a perfect codebase"). It comes after the project's first look
 * around and behind any commit waiting for its review, and is held back as a
 * review is. `isAsked` is the person's `a`, which audits again, whatever holds
 * a background review back.
 */
async function maybeAudit($: EngineInterface, settings: Settings, run: number, isAsked = false): Promise<void> {
  if (project === null || !leaseState.isDriver || !isReviewFree() || mode !== 'on' || repoRoot === '') return
  if (!isAsked) {
    if (project.isAudited || !project.isSurveyed) return
    if (!settings.deepReview.isAfterCommit && settings.deepReview.everyMs === 0) return
    if (settings.deepReview.isAfterCommit && reviewState.waiting.commits.some(commit => !commit.isReviewed)) return
  }
  await withReviewSlot($, settings, async () => {
    if (!isAsked) {
      const held = await readPressure($)
      if (held.level !== 'none' || !mayAsk(health)) return
    }
    if (run !== engagement || mode !== 'on') return
    const files = await sourceFiles($)
    await markAudited($)
    await startReview($, settings, { kind: 'audit', files: files.own, vendored: files.vendored })
  })
}

/** The file that holds the commits waiting in this project. */
function queuePath(): string {
  return `${projectDir(dataRoot, repoRoot)}/queue.json`
}

/** Reads the waiting commits from the project's folder, without those that have waited too long. */
async function loadQueue($: EngineInterface): Promise<void> {
  const now = await $.clock.now()
  reviewState.waiting = repoRoot === '' || dataRoot === '' ? EMPTY_QUEUE : current(parseQueue(await storeOf($).read(queuePath())), now)
}

/** Changes the waiting commits, in the project's folder and in memory. */
async function changeQueue($: EngineInterface, change: (queue: ReviewQueue) => ReviewQueue): Promise<void> {
  const now = await $.clock.now()
  if (repoRoot === '' || dataRoot === '') {
    reviewState.waiting = change(current(reviewState.waiting, now))

    return
  }
  try {
    reviewState.waiting = await updateJson(storeOf($), queuePath(), parseQueue, stored => change(current(stored, now)))
  } catch (error) {
    // Not saved: it still waits for as long as this session runs.
    reviewState.waiting = change(current(reviewState.waiting, now))
    fail($, 'could not save the waiting commits', error)
  }
  // The tab says how many are waiting for their review.
  const count = reviewState.waiting.commits.filter(commit => !commit.isReviewed).length
  if (count !== ((await read($, reviewAtom)).waiting ?? 0)) await setReview($, { waiting: count })
}

/** A review ended without a review (`reviewFailed` in `core/reviewing.ts`): how it counts, and what is tried next. */
async function reviewFailed(
  $: EngineInterface,
  settings: Settings,
  scope: ReviewScope | null,
  detail: string,
  how: 'service' | 'own' | 'final',
): Promise<void> {
  await failReview(reviewPortsOf($, settings), reviewState, scope, detail, how)
}

/** A review ended saying only "error", and why has arrived or the moment for it has passed. */
async function reviewVerdict($: EngineInterface, settings: Settings, reason: string | null): Promise<void> {
  await verdictOnReview(reviewPortsOf($, settings), reviewState, reason)
}

/** The running review has not reported back for a long time: it is looked for, and given up on when it is gone. */
async function reviewWatchdog($: EngineInterface, settings: Settings): Promise<void> {
  await watchReview(reviewPortsOf($, settings), reviewState)
}

/** After a reload of the module, the review that was running is taken up again when it is the first waiting commit's. */
async function adoptReview($: EngineInterface, settings: Settings): Promise<void> {
  await adoptRunningReview(reviewPortsOf($, settings), reviewState)
}

/** What came of the look at a waiting commit's progress: done with, one try, or a wait that is Claude's doing. */
async function settleAssessment($: EngineInterface, settings: Settings, commit: Waiting, isSettled: boolean): Promise<void> {
  await settleAssessmentOf(reviewPortsOf($, settings), reviewState, commit, isSettled)
}

/** Starts whatever the waiting commits need next, and says in the Deep review tab what stands in the way (`core/reviewing.ts`). */
async function planReview($: EngineInterface, settings: Settings): Promise<void> {
  await planWaitingReviews(reviewPortsOf($, settings), reviewState)
  // With nothing waiting for its review, a project that has had no audit gets one.
  void maybeAudit($, settings, engagement)
}

/** Reviews one commit now. Resolves false when no review started. The caller holds the review slot. */
async function reviewCommitNow($: EngineInterface, settings: Settings, commit: { hash: string; title: string }): Promise<boolean> {
  return await reviewCommit(reviewPortsOf($, settings), reviewState, commit)
}

/** What the waiting commits and their reviews ask of Claude Code, each made from `$` and read when it is needed. */
function reviewPortsOf($: EngineInterface, settings: Settings): ReviewPorts {
  return {
    ...hostOf($, settings),
    settings,
    git: args => git($, repoRoot, args),
    changeQueue: change => changeQueue($, change),
    setReview: change => setReview($, change),
    readReview: () => read($, reviewAtom),
    health: () => health,
    pressure: () => pressure,
    jobBlock: job => jobBlocks.get(job),
    readPressure: () => readPressure($),
    probeEnded: () => probeEnded($, settings),
    isActive: () => mode === 'on' && repoRoot !== '' && leaseState.isDriver,
    agents: async () => await $.agent.list(),
    startReview: scope => startReview($, settings, scope),
    reviewText: commit => {
      const text = reviews.find(known => known.commit === commit)?.text
      // The review's issues go with it: its text no longer lists them (2026-10-07).
      return text === undefined ? undefined : withIssues(text, issuesForRequest(ledger, ledger.findings.filter(finding => finding.commit === commit && finding.origin === 'review').map(finding => finding.id)))
    },
    assess: (hash, review) => assessCommit($, settings, hash, review),
    queueProgress: work => queueProgress($, work),
  }
}

/** The fingerprint of the code an insight is about, as that code is now. Null when its file cannot be read. */
async function printForInsight($: EngineInterface, insight: Insight): Promise<{ print: string; of: 'symbol' | 'file'; symbol?: string } | null> {
  if (followState.explainer !== null) return followState.explainer.printFor(insight.file, insight.symbol)
  try {
    return { print: sourcePrint(await $.fs.read(`${repoRoot}/${insight.file}`)), of: 'file' }
  } catch {
    return null
  }
}

/** Whether a file reads now as that commit left it. */
async function isAsCommitted($: EngineInterface, hash: string, file: string): Promise<boolean> {
  const [committed, now] = await Promise.all([git($, repoRoot, ['show', `${hash}:${file}`]), readSource($, repoRoot, file)])

  return committed.exitCode === 0 && now !== null && sourcePrint(committed.stdout) === sourcePrint(now)
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

/** Every review the tab can go back to: the reviews kept, then the first look around. */
function historyOf(): ReviewText[] {
  return historyTexts(reviews, project?.survey ?? null)
}

/** Reads what is known about this project from its cache. */
async function loadProject($: EngineInterface): Promise<void> {
  if (repoRoot === '' || dataRoot === '') {
    project = null
    reviews = []
    ledger = EMPTY_LEDGER

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
async function keepReview($: EngineInterface, scope: ReviewScope, answer: string): Promise<{ text: string; notes: ReviewNotes | null; issues: string[] }> {
  const { text, notes } = splitReview(answer)
  let issues: string[] = []
  if (repoRoot === '' || dataRoot === '') return { text, notes, issues }
  try {
    const at = await $.clock.now()
    // A survey or an audit looked at the project as of HEAD. Work since a review may include uncommitted changes, so it names no commit.
    const commit = scope.kind === 'commit' ? shortHash(scope.hash) : (scope.kind === 'survey' || scope.kind === 'audit') && lastHead !== '' ? shortHash(lastHead) : ''
    issues = await keepIssues($, scope, answer, commit, at)
    await adoptNotes($)
    const prints = new Map<Insight, { print: string; of: 'symbol' | 'file' } | null>()
    // A commit's review is about the code as committed. A file changed since then would tie the insight to code it was not written about.
    const asCommitted = new Map<string, boolean>()
    for (const insight of notes?.insights ?? []) {
      if (scope.kind === 'commit' && !asCommitted.has(insight.file)) asCommitted.set(insight.file, await isAsCommitted($, scope.hash, insight.file))
      prints.set(insight, asCommitted.get(insight.file) === false ? null : await printForInsight($, insight))
    }

    const folder = projectDir(dataRoot, repoRoot)
    const root = repoRoot
    // Read, changed and written as one step: another session may be reviewing this project too.
    project = await updateJson(
      storeOf($),
      `${folder}/project.json`,
      stored => parseProject(stored, root),
      current => {
        // The first look around is kept with the project, as the tab showed it: a new project's tab has it back after
        // a restart (owner, 2026-10-06: "it should have been cached and displayed immediately").
        const surveyed =
          scope.kind === 'survey'
            ? withSurvey(current, { commit: '', subject: scopeSubject(scope), at, text, decisions: notes?.decisions ?? [], insights: insightLines(notes) })
            : current

        return notes === null ? surveyed : withReviewNotes(surveyed, notes, commit, at, insight => prints.get(insight) ?? null, scope.kind === 'audit' ? 'audit' : undefined)
      },
    )
    if (scope.kind !== 'survey') {
      // An audit is kept in the history by its subject and names no commit: it reviewed nobody's commit, and a record
      // naming HEAD would be taken for a review of it (the look at progress would call HEAD reviewed and never looked at).
      const named = scope.kind === 'audit' ? '' : commit
      reviews = await updateJson(storeOf($), `${folder}/reviews.json`, parseReviews, kept =>
        withReview(kept, { commit: named, subject: scopeSubject(scope), at, text, decisions: notes?.decisions ?? [], insights: insightLines(notes) }),
      )
    }
    await setReview($, { older: historyOf() })
  } catch (error) {
    fail($, "could not keep the deep review's notes", error)
  }

  return { text, notes, issues }
}

/**
 * A project the tutor has not seen before gets one look around by the deep
 * review model, so that the faster models start from the big picture.
 */
async function maybeSurvey($: EngineInterface, settings: Settings, run: number): Promise<void> {
  if (project === null || project.isSurveyed || !leaseState.isDriver || !isReviewFree()) return
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
  if (!leaseState.isDriver) {
    if (isAsked) toastPerson($, FOLLOWING)

    return
  }
  // The timer holds back near the plan limit, and while Claude is not answering. A review asked for by hand does not.
  if (!isAsked && ((await readPressure($)).level === 'held' || !mayAsk(health))) return
  if (!isReviewFree()) {
    if (isAsked) toastPerson($, 'A deep review is already running.')

    return
  }
  await withReviewSlot($, settings, () => startSince($, settings, isAsked))
}

/** What `reviewSince` starts, with the review slot held. */
async function startSince($: EngineInterface, settings: Settings, isAsked: boolean): Promise<void> {
  if (isAsked && repoRoot !== '') {
    // A commit that is waiting goes first. Asked for, it is tried whatever was holding it back.
    const commit = nextToReview(reviewState.waiting, { wantsReview: true, wantsAssessment: false })
    if (commit !== null) {
      reviewState.reviewRetryAt = null
      schedulerOf($).cancel('review')
      await reviewCommitNow($, settings, commit)

      return
    }
  }
  if (repoRoot === '' || reviewedHead === '') {
    if (isAsked) toastPerson($, 'A deep review needs a git repository with at least one commit.')

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
  if (settings.deepReview.everyMs <= 0 || mode === 'off' || repoRoot === '' || !leaseState.isDriver) return
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
    journalState.recorder?.add({ at: movedAt, kind: 'head', hash: entry.hash, text: entry.subject })
    journalState.recorder?.moved(movedAt)

    return
  }
  journalState.recorder?.add({ at: movedAt, kind: 'commit', hash: entry.hash, text: commitTitle(entry) })
  if (!settings.deepReview.isAfterCommit && !settings.isProgressOn) return
  // It waits, on disk, until it has been reviewed and looked at for the person's progress.
  // That happens at once when nothing stands in the way, and otherwise when Claude answers again or the plan allows.
  const isAmend = entry.subject.startsWith('commit (amend)')
  await changeQueue($, queue => withCommit(isAmend ? withoutCommit(queue, previous) : queue, { hash: entry.hash, title: commitTitle(entry) }, movedAt))
  await planReview($, settings)
}

/** Plans the next scan of the working tree, as soon after the last as `sensor.ts` says. */
function planScan($: EngineInterface, settings: Settings, now: number): void {
  if (mode !== 'on' || watcher === null || !leaseState.isDriver) return
  schedulerOf($).set('scan', now + scanGapMs({ now, activeAt, lastScanMs, isPushed: isPushed('tree') }), () => scan($, settings))
}

/** True while a watcher pushes the changes of `role`. The focus file's changes count only with the tree's: the file in focus is in the tree. */
function isPushed(role: WatchRole): boolean {
  const live = (of: WatchRole) => pushers.some(pusher => pusher.role === of && pusher.isLive)

  return role === 'tree' ? live('tree') : live('tree') && live('focus')
}

/** Stops every watcher child. */
function stopPushing(): void {
  pushRun += 1
  isPushTried = false
  const leaving = pushers
  pushers = []
  for (const pusher of leaving) pusher.stop()
}

/**
 * Starts the file watchers, where one is on PATH: one over the working tree
 * and HEAD's log, one over the data folder for the editor's focus file. A
 * watcher that cannot start, or stops, changes nothing but how often the
 * scan runs: it is back to its own pace.
 */
async function startPushing($: EngineInterface, settings: Settings): Promise<void> {
  const run = pushRun
  const root = repoRoot
  if (root === '' || gitDir === '') return
  const places: WatchPlaces = { root, gitDir, dataRoot }
  const ignored = ignoredFolders((await git($, root, ['ls-files', '--others', '--ignored', '--exclude-standard', '--directory'])).stdout)
  let gitFolders: string[] = []
  try {
    gitFolders = (await $.fs.list(gitDir)).filter(entry => entry.kind === 'dir').map(entry => entry.name)
  } catch {
    // Not listed: all of it is watched, and its events are left out by the pattern.
  }
  const isGitOutside = gitDir !== `${root}/.git`
  const hasOutsideLogs = isGitOutside && (await $.fs.exists(`${gitDir}/logs`).catch(() => false))
  const hasDataRoot = dataRoot !== '' && (await $.fs.exists(dataRoot).catch(() => false))
  if (run !== pushRun) return
  // The editors' watcher is started once the tree's runs: where there is no inotifywait, it is looked for once.
  // Their folder is made first, so that it can be watched before any editor has written to it.
  const watchFocus = () => {
    if (!hasDataRoot) return
    void (async () => {
      const folder = `${dataRoot}/${EDITORS_FOLDER}`
      try {
        if (!(await $.fs.exists(folder))) {
          await markHome($)
          await $.fs.write(`${folder}/.keep`, '')
        }
      } catch (error) {
        fail($, 'making the editors folder', error)

        return
      }
      if (run === pushRun) runPusher($, settings, 'focus', focusWatchArgv(places), places, run)
    })()
  }
  runPusher($, settings, 'tree', treeWatchArgv(places, ignored, gitFolders, hasOutsideLogs), places, run, watchFocus)
}

/** Runs one watcher child for as long as it lives, and acts on what it reports. */
function runPusher(
  $: EngineInterface,
  settings: Settings,
  role: WatchRole,
  argv: string[],
  places: WatchPlaces,
  run: number,
  whenLive?: () => void,
): void {
  const pusher: Pusher = { role, isLive: false, stop: () => {} }
  void (async () => {
    const started = Date.now()
    let stderr = ''
    let hasStarted = false
    try {
      const child = $.process.spawn({ argv, cwd: places.root })
      // Leaving the loop is what ends the child. A stop between pieces leaves it at the next one at the latest.
      pusher.stop = () => void child.return({ code: null, signal: null }).catch(() => {})
      pushers.push(pusher)
      const lines = lineSplitter()
      for await (const piece of child) {
        hasStarted = true
        if (run !== pushRun) break
        if (piece.stream === 'stderr') {
          stderr = (stderr + piece.text).slice(-4000)
          if (!pusher.isLive && isEstablished(stderr)) {
            pusher.isLive = true
            trace($, 'push', 'watching', () => ({ role, argv }), Date.now() - started)
            whenLive?.()
            // What changed while the watches were being set up is found by a scan now. From here on, changes are pushed.
            await kick($, settings, `the ${role} watcher is ready`)
          }
          continue
        }
        for (const nudge of nudgesOf(lines(piece.text), places)) await nudged($, settings, nudge)
      }
      if (run === pushRun) trace($, 'push', 'stopped', () => ({ role, complaint: watcherComplaint(stderr) }))
    } catch (error) {
      // It never started: there is no watcher on PATH. Otherwise it died, and says why on stderr.
      trace($, 'push', hasStarted ? 'stopped' : 'no watcher', () => ({ role, error: String(error), complaint: watcherComplaint(stderr) }))
    } finally {
      const wasLive = pusher.isLive
      pusher.isLive = false
      pushers = pushers.filter(other => other !== pusher)
      // Back to the scan's own pace. A child whose stream ended with the module (the kit unloads it at a file's end,
      // the children still running) finds the host gone here: nothing to plan (a rejection nothing handled at the
      // end of `filewatch.test.ts`, 2026-10-06).
      if (wasLive && run === pushRun) {
        try {
          planScan($, settings, await $.clock.now())
        } catch {
          // The host is gone.
        }
      }
    }
  })()
}

/**
 * Something pushed a change: a watcher today, an editor plugin later. The
 * scan still works out what changed. A nudge only says to look now.
 */
async function nudged($: EngineInterface, settings: Settings, nudge: Nudge): Promise<void> {
  if (mode !== 'on' || watcher === null || !leaseState.isDriver) return
  trace($, 'push', nudge.kind, () => nudge)
  const spot = followState.focus
  const isSpotChanged = nudge.kind === 'focus' || (nudge.kind === 'tree' && spot !== null && nudge.paths.includes(spot.path))
  // While someone watches the spot in focus, its check runs now. The scan leaves the focus file to it.
  if (followState.isWatchingClosely && isSpotChanged) schedulerOf($).set('focus', await $.clock.now(), () => fastPoll($))
  // An editor's report is read where the scan would read it, and nothing else of the scan is needed for it: a scan
  // for every write of an editor's file was a `git status` a second for an editor in another repository (the
  // seventh ui-truth pass, 2026-10-06: twenty in eight seconds).
  if (nudge.kind !== 'focus') await kick($, settings, `pushed: ${nudge.kind}`)
  else if (!followState.isWatchingClosely) await pollFocus($)
}

/**
 * One scan of the working tree: what was saved, whether HEAD moved, where
 * the editor's caret is. A scan never calls a model. It tells the journal and
 * Explain what it found, and plans the look that a save makes due.
 */
async function scan($: EngineInterface, settings: Settings): Promise<void> {
  const active = watcher
  if (mode !== 'on' || active === null || !leaseState.isDriver) return
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
      await noteWatchedOf(progressPortsOf($, settings), progressState, active.changed())
      await followSaves($, active.changed(), now)
    }
    // Until an editor has written its focus file, looking for it this often is enough.
    if (!followState.isWatchingClosely) await pollFocus($)
    await keepJournal($, active, now)
    await noteSavedFiles($)
    await checkHead($, settings)
    // Another session may have changed what is on record about the person.
    if (now - sharedCheckedAt >= SHARED_CHECK_MS) await refreshShared($, settings)
    // Where a file watcher is on PATH, it pushes what the next scans would have to find.
    if (!isPushTried) {
      isPushTried = true
      void startPushing($, settings)
    }
    traceQuiet($)
    // A look is a deadline, set from what this scan found.
    await planLook($, settings)
  } catch (error) {
    fail($, 'looking at the working tree', error)
  } finally {
    isScanning = false
    if (now === 0) now = await $.clock.now()
    // Asked for again while this one ran: at once. Otherwise as soon as the cadence says.
    lastScanAt = now
    if (isScanWanted) schedulerOf($).set('scan', now, () => scan($, settings))
    else planScan($, settings, now)
  }
}

function stopWatching(): void {
  stopPushing()
  deadlines?.clear()
  isScanning = false
  isScanWanted = false
  isWatchReady = false
  health = HEALTHY
  jobBlocks.clear()
  reviewState.reviewFailure = ''
  reviewState.reviewFailureNoted = null
  followState.isWatchingClosely = false
  leaseState.isDriver = true
  leaseState.holder = ''
  sharedStamp = null
  sharedCheckedAt = 0
  followState.explainer?.stop()
  followState.explainer = null
  progressState.watchedPaths.clear()
  notePrints.clear()
  project = null
  reviews = []
  ledger = EMPTY_LEDGER
  findingsStamp = ''
  followedStamps = null
  followState.focus = null
  followState.editorFiles.clear()
  followState.focusText = null
  followState.isAnyEditor = false
  followState.writtenView = ''
  followState.viewedStamp = ''
  watcher = null
  // A review still running finishes in the background, and its answer is ignored.
  // The commits that were waiting stay in the project's folder, for the next time the tutor is on here.
  reviewState.reviewAgentId = null
  reviewState.reviewScope = null
  reviewState.waiting = EMPTY_QUEUE
  reviewState.isAssessing = false
  reviewState.isReviewBusy = false
  reviewState.reviewRetryAt = null
  reviewState.assessRetryAt = null
  reviewState.endedReview = null
}

/** Starts the watcher from the working tree as it stands now. `run` is the switch-on this belongs to. */
async function startWatching($: EngineInterface, settings: Settings, run: number, isFresh: boolean): Promise<void> {
  stopWatching()
  lastChangeAt = null
  // A reload (a sync, a change in /config) keeps the time of the last look, which the pane holds: the empty tab went back
  // to "No look yet" after every sync, and `l` blamed switch-on (the sixteenth ui-truth pass, 2026-10-07).
  lookState.lastLookAt = isFresh ? null : ((await read($, watchAtom)).lastLookAt ?? null)
  lookState.failures = 0
  lookState.lookFailure = ''
  lastScanMs = 0
  lastScanAt = 0
  pressure = NO_PRESSURE

  const top = await git($, await sessionCwd($), ['rev-parse', '--show-toplevel'])
  if (run !== engagement) return
  const root = top.stdout.trim()
  if (top.exitCode !== 0 || root === '') {
    repoRoot = ''
    gitDir = ''
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
  const folder = (await git($, root, ['rev-parse', '--absolute-git-dir'])).stdout.trim()
  const log = folder === '' ? '' : `${folder}/logs/HEAD`
  const stamp = await fileStamp($, log)
  const tip = (await git($, root, ['rev-parse', '--verify', '--quiet', 'HEAD'])).stdout.trim()
  // Switched off, or on again, while git was answering: this start is no longer wanted.
  if (run !== engagement) return

  watcher = started
  isWatchReady = true
  repoRoot = root
  gitDir = folder
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

/** What following the spot in focus needs from Claude Code. */
function followPortsOf($: EngineInterface): FollowPorts {
  return {
    ...hostOf($, null),
    stamp: path => fileStamp($, path),
    countStat: () => void (quiet.stats += 1),
    readView: () => read($, explainAtom),
    setView: async change => {
      await update($, explainAtom, change)
      await keepSpinning($)
    },
    showEditors: line => showEditors($, line),
    isExplainShown: async () => (await read($, tabAtom)) === 'explain' && (await isTabShown()),
    markActive: now => void (activeAt = now),
    feedJournal: (text, now) => journalState.recorder?.editor(text, now, false),
    isPushed: role => isPushed(role),
    lastFollowed: () => read($, followedEditorAtom),
    keepFollowed: async text => void (await update($, followedEditorAtom, () => text)),
  }
}

/** Shows what is known about the spot in focus, and writes it where an editor can read it. */
async function refreshView($: EngineInterface, isAsked = false): Promise<void> {
  await refreshViewOf(followPortsOf($), followState, isAsked)
}

async function setFocus($: EngineInterface, next: Focus, isAsked: boolean): Promise<void> {
  await setFocusOf(followPortsOf($), followState, next, isAsked)
}

/** Reads the editors' files: which are connected to this project, and what the one that speaks for it says. */
async function readFocus($: EngineInterface): Promise<boolean> {
  return await readFocusOf(followPortsOf($), followState)
}

/** Tells the pane which editors are connected to this project, when that changed. '' is none: the light is red, not out. */
async function showEditors($: EngineInterface, line: string): Promise<void> {
  const before = await read($, watchAtom)
  if (before.editors === line) return
  trace($, 'state', 'editors', () => ({ line }))
  await update($, watchAtom, (w): Watch => ({ ...w, editors: line }))
}

/** The editors' light goes out: this session is not the one reading their files, so it cannot say. */
async function forgetEditors($: EngineInterface): Promise<void> {
  if ((await read($, watchAtom)).editors === undefined) return
  await update($, watchAtom, (w): Watch => {
    const { editors: _editors, ...rest } = w

    return rest
  })
}

/** Explain follows the spot the editor's focus file names, when it names one in this repository. */
async function followEditor($: EngineInterface, now: number): Promise<void> {
  await followEditorOf(followPortsOf($), followState, now)
}

/** Hands what an editor says, when it has said something new, to the journal and to Explain. */
async function pollFocus($: EngineInterface): Promise<void> {
  await pollFocusOf(followPortsOf($), followState)
}

/** Whether the tab that is chosen can be seen: always, now that the pane is the one place the tutor draws. */
async function isTabShown(): Promise<boolean> {
  return true
}

/** Whether anyone can see the Explain view: the tab is open, or an editor is showing it. */
async function isWatched($: EngineInterface): Promise<boolean> {
  return await isWatchedOf(followPortsOf($), followState)
}

/** While the Explain view is being watched, the file in focus is checked far more often than the tree is scanned. */
async function fastPoll($: EngineInterface): Promise<void> {
  await fastPollOf(followPortsOf($), followState)
}

function watchClosely($: EngineInterface): void {
  watchCloselyOf(followPortsOf($), followState)
}

/** Saved files are mapped again, and the focus follows the save unless an editor is reporting its cursor. */
async function followSaves($: EngineInterface, saved: readonly string[], now: number): Promise<void> {
  await followSavesOf(followPortsOf($), followState, saved, now)
}

/** Starts the lookup engine for this repository. `run` is the switch-on this belongs to. */
async function startExplaining($: EngineInterface, settings: Settings, run: number): Promise<void> {
  await startExplainingOf(
    {
      ...followPortsOf($),
      isExplainOff: () => settings.explain.mode === 'off',
      createExplainer: ({ root, onChange, wakeAt }) =>
        createExplainer({
          read: path => readSource($, root, path),
          stamp: path => fileStamp($, `${root}/${path}`),
          store: storeOf($),
          entryPath: path => fileEntryPath(dataRoot, root, path),
          entryStamp: path => fileStamp($, fileEntryPath(dataRoot, root, path)),
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
          insights: (path, name, symbolPrint, filePrint, isMentioned) =>
            project === null
              ? []
              : insightsFor(project, path, name, symbolPrint, filePrint, isMentioned).map(insight =>
                  insightLine(insight, project?.survey?.at, name !== '' && insight.of === 'file' && insight.symbol === ''),
                ),
          // Paused, or with another session driving this project, nothing is fetched unless it is asked for.
          mode: () => (mode === 'off' ? 'off' : mode === 'paused' || !leaseState.isDriver ? 'on request' : settings.explain.mode),
          // While Claude is not answering, or refuses this job's model, only what the person asks for is tried.
          pressure: () => (!mayAsk(health) || jobBlocks.has('explain') ? 'held' : pressure.level),
          model: settings.explain.model,
          onChange,
          wakeAt,
          log: line => {
            $.ui.log(line, { to: 'debug' })
            trace($, 'explain', 'log', () => line)
          },
        }),
    },
    followState,
    run,
  )
}

/** Moves the Explain tab's focus through the file's symbols. */
async function moveFocus($: EngineInterface, step: 1 | -1): Promise<void> {
  await moveFocusOf(followPortsOf($), followState, step)
}

/** What the lookup tool and `/backseat explain` share: move the focus to a spot and say what is known about it. */
async function lookUp($: EngineInterface, spot: Spot): Promise<string> {
  return await lookUpOf(followPortsOf($), followState, spot)
}

/** What every prompt is told about the person: their profile, and what has been seen of their own work. */
function aboutPerson(): string {
  const seen = profiles.languages.map(language => progressState.records.get(language)).filter(record => record !== undefined)
  const grown = growths()
    .filter(({ growth }) => growth.level !== null)
    .map(({ language, growth }) => growthText(language, growth))
  const growthPart = grown.length === 0 ? '' : ['## Their growth, all of it counted: own commits, lessons, help needed, habits', ...grown].join('\n')

  return [personText(profiles), progressText(seen), growthPart].filter(part => part !== '').join('\n\n')
}

/** Growth for the pane, from what it shows. */
function shownGrowth(progress: ProgressView, shown: Profiles, lessons: LessonsView): { language: string; growth: Growth }[] {
  return progress.records.map(record => ({ language: record.language, growth: growthOf(record, shown.subjects[record.language], lessons.paths) }))
}

/** A lesson changed: growth with it, and so what the reviewer is told about the person. */
async function lessonChanged($: EngineInterface, settings: Settings, change: () => Promise<void>): Promise<void> {
  const before = aboutPerson()
  await change()
  if (aboutPerson() !== before) await registerReviewer($, settings)
}

/** Growth in each language in play that has a record. */
function growths(): { language: string; growth: Growth }[] {
  const lessons = lessonViews(learningState, profiles.languages)

  return profiles.languages.flatMap(language => {
    const record = progressState.records.get(language)

    return record === undefined ? [] : [{ language, growth: growthOf(record, profiles.subjects[language], lessons) }]
  })
}

/** What the lessons need from Claude Code. */
function learningPortsOf($: EngineInterface): LearningPorts {
  return {
    ...hostOf($, null),
    pluginRoot: () => $.plugin.root,
    languages: () => profiles.languages,
    setLessons: async view => {
      trace($, 'state', 'lessons', () => ({ paths: view.paths.length, selected: view.selected, problems: view.problems }))
      await update($, lessonsAtom, (): LessonsView => view)
    },
  }
}

async function loadLessons($: EngineInterface): Promise<void> {
  await loadLessonsOf(learningPortsOf($), learningState)
}

async function showLessons($: EngineInterface): Promise<void> {
  await showLessonsOf(learningPortsOf($), learningState)
}

/** Runs one piece of progress work after the ones before it, so that two never write one record at once. */
function queueProgress($: EngineInterface, work: () => Promise<void>): void {
  queueProgressWork(progressState, (what, error) => fail($, what, error), work)
}

async function setProgress($: EngineInterface, change: Partial<ProgressView>): Promise<void> {
  trace($, 'state', 'progress', () => change)
  await update($, progressAtom, (view): ProgressView => ({ ...view, ...change }))
  await keepSpinning($)
}

/** What the look at the person's progress needs from Claude Code. */
function progressPortsOf($: EngineInterface, settings: Settings): ProgressPorts {
  return {
    ...hostOf($, settings),
    settings,
    git: args => git($, repoRoot === '' ? undefined : repoRoot, args),
    projectName: () => projectId(repoRoot).replace(/-[0-9a-f]{8}$/, ''),
    profiles: () => profiles,
    instructions: () => progressInstructions,
    mayAsk: () => mayAsk(health),
    setProgress: change => setProgress($, change),
    registerReviewer: () => registerReviewer($, settings),
    latestReviewed: () => [...reviews].reverse().find(review => review.commit !== '')?.commit ?? '',
    isWaiting: short => reviewState.waiting.commits.some(commit => commit.hash.startsWith(short)),
  }
}

/** The Progress tab shows the records of the languages in play, main ones first. */
async function showProgress($: EngineInterface, settings: Settings): Promise<void> {
  await showProgressOf(progressPortsOf($, settings), progressState)
}

async function loadRecord($: EngineInterface, language: string): Promise<ProgressRecord> {
  return await loadRecordOf({ store: () => storeOf($), dataRoot: () => dataRoot }, language)
}

/** Whose commits count, and the records of the languages in play. */
async function setUpProgress($: EngineInterface, settings: Settings): Promise<void> {
  await setUpProgressOf(progressPortsOf($, settings), progressState)
}

/**
 * A commit of the person's, once it has been reviewed or made: the lines it
 * added, by language, if it is theirs. Resolves false when a request got no
 * answer, which is worth trying again, and true when there is nothing more
 * to do for this commit.
 */
async function assessCommit($: EngineInterface, settings: Settings, hash: string, review: string): Promise<boolean> {
  return await assessCommitOf(progressPortsOf($, settings), progressState, hash, review)
}

/** A language with no level yet gets a first placement from the person's recent commits in this project. */
async function placeFirst($: EngineInterface, settings: Settings, run: number): Promise<void> {
  await placeFirstOf(progressPortsOf($, settings), progressState, run)
}

/**
 * Everything the tutor needs once it is on: the watcher, the profiles, the
 * reviewer and the tools. `/backseat` does not wait for this, so that it answers
 * at once however slow git is. `isFresh` is false when the tutor was already
 * on and the module reloaded, in which case no questions are asked.
 */
async function engage(
  $: EngineInterface,
  settings: Settings,
  run: number,
  isFresh: boolean,
  before: Settings | null = null,
  takesUp: string | null = null,
): Promise<void> {
  try {
    const started = Date.now()
    await startDebug($, settings)
    trace($, 'start', 'engaging', () => ({ run, isFresh, takesUp }))
    await startAnimating($, settings, isFresh)
    if (run !== engagement) return
    await startWatching($, settings, run, isFresh)
    if (run !== engagement) return
    tracer.inProject(repoRoot === '' ? '' : projectId(repoRoot))
    // The lease of the session this one carries on from is its own: nothing waits for it to run out.
    if (takesUp !== null && takesUp !== '') leaseState.holder = takesUp
    // Who drives this project is settled before anything that only the driver does.
    await keepLease($, settings, run)
    if (run !== engagement) return
    // Said where a process that carries this conversation on will look, and looked at again now and then.
    await sayOn($, settings, true)
    schedulerOf($).set('self', (await $.clock.now()) + SELF_CHECK_MS, now => checkSelf($, settings, now))
    if (run !== engagement) return
    if (leaseState.isDriver) await startJournal($, run, isFresh)
    if (run !== engagement) return
    await moveOutOfStore($)
    const main = await setUpProfiles($)
    await loadProject($)
    // What the pane showed when the tutor was last on here: notes still true, and the last review. A session that
    // does not drive took the folder up in `keepLease` (`followDriver`), and takes it up again at every beat.
    if (leaseState.isDriver) await restorePaneFromDisk($, isFresh || takesUp !== null)
    await setUpProgress($, settings)
    await loadLessons($)
    await registerReviewer($, settings)
    // Not waited for. Claude Code connects each tool before it answers, which took eight seconds a tool
    // behind a proxy in a live session, and nothing below needs them.
    void registerTools($).catch(error => fail($, 'could not register the tools', error))
    // The files as they are now are what was just loaded. A change from here on is another session's, or this one's own.
    sharedStamp = null
    await refreshShared($, settings)
    if (leaseState.isDriver) {
      await loadQueue($)
      await adoptReview($, settings)
      // Why the latest reviewed commit did not count, when nothing on record says, and its watched files released.
      await explainUnassessedOf(progressPortsOf($, settings), progressState)
      await releaseSkippedOf(progressPortsOf($, settings), progressState)
    }
    await startExplaining($, settings, run)
    // Commits that were left reviewState.waiting, by an outage or a closed session, are taken up now.
    if (run === engagement) await planReview($, settings)
    trace($, 'start', 'engaged', () => ({ run, repoRoot, languages: profiles.languages, main }), Date.now() - started)
    // Switched on, or switched on by a setting just changed: these run only at such moments.
    const caught = before === null ? null : catchUp(before, settings)
    if (isFresh || caught?.isSurvey === true) void maybeSurvey($, settings, run)
    if (isFresh || caught?.isPlacement === true) queueProgress($, () => placeFirst($, settings, run))
    if (isFresh || caught?.isUpdateCheck === true) void checkForUpdate($, settings)
    // Last, so that everything already works if the questions are dismissed.
    if (isFresh && run === engagement) await ask($, settings, unasked(main))
    // After the questions about their code: how they use the tutor, asked once ever, never in the way.
    if (isFresh && run === engagement) await startLicense($)
  } catch (error) {
    fail($, 'could not finish starting', error)
  }
}

/**
 * Moves to `next`, with everything that has to change along with the mode.
 * `carriedFrom` is the session this process carries the tutor on from, when
 * nobody switched it on here. `isStandingDown` is a process laying the tutor
 * down because its conversation has left it.
 */
async function switchTo(
  $: EngineInterface,
  next: Mode,
  settings: Settings,
  how: { carriedFrom?: string; isStandingDown?: boolean } = {},
): Promise<void> {
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
      // A process that carries this conversation on comes up in the same mode.
      void sayOn($, settings, true)
    }

    return
  }
  engagement += 1
  // The instruction files are framed differently while the tutor is on.
  $.ui.invalidate('prompt.context')
  if (isEngaged) {
    isWatchReady = false
    // Which editors are connected is not known until their files are read.
    await forgetEditors($)
    await showPlay($, settings)
    await showPane($)
    void engage($, settings, engagement, how.carriedFrom === undefined, null, how.carriedFrom ?? null)
  } else {
    // The lease goes back at once, so that a session waiting for it takes over without waiting for it to run out.
    if (leaseState.isDriver && repoRoot !== '' && dataRoot !== '') void giveLease($, leasePath(dataRoot, repoRoot), leaseState.holder)
    stopWatching()
    stopAnimating()
    stopSpinning()
    shownTimer?.cancel()
    shownTimer = null
    shown.band = null
    shown.hint = ''
    await update($, speechAtom, () => SILENT)
    // The journal is written one last time, with the attention added up so far. The command does not wait for it.
    const leaving = journalState.recorder
    journalState.recorder = null
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
    // Off, nothing of it stays above the prompt either.
    isMinimized = false
    shown.minimized = false
    shown.band = null
    await update($, minimizedAtom, () => false)
    await showPane($)
    // Switched off, the session takes back what it said of itself. Left behind by its conversation, it has said goodbye instead.
    if (how.isStandingDown !== true) await sayOffOf(carryPortsOf($, settings), carryState)
    await stopDebug($, how.isStandingDown === true ? 'the conversation left this process' : 'the tutor was switched off')
  }
}

/** Asks one question about forgetting, and answers null when the dialog is dismissed. */
async function choose($: EngineInterface, question: string, options: readonly string[]): Promise<string | null> {
  try {
    return await askPerson($, question, { options: [...options], header: 'Forget' })
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
 * `/backseat forget`: erases what the tutor remembers, after asking. Every way out
 * of a dialog but the explicit one keeps everything.
 */
async function forget($: EngineInterface, settings: Settings, named: Scope | null): Promise<void> {
  const kept = (): void => tellPerson($, NOTHING_FORGOTTEN)
  try {
    await resolveHome($)
    if (dataRoot === '') {
      tellPerson($, 'There is no home directory, so nothing is kept and nothing can be forgotten.')

      return
    }
    const root = repoRoot !== '' ? repoRoot : (await git($, await sessionCwd($), ['rev-parse', '--show-toplevel'])).stdout.trim()
    const projectName = root === '' ? 'no repository here' : projectId(root)

    const scope = named ?? (await pickScope($))
    if (typeof scope === 'string') {
      tellPerson($, scope)

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
      tellPerson($, `Could not delete ${failed.join(', ')}. Delete it by hand to finish.`)

      return
    }

    // What this session holds in memory goes too, so that the blank slate starts now.
    if (scope.kind !== 'language') {
      project = repoRoot === '' ? null : emptyProject(repoRoot)
      reviews = []
      ledger = EMPTY_LEDGER
      findingsStamp = ''
      void update($, issuesAtom, () => NO_ISSUES)
      followedStamps = null
      reviewState.waiting = EMPTY_QUEUE
      reviewState.reviewRetryAt = null
      // A review, a look at the progress or the watched files in flight would write the folder back (the caching audit, 2026-10-06).
      reviewState.reviewAgentId = null
      reviewState.reviewScope = null
      schedulerOf($).cancel('review-watchdog')
      progressState.watchedPaths.clear()
      progressState.skipped = ''
      followState.explainer?.reset()
      notePrints.clear()
      followState.writtenView = ''
      await update($, explainAtom, () => NO_VIEW)
      await update($, notesAtom, () => [])
      await update($, dismissedAtom, () => [])
      await update($, selectedAtom, () => null)
      await update($, reviewAtom, () => NO_REVIEW)
      // Or the journal held in memory would be written straight back into the folder that was just deleted.
      journalState.recorder?.reset()
      await showWorking($, await $.clock.now())
    }
    if (scope.kind !== 'project' && mode !== 'off') {
      await setUpProfiles($)
      await setUpProgress($, settings)
      await loadLessons($)
      await registerReviewer($, settings)
    }
    tellPerson($, `Forgot ${describeScope(scope, projectName)}.`)
  } catch (error) {
    tellPerson($, `Forgetting failed (${String(error)}). Nothing more was deleted.`)
  }
}

/** Draws the tutor in the pane, in the room the site gives it. */
async function drawTutor(
  $: EngineInterface,
  settings: Settings,
  kit: Kit,
  where: Pick<PaneView, 'isFocused' | 'columns' | 'isCompact' | 'rows'> & { placement?: string; scroll?: { offset: number; bodyRows: number } },
) {
  quiet.renders += 1
  // One round for everything the pane shows, not a dozen in a row for every frame.
  const [shownMode, tab, notes, selected, watch, review, shownProfiles, explain, working, progress, release, speech, shownSettings, licensing, backdrop, lessons, openList, spin, now, issues, selectedIssue, playOn] = await Promise.all([
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
    read($, licenseAtom),
    // The character's pixels are dimmed toward the terminal's background, which only the theme tells.
    settings.isAnimated ? themeBackdrop($) : ('dark' as const),
    read($, lessonsAtom),
    read($, openListAtom),
    read($, spinAtom),
    $.clock.now(),
    read($, issuesAtom),
    read($, selectedIssueAtom),
    read($, playOnAtom),
  ])
  // While a lookup runs, the area the explanation stood in keeps its height (`estimatedRows`).
  if (explain.detail !== null) explainRows = estimatedRows(detailMarkdown(explain.detail), where.columns) + explain.insights.length
  const explainHold = explain.detail === null && explain.target !== null && explain.status === 'updating' ? explainRows : 0
  const view: PaneView = {
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
    // Worked out only while the Growth tab is open, from what the pane shows: the records, the profiles and the lessons.
    growth: tab === 'profile' ? shownGrowth(progress, shownProfiles, lessons) : [],
    lessons,
    update: release,
    license: licensing,
    isFocused: where.isFocused,
    columns: where.columns,
    isCompact: where.isCompact,
    rows: where.rows,
    character: settings.isAnimated ? { avatar: avatarFor(settings.persona.voice), speech, backdrop } : null,
    openList,
    spin,
    now,
    settings: shownSettings,
    explainHold,
    issues: { state: issues, views: ledgerViews(issues.ledger, { savedFiles: issues.savedFiles ?? [], cap: PLAY_PICKS }), selected: selectedIssue },
    playOn,
  }

  const tree = renderPane(kit, view, {
    onTab: (tab: Tab) => {
      touched($, settings, 'tab', () => tab)
      // Any list opened downward folds again whenever the person moves on.
      void update($, openListAtom, () => '')
      // Read again each time: a change made in /config meanwhile shows.
      if (tab === 'settings') void showSettings($)
      void showTab($, tab)
    },
    onMinimize: () => {
      touched($, settings, 'minimize')
      void minimizePane($, 'plugin')
    },
    onSettingFold: (key: string) => {
      touched($, settings, 'setting fold', () => key)
      void update($, openListAtom, (open: string): string => (open === `setting:${key}` ? '' : `setting:${key}`))
    },
    onStep: (step: 1 | -1) => {
      touched($, settings, 'step', () => step)
      const next = steppedNote(view, step)
      if (next !== undefined) void update($, selectedAtom, () => next.id)
    },
    onSelect: (id: number) => {
      touched($, settings, 'select', () => id)
      void update($, selectedAtom, () => id)
      void update($, playOnAtom, (): 'note' | 'issue' => 'note')
    },
    // The Play-by-play tab's keys walk its notes, then the issues it shows from the deep review.
    onPlayStep: (step: 1 | -1) => {
      touched($, settings, 'play step', () => step)
      const drawn = [...drawnOrder(view.notes).map(note => ({ kind: 'note' as const, id: note.id })), ...playPicks(view).map(finding => ({ kind: 'issue' as const, id: finding.id }))]
      const item = currentPlayItem(view)
      const at = item === undefined ? -1 : drawn.findIndex(entry => ('note' in item ? entry.kind === 'note' && entry.id === item.note.id : entry.kind === 'issue' && entry.id === item.issue.id))
      const next = drawn[(Math.max(0, at) + (at === -1 ? 0 : step) + drawn.length) % drawn.length]
      if (next === undefined) return
      // Each atom by its own name: the module's state is listed from the calls as written.
      if (next.kind === 'note') void update($, selectedAtom, () => next.id)
      else void update($, selectedIssueAtom, () => next.id)
      void update($, playOnAtom, (): 'note' | 'issue' => next.kind)
    },
    onIssuePin: (id: number, isPinned: boolean) => {
      touched($, settings, isPinned ? 'issue pin' : 'issue unpin', () => id)
      void personOnIssue($, isPinned ? 'pin' : 'unpin', id)
    },
    // A note the play-by-play raised, from the Deep review tab: shown where its keys are.
    onRaisedNote: (id: number) => {
      touched($, settings, 'raised note', () => id)
      void update($, selectedAtom, () => id)
      void update($, playOnAtom, (): 'note' | 'issue' => 'note')
      void update($, tabAtom, (): Tab => 'play')
    },
    onExplain: (note: Note) => {
      touched($, settings, 'explain', () => note)
      // The answer lands in the conversation: an open tab above the prompt would cover it.
      // Not awaited: it resolves when the turn starts, which may be after the one now running.
      void submitForPerson($, explainRequest(note))
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
    onLessonOpen: (id: string | null) => {
      touched($, settings, 'lesson open', () => id)
      void selectLessonOf(learningPortsOf($), learningState, id)
    },
    onLessonStart: (id: string) => {
      touched($, settings, 'lesson start', () => id)
      void startStepOf(learningPortsOf($), learningState, id).then(text => {
        // Not awaited: it resolves when the turn starts. The text carries the step, since this prompt skips the mod's own hook.
        if (text !== '') void submitForPerson($, text)
        else toastPerson($, 'Every step of this lesson is done.')
      })
    },
    onLessonDone: (id: string) => {
      touched($, settings, 'lesson done', () => id)
      void lessonChanged($, settings, async () => {
        const title = await markDoneOf(learningPortsOf($), learningState, id)
        if (title !== '') toastPerson($, `Marked done: ${title}. The tutor seeing you do it counts for more.`)
      })
    },
    onQuestions: () => {
      touched($, settings, 'questions')
      void ask($, settings, firstRunQuestions(profiles.languages, false))
    },
    onExplainMove: (step: 1 | -1) => {
      touched($, settings, 'explain move', () => step)
      void moveFocus($, step)
    },
    onExplainPick: (line: number) => {
      touched($, settings, 'explain pick', () => line)
      void read($, explainAtom).then(shown => {
        // A pick in the outline is the pane's, as `n` and `p` are (the eighth ui-truth pass, 2026-10-06: `view.json` said `command`).
        if (shown.spot !== null) void setFocus($, { path: shown.spot.path, line, source: 'pane' }, true)
      })
    },
    onReviewStep: (step: 1 | -1) => {
      touched($, settings, 'review step', () => step)
      void update($, reviewAtom, (review): Review => {
        const { index, count } = shownReview(review)
        const next = Math.min(Math.max(index + step, 0), Math.max(count - 1, 0))

        return next === index ? review : { ...review, opened: next }
      })
    },
    onIssueSelect: (id: number) => {
      touched($, settings, 'issue select', () => id)
      void update($, selectedIssueAtom, () => id)
      void update($, playOnAtom, (): 'note' | 'issue' => 'issue')
    },
    onIssueStep: (step: 1 | -1) => {
      touched($, settings, 'issue step', () => step)
      void (async () => {
        const [state, chosen, open] = await Promise.all([read($, issuesAtom), read($, selectedIssueAtom), read($, openListAtom)])
        const views = ledgerViews(state.ledger, { savedFiles: [], cap: 0 })
        const drawn = [...views.ranked, ...(open === 'issues-low' ? views.folded : [])]
        if (drawn.length === 0) return
        const at = Math.max(0, chosen === null ? 0 : drawn.indexOf(chosen))
        await update($, selectedIssueAtom, () => drawn[(at + step + drawn.length) % drawn.length] ?? null)
      })()
    },
    onIssueDismiss: (id: number) => {
      touched($, settings, 'issue dismiss', () => id)
      void personOnIssue($, 'dismiss', id)
    },
    onIssueRestore: (id: number) => {
      touched($, settings, 'issue restore', () => id)
      void personOnIssue($, 'restore', id)
    },
    onIssueExplain: (id: number) => {
      touched($, settings, 'issue explain', () => id)
      const finding = ledger.findings.find(candidate => candidate.id === id)
      if (finding !== undefined) void submitForPerson($, issueQuestion(finding))
    },
    ...(settings.editorCommand === ''
      ? {}
      : {
          onIssueOpen: (id: number) => {
            touched($, settings, 'issue open', () => id)
            const finding = ledger.findings.find(candidate => candidate.id === id)
            if (finding !== undefined && finding.file !== '.') openInEditor($, settings, finding.file, Math.max(1, finding.line))
          },
        }),
    ...(leaseState.isDriver
      ? {
          onAudit: () => {
            touched($, settings, 'audit')
            if (!isReviewFree()) {
              toastPerson($, 'A deep review is running. The audit can start when it is done.')

              return
            }
            void maybeAudit($, settings, engagement, true)
          },
        }
      : {}),
    onIssuesFold: (which: 'low' | 'closed') => {
      touched($, settings, 'issues fold', () => which)
      void update($, openListAtom, (open: string): string => (open === `issues-${which}` ? '' : `issues-${which}`))
    },
    onReviewOpen: (index: number) => {
      touched($, settings, 'review open', () => index)
      void update($, openListAtom, () => '')
      void update($, reviewAtom, (review): Review => (review.opened === index ? review : { ...review, opened: index }))
    },
    onReviewsFold: () => {
      touched($, settings, 'reviews fold')
      void update($, openListAtom, (open: string): string => (open === 'reviews' ? '' : 'reviews'))
    },
    onJumpFold: (subject: string) => {
      touched($, settings, 'jump fold', () => subject)
      void update($, openListAtom, (open: string): string => (open === `jump:${subject}` ? '' : `jump:${subject}`))
    },
    onJump: (path: string, line: number) => {
      touched($, settings, 'jump', () => ({ path, line }))
      void update($, openListAtom, () => '')
      // With an editor command set, a place opens in their editor; without one, in the Explain tab.
      if (settings.editorCommand !== '') {
        openInEditor($, settings, path, line)

        return
      }
      void update($, tabAtom, () => 'explain')
      watchClosely($)
      void setFocus($, { path, line, source: 'command' }, true)
    },
    ...(settings.editorCommand === ''
      ? {}
      : {
          onOpen: (path: string, line: number) => {
            touched($, settings, 'open', () => ({ path, line }))
            openInEditor($, settings, path, line)
          },
        }),
    onExplainFetch: () => {
      touched($, settings, 'explain fetch')
      // The press says something even when the file maps to nothing, so it never looks like a dead key.
      toastPerson($, 'Looking this file up…')
      void refreshView($, true)
    },
    onExplainAsk: () => {
      touched($, settings, 'explain ask')
      void read($, explainAtom).then(view => {
        const text = explainAsk(view)
        // A prompt the mod submits skips the mod's own `prompt.submit` hook. The text
        // names the file and the lines, and the tutor's lookup tool has the rest.
        if (text !== '') void submitForPerson($, text)
      })
    },
    onDismiss: (note: Note) => {
      touched($, settings, 'dismiss', () => note)
      // What the character was saying may have been about this note.
      void update($, speechAtom, (said): Speech => (said.text === '' ? said : { ...said, text: '', tick: 0 }))
      // The keys carry on with the next note in the order drawn, not the first.
      const after = steppedNote(view, 1)
      void update($, selectedAtom, () => (after === undefined || after.id === note.id ? null : after.id))
      // Remembered, so that the next look does not bring the same point back.
      void Promise.all([
        update($, notesAtom, open => open.filter(other => other.id !== note.id)),
        update($, dismissedAtom, dismissed => withDismissed(dismissed, note)),
      ]).then(() => saveNotes($))
      void $.clock.now().then(at => journalState.recorder?.add({ at, kind: 'dismissed', path: note.file, line: note.line, text: note.topic }))
    },
    onWorking: () => {
      touched($, settings, 'working')
      void askWorking($)
    },
    onSetting: (row: SettingRow, value: string) => {
      touched($, settings, 'setting', () => ({ key: row.key, value }))
      // Picked: the row's options fold away.
      void update($, openListAtom, () => '')
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
  noteShown($, 'pane', {
    at: Date.now(),
    placement: where.placement ?? '',
    columns: where.columns,
    rows: where.rows,
    isFocused: where.isFocused,
    isCompact: where.isCompact,
    texts: textsOf(tree),
    ...(where.scroll === undefined ? {} : { scroll: where.scroll }),
  })

  return tree
}

/**
 * Keeps what was just drawn, for the state the debug log writes beside
 * itself, and writes the drawing into the log once it has stood a moment.
 * What reached the screen is for `scripts/jack.py` to say: this is the claim.
 */
function noteShown($: EngineInterface, site: 'pane' | 'band', drawing: Shown): void {
  shown[site] = drawing
  if (!tracer.isOn() || shownTimer !== null) return
  if (isSameShown(shownLogged.pane, shown.pane) && isSameShown(shownLogged.band, shown.band)) return
  shownTimer = $.clock.after(SHOWN_SETTLE_MS, () => {
    shownTimer = null
    for (const at of ['pane', 'band'] as const) {
      const latest = shown[at]
      if (isSameShown(shownLogged[at], latest)) continue
      shownLogged[at] = latest
      trace($, 'shown', at, () => latest)
    }
  })
}

/** `/backseat`: what was asked, done, and the answer shown under the command. */
async function backseatCommand($: EngineInterface, settings: Settings, args: string): Promise<{ text: string }> {
  const { request, rest, unknown } = parseRequest(args)
  trace($, 'cmd', request, () => ({ args, mode }))
  // Typing a command means the prompt had the keyboard, whatever the band last heard (Esc raises no event).
  if (request === 'help') return { text: helpText(unknown) }
  if (request === 'debug') {
    const asked = parseDebugRequest(rest)

    return { text: asked === null ? DEBUG_USAGE : await debugCommand($, settings, asked) }
  }
  if (request === 'license') return { text: await licenseCommand($, parseLicenseRequest(rest)) }
  if (request === 'questions') {
    if (mode === 'off') return { text: 'Backseat Driver is off. Run /backseat to start it.' }
    // Not awaited: the dialog stays open for as long as the person takes.
    void ask($, settings, firstRunQuestions(profiles.languages, false))

    return { text: 'Here are the questions again. Esc stops at any point, and the answers so far are kept.' }
  }
  if (request === 'settings') {
    if (mode === 'off') return { text: SETTINGS_OFF }
    await update($, tabAtom, () => 'settings')
    // Asking again brings back a pane that was put away, and reads the rows again.
    await bringBack($)

    return { text: 'The settings are in the pane. Click a row to see its options, or Ctrl+X Tab, then Tab to it and Enter.' }
  }
  if (request === 'explain') {
    if (mode === 'off') return { text: 'Backseat Driver is off. Run /backseat to start it.' }
    if (settings.explain.mode === 'off') return { text: 'Explain is switched off. Its setting is in /config.' }
    if (followState.explainer === null) return { text: 'Explain needs a git repository, and a moment after /backseat to get ready.' }
    await update($, tabAtom, () => 'explain')
    // The answer lands in the pane: one that was put away comes back for it.
    if (isMinimized) await restoreFromStrip($, null)
    watchClosely($)
    const spot = rest.trim() === '' ? followState.focus : parseTarget(rest, repoRoot)
    if (spot === null) {
      return { text: rest.trim() === '' ? 'Name a file and a line: /backseat explain src/app.py:42' : `That is not a file in this project: ${rest.trim()}` }
    }
    // Not awaited: the answer goes to the pane as it arrives.
    void setFocus($, { path: spot.path, line: spot.line, ...(spot.endLine === undefined ? {} : { endLine: spot.endLine }), source: 'command' }, true)

    return { text: `Explaining ${describeSpot(spot)} in the pane.` }
  }
  if (request === 'working') {
    if (mode === 'off') return { text: 'Backseat Driver is off. Run /backseat to start it.' }
    // A session that does not drive keeps no journal of its own and writes into the project's (`sayWorking`).
    if (repoRoot === '') {
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
  const wasOff = mode === 'off'
  if (to !== mode) await switchTo($, to, settings)
  // Asking for "on" again brings back a pane that was put away.
  else if (request === 'on') await bringBack($)
  if (request !== 'status') return { text }

  return { text: `${text} Voice: ${settings.persona.voice}. Engineering: ${settings.persona.engineering}.` }
}

export const register: Register = (on, options) => {
  const settings = readSettings(options)
  loaded.options = options

  on('session.start', async ($, e, next) => {
    // Only a session that began in a terminal is gone for good once it draws nowhere (`core/carrying.ts`).
    carryState.isTerminal = e.surface === 'terminal'
    // After a reload, `$.state` still holds the mode and the notes.
    mode = await read($, modeAtom)
    // A reload is where things go missing, so the debug log carries on from its first moment.
    if (mode !== 'off') {
      await resolveHome($)
      await startDebug($, settings)
    }
    // A change in /config, or in the Settings tab, is a reload with other options.
    const before = await noteSettings($, options)
    if (mode !== 'off') {
      trace($, 'hook', 'session.start', () => ({ mode, cwd: e.cwd, isReload: true }))
      const open = await read($, notesAtom)
      lookState.nextNoteId = open.reduce((highest, note) => Math.max(highest, note.id), 0) + 1
      await loadTutor($, settings.persona)
      // A reload opens the pane again, unless it was put away: the state outlives the module, its variables do not.
      isMinimized = await read($, minimizedAtom)
      shown.minimized = isMinimized
      await showPane($)
      engagement += 1
      await engage($, settings, engagement, false, before)
    }

    try {
      await $.command.register({
        name: 'backseat',
        description: 'Turn the Backseat Driver tutor on. /backseat help lists the rest',
        argumentHint: '[off | pause | resume | status | explain | settings | questions | working | forget | license | update | uninstall | debug | help]',
        immediate: true,
      })
    } catch (error) {
      fail($, 'could not register /backseat', error)
    }

    return next(e)
  })

  // /clear, /resume and /branch reset `$.state` and do not fire `session.start`.
  on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
    await update($, modeAtom, () => mode)
    // So that the next change of a setting is still told apart from the settings in force.
    await update($, appliedAtom, () => options)
    // The pane's "Working on" line was reset with the rest of the state. The journal behind it was not.
    if (mode !== 'off') {
      trace($, 'hook', 'classic.SessionStart', () => ({ source: e.source }))
      // The notes, the review and the rest of the pane were emptied with the state. They come back, and so does whether the pane is put away.
      await update($, minimizedAtom, () => isMinimized)
      await restorePane($, settings)
      journalState.workingShown = ''
      await showWorking($, await $.clock.now())
      await showLicense($)
      // The session may go by another id now. The lease is renewed under it, and it says so under it.
      await keepLease($, settings, engagement)
      await sayOn($, settings, true)
    } else if (e.source !== 'clear') {
      // A conversation Claude Code moved into this process, by a fork or a resume, keeps its tutor.
      await carryOn($, settings)
    }

    return next(e)
  })

  // Spelled out so that `claude plugin validate` can print which command this answers.
  on('command.run', { command: 'backseat' }, async ($, e) => {
    const answer = await backseatCommand($, settings, e.args)
    // What `/backseat` answered is on the screen, under the command: written down, so that it can be looked for there.
    noteSaid($, 'command', answer.text, { args: e.args })

    return answer
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
      journalState.recorder === null ? await storedJournalText($, 'brief') : journalState.recorder.brief(await $.clock.now()),
      // What the ledger holds, so that "is my code healthy?" is answered from what was found and read (2026-10-07).
      repoRoot === '' ? '' : issuesBrief(ledger, ledgerViews(ledger, { savedFiles: [], cap: 0 }), dayClock(await $.clock.now())),
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
      trace($, 'hook', 'turn.complete', () => ({ reason: e.reason }))
      // The conversation's own turn ended. An answer means Claude is answering, which ends any wait.
      if (e.reason === 'answer') await noteOutcome($, settings, 'conversation', { ok: true })
      // Whatever Claude's tools did to the working tree during the turn is looked at now.
      void kick($, settings, 'a turn ended')
      // A turn cut short is how it looks, here, when the conversation is sent to the background mid-answer.
      if (e.reason !== 'answer') void checkBound($, settings)
    }
    const agentId = e.agentId
    if (agentId === undefined || agentId !== reviewState.reviewAgentId) return next(e)
    // The slot is held until what this review leaves behind is on record, so that nothing starts in between.
    await withReviewSlot($, settings, async () => {
      const scope = reviewState.reviewScope
      const failure = reviewState.reviewFailure
      const noted = reviewState.reviewFailureNoted
      reviewState.reviewAgentId = null
      reviewState.reviewScope = null
      reviewState.reviewFailure = ''
      reviewState.reviewFailureNoted = null
      schedulerOf($).cancel('review-watchdog')
      trace($, 'agent', 'finished', () => ({ agentId, reason: e.reason, subject: scope === null ? null : scopeSubject(scope), answer: e.reason === 'answer' ? e.answer : undefined }))

      if (e.reason === 'answer' && e.answer.trim() !== '' && scope !== null) {
        if (scope.kind !== 'survey' && scope.kind !== 'audit') {
          reviewedHead = scope.kind === 'commit' ? scope.hash : lastHead
          reviewedPrint = scope.kind === 'commit' ? '' : scopePrint(scope)
        }
        // The notes at its end go to the project's cache, and never to the pane.
        const kept = await keepReview($, scope, e.answer)
        const shown = kept.text
        const isUnseen = (await read($, tabAtom)) !== 'review' || !(await isTabShown())
        // What the pane puts first: the decision points and insights the review's notes named.
        const decisions = kept.notes?.decisions ?? []
        const insights = insightLines(kept.notes)
        await setReview($, { state: 'done', text: fitReview(shown), isUnseen, decisions, insights })
        // A survey reviewed none of their work, so it is not part of the record of it.
        if (scope.kind !== 'survey') journalState.recorder?.add({ at: await $.clock.now(), kind: 'review', text: scopeSubject(scope) })
        if (isUnseen) toastPerson($, `Deep review ready: ${scopeSubject(scope)}`)
        // The review ends on the one thing most worth doing next, which is worth saying out loud.
        // Its last line as shown: the notes after it are not for the person.
        if (settings.isAnimated) {
          const line = scope.kind === 'survey' ? SURVEY_LINE : scope.kind === 'audit' ? auditLine(ledgerViews(ledger, { savedFiles: [], cap: 0 }).counts) : `Review's in. ${closingLine(shown)}`
          await say($, line)
        }
        // What it said may be about the spot the Explain tab is on.
        void refreshView($)
        reviewState.reviewRetryAt = null
        if (scope.kind === 'commit') {
          // A commit's review is also when the person's progress is brought up to date, with the review for context.
          // A waiting commit moves on to that. One reviewed by hand that was not waiting gets it directly.
          if (reviewState.waiting.commits.some(commit => commit.hash === scope.hash)) await changeQueue($, queue => reviewed(queue, scope.hash))
          else queueProgress($, async () => void (await assessCommit($, settings, scope.hash, withIssues(shown, kept.issues))))
        }
        // The reviewer answered, so Claude is answering.
        await noteOutcome($, settings, 'deep-review', { ok: true })
      } else if (e.reason === 'error' && failure === '') {
        // An API error says only "error" here. Which one arrives through `classic.StopFailure` at about the same
        // moment, so it gets one before this counts as a failure nobody can explain.
        reviewState.endedReview = { agentId, scope }
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
    // The slot is free again: a project that has had no audit gets one, when nothing waits for its review.
    void maybeAudit($, settings, engagement)

    return next(e)
  })

  // An API error ended a turn: the conversation's, or a subagent's. Either way Claude is not answering.
  on('classic.StopFailure', async ($, e, next) => {
    if (mode !== 'off') {
      trace($, 'hook', 'classic.StopFailure', () => ({ error: e.error, details: e.error_details, agent: e.agent_id, type: e.agent_type }))
      const outcome = outcomeOfError(e.error)
      const isRunning = e.agent_id !== undefined && e.agent_id === reviewState.reviewAgentId
      const isEnded = reviewState.endedReview !== null && e.agent_id === reviewState.endedReview.agentId
      // The review's own end, `turn.complete`, says only "error". This says which.
      if (isRunning && !outcome.ok) reviewState.reviewFailure = outcome.detail
      // Any other subagent is one the conversation started: its trouble is not the deep review's setting.
      const noted = noteOutcome($, settings, isRunning || isEnded ? 'deep-review' : 'conversation', outcome)
      if (isRunning) reviewState.reviewFailureNoted = noted
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
      const leaving = journalState.recorder
      if (leaving !== null) await flushJournal($, leaving, await $.clock.now(), true)
      if (e.reason === 'clear' || e.reason === 'resume') await flushDebug($)
      else {
        if (leaseState.isDriver && repoRoot !== '' && dataRoot !== '') await giveLease($, leasePath(dataRoot, repoRoot), leaseState.holder)
        // A conversation sent to the background ends this process first and comes up in another a moment later.
        await sayLeftOf(carryPortsOf($, settings), carryState)
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
    if (mode === 'off' || followState.explainer === null) return answered($, e, 'Nothing is cached, because Explain is not running. Read the file instead.')
    const path = relativeTo(repoRoot, String(e.file ?? ''))
    if (path === null) return answered($, e, 'That file is not in this project.')
    const line = Math.floor(Number(e.line ?? 1))

    return answered($, e, await lookUp($, { path, line: Number.isFinite(line) && line >= 1 ? line : 1 }))
  })

  on('tool.call', { tool: 'mcp__backseat-driver__progress' }, async ($, e) => {
    if (mode === 'off') return answered($, e, 'Backseat Driver is off.')
    if (!settings.isProgressOn) return answered($, e, 'The progress report is switched off in /config.')
    const language = String(e.language ?? '').trim().toLowerCase()
    const record = progressState.records.get(language) ?? (await loadRecord($, language))
    const whose = progressState.identity.length === 0 ? 'Git has no user.email here, so no commit can be confirmed as theirs.' : `Only commits by ${progressState.identity.join(' or ')} count.`

    const growth = growthOf(record, profiles.subjects[language], lessonViews(learningState, profiles.languages))
    const grown = growthText(language, growth)

    return answered($, e, record.observations.length === 0 ? `Nothing is on record for ${language} yet. ${whose}\n\n${grown}` : `${recordText(record)}\n\n${grown}\n\n${whose}`)
  })

  on('tool.call', { tool: 'mcp__backseat-driver__lesson' }, async ($, e) => {
    if (mode === 'off') return answered($, e, 'Backseat Driver is off.')
    const asked = { path: e.path, step: e.step, outcome: e.outcome }
    const answer: { text: string } = { text: '' }
    await lessonChanged($, settings, async () => {
      answer.text = await lessonToolOf(learningPortsOf($), learningState, asked)
    })

    return answered($, e, answer.text)
  })

  on('tool.call', { tool: 'mcp__backseat-driver__profile' }, async ($, e) => {
    if (mode === 'off') return answered($, e, 'Backseat Driver is off.')
    const subject = String(e.language ?? GENERAL).trim().toLowerCase() || GENERAL
    const text = personText({ languages: [subject], subjects: { [subject]: await loadSubject($, subject) } })

    return answered($, e, text === '' ? `Nothing is on record for ${subject}.` : text)
  })

  on('tool.call', { tool: 'mcp__backseat-driver__working' }, async ($, e) => {
    // A session that does not drive keeps no journal of its own and writes into the project's (`sayWorking`).
    if (mode === 'off' || repoRoot === '') return answered($, e, 'No journal is being kept here, so nothing was recorded.')
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

  on('tool.call', { tool: 'mcp__backseat-driver__issue' }, async ($, e) => {
    if (mode === 'off' || repoRoot === '') return answered($, e, 'No project is being looked after here, so there are no issues on record.')
    if (typeof e.id !== 'number') {
      const views = ledgerViews(ledger, { savedFiles: [], cap: 0 })
      const listed = issuesForRequest(ledger, [...views.ranked, ...views.folded])
      const read = coverageLine(ledger.coverage, dayClock(await $.clock.now()))

      return answered($, e, [listed.length === 0 ? 'No issue is open.' : listed.join('\n'), read === '' ? 'The codebase has not been audited.' : read].join('\n\n'))
    }
    const id = e.id
    const before = ledger.findings.find(finding => finding.id === id)
    if (before === undefined) return answered($, e, `There is no issue ${id}.`)
    if (e.status === undefined && (e.severity === undefined || e.severity === '')) return answered($, e, `Nothing was recorded: give the reviewer's verdict as a status, or a severity.`)
    const at = await $.clock.now()
    const ruling = { id, status: e.status ?? before.status, note: typeof e.note === 'string' ? tidy(e.note) : '', severity: e.severity ?? '' }
    trace($, 'state', 'issue ruled in the conversation', () => ruling)
    // The deep reviewer's verdict, so it is a review's word: never a dismissal, which is the person's own.
    await changeIssues($, current => ruledIssues(current, 'review', at, [ruling]).ledger)
    const after = ledger.findings.find(finding => finding.id === id)
    if (after === undefined || (after.status === before.status && after.severity === before.severity && after.statusNote === before.statusNote)) {
      return answered($, e, `Issue ${id} was not changed${before.status === 'dismissed' ? ': they dismissed it, and that stands' : ''}.`)
    }

    return answered($, e, `Issue ${id} (${after.title}) is now ${after.status}, ${after.severity}${after.statusNote === '' ? '' : `: ${after.statusNote}`}. The pane shows it.`)
  })

  on('tool.call', { tool: 'mcp__backseat-driver__activity' }, async ($, e) => {
    if (mode === 'off') return answered($, e, NO_ACTIVITY)
    // A session that does not drive reads the driver's journal: the glance without the latest diffs, which are the driver's.
    const doing = journalState.recorder === null ? await storedJournalText($, 'glance') : journalState.recorder.activity(await $.clock.now())

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

  // The person closing the pane (its mark, or Esc) is something only Claude Code sees. The tutor writes it down,
  // so that a pane missing from the screen reads as their choice and not as a fault.
  on('ui.close', async ($, e, next) => {
    if (e.id === PANE_ID && mode !== 'off') {
      const origin = e.origin.kind
      shown.closed = { at: Date.now(), origin }
      if (origin !== 'plugin') shown.opened = null
      // Whoever closed it, nothing of the pane is on the screen any more.
      shown.pane = null
      trace($, 'ui', 'pane closed', () => ({ origin }))
      // The person's own close (the pane's mark, Ctrl+X X) puts the pane away and leaves the tutor on.
      if (origin === 'person') await minimizePane($, 'person')
    }

    return next(e)
  })

  // Minimized, the pane is a strip above the prompt: its name and its tabs, each a way back. A survey there comes first.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (mode === 'off' || e.props.hasSurvey) return next(e)
    if (!(await read($, minimizedAtom))) return next(e)
    const [notes, review, explain, progress] = await Promise.all([read($, notesAtom), read($, reviewAtom), read($, explainAtom), read($, progressAtom)])
    const tree = renderMinimized(
      $.ui.resolve(e),
      { notes, review, explain, progress },
      {
        onRestore: (tab: Tab | null) => {
          touched($, settings, 'restore', () => tab)
          void restoreFromStrip($, tab)
        },
      },
    )
    noteShown($, 'band', {
      at: Date.now(),
      placement: '',
      columns: e.props.bodyColumns,
      rows: e.viewport?.rows ?? 48,
      isFocused: false,
      isCompact: true,
      texts: textsOf(tree),
    })

    return tree
  })

  // A surface joining or leaving the session: a terminal attached to a background session, or one that left it.
  on('session.attach', ($, e, next) => {
    if (mode !== 'off') trace($, 'hook', 'session.attach', () => ({ surface: e.surface, clientId: e.clientId, viewport: e.viewport }))

    return next(e)
  })

  on('session.detach', ($, e, next) => {
    if (mode !== 'off') trace($, 'hook', 'session.detach', () => ({ surface: e.surface, clientId: e.clientId, reason: e.reason }))

    return next(e)
  })

  // What Claude Code and other plugins tell the person, while the tutor is on, beside what the tutor said itself.
  on('ui.toast', ($, e, next) => {
    // The tutor's own toasts come through here too, and are already written down as said.
    const mine = saidLately.at(-1)
    const isMine = mine !== undefined && mine.how === 'toast' && mine.text === e.text && Date.now() - mine.at < 1000
    if (mode !== 'off' && !isMine) trace($, 'heard', 'toast', () => ({ text: e.text }))

    return next(e)
  })

  on('ui.log', ($, e, next) => {
    if (mode !== 'off') trace($, 'heard', e.to, () => ({ text: e.text }))

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: 'backseat-driver' }, async ($, e) =>
    drawTutor($, settings, $.ui.resolve(e), {
      isFocused: e.props.isFocused,
      rows: e.viewport?.rows ?? 48,
      columns: e.props.bodyColumns,
      placement: e.props.placement,
      // The window over the drawing, for what the tutor says it shows: the first row on the screen, 0 at the top.
      scroll: e.props.scroll === undefined ? undefined : { offset: e.props.scroll.offset, bodyRows: e.props.scroll.bodyRows },
      // A fullscreen terminal seats the pane beside the conversation, and above the prompt once it is too narrow
      // for that: it is drawn whole there too, so that narrowing the window moves the pane and never swaps it for
      // another look. Where panes are never seated at the side, rows above the prompt are scarce, and other
      // surfaces may not draw text art in a fixed-width font.
      isCompact: e.surface !== 'terminal' || (e.props.placement === 'inline' && e.viewport?.isFullscreen !== true),
    }),
  )

  // The focus ring says one thing nothing else does: which note the person is on.
  on('ui.focus', async ($, e, next) => {
    const result = await next(e)
    if (result.deny !== undefined) return result
    const note = /^note-(\d+)$/.exec(e.element ?? '')
    if (note !== null) {
      await update($, selectedAtom, () => Number(note[1]))
      await update($, playOnAtom, (): 'note' | 'issue' => 'note')
    }
    const issue = /^issue-(\d+)$/.exec(e.element ?? '')
    if (issue !== null) {
      await update($, selectedIssueAtom, () => Number(issue[1]))
      await update($, playOnAtom, (): 'note' | 'issue' => 'issue')
    }

    return result
  })

  // Where the pane's window moves, and who moved it: for the debug log, so that a pane standing scrolled past its
  // top can be told from one the person scrolled. The move itself is let through as it is.
  on('ui.scroll', { requestId: 'backseat-driver' }, async ($, e, next) => {
    // A wheel at the edge asks for the offset it already has, eighty times in two seconds (2026-10-06): only a move is logged.
    if (mode !== 'off' && (e.origin.kind !== 'person' || e.offset !== lastScrollOffset)) trace($, 'ui', 'scroll', () => ({ offset: e.offset, by: e.by, origin: e.origin.kind }))
    lastScrollOffset = e.offset

    return next(e)
  })

}
