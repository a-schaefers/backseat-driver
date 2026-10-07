import type { Working } from '../types'
import type { Caret } from './attention'
import { endOf, MAX_NAMES, mergeSpans, namesOf } from './journal'
import type { Entry, Inferred, Journal, Sitting, Span } from './journal'

/**
 * The journal as a model or a person reads it: where the last few minutes
 * went, what the person is working on, and the sitting so far in order.
 *
 * Every time here is said as "5 min ago", never as a clock time. The hooks
 * module does not know the person's time zone, and a model reading "14:05"
 * would not know how long ago that was either.
 */

/** "Lately" is this long: what the picture of their activity covers. */
export const WINDOW_MS = 10 * 60_000
/** What the play-by-play made of their activity is believed for this long. */
export const INFERRED_MS = 60 * 60_000
/** A save counts for as much as this long with the caret somewhere: changing a place says more than looking at it. */
const SAVE_WEIGHT_MS = 60_000
/** Time beside the file in front counts for this much of the same time in front. */
const SCREEN_WEIGHT = 0.25
/** Stays of the caret this close together are one stay. */
const STAY_GAP = 10
const MAX_TIMELINE = 14
const MAX_PLACES = 4

/** What the tutor's activity tool answers with when the journal has nothing in it. */
export const NO_ACTIVITY =
  'Nothing has been recorded yet: no save, no commit and no editor reporting since the tutor was switched on.'

/** Where in a file the caret stayed. `lines` is null for time spread all over it. */
export type Stay = { lines: Span | null; where: string; ms: number }

/** One file's part in the activity. */
export type Place = {
  path: string
  /** Time with the caret in it, as an editor reported. */
  ms: number
  /** Time on screen beside the file with the caret. */
  screenMs: number
  saves: number
  added: number
  removed: number
  /** What the saves changed: the definitions that could be named, latest first, and the lines. */
  names: string[]
  spans: Span[]
  /** Where the caret stayed, longest first. */
  stays: Stay[]
}

/** What they have been doing lately, by file. */
export type Picture = {
  /** The files with activity, the most worked on first. */
  places: Place[]
  /** Editor time over all of them. 0 when no editor reported. */
  ms: number
}

/** Everything a rendering is made from. */
export type Seen = {
  journal: Journal
  /** The attention still being added up, as the entries it will become. */
  live: readonly Entry[]
  /** Where the caret is now, while an editor is reporting. */
  caret: Caret | null
  now: number
}

/** How long ago, in a few words. */
export function ago(ms: number): string {
  const seconds = Math.max(0, ms) / 1000
  if (seconds < 45) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${Math.max(1, minutes)} min ago`
  const hours = Math.round(minutes / 60)

  return hours < 48 ? `${hours} h ago` : `${Math.floor(hours / 24)} days ago`
}

/** How long something took, in a few words. */
export function took(ms: number): string {
  const minutes = Math.round(Math.max(0, ms) / 60_000)
  if (minutes < 1) return 'under a minute'
  if (minutes < 60) return `${minutes} min`
  const rest = minutes % 60

  return rest === 0 ? `${Math.floor(minutes / 60)} h` : `${Math.floor(minutes / 60)} h ${rest} min`
}

function times(count: number): string {
  if (count === 1) return 'once'

  return count === 2 ? 'twice' : `${count} times`
}

function listed(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? ''

  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1] ?? ''}`
}

function lineWords([first, last]: Span): string {
  return first === last ? `line ${first}` : `lines ${first} to ${last}`
}

function addStay(stays: Stay[], lines: Span | null, where: string, ms: number): void {
  const near = stays.find(stay =>
    lines === null || stay.lines === null
      ? lines === stay.lines
      : lines[0] <= stay.lines[1] + STAY_GAP && stay.lines[0] <= lines[1] + STAY_GAP,
  )
  if (near === undefined) {
    stays.push({ lines, where, ms })

    return
  }
  if (near.lines !== null && lines !== null) near.lines = [Math.min(near.lines[0], lines[0]), Math.max(near.lines[1], lines[1])]
  if (near.where === '') near.where = where
  near.ms += ms
}

