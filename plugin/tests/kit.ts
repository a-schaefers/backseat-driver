/**
 * Shared inputs and stubs for the tests. In a test nothing is real: each
 * stub here answers in Claude Code's place.
 */
import type { AgentSpec, ConfigRow, ModelCompleteRequest, On, RenderElement, ToolSpec } from 'claude-code'
import { mock, test } from 'claude-code/testing'
import type { TestBody, TestOptions, TestRest } from 'claude-code/testing'

import { projectId } from '../core/datahome'
import { emptyProject } from '../core/project'

/**
 * A test gets five seconds unless it asks for more. One that starts a session
 * loads the whole mod first, and every test file runs at once, so on a busy
 * machine five seconds is not always enough.
 */
const SESSION_TEST_MS = 30_000

/** `test`, for a test that starts a session: the same, with more time. */
export function sessionTest(name: string, ...rest: TestRest): void {
  const [first, second] = rest
  const options: TestOptions = typeof first === 'function' ? {} : first
  const body = (typeof first === 'function' ? first : second) as TestBody
  test(name, { timeoutMs: SESSION_TEST_MS, ...options }, body)
}

/** A `/name args` typed at the prompt of a wide fullscreen terminal. */
export function typed(command: string, args = '') {
  return {
    command,
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 160 },
  } as const
}

/** What Claude Code passes `session.start` in an interactive terminal session. */
export const SESSION = { surface: 'terminal', isInteractive: true, cwd: '/work' } as const

export const HOME = '/home/me'

/** A person who said long ago how they use the tutor, so that the license question is not among the questions a test counts. */
export const LICENSE_ANSWERED = { 'license.json': { v: 1, use: 'personal', isAsked: true } }
/** The session's id, as `$.session.id()` answers it. */
export const SESSION_ID = 'feedc0de-0000-4000-8000-000000000001'
/** Where the tutor keeps its own files in a test. */
export const DATA_HOME = `${HOME}/.local/share/backseat-driver`
/** The fake repository's root. */
export const ROOT = '/work'

/** A stand-in for skills/tutor/SKILL.md, frontmatter included. */
export const SKILL_FILE = '---\nname: tutor\n---\n\n# Contract\n\nThe user writes the code.\n'

/** The system prompt as Claude Code composes it, cut down to what the tests look at. */
export const ENGINE_SECTIONS = [
  { id: 'intro', text: 'You are an interactive agent.', scope: 'shared' },
  { id: 'doing_tasks', text: '# Doing tasks\n - find the method in the code and modify the code.', scope: 'shared' },
  { id: 'tone', text: '# Tone and style', scope: 'shared' },
  { id: 'memory', text: '# auto memory', scope: 'session' },
] as const

/** What `$.prompt.compose` is called with for a main-conversation request. */
export const COMPOSE = {
  model: 'claude-test',
  promptModel: 'claude-test',
  surfaces: ['terminal'],
  tools: ['Read', 'Edit', 'Write', 'Bash'],
  outputStyle: null,
  traits: [],
} as const

export const STOCK_CLAUDE_MD =
  'Codebase and user instructions are shown below. Be sure to adhere to these instructions. IMPORTANT: These instructions OVERRIDE any default behavior and you MUST follow them exactly as written.\n\nContents of /work/CLAUDE.md (project instructions, checked into the codebase):\n\nAlways edit the files yourself.'

