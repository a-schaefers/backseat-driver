/**
 * Shared inputs and stubs for the tests. In a test nothing is real: each
 * stub here answers in Claude Code's place.
 */
import type { AgentSpec, ModelCompleteRequest, On, ToolSpec } from 'claude-code'
import { mock } from 'claude-code/testing'

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
  /** Extra files of the plugin itself, by path suffix: persona style sheets. */
  pluginFiles?: Record<string, string>
  /** What is committed in the fake repository, by path from its root. */
  head?: Record<string, string>
  /** False for a folder that is not a git repository. */
  isRepository?: boolean
  /** What the plugin's store holds before the session, by key. */
  store?: Record<string, unknown>
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
    /** Every key the plugin read from its store, in order. */
    storeReads: [] as string[],
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
  }

  on('session.start', () => ({ cwd: ROOT }))
  on('classic.SessionStart', () => ({}))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('env.get', ($, e) => ({ value: e.name === 'HOME' ? HOME : undefined }))
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
    for (const [suffix, text] of Object.entries(options.pluginFiles ?? {})) {
      if (e.path.endsWith(suffix)) return { value: text }
    }
    const text = e.path.startsWith(`${ROOT}/`) ? files[e.path.slice(ROOT.length + 1)] : undefined

    return text === undefined ? { deny: `no such file: ${e.path}` } : { value: text }
  })
  on('fs.stat', ($, e) => {
    if (e.path === `${ROOT}/.git/logs/HEAD`) {
      // The reflog grows by one entry each time HEAD moves.
      return { value: { kind: 'file', size: reflog.length, mtimeMs: reflog.length, isLink: false } }
    }
    const path = e.path.slice(ROOT.length + 1)
    const text = e.path.startsWith(`${ROOT}/`) ? files[path] : undefined
    if (text === undefined) return { deny: `no such file: ${e.path}` }

    return { value: { kind: 'file', size: text.length, mtimeMs: mtimes.get(path) ?? 0, isLink: false } }
  })

  on('process.run', ($, e) => {
    const ok = (stdout: string) => ({
      value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
    })
    const failed = { value: { exitCode: 128, stdout: '', stderr: 'fatal', isStdoutTruncated: false, isStderrTruncated: false } }
    const args = e.argv.slice(2)
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
  on('store.get', ($, e) => {
    session.storeReads.push(e.key)

    return { value: session.store.get(e.key) }
  })
  on('store.set', ($, e) => {
    // As the real store does: what comes back is what JSON keeps.
    session.store.set(e.key, JSON.parse(JSON.stringify(e.value)))

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