/** The activity of the last `windowMs`, from the saves and the editor's attention in `entries`. */
export function pictureOf(entries: readonly Entry[], now: number, windowMs = WINDOW_MS): Picture {
  const places = new Map<string, Place>()
  for (const entry of entries) {
    if ((entry.kind !== 'save' && entry.kind !== 'focus' && entry.kind !== 'screen') || endOf(entry) < now - windowMs) continue
    const place: Place = places.get(entry.path) ?? {
      path: entry.path,
      ms: 0,
      screenMs: 0,
      saves: 0,
      added: 0,
      removed: 0,
      names: [],
      spans: [],
      stays: [],
    }
    places.set(entry.path, place)

    if (entry.kind === 'screen') {
      place.screenMs += entry.ms
      continue
    }
    if (entry.kind === 'focus') {
      place.ms += entry.ms
      addStay(place.stays, entry.lines[0] ?? null, entry.where, entry.ms)
      continue
    }
    place.saves += entry.saves
    place.added += entry.added
    place.removed += entry.removed
    place.spans = mergeSpans([...place.spans, ...entry.lines])
    const names = namesOf(entry.where)
    place.names = [...names, ...place.names.filter(name => !names.includes(name))].slice(0, MAX_NAMES)
  }

  const weight = (place: Place): number => place.saves * SAVE_WEIGHT_MS + place.ms + place.screenMs * SCREEN_WEIGHT
  const ranked = [...places.values()].sort((a, b) => weight(b) - weight(a) || a.path.localeCompare(b.path))
  for (const place of ranked) place.stays.sort((a, b) => b.ms - a.ms)

  return { places: ranked, ms: ranked.reduce((total, place) => total + place.ms, 0) }
}

/** The most telling part of a place: what was changed if anything was, otherwise where the caret stayed longest. */
function partOf(place: Place): { where: string; lines: Span | null } {
  if (place.saves > 0) return { where: place.names[0] ?? '', lines: place.spans[0] ?? null }
  const stay = place.stays[0]

  return { where: stay?.where ?? '', lines: stay?.lines ?? null }
}

/** A place in a few words: "src/cache.rs, in get_or_load", or with the lines when nothing there has a name. */
export function placeWords(place: Place): string {
  const { where, lines } = partOf(place)
  if (where !== '') return `${place.path}, in ${where}`

  return lines === null ? place.path : `${place.path}, ${lineWords(lines)}`
}

/** A stretch of time in a few words: seconds under a minute ("7 s"), then minutes and hours. */
function spent(ms: number): string {
  return ms < 60_000 ? `${Math.max(1, Math.round(ms / 1000))} s` : took(ms)
}

/**
 * How much of the window went to a place: the editor's time there, or its
 * saves when no editor reported. The time itself, not its share of the
 * editor's time: "100% of the last 10 minutes in the editor" was said of
 * seven seconds (the twelfth ui-truth pass, 2026-10-07).
 */
export function shareWords(place: Place, picture: Picture, windowMs = WINDOW_MS): string {
  const lately = `the last ${Math.round(windowMs / 60_000)} minutes`
  if (picture.ms > 0 && place.ms > 0) return `${spent(place.ms)} in the editor in ${lately}`
  if (place.saves > 0) return `saved ${times(place.saves)} in ${lately}`

  return ''
}

/**
 * Whether what the play-by-play made of their activity still fits: it is
 * recent, and what they are doing now touches a file that look was shown.
 * With nothing going on, nothing contradicts it.
 */
export function holds(inferred: Inferred | null, picture: Picture, now: number): inferred is Inferred {
  if (inferred === null || inferred.text === '' || now - inferred.at > INFERRED_MS) return false
  if (picture.places.length === 0 || inferred.paths.length === 0) return true

  return picture.places.some(place => inferred.paths.includes(place.path))
}

function pictured(seen: Seen): Picture {
  return pictureOf([...seen.journal.entries, ...seen.live], seen.now)
}

/** What the pane's "Working on" line is made from. */
export function workingOf(seen: Seen): Working {
  const picture = pictured(seen)
  const said = seen.journal.said
  const first = picture.places[0]
  const age = said === null ? 0 : seen.now - said.at

  return {
    said: said?.text ?? '',
    saidAgo: said !== null && said.text !== '' && age >= 60 * 60_000 ? ago(age) : '',
    inferred: holds(seen.journal.inferred, picture, seen.now) ? seen.journal.inferred.text : '',
    where: first === undefined ? '' : placeWords(first),
    share: first === undefined ? '' : shareWords(first, picture),
  }
}

