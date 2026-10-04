/**
 * Shared inputs and stubs for the tests. In a test nothing is real: each
 * stub here answers in Claude Code's place.
 */
import type { ModelCompleteRequest, On } from 'claude-code'
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

export type StubOptions = {
  /** Extra files of the plugin itself, by path suffix: persona style sheets. */
  pluginFiles?: Record<string, string>
  /** What is committed in the fake repository, by path from its root. */
  head?: Record<string, string>
  /** False for a folder that is not a git repository. */
  isRepository?: boolean
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
    /** Commits the working tree. */
    commit() {
      for (const path of Object.keys(head)) delete head[path]
      Object.assign(head, files)
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
  on('ui.log', () => ({ value: undefined }))
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
    for (const [suffix, text] of Object.entries(options.pluginFiles ?? {})) {
      if (e.path.endsWith(suffix)) return { value: text }
    }
    const text = e.path.startsWith(`${ROOT}/`) ? files[e.path.slice(ROOT.length + 1)] : undefined

    return text === undefined ? { deny: `no such file: ${e.path}` } : { value: text }
  })
  on('fs.stat', ($, e) => {
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

    if (args[0] === 'rev-parse') return ok(`${ROOT}\n`)
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

  on('prompt.compose', () => ({ sections: [...ENGINE_SECTIONS] }))
  on('prompt.context', () => ({
    blocks: [
      { name: 'claudeMd', text: STOCK_CLAUDE_MD },
      { name: 'currentDate', text: "Today's date is 2026-10-04." },
    ],
  }))
  on('tool.call', () => ({ result: 'edited' }))

  return session
}
