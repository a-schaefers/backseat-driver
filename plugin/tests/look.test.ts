import { expect, test } from 'claude-code/testing'

import type { Note } from '../types'
import type { ModelReply } from '../core/host'
import { freshLookState, runLook } from '../core/look'
import type { LookPorts } from '../core/look'
import { readSettings } from '../core/settings'
import type { Watcher } from '../core/watcher'

/** The look is host-neutral: it runs here with nothing but ports, no session and no Claude Code. */
function world(reply: ModelReply) {
  const log: string[] = []
  const settled: unknown[][] = []
  let open: Note[] = []
  const change = { path: 'a.py', before: 'x = 1\n', after: 'x = 2\n', hunks: [] }
  const watcher = {
    collect: async () => [change],
    settle: (shown: unknown[]) => void settled.push(shown),
  } as unknown as Watcher
  const asked: string[] = []
  const ports: LookPorts = {
    settings: readSettings({}),
    watcher: () => watcher,
    now: async () => 1000,
    lastChangeAt: () => null,
    ask: async job => {
      asked.push(job)
      log.push('ask')

      return reply
    },
    trace: (kind, name) => void log.push(`${kind}/${name}`),
    toast: text => void log.push(`toast: ${text}`),
    showPlay: async () => void log.push('showPlay'),
    holdDeadline: () => void log.push('hold'),
    planNext: async () => void log.push('planNext'),
    bringIntoPlay: async () => undefined,
    currentInsights: async () => new Set(),
    brief: () => '',
    glance: async () => '',
    system: () => 'system',
    profiles: () => ({ languages: [], subjects: {} }),
    notes: {
      open: async () => open,
      dismissed: async () => [],
      change: async apply => void (open = apply(open)),
    },
    notePrints: new Map(),
    saveNotes: async () => void log.push('saveNotes'),
    saveSubject: async () => undefined,
    recorder: () => null,
    showWorking: async () => undefined,
    say: async () => undefined,
    fail: (what, error) => void log.push(`fail: ${what}: ${String(error)}`),
  }

  return { ports, log, settled, asked, notes: () => open }
}

test('a look that gets a reply makes notes, settles what it showed and plans the next look', async () => {
  const w = world({
    isAnswered: true,
    text: '{"resolved": [], "notes": [{"file": "a.py", "line": 1, "kind": "bug", "topic": "off-by-one", "note": "Look here."}], "say": ""}',
  })
  const state = freshLookState()
  await runLook(w.ports, state, false)

  expect(w.asked).toEqual(['play-by-play'])
  expect(w.notes().map(note => note.id)).toEqual([1])
  expect(state.nextNoteId).toBe(2)
  expect(state.failures).toBe(0)
  expect(state.lastLookAt).toBe(1000)
  expect(w.settled).toHaveLength(1)
  expect(state.isLooking).toBe(false)
  expect(w.log.at(-1)).toBe('planNext')
})

test('a look that fails settles nothing, counts the failure and says why', async () => {
  const w = world({ isAnswered: false, reason: 'api-error', status: 529, error: 'overloaded_error' })
  const state = freshLookState()
  await runLook(w.ports, state, false)

  expect(w.settled).toHaveLength(0)
  expect(state.failures).toBe(1)
  expect(state.lookFailure).not.toBe('')
  expect(state.lastLookAt).toBe(1000)
  expect(w.log.at(-1)).toBe('planNext')
})

test('a look is not started while another is under way, and with no watcher there is nothing to do', async () => {
  const w = world({ isAnswered: true, text: '{}' })
  const state = freshLookState()
  state.isLooking = true
  await runLook(w.ports, state, true)
  expect(w.log).toEqual([])
  expect(state.isLooking).toBe(true)

  const none = world({ isAnswered: true, text: '{}' })
  await runLook({ ...none.ports, watcher: () => null }, freshLookState(), true)
  expect(none.log).toEqual([])
})
