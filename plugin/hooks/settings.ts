import type { PluginOptions } from 'claude-code'

export type Thinking = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

/** What a persona half is called when none is chosen: Claude's own voice, or its own engineering judgment. */
export const DEFAULT_PERSONA = 'default'

/** The persona's two halves, chosen apart. Each is a file name in `personas/voice/` or `personas/engineering/`, or `default`. */
export type Persona = {
  /** How the tutor talks: tone, wording and teaching style. */
  voice: string
  /** Whose engineering judgment it reviews with: what it values, flags and recommends. */
  engineering: string
}

/** The plugin's `/config` rows as the code uses them: durations in milliseconds, defaults applied. */
export type Settings = {
  persona: Persona
  /** Whether the pane shows the voice's animated character, and the reviewers write its lines. */
  isAnimated: boolean
  /** Whether the tutor keeps a record of the person's level in each language, from their own commits. */
  isProgressOn: boolean
  playByPlay: {
    isAutomatic: boolean
    quietMs: number
    minGapMs: number
    model: string
    thinking: Thinking
  }
  deepReview: {
    isAfterCommit: boolean
    /** 0 when the timer is off. */
    everyMs: number
    model: string
    thinking: Thinking
  }
  explain: {
    /** `automatic` looks up what is in focus and what is saved. `on request` waits to be asked. */
    mode: 'automatic' | 'on request' | 'off'
    model: string
    thinking: Thinking
  }
}

const THINKING: readonly Thinking[] = ['low', 'medium', 'high', 'xhigh', 'max']

/** "10 seconds", "2 minutes" or "none" as milliseconds. Anything else is `fallbackMs`. */
export function durationMs(label: unknown, fallbackMs: number): number {
  if (typeof label !== 'string') return fallbackMs
  const trimmed = label.trim()
  if (trimmed === 'none') return 0
  const match = /^(\d+) (second|minute)s?$/.exec(trimmed)
  if (match === null) return fallbackMs
  const count = Number(match[1])

  return match[2] === 'minute' ? count * 60_000 : count * 1000
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value !== '' ? value : fallback
}

function thinking(value: unknown, fallback: Thinking): Thinking {
  return THINKING.find(level => level === value) ?? fallback
}

/** A persona half as set in /config. Anything that could not name a file in `personas/` is the default. */
function personaName(value: unknown): string {
  return typeof value === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value) ? value : DEFAULT_PERSONA
}

/** Keys are the `userConfig` fields in plugin.json. */
export function readSettings(options: PluginOptions): Settings {
  return {
    persona: {
      voice: personaName(options.voice),
      engineering: personaName(options.engineering),
    },
    isAnimated: options.animated_persona !== false,
    isProgressOn: options.progress_report !== false,
    playByPlay: {
      isAutomatic: options.play_by_play !== 'on request',
      quietMs: durationMs(options.quiet_time, 10_000),
      minGapMs: durationMs(options.minimum_gap, 60_000),
      model: text(options.play_by_play_model, 'sonnet'),
      thinking: thinking(options.play_by_play_thinking, 'medium'),
    },
    deepReview: {
      isAfterCommit: options.deep_review_after_commit !== false,
      everyMs: durationMs(options.deep_review_every, 0),
      model: text(options.deep_review_model, 'opus'),
      thinking: thinking(options.deep_review_thinking, 'high'),
    },
    explain: {
      mode: options.explain === 'off' ? 'off' : options.explain === 'on request' ? 'on request' : 'automatic',
      model: text(options.explain_model, 'sonnet'),
      thinking: thinking(options.explain_thinking, 'low'),
    },
  }
}
