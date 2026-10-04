import type { Mode } from '../types'

export type Request = 'on' | 'off' | 'pause' | 'resume' | 'status' | 'help'

/** What `/bsd <args>` asks for. No argument means on. */
export function parseRequest(args: string): Request {
  const word = args.trim().toLowerCase()
  if (word === '' || word === 'on') return 'on'
  if (word === 'off' || word === 'pause' || word === 'resume' || word === 'status') return word

  return 'help'
}

export const USAGE = 'Usage: /bsd [off | pause | resume | status]. With no argument it turns the tutor on.'

/** The mode a request leads to from `from`, and the line the command prints. */
export function transition(from: Mode, request: Request): { to: Mode; text: string } {
  switch (request) {
    case 'on':
      if (from === 'on') return { to: 'on', text: 'Backseat Driver is already on.' }
      if (from === 'paused') return { to: 'on', text: 'Backseat Driver is on again.' }

      return { to: 'on', text: 'Backseat Driver is on. You drive.' }
    case 'off':
      if (from === 'off') return { to: 'off', text: 'Backseat Driver is already off.' }

      return { to: 'off', text: 'Backseat Driver is off. Claude Code is back to normal.' }
    case 'pause':
      if (from === 'off') return { to: 'off', text: 'Backseat Driver is off. Run /bsd to start it.' }

      return { to: 'paused', text: 'Backseat Driver is paused. Run /bsd resume to continue.' }
    case 'resume':
      if (from === 'off') return { to: 'off', text: 'Backseat Driver is off. Run /bsd to start it.' }

      return { to: 'on', text: 'Backseat Driver is on again.' }
    case 'status':
      return { to: from, text: `Backseat Driver is ${from}.` }
    case 'help':
      return { to: from, text: USAGE }
  }
}
