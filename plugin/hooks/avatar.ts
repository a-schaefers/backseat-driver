/**
 * The animated persona: a small character for each voice, the poses it
 * takes, and the speech bubble it talks in. register.tsx moves the clock and
 * keeps the speech in `$.state`. Everything here is plain values.
 */
import type { Mode, Speech, Watch } from '../types'
import CLAUDE_ART from './art/default'
import KISS_ART from './art/eli5-tldr-kiss-terse'
import KNUTH_ART from './art/knuth'
import PRIME_ART from './art/primeagen'
import LINUS_ART from './art/torvalds'
import type { SpriteArt } from './sprite'

export type Pose = 'rest' | 'talk' | 'blink' | 'think'

/** How a speech bubble is drawn: with Claude Code's own box lines, or in plain ASCII to match ASCII art. */
export type BubbleStyle = 'round' | 'ascii'

/** One character. Every pose has the same number of lines, and every line the same width. */
export type Avatar = {
  /** Who or what it is, in a few words. */
  name: string
  /** What it says when the tutor is switched on. */
  hello: string
  /** A theme key or a terminal color for the drawing. */
  color: string
  /** The character in truecolor pixels, from its file in `art/`: what a terminal shows. */
  art: SpriteArt
  /** The character in plain text, where pixels cannot be drawn. */
  frames: Record<Pose, readonly string[]>
  /** The row of `frames` that the speech bubble's tail points at: its mouth, give or take. At least 1. */
  mouth: number
  bubbleStyle: BubbleStyle
  /** The same poses in one line, for where rows are scarce. Every one the same width. */
  mini: Record<Pose, string>
}

/** Claude Code's own mascot, for the default voice. */
const CLAUDE: Avatar = {
  name: "Claude Code's mascot",
  hello: 'Riding along. You drive.',
  color: 'claude',
  art: CLAUDE_ART,
  frames: {
    rest: [' ▐▛███▜▌ ', '▝▜█████▛▘', '  ▘▘ ▝▝  '],
    talk: ['▗▐▛███▜▌▖', ' ▜█████▛ ', '  ▘▘ ▝▝  '],
    blink: [' ▐█████▌ ', '▝▜█████▛▘', '  ▘▘ ▝▝  '],
    think: [' ▐▙███▟▌ ', '▝▜█████▛▘', '  ▘▘ ▝▝  '],
  },
  mouth: 1,
  bubbleStyle: 'round',
  mini: { rest: ' ▐▛███▜▌ ', talk: '▗▐▛███▜▌▖', blink: ' ▐█████▌ ', think: ' ▐▙███▟▌ ' },
}

/** Square glasses, a tuft of hair and a wry smile. */
const LINUS: Avatar = {
  name: 'Linus Torvalds, in ASCII',
  hello: 'Ready. Save something.',
  color: 'green',
  art: LINUS_ART,
  frames: {
    rest: ['   .,,,,.   ', '  /      \\  ', ' | [o]-[o] |', ' |    >    |', "  \\  `-'  / ", "   '-----'  "],
    talk: ['   .,,,,.   ', '  /      \\  ', ' | [o]-[o] |', ' |    >    |', '  \\   O   / ', "   '-----'  "],
    blink: ['   .,,,,.   ', '  /      \\  ', ' | [-]-[-] |', ' |    >    |', "  \\  `-'  / ", "   '-----'  "],
    think: ['   .,,,,.   ', '  /      \\  ', " | [']-['] |", ' |    >    |', "  \\  `-'  / ", "   '-----'  "],
  },
  mouth: 4,
  bubbleStyle: 'ascii',
  mini: { rest: '[o]-[o]', talk: '[O]-[O]', blink: '[-]-[-]', think: "[']-[']" },
}

/** Bald on top, tufts at the sides, round glasses and a big smile. */
const KNUTH: Avatar = {
  name: 'Donald Knuth, in ASCII',
  hello: 'Shall we read some programs together?',
  color: 'yellow',
  art: KNUTH_ART,
  frames: {
    rest: ['   .---.   ', ' ~/     \\~ ', ' |(o)-(o)| ', ' |   >   | ', '  \\ \\_/ /  ', "   '---'   "],
    talk: ['   .---.   ', ' ~/     \\~ ', ' |(o)-(o)| ', ' |   >   | ', '  \\  O  /  ', "   '---'   "],
    blink: ['   .---.   ', ' ~/     \\~ ', ' |(-)-(-)| ', ' |   >   | ', '  \\ \\_/ /  ', "   '---'   "],
    think: ['   .---.   ', ' ~/     \\~ ', " |(')-(')| ", ' |   >   | ', '  \\ \\_/ /  ', "   '---'   "],
  },
  mouth: 4,
  bubbleStyle: 'ascii',
  mini: { rest: '(o)-(o)', talk: '(O)-(O)', blink: '(-)-(-)', think: "(')-(')" },
}

