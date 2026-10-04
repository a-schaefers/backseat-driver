/**
 * Shared inputs and stubs for the tests. In a test nothing is real: each
 * stub here answers in Claude Code's place.
 */
import type { AgentSpec, ModelCompleteRequest, On, ToolSpec } from 'claude-code'
import { mock, test } from 'claude-code/testing'
import type { TestBody, TestOptions, TestRest } from 'claude-code/testing'

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
}

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
  const commits = [{ hash: commitHash(1), message: 'Start', tree: { ...head } }]
  /** Every move of HEAD, as the reflog records it. */
  const reflog = [`${commitHash(1)}\0commit (initial): Start`]
  const tip = () => commits[commits.length - 1] ?? { hash: '', message: '', tree: {} }

  const session = {
    opened: [] as string[],
    closed: [] as string[],
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
    toasts: [] as string[],
    /** The plugin's store, which outlives the session. */
    store: new Map<string, unknown>(Object.entries(options.store ?? {})),
    /** Every file outside the repository, by absolute path: the tutor's data folder. */
    disk: new Map<string, string>(
      Object.entries(options.data ?? {}).map(([path, value]) => [`${DATA_HOME}/${path}`, JSON.stringify(value)]),
    ),
    /** What the plugin deleted with `rm`, in order. */
    removed: [] as string[],
    /** A JSON file in the tutor's data folder, by path from it, or undefined when it is not there. */
    data(path: string): unknown {
      const text = session.disk.get(`${DATA_HOME}/${path}`)

      return text === undefined ? undefined : (JSON.parse(text) as unknown)
    },
    /** The plan's usage windows as Claude Code reports them. Empty means no reading. */
    limits: [] as { kind: string; percentUsed: number }[],
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
    /** Commits the working tree, as `git commit -am` would, and returns the new commit's hash. */
    commit(message = 'Commit') {
      for (const path of Object.keys(head)) delete head[path]
      Object.assign(head, files)
      const hash = commitHash(commits.length + 1)
      commits.push({ hash, message, tree: { ...head } })
      reflog.push(`${hash}\0commit: ${message}`)

      return hash
    },
    /** Moves HEAD without a commit, as a checkout or a pull would. */
    checkout() {
      const hash = commitHash(commits.length + 1)
      commits.push({ hash, message: 'Elsewhere', tree: { ...head } })
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
    /** Moves the cursor in an editor that reports to the tutor: it writes the focus file. */
    editor(file: string, line: number, endLine?: number) {
      writes += 1
      session.disk.set(`${DATA_HOME}/focus.json`, JSON.stringify({ file, line, ...(endLine === undefined ? {} : { endLine }) }))
      mtimes.set(`${DATA_HOME}/focus.json`, writes)
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
  }

  on('session.start', () => ({ cwd: ROOT }))
  on('classic.SessionStart', () => ({}))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('env.get', ($, e) => ({ value: e.name === 'HOME' ? HOME : options.env?.[e.name] }))
  on('ui.log', ($, e) => {
    session.logs.push(e.text)

    return { value: undefined }
  })
  // The kit answers a redraw itself, but not the invalidation of a cached prompt event.
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.open', ($, e) => {
    session.opened.push(e.id)

    return { value: { isPlaced: true } }
  })
  on('ui.close', ($, e) => {
    session.closed.push(e.id)

    return { value: undefined }
  })

  on('fs.read', ($, e) => {
    if (e.path.endsWith('/skills/tutor/SKILL.md')) return { value: SKILL_FILE }
    if (e.path.endsWith('/prompts/play-by-play.md')) return { value: 'PLAY-BY-PLAY INSTRUCTIONS\n' }
    if (e.path.endsWith('/prompts/deep-review.md')) return { value: 'DEEP REVIEW INSTRUCTIONS\n' }
    if (e.path.endsWith('/prompts/explain.md')) return { value: 'EXPLAIN INSTRUCTIONS\n' }
    for (const [suffix, text] of Object.entries(options.pluginFiles ?? {})) {
      if (e.path.endsWith(suffix)) return { value: text }
    }
    if (!e.path.startsWith(`${ROOT}/`)) session.diskReads.push(e.path)
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
    value: session.disk.has(e.path) || [...session.disk.keys()].some(path => path.startsWith(`${e.path}/`)),
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
    if (e.argv[0] !== 'git' || e.argv[1] !== '--no-optional-locks') return { deny: `unexpected process: ${e.argv.join(' ')}` }
    if (options.isRepository === false) return failed

    if (args[0] === 'rev-parse') {
      if (args[1] === '--show-toplevel') return ok(`${ROOT}\n`)
      if (args[1] === '--absolute-git-dir') return ok(`${ROOT}/.git\n`)

      return ok(`${tip().hash}\n`)
    }
    if (args[0] === 'reflog') return ok(`${reflog[reflog.length - 1] ?? ''}\n`)
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
    if (args[0] === 'show' && !String(args[1]).startsWith('HEAD:')) {
      const commit = commits.find(known => known.hash === args[args.length - 1])

      return commit === undefined ? failed : ok(`commit ${commit.hash}\n\n${commit.message}\n\n+patch of ${commit.message}`)
    }
    if (args[0] === 'status') {
      const changed = Object.keys(files).filter(path => files[path] !== head[path])
      const gone = Object.keys(head).filter(path => !(path in files))

      return ok(
        [...changed.map(path => `${path in head ? ' M' : '??'} ${path}`), ...gone.map(path => ` D ${path}`)]
          .map(entry => `${entry}\0`)
          .join(''),
      )
    }
    if (args[0] === 'show') {
      const path = String(args[1]).replace(/^HEAD:/, '')
      const text = head[path]

      return text === undefined ? failed : ok(text)
    }

    return failed
  })

  on('model.complete', ($, e) => {
    if (e.system?.startsWith('EXPLAIN INSTRUCTIONS') === true) {
      session.lookups.push(e)
      const text =
        session.lookupAnswers.find(answer => e.prompt.includes(answer.when))?.reply ??
        session.lookupReplies.shift() ??
        '{"summary": "", "symbols": []}'

      return { value: { isAnswered: true, text, usage: USAGE } }
    }
    session.requests.push(e)

    return { value: { isAnswered: true, text: session.replies.shift() ?? '{"resolved": [], "notes": []}', usage: USAGE } }
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
    value: session.spawned.map((input, index) => ({
      id: session.agentId(index + 1),
      description: input.description,
      type: 'backseat-driver:deep-reviewer',
      status: session.finishedAgents.includes(session.agentId(index + 1)) ? ('completed' as const) : ('running' as const),
    })),
  }))
  on('agent.offer', () => ({ isOffered: true }))
  on('turn.complete', () => ({ text: '' }))
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
      startedAt: 0,
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
