import type { SettingRow } from '../types'

/** The plugin's options as a host hands them over: Claude Code's `PluginOptions`, spelled here so this file needs no host's types. */
export type Options = Readonly<Record<string, string | number | boolean | readonly string[]>>

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

/**
 * Where the tutor shows itself. `unified` draws into Claude Code's own
 * places: a few lines above the prompt that open into the tabs on demand,
 * and the status line under the prompt. `horizontal` is the whole view as a
 * framed strip above the prompt, its parts side by side. `vertical` is the
 * whole view as a pane, stacked, which Claude Code docks beside the
 * conversation in its fullscreen layout.
 */
export type Layout = 'unified' | 'horizontal' | 'vertical'

/** In the order `/bsd layout` steps through them. */
export const LAYOUTS: readonly Layout[] = ['unified', 'horizontal', 'vertical']

/** The layout until the person picks another. */
export const DEFAULT_LAYOUT: Layout = 'vertical'

/** A layout as set in /config or typed after `/bsd layout`. Anything else is null. */
export function layoutOf(value: unknown): Layout | null {
  return LAYOUTS.find(layout => layout === (typeof value === 'string' ? value.trim().toLowerCase() : value)) ?? null
}

/** The plugin's `/config` rows as the code uses them: durations in milliseconds, defaults applied. */
export type Settings = {
  persona: Persona
  layout: Layout
  /** Whether the pane shows the voice's animated character, and the reviewers write its lines. */
  isAnimated: boolean
  /** Whether the tutor keeps a record of the person's level in each language, from their own commits. */
  isProgressOn: boolean
  /** Whether the tutor asks the upstream repository for a newer release, at most every six hours. */
  isUpdateCheckOn: boolean
  /** Burn token mode: every model request is also sent to the most capable model at maximum thinking, and the answer dropped. */
  isBurning: boolean
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
export function readSettings(options: Options): Settings {
  return {
    persona: {
      voice: personaName(options.voice),
      engineering: personaName(options.engineering),
    },
    layout: layoutOf(options.layout) ?? DEFAULT_LAYOUT,
    isAnimated: options.animated_persona !== false,
    isProgressOn: options.progress_report !== false,
    isUpdateCheckOn: options.update_check !== false,
    isBurning: options.burn_tokens === true,
    playByPlay: {
      isAutomatic: options.play_by_play !== 'on request',
      // Quick by default (owner, 2026-10-05: "make this app as quick as possible"): a look five seconds after the
      // last save, and no gap between looks. The gap is there for whoever wants to cap the spend.
      quietMs: durationMs(options.quiet_time, 5_000),
      minGapMs: durationMs(options.minimum_gap, 0),
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

/** What a `/config` row is made of, as far as the Settings tab needs it (`ConfigRow` in Claude Code). */
export type ConfigRowLike = {
  key: string
  label: string
  description?: string
  kind: 'boolean' | 'choice' | 'text' | 'number'
  value: boolean | string | number | readonly string[]
  options?: readonly string[]
  provider: { plugin: string }
  isLocked: boolean
}

/**
 * This plugin's rows of `/config`, in its order, as the Settings tab shows
 * them. A toggle becomes a pick between `on` and `off`. Every field of the
 * plugin is a toggle or a choice, so a text or number row, should one appear,
 * is left out rather than shown in a form it cannot be changed in.
 */
export function settingRows(rows: readonly ConfigRowLike[], plugin: string): SettingRow[] {
  return rows.flatMap((row): SettingRow[] => {
    // A copy loaded from a folder is `backseat-driver@inline` in /config, and an installed one `backseat-driver@<marketplace>`.
    if (row.provider.plugin.split('@')[0] !== plugin.split('@')[0]) return []
    const shared = { key: row.key, label: row.label, description: row.description ?? '', isLocked: row.isLocked }
    if (row.kind === 'boolean') return [{ ...shared, kind: 'boolean', value: row.value === true ? 'on' : 'off', options: ['on', 'off'] }]
    if (row.kind !== 'choice' || row.options === undefined || row.options.length === 0) return []
    const value = typeof row.value === 'string' ? row.value : String(row.value)

    return [{ ...shared, kind: 'choice', value, options: [...row.options] }]
  })
}

/** What `$.config.set` is given for a pick in the Settings tab: a toggle's boolean, or the option itself. */
export function configValue(row: Pick<SettingRow, 'kind'>, picked: string): boolean | string {
  return row.kind === 'boolean' ? picked === 'on' : picked
}

/** The rows with one value changed, as the tab shows it until `/config` is read again. */
export function withSetting(rows: readonly SettingRow[], key: string, value: string): SettingRow[] {
  return rows.map(row => (row.key === key ? { ...row, value } : row))
}

/**
 * When a change to each `userConfig` field is felt. A change in /config, or
 * a pick in the Settings tab, makes Claude Code load the mod again with the
 * new values (`register` runs again, then `session.start`), and everything
 * is read afresh from there. `now`: in effect from that reload. `next look`,
 * `next review`, `next lookup`: a model and its thinking are given to each
 * request as it is made, so one already under way finishes as it began.
 *
 * Every field of plugin.json's `userConfig` has an entry. A field without
 * one is reported when the mod loads (`unclassified`), and a test fails.
 */
export const SETTING_EFFECTS = {
  layout: 'now',
  voice: 'now',
  engineering: 'now',
  animated_persona: 'now',
  play_by_play: 'now',
  quiet_time: 'now',
  minimum_gap: 'now',
  play_by_play_model: 'next look',
  play_by_play_thinking: 'next look',
  deep_review_after_commit: 'now',
  deep_review_every: 'now',
  deep_review_model: 'next review',
  deep_review_thinking: 'next review',
  explain: 'now',
  explain_model: 'next lookup',
  explain_thinking: 'next lookup',
  progress_report: 'now',
  update_check: 'now',
  burn_tokens: 'now',
} as const satisfies Record<string, SettingEffect>

export type SettingEffect = 'now' | 'next look' | 'next review' | 'next lookup'

export type SettingField = keyof typeof SETTING_EFFECTS

/** The fields among `options` that `SETTING_EFFECTS` does not cover. Claude Code fills in every declared field, defaults included. */
export function unclassified(options: Options): string[] {
  return Object.keys(options).filter(field => !Object.hasOwn(SETTING_EFFECTS, field))
}

/** The fields whose value differs between two sets of options, in plugin.json's order. */
export function changedFields(before: Options, after: Options): string[] {
  const fields = [...new Set([...Object.keys(SETTING_EFFECTS), ...Object.keys(before), ...Object.keys(after)])]

  return fields.filter(field => JSON.stringify(before[field] ?? null) !== JSON.stringify(after[field] ?? null))
}

/**
 * What a reload with changed settings has to start by hand. Some work runs
 * only when the tutor is switched on (the release check, the first placement
 * of a level, the look around a new project), so a setting that switches it
 * on would otherwise wait for the next `/bsd`.
 */
export function catchUp(before: Settings, after: Settings): { isUpdateCheck: boolean; isPlacement: boolean; isSurvey: boolean } {
  const reviews = (settings: Settings): boolean => settings.deepReview.isAfterCommit || settings.deepReview.everyMs > 0

  return {
    isUpdateCheck: after.isUpdateCheckOn && !before.isUpdateCheckOn,
    isPlacement: after.isProgressOn && !before.isProgressOn,
    isSurvey: reviews(after) && !reviews(before),
  }
}

/** A changed row as the line after a reload names it: its label in /config and the value it now has. */
export type ChangedRow = { field: string; label: string; value: string }

const EFFECT_WORDS: Record<SettingEffect, string> = {
  now: 'in effect now',
  'next look': 'from the next look',
  'next review': 'from the next review',
  'next lookup': 'from the next lookup',
}

/**
 * The line that says the settings just changed are in effect, and from
 * when. Said only while the tutor is on: off, it touches nothing, and the
 * settings are read afresh at the next `/bsd` anyway.
 */
export function changedText(rows: readonly ChangedRow[]): string {
  const parts = rows.map(row => {
    const effect = (SETTING_EFFECTS as Record<string, SettingEffect | undefined>)[row.field] ?? 'now'

    return `${row.label}: ${row.value}, ${EFFECT_WORDS[effect]}`
  })

  return parts.length === 0 ? '' : `${parts.join('. ')}.`
}

/** How long a pick in the Settings tab waits for Claude Code to load the mod again before saying it did not. */
export const RELOAD_WAIT_MS = 5000

/** Said when a pick was saved and no reload followed, so the running tutor still has the old value. */
export function notReloadedText(label: string, value: string): string {
  return `${label}: ${value} is saved, but Claude Code did not load Backseat Driver again, so it is not in effect yet. /reload-plugins applies it.`
}