/** A shaved head under headphones, and the mustache. */
const PRIME: Avatar = {
  name: 'ThePrimeagen, in ASCII',
  hello: "Let's go. Write something.",
  color: 'magenta',
  art: PRIME_ART,
  frames: {
    rest: ['   .---.   ', ' [/     \\] ', ' [| o o |] ', "  |,/^\\,|  ", '   \\_-_/   '],
    talk: ['   .---.   ', ' [/     \\] ', ' [| o o |] ', "  |,/^\\,|  ", '   \\_O_/   '],
    blink: ['   .---.   ', ' [/     \\] ', ' [| - - |] ', "  |,/^\\,|  ", '   \\_-_/   '],
    think: ['   .---.   ', ' [/     \\] ', " [| ' ' |] ", "  |,/^\\,|  ", '   \\_-_/   '],
  },
  mouth: 3,
  bubbleStyle: 'ascii',
  mini: { rest: '[o~o]', talk: '[oOo]', blink: '[-~-]', think: "['~']" },
}

/** Tux in a top hat, after the KISS Linux one, for the keep-it-simple voice. */
const KISS: Avatar = {
  name: 'the KISS Linux penguin',
  hello: '"whatsoever a man soweth, that shall he also reap."',
  color: 'white',
  art: KISS_ART,
  frames: {
    rest: ['    ____   ', '   |    |  ', ' ._|____|_.', '   |o_o |  ', '   |:_/ |  ', '  //   \\ \\ '],
    talk: ['    ____   ', '   |    |  ', ' ._|____|_.', '   |o_o |  ', '   |:o/ |  ', '  \\\\   / / '],
    blink: ['    ____   ', '   |    |  ', ' ._|____|_.', '   |-_- |  ', '   |:_/ |  ', '  //   \\ \\ '],
    think: ['    ____   ', '   |    |  ', ' ._|____|_.', "   |'_' |  ", '   |:_/ |  ', '  //   \\ \\ '],
  },
  mouth: 4,
  bubbleStyle: 'ascii',
  mini: { rest: '_|o_o|_', talk: '_|oOo|_', blink: '_|-_-|_', think: "_|'_'|_" },
}

/** The character for each voice. */
export const AVATARS = {
  default: CLAUDE,
  torvalds: LINUS,
  knuth: KNUTH,
  primeagen: PRIME,
  'eli5-tldr-kiss-terse': KISS,
} as const satisfies Record<string, Avatar>

const BY_VOICE: ReadonlyMap<string, Avatar> = new Map(Object.entries(AVATARS))

/** The voice's character. A voice without one gets Claude Code's mascot. */
export function avatarFor(voice: string): Avatar {
  return BY_VOICE.get(voice) ?? CLAUDE
}

/** What a character says when it has nothing to say. */
export const SILENT: Speech = { text: '', tick: 0, isBlinking: false }

/** How long each word takes to say, and how often the mouth moves. */
export const TALK_MS = 150
/** How often a resting character blinks, and how long its eyes stay shut. */
export const BLINK_MS = 7000
export const BLINK_SHUT_MS = 180
/** After this many looks in a row that it kept quiet, a look may give it a light remark. */
export const QUIET_LOOKS_BEFORE_REMARK = 4
/** The most a character says in one go. */
const MAX_SPEECH_CHARS = 160
/** The speech bubble never grows taller than this many lines of text, or wider than this. */
const MAX_BUBBLE_LINES = 3
const MAX_BUBBLE_WIDTH = 60
/** Narrower than this, the bubble does not fit beside the drawing, and the character is drawn in one line. */
const MIN_BUBBLE_WIDTH = 20

function words(text: string): string[] {
  return text.split(/\s+/).filter(word => word !== '')
}

/**
 * Text as a character can say it: one line of plain words, without Markdown
 * or code formatting, cut at a word when it runs long.
 */
