import { expect, test } from 'claude-code/testing'

import {
  AVATARS,
  avatarFor,
  bubble,
  bubbleColumn,
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
    // The bubble's tail points at a row of the drawing, with a row above it for the bubble's top.
    expect({ voice, isMouthInside: avatar.mouth >= 1 && avatar.mouth < height }).toEqual({ voice, isMouthInside: true })
  }
})

test("each voice has its own character, and a voice without one gets Claude Code's mascot", async () => {
  expect(avatarFor('torvalds').name).toBe('Linus Torvalds, in ASCII')
  expect(avatarFor('knuth').name).toBe('Donald Knuth, in ASCII')
  expect(avatarFor('primeagen').name).toBe('ThePrimeagen, in ASCII')
  expect(avatarFor('eli5-tldr-kiss-terse').name).toBe('the KISS Linux penguin')
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

test('ASCII art speaks in an ASCII bubble, with its tail on any line', async () => {
  expect(bubble('Keep it simple.', 3, 40, 'ascii')).toEqual([' .-----------------.', '-| Keep it simple. |', " '-----------------'"])
  expect(bubble('a b', 2, 6, 'ascii', 1)).toEqual([' .---.', ' | a |', '-| b |', " '---'"])
})

test("the bubble's tail is level with the character's mouth, and a tall bubble hangs below as little as it can", async () => {
  const kiss = AVATARS['eli5-tldr-kiss-terse']
  const short = bubbleColumn(kiss, kiss.hello, 9, 60)
  expect(short.slice(0, kiss.mouth - 1)).toEqual([' ', ' ', ' '])
  expect(short[kiss.mouth]).toBe('-| "whatsoever a man soweth, that shall he also reap." |')

  // Three lines of text with the mouth on row 4: the tail moves to the last line, and the bubble ends below the mouth.
  const long = bubbleColumn(kiss, 'one two three four five six', 6, 12)
  expect(long.length).toBe(kiss.mouth + 2)
  expect(long[kiss.mouth]?.startsWith('-|')).toBe(true)

  // Claude's mascot speaks from its middle row, at the top of the bubble.
  const claude = AVATARS.default
  expect(bubbleColumn(claude, 'Hi!', 1, 60)).toEqual([' ╭─────╮', '─┤ Hi! │', ' ╰─────╯'])
})

