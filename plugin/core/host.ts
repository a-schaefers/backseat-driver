/**
 * What the tutor's engines ask of the program they run in. Each engine states
 * the part of this it needs, as ports (see `look.ts`); this file holds the
 * pieces more than one of them takes. The Claude Code adapter
 * (`hooks/register.tsx`) builds every port from `$`. Another host builds the
 * same ports from its own calls, and nothing here names either.
 */

import type { Mode } from '../types'
import type { Pressure } from './health'
import type { Thinking } from './settings'
import type { Store } from './store'

/** One request to a model: no tools, no history. What the model's own host calls this is for its adapter to map. */
export type ModelRequest = {
  /** An alias or a full model id, as the person set it. */
  model: string
  effort: Thinking
  system: string
  prompt: string
  maxTokens: number
  timeoutMs: number
}

/** What came back: the reply, or why there is none. `health.ts`'s `outcomeOf` reads the second shape. */
export type ModelReply =
  | { isAnswered: true; text: string }
  | { isAnswered: false; reason: string; status?: number | null; error?: string }

/** One request to the model of a job: asked, and told to everything that waits on the model answering. */
export type AskModel = (job: string, request: ModelRequest) => Promise<ModelReply>

/** Records a step for the debug log. `detail` is only called while the log is on. */
export type Trace = (kind: string, name: string, detail?: () => unknown) => void

/** Sets a named deadline, moves it, or takes it away. */
export type Deadlines = {
  set: (name: string, at: number, run: (now: number) => Promise<unknown> | unknown) => void
  cancel: (name: string) => void
}

/** What git answered. -1 is git not answering at all (missing, timed out). */
export type GitResult = { exitCode: number; stdout: string }

/**
 * Everything the engines ask of the program they run in, in one place. Each
 * engine's ports are the part of this it takes (`Pick<Host, …>`), plus what is
 * its own (the pane's parts, the work of another engine). The Claude Code
 * adapter builds one `Host` from `$` (`hostOf` in `register.tsx`) and every
 * engine's ports from it. Each field is read at the moment an engine needs
 * it, never earlier.
 *
 * Not here, because only one engine takes them: the deep reviewer
 * (`ReviewPorts`'s `startReview` and `agents`), the plan's limits as the
 * review queue reads them, and anything that draws.
 */
export type Host = {
  // The clock.
  now: () => Promise<number>
  /** Runs `run` after `ms`, once. */
  after: (ms: number, run: () => void) => { cancel: () => void }
  deadline: Deadlines

  // What the tutor says about itself.
  trace: Trace
  /** An error the tutor survives: logged, and counted for the pane's row of what keeps failing. */
  fail: (what: string, error: unknown) => void
  /** A short line the person sees for a moment. */
  toast: (text: string) => void

  // The session.
  /** The session's id now. */
  sessionId: () => Promise<string>
  /** The tutor's mode as the session has it now. */
  mode: () => Mode
  /** False while the tutor is off. */
  isOn: () => boolean
  /** True where this session drives the project (or there is no lease to hold). */
  isDriver: () => boolean
  /** Counts the switch-ons, so that work from before a switch-off lets go. */
  engagement: () => number

  // Where things are.
  /** The repository's root, or '' outside one. */
  repoRoot: () => string
  /** The data folder, or '' when there is none. */
  dataRoot: () => string

  // The data folder and the files.
  store: () => Pick<Store, 'read' | 'update'>
  /** Makes the data folder's marker, so that anything may be written to it. */
  markHome: () => Promise<void>
  /** A folder's entries. Rejects when the folder is missing. `path` is absolute. */
  list: (path: string) => Promise<{ name: string; kind: string; size: number; mtimeMs: number }[]>
  /** A file's text. Rejects when it cannot be read. `path` is absolute. */
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, text: string) => Promise<void>

  /** Runs git in `root`, or wherever the host is when it is undefined. */
  git: (root: string | undefined, args: readonly string[]) => Promise<GitResult>

  // The model.
  /** The model of a job. */
  ask: AskModel
  /** Reads how close the plan's usage limit is. */
  readPressure: () => Promise<Pressure>
}