export function speakable(text: string): string {
  const plain = words(
    text
      .replace(/`+/g, '')
      .replace(/\*\*|__/g, '')
      .replace(/^[\s>#*-]+/, ''),
  ).join(' ')
  if (plain.length <= MAX_SPEECH_CHARS) return plain
  const cut = plain.slice(0, MAX_SPEECH_CHARS)

  return `${cut.slice(0, cut.lastIndexOf(' ') > 0 ? cut.lastIndexOf(' ') : cut.length)}…`
}

/** The last line of a deep review, which its instructions make the single thing most worth doing next. */
export function closingLine(review: string): string {
  const lines = review.split('\n').filter(line => line.trim() !== '')

  return speakable(lines[lines.length - 1] ?? '')
}

/** A new line to say, from its first word. */
export function speech(text: string): Speech {
  return { text: speakable(text), tick: 0, isBlinking: false }
}

/** True while the character is still saying its line. */
export function isTalking(said: Speech): boolean {
  return said.tick < words(said.text).length
}

/** The speech one tick later. A finished line stays finished. */
export function nextTick(said: Speech): Speech {
  return isTalking(said) ? { ...said, tick: said.tick + 1 } : said
}

/** The speech with its line all said, as after a reload, when the timer that moved it is gone. */
export function finished(said: Speech): Speech {
  return { ...said, tick: words(said.text).length, isBlinking: false }
}

/** How many of its words have been said: one more each tick, all of them once it is done. */
export function wordsSaid(said: Speech): number {
  return Math.min(words(said.text).length, said.tick + 1)
}

/** The part of the line said so far. */
export function saidSoFar(said: Speech): string {
  return words(said.text).slice(0, wordsSaid(said)).join(' ')
}

/** How the character stands: asleep while paused, mouth moving while it talks, eyes up while a look runs. */
export function poseOf(mode: Mode, watch: Watch['state'], said: Speech): Pose {
  if (mode === 'paused') return 'blink'
  if (isTalking(said)) return said.tick % 2 === 0 ? 'talk' : 'rest'
  if (watch === 'looking') return 'think'

  return said.isBlinking ? 'blink' : 'rest'
}

/** Words in lines of at most `width` characters. A word longer than that is split. */
export function wrap(text: string, width: number): string[][] {
  const lines: string[][] = []
  let line: string[] = []
  let length = 0
  for (const whole of words(text)) {
    for (let start = 0; start < whole.length; start += width) {
      const word = whole.slice(start, start + width)
      if (line.length > 0 && length + 1 + word.length > width) {
        lines.push(line)
        line = []
        length = 0
      }
      length += (line.length > 0 ? 1 : 0) + word.length
      line.push(word)
    }
  }
  if (line.length > 0) lines.push(line)

  return lines
}

/** The lines a bubble is drawn with, by style. */
const BUBBLE_LINES: Record<BubbleStyle, { top: readonly [string, string]; side: string; tail: string; bottom: readonly [string, string]; rule: string }> = {
  round: { top: [' ╭', '╮'], side: '│', tail: '─┤', bottom: [' ╰', '╯'], rule: '─' },
  ascii: { top: [' .', '.'], side: '|', tail: '-|', bottom: [" '", "'"], rule: '-' },
}

/**
 * The speech bubble as lines of text, its tail on text line `tail` (from 0)
 * pointing back at the character. It is no wider than its line needs and at
 * most `maxWidth`, and it is sized for the whole line from the first word, so
 * that it does not grow while the words come.
 */
export function bubble(text: string, said: number, maxWidth: number, style: BubbleStyle = 'round', tail = 0): string[] {
  const lines = wrap(text, maxWidth - 5)
  if (lines.length > MAX_BUBBLE_LINES) {
    const last = lines[MAX_BUBBLE_LINES - 1] ?? []
    while (last.length > 1 && [...last, '…'].join(' ').length > maxWidth - 5) last.pop()
    last.push('…')
  }
  const shown = lines.slice(0, MAX_BUBBLE_LINES)
  const inner = Math.max(1, ...shown.map(line => line.join(' ').length))
  const drawn = BUBBLE_LINES[style]
  let left = said
  const rows = shown.map(line => {
    const spoken = line.slice(0, Math.max(0, left))
    left -= line.length

    return spoken.join(' ').padEnd(inner)
  })

  return [
    `${drawn.top[0]}${drawn.rule.repeat(inner + 2)}${drawn.top[1]}`,
    ...rows.map((row, index) => `${index === tail ? drawn.tail : ` ${drawn.side}`} ${row} ${drawn.side}`),
    `${drawn.bottom[0]}${drawn.rule.repeat(inner + 2)}${drawn.bottom[1]}`,
  ]
}

/**
 * What stands beside a character: blank rows, then its bubble, placed so
 * that the tail is level with the character's mouth. When there is not room
 * above the mouth for the whole bubble, the tail moves down the bubble's
 * side instead, so that the bubble hangs below the drawing as little as it can.
 */
export function bubbleColumn(avatar: Avatar, text: string, said: number, maxWidth: number, mouth = avatar.mouth): string[] {
  const lines = Math.min(MAX_BUBBLE_LINES, wrap(text, maxWidth - 5).length)
  const tail = Math.max(0, Math.min(lines - 1, mouth - 1))
  // A blank row is a space: an empty line of text can collapse to nothing.
  const above = Array.from({ length: mouth - 1 - tail }, () => ' ')

  return [...above, ...bubble(text, said, maxWidth, avatar.bubbleStyle, tail)]
}

/** How wide the bubble can be beside a drawing of `artWidth` columns, or 0 when it does not fit. */
export function bubbleWidth(columns: number, artWidth: number): number {
  const room = Math.min(MAX_BUBBLE_WIDTH, columns - artWidth - 1)

  return room < MIN_BUBBLE_WIDTH ? 0 : room
}
