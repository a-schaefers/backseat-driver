/**
 * Following the spot in focus: reading what the editors say, keeping the
 * Explain view and its file up to date with the spot and with the file on
 * disk, checking the spot ten times a second while someone watches it, and
 * answering a lookup. The lookup engine itself is `explainer.ts`. This is
 * the engine around it; the program it runs in gives it `FollowPorts`, and
 * what it remembers is `FollowState`.
 *
 * Moved out of `hooks/register.tsx` with each call made in the order it was
 * made there.
 */

import type { ExplainView, Spot } from '../types'
import { connectedHere, editorsLine, isConnected, parseEditorFile, speaker } from './editors'
import type { EditorSeen } from './editors'
import { NO_VIEW } from './explainer'
import type { Explainer, Intent } from './explainer'
import { describeSpot, parseFocusFile, viewFile, viewText } from './focus'
import type { Focus } from './focus'
import type { WatchRole } from './filewatch'
import type { Host } from './host'
import { editorsPath } from './datahome'
import { FOCUS_SCAN_MS, focusGapMs } from './sensor'

/** A save does not move the focus away from an editor that moved it within this long. */
export const EDITOR_LIVE_MS = 600_000
/** The lookup tool waits this long for what it was asked about. A hook has ten seconds of its own. */
export const LOOKUP_WAIT_MS = 6000

/** What following the focus remembers. */
export type FollowState = {
  /** The lookup engine of this repository, or null while Explain is off or not started. */
  explainer: Explainer | null
  focus: Focus | null
  /** When an editor last moved the focus, in clock milliseconds. */
  editorFocusAt: number
  /** True while the spot in focus is being checked ten times a second (`fastPoll`). */
  isWatchingClosely: boolean
  /** Each editor's file as last read (`editors.ts`), by name: its size and modification time, and what it said. */
  editorFiles: Map<string, { stamp: string; seen: EditorSeen | null }>
  /** What the editor that speaks for this project says, without what changes on every write; null when no editor does. */
  focusText: string | null
  /** Whether any editor is open, in this project or another. */
  isAnyEditor: boolean
  /** Counts refreshes of the Explain view, so that a slower, older one does not overwrite a newer one. */
  viewRun: number
  /** The focused file's stamp when the view was last made. A different stamp now means the view may describe code that is gone. */
  viewedStamp: string
  /** The view as last written to `view.json`. */
  writtenView: string
}

export function freshFollowState(): FollowState {
  return {
    explainer: null,
    focus: null,
    editorFocusAt: 0,
    isWatchingClosely: false,
    editorFiles: new Map(),
    focusText: null,
    isAnyEditor: false,
    viewRun: 0,
    viewedStamp: '',
    writtenView: '',
  }
}

/** What following the focus needs from its host. Each is read or done when it is needed. */
export type FollowPorts = Pick<
  Host,
  | 'now'
  | 'trace'
  | 'fail'
  | 'repoRoot'
  | 'dataRoot'
  | 'isOn'
  | 'isDriver'
  | 'engagement'
  | 'list'
  | 'readFile'
  | 'writeFile'
  | 'deadline'
  | 'after'
  | 'markHome'
> & {
  /** A file's size and modification time as text, '' when it cannot be read. `path` is absolute. */
  stamp: (path: string) => Promise<string>
  /** Counts a stat for the debug log's summary. */
  countStat: () => void
  /** Reads, or changes, what the Explain tab shows. */
  readView: () => Promise<ExplainView>
  setView: (change: (view: ExplainView) => ExplainView) => Promise<void>
  /** What the pane says about the editors connected here. */
  showEditors: (line: string) => Promise<void>
  /** Whether the Explain tab is the one chosen and can be seen. */
  isExplainShown: () => Promise<boolean>
  /** Hands what an editor says to the journal; a scan counts as something having happened. */
  feedJournal: (text: string | null, now: number) => void
  markActive: (now: number) => void
  /** Whether a watcher pushes the changes of this role. */
  isPushed: (role: WatchRole) => boolean
}

/** What starting the lookup engine needs besides that. */
export type StartPorts = FollowPorts & {
  /** Builds the lookup engine; `onChange` and `wakeAt` are what it tells this engine. */
  createExplainer: (hooks: { root: string; onChange: () => void; wakeAt: (at: number | null) => void }) => Explainer
  /** True when the Explain setting is off. */
  isExplainOff: () => boolean
}

/**
 * Shows what is known about the spot in focus, and writes it where an editor
 * can read it. `isAsked` is true when the person named the spot just now,
 * which fetches what is missing at once. Every other refresh is the tutor
 * keeping up: with a save, or with whatever else moved the focus there.
 */
