import type { Mode } from '../types'

/** The requests that change or report the mode. */
export type ModeRequest = 'on' | 'off' | 'pause' | 'resume' | 'status'

/** Everything `/bsd <word>` can ask for. */
export type Request = ModeRequest | 'explain' | 'settings' | 'questions' | 'working' | 'forget' | 'license' | 'update' | 'uninstall' | 'debug' | 'help'

const WORDS: readonly Request[] = ['on', 'off', 'pause', 'resume', 'status', 'explain', 'settings', 'questions', 'working', 'forget', 'license', 'update', 'uninstall', 'debug', 'help']

export type Parsed = {
  request: Request
  /** What followed the first word. */
  rest: string
  /** The first word when it is not a request, in which case `request` is `help`. */
  unknown?: string
}

/** What `/bsd <args>` asks for. No argument means on. */
export function parseRequest(args: string): Parsed {
  const [first = '', ...others] = args.trim().split(/\s+/)
  const word = first.toLowerCase()
  const rest = others.join(' ')
  if (word === '') return { request: 'on', rest }
  const request = WORDS.find(known => known === word)

  return request === undefined ? { request: 'help', rest, unknown: first } : { request, rest }
}

export function isModeRequest(request: Request): request is ModeRequest {
  return (
    request !== 'explain' &&
    request !== 'settings' &&
    request !== 'questions' &&
    request !== 'working' &&
    request !== 'forget' &&
    request !== 'license' &&
    request !== 'update' &&
    request !== 'uninstall' &&
    request !== 'debug' &&
    request !== 'help'
  )
}

/** Every command and key, as `/bsd help` prints it. */
export const HELP = [
  'A tutor that reviews your code while you write it yourself.',
  '',
  '  /bsd             turn it on (also /backseat-driver)',
  '  /bsd off         turn it off: Claude Code is back to normal',
  '  /bsd pause       stop the background commentary and keep the pane',
  '  /bsd resume      carry on',
  '  /bsd status      whether it is on, its voice and its engineering persona',
  '  /bsd explain     explain a spot in the code: /bsd explain src/app.py:42',
  '  /bsd settings    change its settings in the pane, as in /config',
  '  /bsd questions   answer the first-run questions again',
  '  /bsd working     say what you are working on: /bsd working on the parser',
  '                   /bsd working clear lets it work that out again',
  '  /bsd forget      erase what it remembers: this project, one language, or everything',
  '  /bsd license     personal or commercial use: /bsd license personal, commercial, <key>, clear',
  '  /bsd update      fetch the newest release (also /backseat-driver-update)',
  '  /bsd uninstall   remove the plugin, and erase what it remembers if you say so',
  '  /bsd debug       log everything the tutor does to a file: /bsd debug on, off, status, dump, clear',
  '  /bsd help        this list',
  '',
  'In the pane. Ctrl+X Tab or a click gives it the keyboard, and Esc gives it back:',
  '  1 2 3 4 5 switch tabs: 5 is Settings, where a pick and Enter changes one',
  '  e d m     explain, dismiss or mute the selected note',
  '  l         look at your changes now',
  '  r         run a deep review now',
  '  n p e     in Explain: next symbol, previous symbol, ask about this one',
  '  w         say what you are working on',
  '  q         answer the questions again',
  '',
  'Models, thinking levels, pacing, the voice and the engineering persona are in the Settings tab, and in /config: search for "backseat".',
].join('\n')

/** What `/bsd settings` says while the tutor is off, when there is no pane to show them in. */
export const SETTINGS_OFF = 'Backseat Driver is off. Its settings are in /config (search for "backseat"), or run /bsd and press 5 in the pane.'

/** What `/bsd help` prints, with a first line about a word that is not a command. */
export function helpText(unknown?: string): string {
  return unknown === undefined ? HELP : `There is no /bsd ${unknown}.\n\n${HELP}`
}

/** The mode a request leads to from `from`, and the line the command prints. */
export function transition(from: Mode, request: ModeRequest): { to: Mode; text: string } {
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
  }
}
