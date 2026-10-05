import type { Watch } from '../types'
import type { Play } from './play'

/**
 * The pane's status line: what the play-by-play is doing, said so that it is
 * true the moment it is read. A wait says what it is waiting for and until
 * when, as a time of day, so that the line does not have to be redrawn every
 * second to stay right.
 */

/** A time of day as the person's clock shows it: 09:05. */
export function clockTime(ms: number): string {
  const date = new Date(ms)

  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const TROUBLES: Record<string, string> = {
  'rate-limit': 'Claude is rate limited',
  overloaded: 'Claude is overloaded',
  server: 'Claude had a server error',
  offline: 'There is no connection to Claude',
  timeout: 'Claude did not answer in time',
}

/** What the status line says while the tutor is on or paused. */
export function playLine(play: Play): string {
  switch (play.at) {
    case 'paused':
      return 'Paused. /bsd resume to continue.'
    case 'starting':
      return 'On. Getting ready.'
    case 'no-git':
      return 'On. This folder is not a git repository, so there is no play-by-play.'
    case 'watching':
      return 'On. Watching for your next save.'
    case 'on-request':
      return 'On. Looking only when you ask.'
    case 'settling':
      return play.isSpacing ? `On. Saw your save. Next look after ${clockTime(play.dueAt)}.` : 'On. Saw your save. Looking when you pause.'
    case 'looking':
      return 'On. Looking at your changes.'
    case 'waiting': {
      const { until, why } = play
      const next = until === null ? '' : ` Next try ${clockTime(until)}.`
      switch (why.kind) {
        case 'failed':
          return `On. The last look failed (${why.detail}).${next === '' ? ' It will try again.' : next}`
        case 'trouble':
          return `On. ${TROUBLES[why.trouble] ?? 'Claude is not answering'}.${next}`
        case 'plan':
          return until === null
            ? 'On. Holding back, because you are close to your plan limit. It still looks when you ask.'
            : `On. Holding back until ${clockTime(until)}, because you are close to your plan limit. It still looks when you ask.`
        case 'account':
          return `On. Claude is refusing this account (${why.detail}). Nothing runs in the background until that is sorted out.`
        case 'job':
          return `On. The play-by-play cannot run (${why.detail}). Its model is set in /config.`
      }
    }
  }
}

/** What the pane is told: the line, and the state the animated character takes its pose from. */
export function watchOf(play: Play, lastLookAt: number | null): Watch {
  const state: Watch['state'] =
    play.at === 'starting' || play.at === 'no-git' || play.at === 'looking' || play.at === 'settling' || play.at === 'waiting' ? play.at : 'idle'

  return { state, lastLookAt, line: playLine(play) }
}