/** What Claude Code passes a `ui.render` hook for the plugin's pane, apart from the surface. */
export const PANE = {
  plugin: 'backseat-driver',
  component: 'Pane',
  requestId: 'backseat-driver',
  viewport: { columns: 160, rows: 48 },
  props: {
    title: 'Backseat',
    isFocused: true,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

/** What Claude Code passes a `ui.render` hook for the band above the prompt, apart from the surface. */
export const BAND = {
  plugin: 'backseat-driver',
  component: 'AbovePrompt',
  requestId: 'above-prompt',
  viewport: { columns: 160, rows: 48 },
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 24,
    bodyColumns: 155,
    scroll: { offset: 0, bodyRows: 23 },
    view: {},
  },
} as const

/** What the kit draws in the band above the prompt in Claude Code's place. */
export const ENGINE_BAND = 'nothing of the plugin here'

/** What Claude Code passes a `ui.render` hook for the hint line under the prompt, apart from the surface. */
export const HINT = {
  plugin: 'backseat-driver',
  component: 'PromptHint',
  requestId: 'prompt-hint',
  viewport: { columns: 160, rows: 48 },
  props: { isDraft: false, isWorking: false, hint: '? for shortcuts' },
} as const

const USAGE = { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

/** A stand-in for a commit hash: forty hex digits that count up. */
export function commitHash(index: number): string {
  return index.toString(16).padStart(40, '0')
}

/** What Claude Code passes `turn.complete` when a subagent the plugin did not start finishes. */
export function finished(agentId: string, answer: string) {
  return { turnId: `turn-${agentId}`, agentId, answer, durationMs: 1000, isAborted: false, reason: 'answer' } as const
}

export type StubOptions = {
  /** Extra files of the plugin itself, by path suffix: `/personas/voice/knuth.md`. */
  pluginFiles?: Record<string, string>
  /** What is committed in the fake repository, by path from its root. */
  head?: Record<string, string>
  /** False for a folder that is not a git repository. */
  isRepository?: boolean
  /** What the plugin's store holds before the session, by key. Profiles lived there once. */
  store?: Record<string, unknown>
  /** JSON files already in the tutor's data folder, by path from it: `profiles/python.json`. */
  data?: Record<string, unknown>
  /** Environment variables besides HOME. */
  env?: Record<string, string>
  /**
   * True for a project the tutor has never seen, which gets a survey by the
   * deep reviewer when the tutor is switched on. Left out, the project counts
   * as surveyed already, so that a test's first subagent is its own.
   */
  isNewProject?: boolean
  /** The email git says is the person's in the fake repository. '' for none. Default: `me@example.com`. */
  email?: string
  /** How this copy of the plugin was installed: a clone (whose top is the plugin's parent folder), or through a marketplace. Left out, neither. */
  install?: 'clone' | 'installed'
  /** The release tags upstream, such as `v0.3.0`. Left out, `git ls-remote` fails, as it does offline. */
  tags?: string[]
  /** True when the clone has changes of its own. */
  isCloneDirty?: boolean
  /** True when the clone already has everything upstream has, so a pull changes nothing. */
  isCloneCurrent?: boolean
  /** True when inotifywait is on PATH: the tutor's watchers run, and `session.watchers` drives them. Left out, it is not there. */
  hasInotify?: boolean
  /** Folders git ignores in the fake repository, as `git ls-files --ignored --directory` lists them. */
  ignored?: string[]
}

/** A file watcher the tutor started, as a test drives it. */
export type FakeWatcher = {
  argv: readonly string[]
  /** Reports changes to these absolute paths, one line each, in one piece of output. */
  report: (...paths: string[]) => void
  /** Ends the child, as inotifywait does when it gives up, with this on stderr. */
  end: (complaint?: string) => void
  /** True once the tutor ended the child. */
  isStopped: boolean
}

/** Who wrote a commit in the fake repository, and anything its message says besides its title. */
export type CommitOptions = { author?: { name: string; email: string }; body?: string; isMerge?: boolean }

/**
 * Everything the plugin calls: the session, a fake git repository under
 * /work, a clock the test moves, and a model that answers from a queue.
 */
export function stubSession(on: On, options: StubOptions = {}) {
  const head: Record<string, string> = { ...options.head }
  const files: Record<string, string> = { ...head }
  const mtimes = new Map<string, number>()
  let writes = 0
  /** Every commit, oldest first, with the tree it recorded. The repository starts with one. */
  const me = { name: 'Me', email: options.email ?? 'me@example.com' }
  const commits: { hash: string; message: string; tree: Record<string, string>; author: { name: string; email: string }; body: string; isMerge: boolean }[] = [
    { hash: commitHash(1), message: 'Start', tree: { ...head }, author: me, body: '', isMerge: false },
  ]
  /** Every move of HEAD, as the reflog records it. */
  const reflog = [`${commitHash(1)}\0commit (initial): Start`]
  const tip = () => commits[commits.length - 1] ?? { hash: '', message: '', tree: {}, author: me, body: '', isMerge: false }

  /** What a commit added to each file, as `git show --unified=0` prints it: every line not in the file before. */
  const patchOf = (index: number): string => {
    const commit = commits[index]
    const before = commits[index - 1]?.tree ?? {}
    if (commit === undefined) return ''

    return Object.entries(commit.tree)
      .filter(([path, text]) => before[path] !== text)
      .map(([path, text]) => {
        const old = new Set((before[path] ?? '').split('\n'))
        const added = text.split('\n').filter(line => line !== '' && !old.has(line))

        return [`diff --git a/${path} b/${path}`, `--- a/${path}`, `+++ b/${path}`, `@@ -0,0 +1,${added.length} @@`, ...added.map(line => `+${line}`)].join('\n')
      })
      .join('\n')
  }

  /** Marks the plugin made in its lock repository with `git hash-object`, by what they hold. */
  const marks = new Map<string, string>()

  /** The clone's top folder, once the plugin has asked git for it, and the commit it is at. */
  let cloneTop = ''
  let cloneHead = commitHash(500)
  const session = {
    /** The rows of `/config`, as `$.config.list()` answers: three of the plugin's own and one of another plugin's. */
    config: [
      {
        key: 'backseat-driver.layout',
        label: 'Layout',
        kind: 'choice',
        value: 'unified',
        options: ['unified', 'horizontal', 'vertical'],
        provider: { plugin: 'backseat-driver', tier: 'user' },
        isLocked: false,
      },
      {
        key: 'backseat-driver.voice',
        label: 'Voice persona',
        description: 'How the tutor talks.',
        kind: 'choice',
        value: 'default',
        options: ['default', 'torvalds', 'knuth'],
        provider: { plugin: 'backseat-driver', tier: 'user' },
        isLocked: false,
      },
      {
        key: 'backseat-driver.animated_persona',
        label: 'Animated persona',
        kind: 'boolean',
        value: true,
        provider: { plugin: 'backseat-driver', tier: 'user' },
        isLocked: false,
      },
      { key: 'theme', label: 'Theme', kind: 'choice', value: 'dark', options: ['dark', 'light'], provider: { plugin: 'engine', tier: 'core' }, isLocked: false },
    ] as ConfigRow[],
    /** Every `$.config.set` the plugin made, in order. */
    configured: [] as { key: string; value: unknown }[],
    /** Set to refuse the next `$.config.set` with this reason. */
    configDeny: '',
    opened: [] as string[],
    closed: [] as string[],
    /** Why Claude Code opens a pane without drawing it, as it does unasked on a narrow terminal. '' for a pane that is drawn. */
    paneWaits: '',
    /** Every `$.ui.status` call, in order: the text, or undefined for a cleared line. */
    statuses: [] as (string | undefined)[],

    /** Every prompt that reached Claude Code, and what the plugin attached to it for Claude alone. */
    submitted: [] as string[],
    contexts: [] as (readonly string[])[],
    /** Every request the plugin made to a model. */
    requests: [] as ModelCompleteRequest[],
    /** Queued replies; with none queued the model has nothing to add. */
    replies: [] as string[],
    /** The same for the Explain tab's lookups, which are kept apart from the play-by-play's. */
    lookups: [] as ModelCompleteRequest[],
    lookupReplies: [] as string[],
    lookupAnswers: [] as { when: string; reply: string }[],
    /** The progress assessments the plugin asked for, and the replies queued for them. With none queued, nothing is seen. */
    assessments: [] as ModelCompleteRequest[],
    assessmentReplies: [] as string[],
    /** Queues the reply to the next progress assessment. */
    assess(reply: unknown) {
      session.assessmentReplies.push(typeof reply === 'string' ? reply : JSON.stringify(reply))
    },
    clock: mock.clock(on),
    /** Saves a file in the working tree, as the user's editor would. */
    write(path: string, text: string) {
      files[path] = text
      writes += 1
      mtimes.set(path, writes)
    },
    /** Subagent types the plugin registered, and the subagents it started. */
    agents: [] as AgentSpec[],
    spawned: [] as { type: string; description: string; prompt: string }[],
    /** Ids of subagents a test has reported finished, through `finish()`. */
    finishedAgents: [] as string[],
    /** Ids of subagents that are gone without having reported back: Claude Code no longer lists them. */
    lostAgents: [] as string[],
    toasts: [] as string[],
    /** The plugin's store, which outlives the session. */
    store: new Map<string, unknown>(Object.entries(options.store ?? {})),
    /** Every file outside the repository, by absolute path: the tutor's data folder. */
    disk: new Map<string, string>(
      Object.entries(options.data ?? {}).map(([path, value]) => [`${DATA_HOME}/${path}`, JSON.stringify(value)]),
    ),
    /** What the plugin deleted with `rm`, in order. */
    removed: [] as string[],
    /**
     * Files another session is in the middle of writing, by absolute path: the
     * next reads of one find it empty, that many times, as `$.fs.write` leaves it for a moment.
     */
    halfWritten: new Map<string, number>(),
    /** Every lock the plugin took and gave back, in order: `take <ref>`, `steal <ref>`, `give <ref>`, or `refused <ref>`. */
    locking: [] as string[],
    /** Another session's lock on a file of the data folder, taken this long ago on the test's clock. */
    lockedElsewhere(ref: string, agoMs = 0) {
      const file = `${options.env?.BACKSEAT_DRIVER_HOME ?? DATA_HOME}/locks.git/${ref}`
      session.disk.set(file, `${commitHash(9999)}\n`)
      mtimes.set(file, session.clock.now() - agoMs)
    },
    /** The `claude` commands the plugin ran, the network git commands, and `git pull`, in order. */
    ran: [] as string[],
    /** The folder that holds what the tutor knows about the fake repository. */
    projectFolder: `${options.env?.BACKSEAT_DRIVER_HOME ?? DATA_HOME}/projects/${projectId(ROOT)}`,
    /** A JSON file in the tutor's data folder, by path from it, or undefined when it is not there. */
    data(path: string): unknown {
      const text = session.disk.get(`${DATA_HOME}/${path}`)

      return text === undefined ? undefined : (JSON.parse(text) as unknown)
    },
    /** The plan's usage windows as Claude Code reports them. Empty means no reading. */
    limits: [] as { kind: string; percentUsed: number; resetsAt?: string }[],
    /** How many times the plugin has asked git for the working tree's status: once per scan. */
    scans: 0,
    /** The file watchers the tutor started, oldest first. Only with `hasInotify`. */
    watchers: [] as FakeWatcher[],
    /** Every command the tutor tried to start as a long-running child, found or not. */
    spawnedProcesses: [] as string[][],
    /** What `$.turn.complete` is fired with when a turn of the conversation itself ends with an answer. */
    turnEnded(answer = 'Done.') {
      return { turnId: 'turn-main', answer, durationMs: 1000, isAborted: false, reason: 'answer' } as const
    },
    /**
     * How the next requests to a model go wrong, in order: one of Claude Code's words for an
     * API error (`overloaded`, `rate_limit`, `server_error`, `authentication_failed`,
     * `model_not_found`), or `offline`, `timeout` or `empty`. As it stands it is for whichever
     * job asks next. `look:overloaded`, `explain:...` or `progress:...` is for that job's next request.
     */
    failing: [] as string[],
    /** Claude Code's id for this session. `/clear` gives a session another: a test sets it and fires `classic.SessionStart`. */
    sessionId: SESSION_ID as string,
    /** Where the session draws. A test empties it for a process whose conversation went to the background. */
    surfaces: ['terminal'] as ('terminal' | 'desktop' | 'mobile' | 'vscode')[],
    /** When the session's conversation first began, which a fork and a resume of it share. */
    born: 0,
    /** The jobs (`look`, `explain`, `progress`) whose model requests stay open, as a slow model's do, until `release()`. */
    stalled: [] as string[],
    /** The answers held back for those requests. */
    held: [] as (() => void)[],
    /** Every key the plugin read from its store, in order. */
    storeReads: [] as string[],
    /** Every file the plugin read outside the repository and its own folder, in order. */
    diskReads: [] as string[],
    /** Tools the plugin registered for the model. */
    tools: [] as Required<ToolSpec>[],
    /** The questions the plugin put to the user, and the answers still queued. With none queued, the dialog is dismissed. */
    asked: [] as string[],
    answers: [] as string[],
    /** What the plugin wrote to the debug log: where a swallowed error shows up. */
    logs: [] as string[],
    /** Every record in the tutor's own debug log, in order, across its chunks. Empty while that log is off. */
    debugLog(): { k: string; n: string; s: string; p: string; seq: number; ms?: number; d?: unknown }[] {
      return [...session.disk.entries()]
        .filter(([path]) => path.startsWith(`${DATA_HOME}/debug/`) && path.endsWith('.jsonl'))
        .sort(([a], [b]) => a.localeCompare(b))
        .flatMap(([, text]) => text.split('\n').filter(line => line !== ''))
        .map(line => JSON.parse(line) as { k: string; n: string; s: string; p: string; seq: number; ms?: number; d?: unknown })
    },
    /** Commits the working tree, as `git commit -am` would, and returns the new commit's hash. */
    commit(message = 'Commit', commitOptions: CommitOptions = {}) {
      for (const path of Object.keys(head)) delete head[path]
      Object.assign(head, files)
      const hash = commitHash(commits.length + 1)
      commits.push({ hash, message, tree: { ...head }, author: commitOptions.author ?? me, body: commitOptions.body ?? '', isMerge: commitOptions.isMerge === true })
      reflog.push(`${hash}\0commit: ${message}`)

      return hash
    },
    /** Moves HEAD without a commit, as a checkout or a pull would. */
    checkout() {
      const hash = commitHash(commits.length + 1)
      commits.push({ hash, message: 'Elsewhere', tree: { ...head }, author: me, body: '', isMerge: false })
      reflog.push(`${hash}\0checkout: moving from main to other`)
    },
    /** The id of the nth subagent the plugin spawned, counting from 1. */
    agentId(index: number) {
      return `agent-${index}`
    },
    /** What `$.turn.complete` is fired with when the nth subagent ends. */
    finish(index: number, answer: string, reason: 'answer' | 'error' | 'aborted' = 'answer') {
      const agentId = session.agentId(index)
      session.finishedAgents.push(agentId)

      return { turnId: `turn-${agentId}`, agentId, answer, durationMs: 1000, isAborted: reason === 'aborted', reason }
    },
    /** Queues the reviewer's next reply. */
    reply(reply: unknown) {
      session.replies.push(typeof reply === 'string' ? reply : JSON.stringify(reply))
    },
    /**
     * Moves the cursor in an editor that reports to the tutor: it writes its
     * file in the editors' folder. `more` holds the protocol's other fields,
     * such as `buffers`, and may name the `editor` (one file each) or set `at`.
     * By default the editor keeps beating for as long as the test runs.
     */
    editor(file: string, line: number, endLine?: number, more: Record<string, unknown> = {}) {
      writes += 1
      const path = `${DATA_HOME}/editors/${String(more.editor ?? 'test')}-1.json`
      const report = { v: 1, editor: 'test', pid: 1, at: Number.MAX_SAFE_INTEGER, changed: session.clock.now() + writes, file, line }
      session.disk.set(path, JSON.stringify({ ...report, ...(endLine === undefined ? {} : { endLine }), ...more }))
      mtimes.set(path, writes)
    },
    /**
     * What the explain model answers. With `when`, every request whose prompt
     * contains that text gets this reply: lookups run side by side, so their
     * order is not something a test can count on. Without it, the next request does.
     */
    explain(reply: unknown, when?: string) {
      const text = typeof reply === 'string' ? reply : JSON.stringify(reply)
      if (when === undefined) session.lookupReplies.push(text)
      else session.lookupAnswers.push({ when, reply: text })
    },
    /** From now on this job's model requests stay open until `release()`. */
    stall(job: 'look' | 'explain' | 'progress') {
      session.stalled.push(job)
    },
    /** Answers every request that was held open, and holds none from now on. */
    release() {
      session.stalled.length = 0
      for (const answer of session.held.splice(0)) answer()
    },
  }

  if (options.install === 'installed') {
    // An install path of `/` holds every folder, the plugin's included.
    session.disk.set(`${HOME}/.claude/plugins/installed_plugins.json`, JSON.stringify({ version: 2, plugins: { 'backseat-driver@backseat-driver': [{ installPath: '/' }] } }))
  }
  if (options.isNewProject !== true && !session.disk.has(`${session.projectFolder}/project.json`)) {
    session.disk.set(`${session.projectFolder}/project.json`, JSON.stringify({ ...emptyProject(ROOT), isSurveyed: true }))
  }

  on('session.start', () => ({ cwd: ROOT }))
  on('session.end', () => ({ sessionId: session.sessionId }))
  on('session.id', () => ({ value: session.sessionId }))
  on('session.cwd', () => ({ value: ROOT }))
  on('session.surfaces', () => ({ value: session.surfaces }))
  on('session.version', () => ({ value: { version: '2.1.289', base: '2.1.289', builtAt: '2026-10-03T19:21:39Z' } }))
  on('classic.SessionStart', () => ({}))
  on('classic.StopFailure', () => ({}))
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('env.get', ($, e) => ({ value: e.name === 'HOME' ? HOME : options.env?.[e.name] }))
  on('ui.log', ($, e) => {
    session.logs.push(e.text)

    return { value: undefined }
  })
  // The kit answers a redraw itself, but not the invalidation of a cached prompt event.
  on('ui.invalidate', () => ({ value: undefined }))
  const panes: string[] = []
  // What Claude Code draws in the band above the prompt and in the hint line under it, when no plugin draws there.
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)

    return h(Text, {}, ENGINE_BAND) as RenderElement
  })
  on('ui.render', { component: 'PromptHint' }, ($, e) => {
    const { Text } = $.ui.resolve(e)

    return h(Text, { dimColor: true }, `${e.props.hint}${e.props.tail === undefined ? '' : ` · ${e.props.tail}`}`) as RenderElement
  })
  on('ui.open', ($, e) => {
    session.opened.push(e.id)
    if (!panes.includes(e.id)) panes.push(e.id)

    return { value: session.paneWaits === '' ? { isPlaced: true } : { isPlaced: false, reason: session.paneWaits } }
  })
  on('ui.close', ($, e) => {
    session.closed.push(e.id)
    panes.splice(panes.indexOf(e.id), 1)

    return { value: undefined }
  })
  on('ui.panes', () => ({ value: panes.map(id => ({ id, title: 'Backseat', isShown: true, isFocused: false, isPlaced: true })) }))
  on('ui.status', ($, e) => {
    session.statuses.push(e.text)

    return { value: undefined }
  })

  on('fs.read', ($, e) => {
    if (e.path.endsWith('/skills/tutor/SKILL.md')) return { value: SKILL_FILE }
    if (e.path.endsWith('/prompts/play-by-play.md')) return { value: 'PLAY-BY-PLAY INSTRUCTIONS\n' }
    if (e.path.endsWith('/prompts/deep-review.md')) return { value: 'DEEP REVIEW INSTRUCTIONS\n' }
    if (e.path.endsWith('/prompts/explain.md')) return { value: 'EXPLAIN INSTRUCTIONS\n' }
    if (e.path.endsWith('/prompts/progress.md')) return { value: 'PROGRESS INSTRUCTIONS\n' }
    if (e.path.endsWith('/prompts/speech-bubble.md')) return { value: 'SPEECH BUBBLE INSTRUCTIONS\n' }
    for (const [suffix, text] of Object.entries(options.pluginFiles ?? {})) {
      if (e.path.endsWith(suffix)) return { value: text }
    }
    if (!e.path.startsWith(`${ROOT}/`)) session.diskReads.push(e.path)
    const emptyReads = session.halfWritten.get(e.path) ?? 0
    if (emptyReads > 0) {
      session.halfWritten.set(e.path, emptyReads - 1)

      return { value: '' }
    }
    const text = e.path.startsWith(`${ROOT}/`) ? files[e.path.slice(ROOT.length + 1)] : session.disk.get(e.path)

    return text === undefined ? { deny: `no such file: ${e.path}` } : { value: text }
  })
  on('fs.write', ($, e) => {
    writes += 1
    session.disk.set(e.path, e.text)
    mtimes.set(e.path, writes)

    return { value: undefined }
  })
  on('fs.exists', ($, e) => ({
    value:
      (options.install === 'clone' && cloneTop !== '' && e.path === `${cloneTop}/.claude-plugin/marketplace.json`) ||
      session.disk.has(e.path) ||
      [...session.disk.keys()].some(path => path.startsWith(`${e.path}/`)),
  }))
  on('fs.list', ($, e) => {
    const inside = [...session.disk.keys()].filter(path => path.startsWith(`${e.path}/`))
    if (inside.length === 0) return { deny: `no such folder: ${e.path}` }
    const names = [...new Set(inside.map(path => path.slice(String(e.path).length + 1).split('/')[0] ?? ''))]

    return {
      value: names.map(name => {
        const text = session.disk.get(`${e.path}/${name}`)

        return {
          name,
          kind: text === undefined ? ('dir' as const) : ('file' as const),
          size: text?.length ?? 0,
          mtimeMs: mtimes.get(`${e.path}/${name}`) ?? 0,
          isLink: false,
        }
      }),
    }
  })
  on('fs.stat', ($, e) => {
    if (e.path === `${ROOT}/.git/logs/HEAD`) {
      // The reflog grows by one entry each time HEAD moves.
      return { value: { kind: 'file', size: reflog.length, mtimeMs: reflog.length, isLink: false } }
    }
    const path = e.path.slice(ROOT.length + 1)
    const isInRepository = e.path.startsWith(`${ROOT}/`)
    const text = isInRepository ? files[path] : session.disk.get(e.path)
    if (text === undefined) return { deny: `no such file: ${e.path}` }
    const mtimeMs = mtimes.get(isInRepository ? path : e.path) ?? 0

    return { value: { kind: 'file', size: text.length, mtimeMs, isLink: false } }
  })

  // inotifywait, when the test says it is on PATH. Anything else, and inotifywait without it, cannot be started.
  on('process.spawn', async function* ($, e) {
    session.spawnedProcesses.push([...e.argv])
    if (e.argv[0] !== 'inotifywait' || options.hasInotify !== true) return { deny: `spawn ${String(e.argv[0])} ENOENT` }
    const pieces: { stream: 'stdout' | 'stderr'; text: string }[] = [{ stream: 'stderr', text: 'Setting up watches.\nWatches established.\n' }]
    let isEnded = false
    let wake: () => void = () => {}
    const fake: FakeWatcher = {
      argv: [...e.argv],
      report: (...paths) => {
        pieces.push({ stream: 'stdout', text: paths.map(path => `${path}\n`).join('') })
        wake()
      },
      end: complaint => {
        if (complaint !== undefined) pieces.push({ stream: 'stderr', text: `${complaint}\n` })
        isEnded = true
        wake()
      },
      isStopped: false,
    }
    session.watchers.push(fake)
    try {
      for (;;) {
        const piece = pieces.shift()
        if (piece !== undefined) {
          yield piece
          continue
        }
        if (isEnded) break
        await new Promise<void>(resolve => {
          wake = resolve
        })
      }
    } finally {
      fake.isStopped = true
    }

    return { value: { code: 1, signal: null } }
  })

  on('process.run', ($, e) => {
    const ok = (stdout: string) => ({
      value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
    })
    const failed = { value: { exitCode: 128, stdout: '', stderr: 'fatal', isStdoutTruncated: false, isStderrTruncated: false } }
    const args = e.argv.slice(2)
    if (e.argv[0] === 'rm' && e.argv[1] === '-rf' && e.argv[2] === '--' && e.argv.length === 4) {
      const target = String(e.argv[3])
      session.removed.push(target)
      for (const path of [...session.disk.keys()]) {
        if (path === target || path.startsWith(`${target}/`)) session.disk.delete(path)
      }

      return ok('')
    }
    if (e.argv[0] === 'claude') {
      session.ran.push(e.argv.join(' '))

      return ok('')
    }
    if (e.argv[0] !== 'git' || e.argv[1] !== '--no-optional-locks') return { deny: `unexpected process: ${e.argv.join(' ')}` }
    const cwd = String(e.init?.cwd ?? '')
    // The tutor's lock repository: a ref is a lock, and git changes one only when it holds what the caller expects.
    if (args[0] === 'init' && args[1] === '--bare') {
      session.disk.set(`${String(args[args.length - 1])}/HEAD`, 'ref: refs/heads/main\n')

      return ok('')
    }
    if (String(args[0]).startsWith('--git-dir=')) {
      const repo = String(args[0]).slice('--git-dir='.length)
      if (!session.disk.has(`${repo}/HEAD`)) return failed
      if (args[1] === 'hash-object') {
        const held = String(e.init?.stdin ?? '')
        if (!marks.has(held)) marks.set(held, commitHash(7000 + marks.size))

        return ok(`${marks.get(held) ?? ''}\n`)
      }
      if (args[1] === 'update-ref') {
        const isDelete = args[2] === '-d'
        const [ref, next, expected] = isDelete ? [String(args[3]), '', String(args[4])] : [String(args[2]), String(args[3]), String(args[4])]
        const file = `${repo}/${ref}`
        const current = session.disk.get(file)?.trim()
        const isFree = /^0+$/.test(expected)
        if (isFree ? current !== undefined : current !== expected) {
          session.locking.push(`refused ${ref}`)

          return failed
        }
        if (isDelete) {
          session.disk.delete(file)
          session.locking.push(`give ${ref}`)
        } else {
          session.disk.set(file, `${next}\n`)
          mtimes.set(file, session.clock.now())
          session.locking.push(`${isFree ? 'take' : 'steal'} ${ref}`)
        }

        return ok('')
      }

      return failed
    }
    if (args[0] === 'ls-remote') {
      session.ran.push(`git ${args.join(' ')}`)
      const tags = options.tags

      return tags === undefined ? failed : ok(tags.map((tag, index) => `${commitHash(100 + index)}\trefs/tags/${tag}`).join('\n'))
    }
    // The plugin's own folder, and the clone it may live in.
    if (cwd.endsWith('/plugin') || (cloneTop !== '' && cwd === cloneTop)) {
      if (args[0] === 'rev-parse' && args[1] === '--show-toplevel') {
        if (options.install !== 'clone') return failed
        cloneTop = cwd.replace(/\/plugin$/, '')

        return ok(`${cloneTop}\n`)
      }
      if (args[0] === 'remote') return ok('git@example.com:me/backseat-driver.git\n')
      if (args[0] === 'rev-parse' && args[1] === 'HEAD') return ok(`${cloneHead}\n`)
      if (args[0] === 'status') return ok(options.isCloneDirty === true ? ' M plugin/hooks/register.tsx\n' : '')
      if (args[0] === 'pull') {
        session.ran.push(`git ${args.join(' ')}`)
        if (options.isCloneCurrent !== true) cloneHead = commitHash(501)

        return ok('Updating 1111111..2222222\nFast-forward\n')
      }

      return failed
    }
    if (options.isRepository === false) return failed

    if (args[0] === 'rev-parse') {
      if (args[1] === '--show-toplevel') return ok(`${ROOT}\n`)
      if (args[1] === '--absolute-git-dir') return ok(`${ROOT}/.git\n`)
      if (args[1] === '--abbrev-ref') return ok('main\n')

      return ok(`${tip().hash}\n`)
    }
    if (args[0] === 'reflog') return ok(`${reflog[reflog.length - 1] ?? ''}\n`)
    if (args[0] === 'config') {
      if (args.includes('--global')) return ok('')
      const email = options.email ?? 'me@example.com'

      return email === '' ? failed : ok(`${email}\n`)
    }
    if (args[0] === 'show' && args[1] === '-s') {
      const commit = commits.find(known => known.hash === args[args.length - 1])
      if (commit === undefined) return failed
      const index = commits.indexOf(commit)
      const parents = [commits[index - 1]?.hash ?? '', ...(commit.isMerge ? [commitHash(999)] : [])].filter(hash => hash !== '').join(' ')
      const message = commit.body === '' ? commit.message : `${commit.message}\n\n${commit.body}`

      return ok(`${commit.hash}\0${parents}\0${commit.author.email}\0${commit.author.name}\0${message}\n`)
    }
    if (args[0] === 'show' && args[1] === '--format=') {
      const index = commits.findIndex(known => known.hash === args[args.length - 1])

      return index === -1 ? failed : ok(patchOf(index))
    }
    if (args[0] === 'log' && args[1] === '--no-merges') {
      return ok(
        [...commits]
          .reverse()
          .filter(commit => !commit.isMerge)
          .map(commit => `${commit.hash}\0${commit.author.email}`)
          .join('\n'),
      )
    }
    if (args[0] === 'ls-files' && args.includes('--ignored')) return ok((options.ignored ?? []).map(folder => `${folder}/\n`).join(''))
    if (args[0] === 'ls-files') return ok(Object.keys(head).map(path => `${path}\0`).join(''))
    if (args[0] === 'log') {
      if (args[1] === '-1') return ok(`${tip().hash}\0commit: ${tip().message}\n`)
      const from = String(args[args.length - 1]).replace(/\.\.HEAD$/, '')
      const since = commits.slice(commits.findIndex(commit => commit.hash === from) + 1)

      return ok(since.map(commit => `${commit.hash.slice(0, 7)} ${commit.message}`).join('\n'))
    }
    if (args[0] === 'diff') {
      const from = commits.find(commit => commit.hash === args[args.length - 1])?.tree ?? {}
      const changed = Object.keys(files).filter(path => path in head && files[path] !== from[path])

      return ok(changed.map(path => `diff --git a/${path} b/${path}\n+${files[path] ?? ''}`).join('\n'))
    }
    if (args[0] === 'show' && !String(args[1]).includes(':')) {
      const commit = commits.find(known => known.hash === args[args.length - 1])

      return commit === undefined ? failed : ok(`commit ${commit.hash}\n\n${commit.message}\n\n+patch of ${commit.message}`)
    }
    if (args[0] === 'status') {
      session.scans += 1
      const changed = Object.keys(files).filter(path => files[path] !== head[path])
      const gone = Object.keys(head).filter(path => !(path in files))

      return ok(
        [...changed.map(path => `${path in head ? ' M' : '??'} ${path}`), ...gone.map(path => ` D ${path}`)]
          .map(entry => `${entry}\0`)
          .join(''),
      )
    }
    if (args[0] === 'show') {
      // `HEAD:path`, or `<hash>:path` for a file as a commit left it.
      const [ref = '', ...rest] = String(args[1]).split(':')
      const path = rest.join(':')
      const tree = ref === 'HEAD' ? head : commits.find(known => known.hash === ref)?.tree
      const text = tree?.[path]

      return text === undefined ? failed : ok(text)
    }

    return failed
  })

  on('model.complete', ($, e) => {
    const refused = (failure: string) => {
      const none = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
      if (failure === 'timeout') return { value: { isAnswered: false as const, reason: 'aborted' as const, usage: none } }
      if (failure === 'empty') return { value: { isAnswered: false as const, reason: 'empty-reply' as const, usage: USAGE } }
      const status = failure === 'offline' ? null : failure === 'rate_limit' ? 429 : failure === 'overloaded' ? 529 : failure === 'model_not_found' ? 404 : 500

      return { value: { isAnswered: false as const, reason: 'api-error' as const, status, error: (failure === 'offline' ? 'unknown' : failure) as never, usage: none } }
    }
    const job = e.system?.startsWith('PROGRESS INSTRUCTIONS') === true ? 'progress' : e.system?.startsWith('EXPLAIN INSTRUCTIONS') === true ? 'explain' : 'look'
    const answer = () => {
      const queued = session.failing.findIndex(entry => !entry.includes(':') || entry.startsWith(`${job}:`))
      const failure = queued === -1 ? undefined : session.failing.splice(queued, 1)[0]?.replace(/^[a-z]+:/, '')
      // Claude Code refusing to send at all, as for a blocked model: the call rejects.
      if (failure === 'refused') throw new Error('refused')
      if (job === 'progress') {
        if (failure !== undefined) return refused(failure)
        const text = session.assessmentReplies.shift() ?? '{"observations": [], "level": null}'

        return { value: { isAnswered: true as const, text, usage: USAGE } }
      }
      if (job === 'explain') {
        if (failure !== undefined) return refused(failure)
        const text =
          session.lookupAnswers.find(known => e.prompt.includes(known.when))?.reply ??
          session.lookupReplies.shift() ??
          '{"summary": "", "symbols": []}'

        return { value: { isAnswered: true as const, text, usage: USAGE } }
      }
      if (failure !== undefined) return refused(failure)

      return { value: { isAnswered: true as const, text: session.replies.shift() ?? '{"resolved": [], "notes": []}', usage: USAGE } }
    }
    // Recorded when it is asked, whenever it is answered.
    if (job === 'progress') session.assessments.push(e)
    else if (job === 'explain') session.lookups.push(e)
    else session.requests.push(e)
    if (!session.stalled.includes(job)) return answer()

    return new Promise<ReturnType<typeof answer>>(resolve => {
      session.held.push(() => resolve(answer()))
    })
  })
  on('prompt.submit', ($, e) => {
    session.submitted.push(e.text)
    session.contexts.push(e.context ?? [])

    return { text: e.text }
  })

  on('agent.register', ($, e) => {
    session.agents.push(e)

    return { value: { agent: `backseat-driver:${e.name}` } }
  })
  on('agent.spawn', ($, e) => {
    // The kit hands a plugin's spawn over in the Agent tool's spelling, whatever the types say.
    const input = e as typeof e & { subagent_type?: string }
    session.spawned.push({
      type: input.subagent_type ?? input.subagentType,
      description: input.description,
      prompt: input.prompt,
    })

    return { model: 'claude-test' }
  })
  // Claude Code sets the id of a started subagent itself and drops one a stub
  // returns, so the plugin finds its reviewer here, as it does when another
  // mod answers its spawn.
  on('agent.list', () => ({
    value: session.spawned
      .map((input, index) => ({
        id: session.agentId(index + 1),
        description: input.description,
        type: 'backseat-driver:deep-reviewer',
        status: session.finishedAgents.includes(session.agentId(index + 1)) ? ('completed' as const) : ('running' as const),
      }))
      .filter(agent => !session.lostAgents.includes(agent.id)),
  }))
  on('agent.offer', () => ({ isOffered: true }))
  on('turn.complete', () => ({ text: '' }))
  on('config.list', () => ({ value: session.config }))
  on('config.set', ($, e) => {
    session.configured.push({ key: e.key, value: e.value })
    const deny = session.configDeny
    session.configDeny = ''
    if (deny !== '') return { deny }
    session.config = session.config.map(row => (row.key === e.key ? { ...row, value: e.value } : row))

    return { value: e.value }
  })
  on('ui.toast', ($, e) => {
    session.toasts.push(e.text)

    return { value: undefined }
  })

  on('prompt.compose', () => ({ sections: [...ENGINE_SECTIONS] }))
  on('prompt.context', () => ({
    blocks: [
      { name: 'claudeMd', text: STOCK_CLAUDE_MD },
      { name: 'currentDate', text: "Today's date is 2026-10-04." },
    ],
  }))
  on('session.usage', () => ({
    value: {
      startedAt: session.born,
      context: { tokens: 0, window: 200_000, percent: 0 },
      rateLimits: session.limits,
    } as never,
  }))
  on('store.get', ($, e) => {
    session.storeReads.push(e.key)

    return { value: session.store.get(e.key) }
  })
  on('store.set', ($, e) => {
    // As the real store does: what comes back is what JSON keeps.
    session.store.set(e.key, JSON.parse(JSON.stringify(e.value)))

    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...session.store.keys()] }))
  on('store.delete', ($, e) => {
    session.store.delete(e.key)

    return { value: undefined }
  })
  on('tool.register', ($, e) => {
    session.tools.push(e)

    return { value: { tool: `mcp__backseat-driver__${e.name}` } }
  })

  on('tool.call', ($, e) => {
    // `$.ui.ask` reaches a test as a call to the question tool.
    if (e.tool === 'AskUserQuestion') {
      const question = e.questions[0]?.question ?? ''
      session.asked.push(question)
      const answer = session.answers.shift()

      return answer === undefined ? { deny: 'dismissed' } : { result: { answers: { [question]: answer } } }
    }

    return { result: 'edited' }
  })

  return session
}