function stayWords(stay: Stay): string {
  if (stay.where !== '') return stay.lines === null ? `in ${stay.where}` : `in ${stay.where} (${lineWords(stay.lines)})`

  return stay.lines === null ? 'all over the file' : `around ${lineWords(stay.lines)}`
}

function placeLine(place: Place, picture: Picture): string {
  const parts: string[] = []
  if (picture.ms > 0 && place.ms > 0) {
    const stays = place.stays.filter(stay => stay.lines !== null).slice(0, 2).map(stayWords)
    const share = `${Math.round((place.ms / picture.ms) * 100)}% of the time in the editor`
    parts.push(stays.length === 0 ? share : `${share}, the caret mostly ${stays.join(', then ')}`)
  }
  if (picture.ms > 0 && place.screenMs > 0) {
    parts.push(`on screen beside the file in front for ${Math.round((place.screenMs / picture.ms) * 100)}% of the time`)
  }
  if (place.saves > 0) {
    const names = place.names.length === 0 ? '' : ` in ${listed(place.names)}`
    const lines = place.spans.length === 0 ? '' : ` (${place.spans.map(lineWords).join(', ')})`
    parts.push(`saved ${times(place.saves)}, +${place.added} -${place.removed}${names}${lines}`)
  }

  return `- ${place.path}: ${parts.join('; ')}`
}

function entryWords(entry: Entry): string | null {
  switch (entry.kind) {
    case 'on':
      return entry.text === '' ? 'the tutor was switched on' : `the tutor was switched on, on branch ${entry.text}`
    case 'save': {
      const over = entry.until - entry.at >= 60_000 ? ` over ${took(entry.until - entry.at)}` : ''
      const names = entry.where === '' ? '' : ` in ${listed(namesOf(entry.where))}`
      const lines = entry.lines.length === 0 ? '' : ` (${entry.lines.map(lineWords).join(', ')})`

      return `saved ${entry.path} ${times(entry.saves)}${over}, +${entry.added} -${entry.removed}${names}${lines}`
    }
    case 'commit':
      return `committed ${entry.hash.slice(0, 7)}: ${entry.text}`
    case 'head':
      return `HEAD moved without a commit (${entry.text})`
    case 'note':
      return `a play-by-play note was raised on ${entry.path} line ${entry.line} (${entry.text})`
    case 'fixed':
      return `they dealt with a note in the code: ${entry.text} (${entry.path})`
    case 'dismissed':
      return `they dismissed a note: ${entry.text} (${entry.path})`
    case 'review':
      return `a deep review arrived for ${entry.text}`
    case 'said':
      return entry.text === ''
        ? 'they took back what they had said they were working on'
        : `they said they are working on: ${entry.text}`
    case 'focus':
    case 'screen':
      // Attention is in the picture above the timeline, not in it.
      return null
  }
}

function sittingLine(sitting: Sitting, now: number): string {
  const parts = [`Last time they worked here (${ago(now - sitting.to)}, for ${took(sitting.to - sitting.from)})`]
  const files = sitting.files.slice(0, 3).map(file => file.path)
  parts[0] += files.length === 0 ? '.' : `: mostly ${listed(files)}.`
  if (sitting.commitCount > 0) {
    const last = sitting.commits[sitting.commits.length - 1] ?? ''
    parts.push(`${sitting.commitCount === 1 ? '1 commit' : `${sitting.commitCount} commits`}, the last "${last}".`)
  }
  if (sitting.said !== '') parts.push(`They said they were working on: ${sitting.said}.`)

  return parts.join(' ')
}

/** The lines that say what they are working on: their own words, what a look made of it, and where the activity is. */
function workingLines(seen: Seen, picture: Picture): string[] {
  const lines: string[] = []
  const said = seen.journal.said
  if (said !== null && said.text !== '') {
    lines.push(`Working on, in their own words (said ${ago(seen.now - said.at)}): ${said.text}`)
  }
  const inferred = seen.journal.inferred
  if (holds(inferred, picture, seen.now)) {
    lines.push(`Working on, as it looked at the last look (${ago(seen.now - inferred.at)}): ${inferred.text}`)
  }
  const first = picture.places[0]
  if (first !== undefined) {
    const { where, lines: at } = partOf(first)
    const part = where === '' ? '' : `, in ${where}`
    lines.push(`Most of the activity is in: ${first.path}${part}${at === null ? '' : ` (${lineWords(at)})`}`)
  }

  return lines
}