export async function refreshView(ports: FollowPorts, state: FollowState, isAsked = false): Promise<void> {
  const engine = state.explainer
  const spot = state.focus
  if (engine === null || spot === null) return
  state.viewRun += 1
  const run = state.viewRun
  try {
    const intent: Intent = isAsked ? 'asked' : spot.source === 'save' ? 'following' : 'browsing'
    const stamp = await ports.stamp(`${ports.repoRoot()}/${spot.path}`)
    const view = await engine.view(spot, intent)
    // A newer refresh started while this one was reading the file: its answer is the one to show.
    if (run !== state.viewRun || engine !== state.explainer) return
    state.viewedStamp = stamp
    await ports.setView(() => view)
    const text = JSON.stringify(view)
    // One file serves every session and every project. It is written by the session that drives this project,
    // and only while an editor's caret is in this project, or no editor is open at all.
    const isOurs = ports.isDriver() && (state.focusText !== null || !state.isAnyEditor)
    if (text !== state.writtenView && ports.dataRoot() !== '' && isOurs) {
      state.writtenView = text
      await ports.writeFile(`${ports.dataRoot()}/view.json`, viewFile(view, ports.repoRoot(), spot.source, await ports.now()))
    }
  } catch (error) {
    ports.fail('showing what Explain knows', error)
  }
}

export async function setFocus(ports: FollowPorts, state: FollowState, next: Focus, isAsked: boolean): Promise<void> {
  state.focus = next
  await refreshView(ports, state, isAsked)
}

/**
 * Reads the editors' files (`editors.ts`): one listing of their folder, and a
 * read of each file that changed since. Shows which editors are connected to
 * this project, and resolves true when what the editor that speaks for it
 * says has changed. One read serves the journal and Explain both. A source
 * that pushes editor events would call this.
 */
export async function readFocus(ports: FollowPorts, state: FollowState): Promise<boolean> {
  if (ports.dataRoot() === '') return false
  const folder = editorsPath(ports.dataRoot())
  ports.countStat()
  let listed: { name: string; kind: string; size: number; mtimeMs: number }[] = []
  try {
    listed = await ports.list(folder)
  } catch {
    // No editor has written yet.
  }
  const names = new Set<string>()
  for (const entry of listed) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue
    names.add(entry.name)
    const stamp = `${entry.size}:${entry.mtimeMs}`
    if (state.editorFiles.get(entry.name)?.stamp === stamp) continue
    let seen: EditorSeen | null = null
    try {
      seen = parseEditorFile(await ports.readFile(`${folder}/${entry.name}`))
    } catch {
      // Gone between the listing and the read.
    }
    // A file caught half-written does not parse: what it said before stands, and it is read again next time.
    if (seen === null && entry.size > 0) continue
    state.editorFiles.set(entry.name, { stamp, seen })
  }
  for (const name of [...state.editorFiles.keys()]) if (!names.has(name)) state.editorFiles.delete(name)

  const now = await ports.now()
  const editors = [...state.editorFiles.values()].flatMap(file => (file.seen === null ? [] : [file.seen]))
  state.isAnyEditor = editors.some(seen => isConnected(seen, now))
  await ports.showEditors(editorsLine(connectedHere(editors, ports.repoRoot(), now)))
  const text = speaker(editors, ports.repoRoot(), now)?.text ?? null
  if (text === state.focusText) return false
  state.focusText = text

  return true
}

/** Explain follows the spot the editor's focus file names, when it names one in this repository. */
export async function followEditor(ports: FollowPorts, state: FollowState, now: number): Promise<void> {
  if (state.explainer === null || state.focusText === null) return
  // A file caught half-written does not parse. The editor's next write is read whole.
  const spot = parseFocusFile(state.focusText, ports.repoRoot())
  if (spot === null) return
  state.editorFocusAt = now
  // An editor is reporting its cursor: from now on its file is checked ten times a second.
  watchClosely(ports, state)
  await setFocus(ports, state, { ...spot, source: 'editor' }, false)
}

/** Hands what an editor says, when it has said something new, to the journal and to Explain. */
export async function pollFocus(ports: FollowPorts, state: FollowState): Promise<void> {
  if (!ports.isOn() || ports.repoRoot() === '' || !(await readFocus(ports, state))) return
  const now = await ports.now()
  ports.markActive(now)
  ports.feedJournal(state.focusText, now)
  await followEditor(ports, state, now)
}

/** Whether anyone can see the Explain view: the tab is open, or an editor is showing it. */
export async function isWatched(ports: FollowPorts, state: FollowState): Promise<boolean> {
  if (await ports.isExplainShown()) return true

  return state.focus?.source === 'editor' && (await ports.now()) - state.editorFocusAt < EDITOR_LIVE_MS
}

/**
 * While the Explain view is being watched, the file in focus is checked for
 * changes far more often than the working tree is scanned, so that an edit
 * takes the old explanation off the screen in a tenth of a second and an
 * editor's caret is followed as it moves. Each check plans the next, until
 * nobody is watching.
 */
