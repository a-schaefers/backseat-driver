/**
 * Opening a place in the person's own editor (owner, 2026-10-05): the
 * `editor_command` setting is a command line with `{file}`, `{line}` and
 * `{column}` in it, such as `emacsclient -n +{line} {file}` or
 * `code --goto {file}:{line}`. This file turns it into an argv for one place.
 * Running it is the adapter's.
 */

export type Place = { file: string; line: number; column?: number }

/** The placeholders a command may carry. A command with none of them gets `+{line} {file}` appended: the vi and Emacs convention. */
export const PLACEHOLDERS = ['{file}', '{line}', '{column}'] as const

/**
 * Splits a command line the way a shell would, as far as quotes go: single
 * quotes keep everything, double quotes keep everything but let `\"` through,
 * a backslash escapes the next character outside quotes. No expansion of
 * anything else: the command runs as given, nothing passes through a shell.
 */
export function splitCommand(command: string): string[] {
  const words: string[] = []
  let word = ''
  let isInWord = false
  let quote: '"' | "'" | null = null
  for (let index = 0; index < command.length; index += 1) {
    const char = command[index] ?? ''
    if (quote === "'") {
      if (char === "'") quote = null
      else word += char
    } else if (quote === '"') {
      if (char === '"') quote = null
      else if (char === '\\' && (command[index + 1] === '"' || command[index + 1] === '\\')) {
        word += command[index + 1]
        index += 1
      } else word += char
    } else if (char === "'" || char === '"') {
      quote = char
      isInWord = true
    } else if (char === '\\' && index + 1 < command.length) {
      word += command[index + 1]
      index += 1
      isInWord = true
    } else if (/\s/.test(char)) {
      if (isInWord) words.push(word)
      word = ''
      isInWord = false
    } else {
      word += char
      isInWord = true
    }
  }
  if (isInWord) words.push(word)

  return words
}

/** Whether a command names any place at all. */
export function hasPlaceholder(command: string): boolean {
  return PLACEHOLDERS.some(placeholder => command.includes(placeholder))
}

/**
 * The argv that opens `place` with `command`, or null when the command is
 * empty. Each placeholder is replaced inside its word, so `{file}:{line}` is
 * one argument; a command with no placeholder gets `+{line}` and `{file}`.
 */
export function editorArgv(command: string, place: Place): string[] | null {
  const words = splitCommand(command)
  if (words.length === 0) return null
  const template = hasPlaceholder(command) ? words : [...words, '+{line}', '{file}']

  return template.map(word =>
    word.replaceAll('{file}', place.file).replaceAll('{line}', String(place.line)).replaceAll('{column}', String(place.column ?? 1)),
  )
}
