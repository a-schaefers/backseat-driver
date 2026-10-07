/** Files whose changes are never worth a tutor's comment. */

const LOCK_FILES = new Set([
  'package-lock.json',
  'npm-shrinkwrap.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lock',
  'bun.lockb',
  'Cargo.lock',
  'poetry.lock',
  'Pipfile.lock',
  'uv.lock',
  'composer.lock',
  'Gemfile.lock',
  'go.sum',
  'flake.lock',
  'mix.lock',
  'pubspec.lock',
  'Podfile.lock',
  'packages.lock.json',
])

const GENERATED_FOLDERS = new Set([
  'node_modules',
  'vendor',
  'dist',
  'build',
  'out',
  'target',
  'coverage',
  '__pycache__',
  '.next',
  '.nuxt',
  '.venv',
  'venv',
])

const NOT_SOURCE = /\.(min\.js|min\.css|map|snap|png|jpe?g|gif|webp|ico|svg|pdf|zip|gz|tgz|bz2|xz|7z|jar|war|class|o|a|so|dylib|dll|exe|wasm|pyc|woff2?|ttf|otf|eot|mp[34]|mov|avi|sqlite3?|db|bin|lockb)$/i

/** Lock files, generated or vendored folders, and files that are not source text. */
export function isNoiseFile(path: string): boolean {
  const parts = path.split('/')
  const name = parts[parts.length - 1] ?? ''
  if (LOCK_FILES.has(name)) return true
  if (NOT_SOURCE.test(name)) return true

  return parts.slice(0, -1).some(folder => GENERATED_FOLDERS.has(folder))
}

/**
 * Where a noise file's noise begins: the generated or vendored folder it is
 * in, with its slash, or the file itself when its name is what makes it
 * noise. Never a folder above the one that is vendored, which may hold their
 * own code beside it.
 */
export function noiseRoot(path: string): string {
  const parts = path.split('/')
  const at = parts.slice(0, -1).findIndex(folder => GENERATED_FOLDERS.has(folder))

  return at === -1 ? path : `${parts.slice(0, at + 1).join('/')}/`
}

/** A committed source file larger than this is taken for vendored or generated code: hand-written code rarely reaches it. */
export const VENDORED_BYTES = 200_000

/** A line that opens with a comment, in the languages the tutor reads: `//`, `#`, `/*`, `*`, `--`, `<!--`, `;`, `%`. */
const COMMENT = /^(\/\/|#|\/\*|\*|--|<!--|;|%)/

/** Whether a line, trimmed, opens with a comment. */
export function isCommentLine(line: string): boolean {
  return COMMENT.test(line.trim())
}

/** Whether every line from `start` to `end` (1-based, inclusive) that is not blank is a comment, and one is: code commented out. */
export function isAllComment(lines: readonly string[], start: number, end: number): boolean {
  const said = lines.slice(Math.max(0, start - 1), end).filter(line => line.trim() !== '')

  return said.length > 0 && said.every(isCommentLine)
}

/** Text files do not contain NUL. */
export function looksBinary(text: string): boolean {
  return text.includes('\0')
}

/** Line endings unified, trailing whitespace and blank lines dropped. Leading whitespace stays: it can be code. */
function significant(text: string): string {
  return text
    .split(/\r?\n/)
    .map(line => line.trimEnd())
    .filter(line => line !== '')
    .join('\n')
}

/** True when the edit only touched blank lines, trailing whitespace or line endings. */
export function isTrivialChange(before: string, after: string): boolean {
  return significant(before) === significant(after)
}
