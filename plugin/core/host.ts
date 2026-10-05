/**
 * What the tutor's engines ask of the program they run in. Each engine states
 * the part of this it needs, as ports (see `look.ts`); this file holds the
 * pieces more than one of them takes. The Claude Code adapter
 * (`hooks/register.tsx`) builds every port from `$`. Another host builds the
 * same ports from its own calls, and nothing here names either.
 */

import type { Thinking } from './settings'

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
