import type { Working } from '../types'

/**
 * "What are you working on right now?" The tutor works the answer out from
 * the person's activity, because being asked is a chore. This is the one
 * question it has for when they want to say it themselves, and the ways they
 * can: the pane's `w` key, `/bsd working`, or telling the tutor in chat.
 */

export const WORKING_QUESTION = 'What are you working on right now?'
/** The chip beside the question. Twelve characters at most. */
export const WORKING_HEADER = 'Working on'

/** Takes back what they said, so that the tutor goes by their activity again. */
export const LET_IT_INFER = 'Let the tutor work it out'
/** An answer for when there is nothing to confirm yet. It changes nothing. */
export const NOTHING_YET = 'Nothing in particular'

const MAX_SAID_CHARS = 160
const MAX_LABEL_CHARS = 70

function clip(text: string, length: number): string {
  return text.length <= length ? text : `${text.slice(0, length - 1).trimEnd()}…`
}

/** What they said, as it is kept: one line, not too long. */
export function tidy(text: string): string {
  return clip(text.replace(/\s+/g, ' ').trim(), MAX_SAID_CHARS)
}

function stillLabel(said: string): string {
  return clip(`Still: ${said}`, MAX_LABEL_CHARS)
}

function rightLabel(guess: string): string {
  return clip(`That is right: ${guess}`, MAX_LABEL_CHARS)
}

/** What the tutor would say they are working on if they said nothing: what a look made of it, or where the activity is. */
function guessOf(working: Working): string {
  return working.inferred !== '' ? working.inferred : working.where
}

/**
 * The answers offered beside the free text, two of them. The first is what
 * Enter gives, and it never loses anything: what they said stays, or the
 * tutor keeps working it out.
 */
export function workingChoices(working: Working): string[] {
  if (working.said !== '') return [stillLabel(working.said), LET_IT_INFER]
  const guess = guessOf(working)

  return [LET_IT_INFER, guess === '' ? NOTHING_YET : rightLabel(guess)]
}

/** What an answer means: something to record, '' to take back what was said, or null to leave everything as it is. */
export function chosen(answer: string, working: Working): string | null {
  const text = answer.trim()
  if (text === '' || text === NOTHING_YET) return null
  if (text === LET_IT_INFER) return working.said === '' ? null : ''
  if (working.said !== '' && text === stillLabel(working.said)) return working.said
  const guess = guessOf(working)
  if (guess !== '' && text === rightLabel(guess)) return tidy(guess)

  return tidy(text)
}

/**
 * What `/bsd working <rest>` asks for: something to record, '' to take back
 * what was said, or null when nothing follows and the question is asked.
 * "/bsd working on the parser" reads naturally, so a leading "on" is dropped.
 */
export function parseWorking(rest: string): string | null {
  const text = tidy(rest.replace(/^on\b\s*/i, ''))
  if (text === '') return null

  return /^(?:clear|nothing|infer)$/i.test(text) ? '' : text
}
