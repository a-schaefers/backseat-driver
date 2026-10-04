import type { PluginOptions } from 'claude-code'

export type Thinking = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

/** The plugin's `/config` rows as the code uses them: durations in milliseconds, defaults applied. */
export type Settings = {
  persona: string
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

/** Keys are the `userConfig` fields in plugin.json. */
export function readSettings(options: PluginOptions): Settings {
  return {
    persona: text(options.persona, 'none'),
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
  }
}
