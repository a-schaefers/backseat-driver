/**
 * Shared inputs and stubs for the tests. In a test nothing is real: each
 * stub here answers in Claude Code's place.
 */
import type { On } from 'claude-code'

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

/** Everything the plugin calls when it starts and when the tutor is switched on or off. */
export function stubSession(on: On, files: Record<string, string> = {}): { opened: string[]; closed: string[] } {
  const calls = { opened: [] as string[], closed: [] as string[] }

  on('session.start', () => ({ cwd: '/work' }))
  on('classic.SessionStart', () => ({}))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('env.get', ($, e) => ({ value: e.name === 'HOME' ? HOME : undefined }))
  on('ui.log', () => ({ value: undefined }))
  // The kit answers a redraw itself, but not the invalidation of a cached prompt event.
  on('ui.invalidate', () => ({ value: undefined }))
  on('fs.read', ($, e) => {
    if (e.path.endsWith('/skills/tutor/SKILL.md')) return { value: SKILL_FILE }
    for (const [suffix, text] of Object.entries(files)) {
      if (e.path.endsWith(suffix)) return { value: text }
    }

    return { deny: `no such file: ${e.path}` }
  })
  on('ui.open', ($, e) => {
    calls.opened.push(e.id)

    return { value: { isPlaced: true } }
  })
  on('ui.close', ($, e) => {
    calls.closed.push(e.id)

    return { value: undefined }
  })
  on('prompt.compose', () => ({ sections: [...ENGINE_SECTIONS] }))
  on('prompt.context', () => ({
    blocks: [
      { name: 'claudeMd', text: STOCK_CLAUDE_MD },
      { name: 'currentDate', text: "Today's date is 2026-10-04." },
    ],
  }))
  on('tool.call', () => ({ result: 'edited' }))

  return calls
}
