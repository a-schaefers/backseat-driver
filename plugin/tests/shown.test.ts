import { expect, test } from 'claude-code/testing'

import { isSameShown, textsOf } from '../hooks/shown'
import type { Shown } from '../hooks/shown'

/** What the tutor says it is showing: the pieces of text in a drawing, for whoever checks them against the screen. */

test('a drawing is the text a person would read in it, piece by piece, in the order drawn', async () => {
  const tree = {
    type: 'Box',
    props: { flexDirection: 'column' },
    children: [
      {
        type: 'Box',
        props: { flexDirection: 'row' },
        children: [
          { type: 'Button', props: { key: 'tab-play', label: 'Play (2)', hotkey: '1', plain: true } },
          { type: 'Button', props: { key: 'look', label: 'look now' } },
        ],
      },
      { type: 'Text', props: { dimColor: true }, children: ['On.  Watching   your saves.'] },
      false,
      null,
      { type: 'Text', children: [' '] },
      [{ type: 'Text', children: ['stats.py:4 ', { type: 'Text', props: { bold: true }, children: ['divides by zero'] }] }],
      { type: 'Raster', props: { key: 'persona', cells: 'AAAA' } },
      { type: 'Markdown', props: { key: 'review', text: '## Review\n\nThe **mean** is fine.\n' } },
      { type: 'Select', props: { key: 'setting-voice', label: 'Voice persona', value: 'knuth' } },
      'a bare string',
      7,
    ],
  }

  expect(textsOf(tree)).toEqual([
    '1: Play (2)',
    'look now',
    'On. Watching your saves.',
    'stats.py:4 divides by zero',
    '## Review',
    'The **mean** is fine.',
    'Voice persona: knuth',
    'a bare string',
    '7',
  ])
  expect(textsOf(undefined)).toEqual([])
  expect(textsOf({ type: 'Box' })).toEqual([])
})

test('two drawings are the same when they say the same in the same place', async () => {
  const one: Shown = { at: 1, placement: 'dock', columns: 60, rows: 48, isFocused: false, isCompact: false, texts: ['a', 'b'] }
  expect(isSameShown(one, { ...one, at: 2, rows: 50 })).toBe(true)
  expect(isSameShown(one, { ...one, texts: ['a', 'c'] })).toBe(false)
  // The spinner's frames apart, a drawing is the same drawing.
  expect(isSameShown({ ...one, texts: ['2: Review ✻', 'b'] }, { ...one, texts: ['2: Review ·', 'b'] })).toBe(true)
  expect(isSameShown({ ...one, texts: ['2: Review ✽', 'b'] }, { ...one, texts: ['2: Review ✶', 'b'] })).toBe(true)
  expect(isSameShown({ ...one, texts: ['2: Review (new)', 'b'] }, { ...one, texts: ['2: Review ✶', 'b'] })).toBe(false)
  expect(isSameShown(one, { ...one, placement: 'inline' })).toBe(false)
  expect(isSameShown(one, { ...one, isFocused: true })).toBe(false)
  expect(isSameShown(null, null)).toBe(true)
  expect(isSameShown(one, null)).toBe(false)
})
