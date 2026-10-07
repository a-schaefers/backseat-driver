import type { Mode } from '../types'

/** The requests that change or report the mode. */
export type ModeRequest = 'on' | 'off' | 'pause' | 'resume' | 'status'

/** Everything `/backseat <word>` can ask for. */
export type Request = ModeRequest | 'explain' | 'settings' | 'questions' | 'working' | 'forget' | 'license' | 'update' | 'uninstall' | 'debug' | 'help'

const WORDS: readonly Request[] = ['on', 'off', 'pause', 'resume', 'status', 'explain', 'settings', 'questions', 'working', 'forget', 'license', 'update', 'uninstall', 'debug', 'help']

export type Parsed = {
  request: Request
  /** What followed the first word. */
  rest: string
  /** The first word when it is not a request, in which case `request` is `help`. */
  unknown?: string
}

/** What `/backseat <args>` asks for. No argument means on. */
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

/** Every command and key, as `/backseat help` prints it. */
/** Said once when the folder the tutor was switched on in becomes a repository (the owner's `git init` after `/backseat`, 2026-10-06). */
export const REPOSITORY_APPEARED = 'A git repository appeared here. Backseat Driver is watching it now.'

export const HELP = [
  'A tutor that reviews your code while you write it yourself.',
  '',
  '  /backseat             turn it on',
  '  /backseat off         turn it off: Claude Code is back to normal',
  '  /backseat pause       stop the background commentary and keep the notes',
  '  /backseat resume      carry on',
  '  /backseat status      whether it is on, its voice and its engineering persona',
  '  /backseat explain     explain a spot in the code: /backseat explain src/app.py:42',
  '  /backseat settings    change its settings in the pane, as in /config',
  '  /backseat questions   answer the first-run questions again',
  '  /backseat working     say what you are working on: /backseat working on the parser',
  '                        /backseat working clear lets it work that out again',
  '  /backseat forget      erase what it remembers: this project, one language, or everything',
  '  /backseat license     personal or commercial use: /backseat license personal, commercial, <key>, clear',
  '  /backseat update      fetch the newest release',
  '  /backseat uninstall   remove the plugin, and erase what it remembers if you say so',
  '  /backseat debug       log everything the tutor does to a file: /backseat debug on, off, status, dump, clear',
  '  /backseat help        this list',
  '',
  'In the tutor. Ctrl+X Tab or a click gives it the keyboard, and Esc gives it back:',
  '  1 to 6    switch tabs: 4 Growth, 5 Lessons, 6 Settings, where a row opens its options',
  '  x         put the pane away as a strip above the prompt; a click on the strip, or /backseat, brings it back',
  '  j k       next note, previous note',
  '  e d m     explain, dismiss or mute the selected note',
  '  l         look at your changes now',
  '  r         run a deep review now',
  '  a v       in Deep review: audit the whole codebase now, show the map of the project',
  '  j k e d o in Deep review: next issue, previous, ask about it, dismiss it, open it in the editor',
  '  n p e     in Explain: next symbol, previous symbol, ask about this one',
  '  w         say what you are working on',
  '  q         answer the questions again',
  '  s c b     in Lessons: start the next step, mark it done yourself, back to the list',
  '',
  'The models, thinking levels, pacing, the voice and the engineering persona are in the Settings tab, and in /config: search for "backseat".',
].join('\n')

/** What `/backseat settings` says while the tutor is off, when there is no pane to show them in. */
export const SETTINGS_OFF = 'Backseat Driver is off. Its settings are in /config (search for "backseat"), or run /backseat and press 6 in the tutor.'

/** What `/backseat help` prints, with a first line about a word that is not a command. */
export function helpText(unknown?: string): string {
  return unknown === undefined ? HELP : `There is no /backseat ${unknown}.\n\n${HELP}`
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
      if (from === 'off') return { to: 'off', text: 'Backseat Driver is off. Run /backseat to start it.' }

      return { to: 'paused', text: 'Backseat Driver is paused. Run /backseat resume to continue.' }
    case 'resume':
      if (from === 'off') return { to: 'off', text: 'Backseat Driver is off. Run /backseat to start it.' }

      return { to: 'on', text: 'Backseat Driver is on again.' }
    case 'status':
      return { to: from, text: `Backseat Driver is ${from}.` }
  }
}

