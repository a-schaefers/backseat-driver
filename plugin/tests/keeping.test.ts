import { expect, test } from 'claude-code/testing'

import { freshJournalState, journalDue, NO_WORKING, sayWorking, showWorking } from '../core/journaling'
import type { JournalPorts } from '../core/journaling'

/** Keeping the journal is host-neutral: it runs here with nothing but ports. */
function world(overrides: Partial<JournalPorts> = {}) {
  const log: string[] = []
  const ports: JournalPorts = {
    now: async () => 1000,
    trace: () => undefined,
    showWorking: async working => void log.push(`working ${working.said}`),
    isOn: () => true,
    store: () => ({ read: async () => null, update: async () => undefined }) as never,
    file: () => '',
    repoRoot: () => '/work',
    read: async () => null,
    git: async () => ({ exitCode: 0, stdout: '' }),
    readEditor: async () => null,
    watcher: () => null,
    engagement: () => 1,
    deadline: { set: name => void log.push(`set ${name}`), cancel: name => void log.push(`cancel ${name}`) },
    fail: (what, error) => void log.push(`fail: ${what}: ${String(error)}`),
    ...overrides,
  }

  return { ports, log }
}

test('with no journal, the pane is told nothing is being worked on, once', async () => {
  const w = world()
  const state = freshJournalState()
  await showWorking(w.ports, state, 1)
  await showWorking(w.ports, state, 2)

  expect(JSON.parse(state.workingShown)).toEqual(NO_WORKING)
  expect(w.log).toEqual(['working '])
})

test('without a journal, a deadline or a statement does nothing', async () => {
  const w = world()
  const state = freshJournalState()
  await journalDue(w.ports, state)
  await sayWorking(w.ports, state, 'median')

  expect(w.log).toEqual([])
})
