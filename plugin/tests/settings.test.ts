import { expect, test } from 'claude-code/testing'

import { durationMs, readSettings } from '../hooks/settings'

test('durationMs reads the labels the /config pickers offer', async () => {
  expect(durationMs('5 seconds', -1)).toBe(5000)
  expect(durationMs('1 minute', -1)).toBe(60_000)
  expect(durationMs('180 minutes', -1)).toBe(10_800_000)
  expect(durationMs('none', -1)).toBe(0)
})

test('durationMs falls back on anything it does not recognise', async () => {
  expect(durationMs('soon', 42)).toBe(42)
  expect(durationMs(undefined, 42)).toBe(42)
  expect(durationMs(10, 42)).toBe(42)
})

test('readSettings applies the documented defaults to empty options', async () => {
  expect(readSettings({})).toEqual({
    persona: { voice: 'default', engineering: 'default' },
    isAnimated: true,
    playByPlay: {
      isAutomatic: true,
      quietMs: 10_000,
      minGapMs: 60_000,
      model: 'sonnet',
      thinking: 'medium',
    },
    deepReview: {
      isAfterCommit: true,
      everyMs: 0,
      model: 'opus',
      thinking: 'high',
    },
    explain: { mode: 'automatic', model: 'sonnet', thinking: 'low' },
  })
})

test('readSettings takes what the user chose', async () => {
  const settings = readSettings({
    voice: 'eli5-tldr-kiss-terse',
    engineering: 'knuth',
    animated_persona: false,
    play_by_play: 'on request',
    quiet_time: '30 seconds',
    minimum_gap: 'none',
    play_by_play_model: 'haiku',
    play_by_play_thinking: 'low',
    deep_review_after_commit: false,
    deep_review_every: '45 minutes',
    deep_review_model: 'fable',
    deep_review_thinking: 'max',
  })

  expect(settings.persona).toEqual({ voice: 'eli5-tldr-kiss-terse', engineering: 'knuth' })
  expect(settings.isAnimated).toBe(false)
  expect(settings.playByPlay).toEqual({
    isAutomatic: false,
    quietMs: 30_000,
    minGapMs: 0,
    model: 'haiku',
    thinking: 'low',
  })
  expect(settings.deepReview).toEqual({
    isAfterCommit: false,
    everyMs: 2_700_000,
    model: 'fable',
    thinking: 'max',
  })
})

test('readSettings treats a persona that could not name a file as the default', async () => {
  expect(readSettings({ voice: '../../secrets', engineering: 'Knuth' }).persona).toEqual({
    voice: 'default',
    engineering: 'default',
  })
  expect(readSettings({ voice: '', engineering: 3 }).persona).toEqual({ voice: 'default', engineering: 'default' })
})
