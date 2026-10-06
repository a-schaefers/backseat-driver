import { lessonsDir, profilePath, progressPath, projectDir, REMOVABLE } from './datahome'
import { languageName } from './languages'
import { backupPath, brokenPath } from './store'

/** What can be forgotten: one project's cache, one language's record of the person, or all of it. */
export type Scope = { kind: 'project' } | { kind: 'language'; language: string } | { kind: 'everything' }

/** What `/backseat forget <rest>` names, or null when it names nothing and the person has to be asked. */
export function parseScope(rest: string): Scope | null {
  const word = rest.trim().toLowerCase()
  if (word === '') return null
  if (word === 'project' || word === 'this project') return { kind: 'project' }
  if (word === 'everything' || word === 'all') return { kind: 'everything' }

  return { kind: 'language', language: word }
}

export const SCOPE_QUESTION = 'What should be forgotten?'
export const SCOPE_PROJECT = 'This project: its journal and cache'
export const SCOPE_LANGUAGE = 'One language: its profile and progress'
export const SCOPE_EVERYTHING = 'Everything'
export const LANGUAGE_QUESTION = 'Which language? Type its name if it is not listed.'

/** The two answers to "are you sure". Keeping comes first, so it is what Enter chooses. */
export const KEEP = 'Keep it'
export const FORGET = 'Forget it'

/** Forgetting everything also takes these words, typed out. */
export const PHRASE = 'forget everything'
export const PHRASE_QUESTION = `This erases every profile, every progress record and every project's journal and cache. Type "${PHRASE}" to go ahead.`
export const PHRASE_OPTIONS = ['Keep everything', 'Cancel'] as const

export function isPhrase(answer: string): boolean {
  return answer.trim().toLowerCase() === PHRASE
}

/** The scope the person picked from the first question, or null for anything else. */
export function scopeOf(answer: string): Scope['kind'] | null {
  if (answer === SCOPE_PROJECT) return 'project'
  if (answer === SCOPE_LANGUAGE) return 'language'
  if (answer === SCOPE_EVERYTHING) return 'everything'

  return null
}

/** What a scope covers, in the words the confirmation and the result use. */
export function describeScope(scope: Scope, projectName: string): string {
  switch (scope.kind) {
    case 'project':
      return `the journal and cache of this project (${projectName})`
    case 'language':
      return `your ${languageName(scope.language)} profile and progress`
    case 'everything':
      return "every profile, every progress record and every project's journal and cache"
  }
}

export function confirmQuestion(scope: Scope, projectName: string): string {
  return `Forget ${describeScope(scope, projectName)}? This cannot be undone.`
}

/** The files and folders a scope deletes. `repoRoot` is '' outside a repository, where there is no project. */
export function scopePaths(root: string, repoRoot: string, scope: Scope): string[] {
  switch (scope.kind) {
    case 'project':
      return repoRoot === '' ? [] : [projectDir(root, repoRoot)]
    case 'language':
      // With each file go the copies the store keeps beside it.
      // The lessons of the language are part of its progress.
      return [
        ...[profilePath(root, scope.language), progressPath(root, scope.language)].flatMap(path => [path, backupPath(path), brokenPath(path)]),
        lessonsDir(root, scope.language),
      ]
    case 'everything':
      return REMOVABLE.map(name => `${root}/${name}`)
  }
}

/** The language ids on record, from the names of the files that hold them. */
export function knownLanguages(files: readonly string[]): string[] {
  const ids = files.filter(name => name.endsWith('.json')).map(name => name.slice(0, -'.json'.length))

  return [...new Set(ids)].filter(id => id !== 'general').sort()
}