function caretLines(caret: Caret | null): string[] {
  if (caret === null) return []
  const where = caret.where === '' ? '' : `, in ${caret.where}`
  const lines = [`Caret now: ${caret.path} line ${caret.line}${where}.${caret.isModified ? ' That buffer has changes that are not saved.' : ''}`]
  if (caret.visible.length > 0) lines.push(`On screen beside it: ${caret.visible.join(', ')}`)
  const open = caret.open.filter(path => !caret.visible.includes(path))
  if (open.length > 0) lines.push(`Also open in the editor: ${open.join(', ')}`)

  return lines
}

/**
 * What a reviewer is told about what the person has been doing, or '' when
 * there is nothing to tell. The play-by-play reads it before the changes,
 * the deep reviewer after its task, and the tutor's activity tool answers
 * with it.
 */
export function glanceText(seen: Seen): string {
  const picture = pictured(seen)
  const sections: string[] = []

  const working = workingLines(seen, picture)
  if (working.length > 0) sections.push(working.join('\n'))

  if (picture.places.length > 0 || seen.caret !== null) {
    const minutes = Math.round(WINDOW_MS / 60_000)
    const source =
      picture.ms > 0 ? `${took(picture.ms)} with the caret moving in the editor` : 'from their saves, with no editor reporting'
    sections.push(
      [
        ...(picture.places.length === 0 ? [] : [`The last ${minutes} minutes (${source}):`]),
        ...picture.places.slice(0, MAX_PLACES).map(place => placeLine(place, picture)),
        ...caretLines(seen.caret),
      ].join('\n'),
    )
  }

  const events = seen.journal.entries.flatMap(entry => {
    const words = entryWords(entry)

    return words === null ? [] : [`- ${ago(seen.now - entry.at)}: ${words}`]
  })
  // Being switched on is not news by itself, and attention is in the picture above.
  if (seen.journal.entries.some(entry => entryWords(entry) !== null && entry.kind !== 'on')) {
    const shown = events.slice(-MAX_TIMELINE)
    const heading =
      shown.length < events.length
        ? `This sitting, oldest first (the last ${shown.length} of ${events.length} things):`
        : 'This sitting, oldest first:'
    sections.push([heading, ...shown].join('\n'))
  }

  const previous = seen.journal.sittings[seen.journal.sittings.length - 1]
  if (previous !== undefined) sections.push(sittingLine(previous, seen.now))
  if (sections.length === 0) return ''

  return [
    'What they have been doing in the code. This comes from their editor and from git, not from them, and it can have gaps.',
    ...sections,
  ].join('\n\n')
}

/** What one save changed in one file: the diff as text, kept in memory and never written to the journal. */
export type Change = { path: string; at: number; diff: string }

/**
 * The latest change to each file saved lately, newest first, or '' when
 * there is none. Only the tutor's activity tool answers with this: the
 * reviewers see the changes themselves.
 */
export function changesText(changes: readonly Change[], now: number): string {
  if (changes.length === 0) return ''

  return [
    'What their latest saves changed, newest first, as unified diffs:',
    ...changes.map(change => `=== ${change.path}, saved ${ago(now - change.at)} ===\n${change.diff}`),
  ].join('\n\n')
}

/**
 * What the conversation is told with each prompt, or '' when there is
 * nothing to tell: a few lines, because it is attached again and again. The
 * whole record is one tool call away.
 */
export function briefText(seen: Seen): string {
  const picture = pictured(seen)
  const lines = [...workingLines(seen, picture), ...caretLines(seen.caret).slice(0, 1)]
  if (lines.length === 0) return ''

  return [
    'Backseat Driver: what the user is doing in their code right now, taken from their editor and from git. They did not type this, so do not answer it. Use it to place what they ask about.',
    ...lines,
  ].join('\n')
}
