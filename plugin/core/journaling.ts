/**
 * Keeping the journal of a project while the tutor is on: starting it, what a
 * scan feeds it, when its deadline comes, and what the pane is told about
 * what the person is working on. The journal itself is `recorder.ts`. This is
 * the engine; the program it runs in gives it `JournalPorts`, and what it
 * remembers is `JournalState`.
 *
 * Moved out of `hooks/register.tsx` with each call made in the order it was
 * made there.
 */

import type { Working } from '../types'
import { createRecorder } from './recorder'
import type { Recorder } from './recorder'
import type { Trace } from './host'
import type { Store } from './store'
import type { Watcher } from './watcher'

/** What the pane says when no journal is kept. */
export const NO_WORKING: Working = { said: '', saidAgo: '', inferred: '', where: '', share: '' }

/** What the journal's keeping remembers: the journal in use, and the line the pane was last told. */
export type JournalState = {
  recorder: Recorder | null
  /** What the pane was last told they are working on, as JSON. */
  workingShown: string
}

export function freshJournalState(): JournalState {
  return { recorder: null, workingShown: '' }
}

/** What keeping the journal needs from its host. Each is read or done when it is needed. */
export type JournalPorts = {
  now: () => Promise<number>
  trace: Trace
  /** Changes what the pane says they are working on. */
  showWorking: (working: Working) => Promise<void>
  /** False while the tutor is off. */
  isOn: () => boolean
  store: () => Pick<Store, 'read' | 'update'>
  /** The journal's file, or '' when there is no data folder. */
  file: (root: string) => string
  repoRoot: () => string
  /** A file's text by its path from the repository root, or null when it cannot be read. */
  read: (root: string, path: string) => Promise<string | null>
  /** Runs git in the repository. */
  git: (root: string, args: readonly string[]) => Promise<{ exitCode: number; stdout: string }>
  /** Reads the editors again, and says what the one that speaks for this project reports. */
  readEditor: () => Promise<string | null>
  /** The files the watcher has found changed or still dirty. */
  watcher: () => Pick<Watcher, 'dirty'> | null
  engagement: () => number
  /** Sets or takes away the deadline of the journal. */
  deadline: { set: (name: string, at: number, run: () => Promise<unknown> | unknown) => void; cancel: (name: string) => void }
  fail: (what: string, error: unknown) => void
}

/** Tells the pane what they are working on, when that has changed since it was last told. */
export async function showWorking(ports: JournalPorts, state: JournalState, now: number): Promise<void> {
  const working = state.recorder === null ? NO_WORKING : state.recorder.working(now)
  const text = JSON.stringify(working)
  if (text === state.workingShown) return
  state.workingShown = text
  ports.trace('state', 'working', () => working)
  await ports.showWorking(working)
}

/** Writes the journal when it is due, or now when `isForced`. A write that fails is made again with the next one. */
export async function flushJournal(ports: JournalPorts, journal: Recorder, now: number, isForced: boolean): Promise<void> {
  try {
    await journal.flush(now, isForced)
  } catch (error) {
    ports.fail('could not write the journal', error)
  }
}

/**
 * The journal's part of a scan: what was just saved and what it changed, and
 * the time the caret has spent where it is. No model is involved. Writing
 * the journal is not part of it: that has a deadline of its own.
 */
export async function keepJournal(ports: JournalPorts, state: JournalState, active: Pick<Watcher, 'changed' | 'dirty'>, now: number): Promise<void> {
  const journal = state.recorder
  if (journal === null) return
  const saved = active.changed()
  if (saved.length > 0) await journal.saved(saved, now)
  journal.settle(active.dirty())
  await journal.tick(now)
  await showWorking(ports, state, now)
}

/**
 * The journal's deadline came: a write is due, or the time the caret has
 * spent somewhere is worth an entry. The journal says when the next one is.
 */
export async function journalDue(ports: JournalPorts, state: JournalState): Promise<void> {
  const journal = state.recorder
  if (journal === null || !ports.isOn()) return
  const now = await ports.now()
  await journal.tick(now)
  await showWorking(ports, state, now)
  await flushJournal(ports, journal, now, false)
}

/**
 * Starts the journal of this project, once the watcher has read the tree.
 * `isFresh` is false when the tutor was already on and the module reloaded.
 */
export async function startJournal(ports: JournalPorts, state: JournalState, run: number, isFresh: boolean): Promise<void> {
  const root = ports.repoRoot()
  if (root === '') return
  const started = createRecorder({
    store: ports.store(),
    file: ports.file(root),
    root,
    read: path => ports.read(root, path),
    head: async path => {
      const shown = await ports.git(root, ['show', `HEAD:${path}`])

      return shown.exitCode === 0 ? shown.stdout : null
    },
    wakeAt: at => {
      // Only the journal in use keeps the deadline: one that was replaced, or never taken up, has no say.
      if (state.recorder !== null && state.recorder !== started) return
      if (at === null) ports.deadline.cancel('journal')
      else ports.deadline.set('journal', at, () => journalDue(ports, state))
    },
  })
  const branch = (await ports.git(root, ['rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim()
  const now = await ports.now()
  await started.start(now, isFresh ? branch : null, ports.watcher()?.dirty() ?? [])
  // Where the caret was left before the tutor was watching earns no time until the editor writes again.
  started.editor(await ports.readEditor(), now, true)
  // Switched off, or on again, in the meantime: this journal is no longer wanted.
  if (run !== ports.engagement()) return

  state.recorder = started
  await showWorking(ports, state, now)
}

/** Records what they said they are working on, or takes it back with ''. It is saved at once. */
export async function sayWorking(ports: JournalPorts, state: JournalState, said: string): Promise<void> {
  const journal = state.recorder
  if (journal === null) return
  const now = await ports.now()
  journal.say(said, now)
  await showWorking(ports, state, now)
  await flushJournal(ports, journal, now, true)
}