export async function fastPoll(ports: FollowPorts, state: FollowState): Promise<void> {
  if (!state.isWatchingClosely) return
  let isStillWatched = false
  const started = await ports.now()
  try {
    if (state.explainer !== null) {
      await pollFocus(ports, state)
      const spot = state.focus
      if (spot !== null && (await ports.stamp(`${ports.repoRoot()}/${spot.path}`)) !== state.viewedStamp) await refreshView(ports, state)
      isStillWatched = state.explainer !== null && (await isWatched(ports, state))
    }
  } catch (error) {
    ports.fail('checking the spot in focus', error)
    isStillWatched = state.explainer !== null
  }
  // Switched off, or on again, while this check ran: whoever did that decides what runs now.
  if (!state.isWatchingClosely) return
  if (!isStillWatched) {
    ports.trace('timer', 'nobody is watching the focus')
    state.isWatchingClosely = false

    return
  }
  const now = await ports.now()
  ports.deadline.set('focus', now + focusGapMs({ tookMs: now - started, isPushed: ports.isPushed('focus') }), () => fastPoll(ports, state))
}

export function watchClosely(ports: FollowPorts, state: FollowState): void {
  if (state.explainer === null || state.isWatchingClosely) return
  state.isWatchingClosely = true
  ports.trace('timer', 'watching the focus closely', () => ({ everyMs: FOCUS_SCAN_MS, focus: state.focus }))
  // The first check is due at once: the scheduler runs a deadline whose time has passed straight away.
  ports.deadline.set('focus', 0, () => fastPoll(ports, state))
}

/** Saved files are mapped again, and the focus follows the save unless an editor is reporting its cursor. */
export async function followSaves(ports: FollowPorts, state: FollowState, saved: readonly string[], now: number): Promise<void> {
  const engine = state.explainer
  if (engine === null || saved.length === 0) return
  for (const path of saved) await engine.touch(path)
  const first = saved[0]
  const isEditorLive = state.focus?.source === 'editor' && now - state.editorFocusAt < EDITOR_LIVE_MS
  if (first === undefined || isEditorLive) {
    await refreshView(ports, state)

    return
  }
  await setFocus(ports, state, { path: first, line: await engine.where(first), source: 'save' }, false)
}

/** Starts the lookup engine for this repository. `run` is the switch-on this belongs to. */
export async function startExplaining(ports: StartPorts, state: FollowState, run: number): Promise<void> {
  if (ports.repoRoot() === '' || ports.dataRoot() === '') return
  if (ports.isExplainOff()) {
    await ports.setView((): ExplainView => ({ ...NO_VIEW, status: 'off' }))

    return
  }
  const root = ports.repoRoot()
  await ports.markHome()
  if (run !== ports.engagement()) return

  state.explainer = ports.createExplainer({
    root,
    onChange: () => {
      void refreshView(ports, state)
    },
    wakeAt: at => {
      if (at === null) ports.deadline.cancel('explain')
      else ports.deadline.set('explain', at, () => state.explainer?.wake())
    },
  })
  // After a reload, the pane still holds the spot it was showing. The view is made again from the file as it is now.
  const shown = (await ports.readView()).spot
  if (shown !== null) state.focus = { ...shown, source: 'pane' }
  else await ports.setView(() => NO_VIEW)
  await refreshView(ports, state)
  // The journal may have read the focus file already. What it said is followed either way.
  await readFocus(ports, state)
  await followEditor(ports, state, await ports.now())
  if (await isWatched(ports, state)) watchClosely(ports, state)
}

/** Moves the Explain tab's focus through the file's symbols. */
export async function moveFocus(ports: FollowPorts, state: FollowState, step: 1 | -1): Promise<void> {
  const view = await ports.readView()
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
  if (row !== undefined) await setFocus(ports, state, { path: view.spot.path, line: row.startLine, source: 'pane' }, true)
}

/** Resolves when `wanted` does, or after `ms`, whichever comes first. */
function soonest(ports: FollowPorts, wanted: Promise<void>, ms: number): Promise<void> {
  return new Promise(resolve => {
    const timer = ports.after(ms, () => resolve())
    void wanted.then(() => {
      timer.cancel()
      resolve()
    })
  })
}

/** What the lookup tool and `/bsd explain` share: move the focus to a spot and say what is known about it. */
export async function lookUp(ports: FollowPorts, state: FollowState, spot: Spot): Promise<string> {
  const engine = state.explainer
  if (engine === null) return ''
  await setFocus(ports, state, { ...spot, source: 'command' }, true)
  let view = await engine.view(spot, 'asked')
  // A lookup takes the model a few seconds, and a hook has ten of its own. This waits for the lookup to
  // land and answers the moment it does, or with what there is when the wait is over.
  const until = (await ports.now()) + LOOKUP_WAIT_MS
  while (view.status === 'updating' && engine.pending() > 0) {
    const left = until - (await ports.now())
    if (left <= 0) break
    await soonest(ports, engine.changed(), left)
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
