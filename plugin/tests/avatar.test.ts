import { expect, test } from 'claude-code/testing'

import {
  AVATARS,
  avatarFor,
  bubble,
  bubbleWidth,
  closingLine,
  finished,
  isTalking,
  nextTick,
  poseOf,
  saidSoFar,
  speakable,
  speech,
  wordsSaid,
  wrap,
} from '../hooks/avatar'
import type { Pose } from '../hooks/avatar'

const POSES: readonly Pose[] = ['rest', 'talk', 'blink', 'think']

/** Printable ASCII and the block elements Claude Code draws its own mascot with: one cell each in any terminal. */
function isOneCell(text: string): boolean {
  return [...text].every(char => {
    const code = char.codePointAt(0) ?? 0

    return (code >= 0x20 && code <= 0x7e) || (code >= 0x2580 && code <= 0x259f)
  })
}

test('every character keeps its size in every pose, and draws only with one-cell characters', async () => {
  for (const [voice, avatar] of Object.entries(AVATARS)) {
    const height = avatar.frames.rest.length
    const width = avatar.frames.rest[0]?.length ?? 0
    for (const pose of POSES) {
      expect({ voice, pose, height: avatar.frames[pose].length }).toEqual({ voice, pose, height })
      for (const line of avatar.frames[pose]) {
        expect({ voice, pose, line, width: line.length }).toEqual({ voice, pose, line, width })
        expect(isOneCell(line)).toBe(true)
      }
      expect(avatar.mini[pose].length).toBe(avatar.mini.rest.length)
      expect(isOneCell(avatar.mini[pose])).toBe(true)
    }
  }
})

test("each voice has its own character, and a voice without one gets Claude Code's mascot", async () => {
  expect(avatarFor('torvalds').name).toBe('a penguin')
  expect(avatarFor('knuth').name).toBe('an owl')
  expect(avatarFor('nobody')).toBe(AVATARS.default)
  expect(new Set(Object.values(AVATARS)).size).toBe(Object.keys(AVATARS).length)
})

test('a line is said one word a tick with the mouth moving, and then it rests', async () => {
  const start = speech('one two three')
  expect([wordsSaid(start), saidSoFar(start), poseOf('on', 'idle', start)]).toEqual([1, 'one', 'talk'])

  const second = nextTick(start)
  expect([wordsSaid(second), saidSoFar(second), poseOf('on', 'idle', second)]).toEqual([2, 'one two', 'rest'])

  const third = nextTick(second)
  expect([wordsSaid(third), isTalking(third), poseOf('on', 'idle', third)]).toEqual([3, true, 'talk'])

  const done = nextTick(third)
  expect([wordsSaid(done), isTalking(done), saidSoFar(done)]).toEqual([3, false, 'one two three'])
  expect(nextTick(done)).toBe(done)
  expect(finished(speech('one two three'))).toEqual(done)

  expect(isTalking(speech(''))).toBe(false)
  expect(wordsSaid(speech(''))).toBe(0)
})

test('poseOf: asleep while paused, eyes up while a look runs, a blink now and then', async () => {
  const quiet = finished(speech('Done.'))

  expect(poseOf('paused', 'idle', speech('Still talking'))).toBe('blink')
  expect(poseOf('on', 'looking', quiet)).toBe('think')
  // Talking wins over thinking: a review can land while a look runs.
  expect(poseOf('on', 'looking', speech('Review is in.'))).toBe('talk')
  expect(poseOf('on', 'idle', { ...quiet, isBlinking: true })).toBe('blink')
  expect(poseOf('on', 'idle', quiet)).toBe('rest')
})

test('speakable makes one line of plain words, and cuts a long one at a word', async () => {
  expect(speakable('  **Look** at `xs[0]`\n when it is __empty__. ')).toBe('Look at xs[0] when it is empty.')
  expect(speakable('- > ## A heading')).toBe('A heading')

  const long = Array.from({ length: 40 }, () => 'abcdefg').join(' ')
  expect(speakable(long)).toBe(`${Array.from({ length: 20 }, () => 'abcdefg').join(' ')}…`)
})

test("closingLine is the review's last line, as the character can say it", async () => {
  const review = '## Review\n\nGood work.\n\n- `cache.rs:42`: the lock\n\n**Next:** add a test for the empty list.\n\n'

  expect(closingLine(review)).toBe('Next: add a test for the empty list.')
  expect(closingLine('')).toBe('')
})

test('wrap fills each line before starting the next, and splits a word too long for any line', async () => {
  expect(wrap('aaa bb cccc', 6)).toEqual([['aaa', 'bb'], ['cccc']])
  expect(wrap('abcdefghij', 4)).toEqual([['abcd'], ['efgh'], ['ij']])
  expect(wrap('  ', 10)).toEqual([])
})

test('the bubble is sized for the whole line from its first word, with its tail on the second row', async () => {
  const first = bubble('Count the fence posts.', 1, 24)

  expect(first).toEqual([
    ` ╭${'─'.repeat(17)}╮`,
    `─┤ ${'Count'.padEnd(15)} │`,
    ` │ ${''.padEnd(15)} │`,
    ` ╰${'─'.repeat(17)}╯`,
  ])
  expect(bubble('Count the fence posts.', 4, 24).slice(1, 3)).toEqual([
    `─┤ ${'Count the fence'.padEnd(15)} │`,
    ` │ ${'posts.'.padEnd(15)} │`,
  ])
  // No wider than the longest line needs.
  expect(first.every(row => row.length === 20)).toBe(true)
  expect(bubble('Hi!', 3, 60)).toEqual([' ╭─────╮', '─┤ Hi! │', ' ╰─────╯'])
})

test('a line too long for three rows of bubble ends in an ellipsis', async () => {
  const letters = 'a b c d e f g h i j k l m n o p q r s t u v w x y z'
  const rows = bubble(letters, 26, 20)

  expect(rows.length).toBe(5)
  expect(rows[3]).toBe(` │ ${'q r s t u v w …'.padEnd(15)} │`)
})

test('the bubble leaves room for the drawing, and gives way when the pane is too narrow', async () => {
  expect(bubbleWidth(60, 9)).toBe(50)
  expect(bubbleWidth(200, 9)).toBe(60)
  expect(bubbleWidth(28, 9)).toBe(0)
})
