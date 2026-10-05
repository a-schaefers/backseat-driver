/**
 * The name of the definition a line sits in, so that "where they are working"
 * can be said in a word instead of a line range. There is no parser here: it
 * reads indentation and the common shapes of a definition. A wrong name is
 * worse than none, so whatever is unclear comes back as ''.
 */

/** How far above the line a definition is looked for. */
const MAX_SCAN = 400
const MAX_NAME_CHARS = 60

const NAME = '[A-Za-z_$][\\w$]*'
const MODIFIERS =
  '(?:(?:export|default|declare|pub(?:\\([^)]*\\))?|public|private|protected|internal|static|async|abstract|final|sealed|override|virtual|inline|extern|unsafe|const|open|data|partial)\\s+)*'
const KEYWORDS =
  '(?:def|defp|defmodule|class|fn|func|fun|function\\*?|struct|enum|union|trait|impl|interface|module|mod|namespace|object|record|protocol|extension|sub|proc|macro|type)'

/** `def name`, `pub fn name`, `func (r *T) Name`, `impl<T> Name`, `class Name`. */
const KEYWORD_DEFINITION = new RegExp(
  `^\\s*${MODIFIERS}${KEYWORDS}(?:\\s*<[^>]*>)?(?:\\s*\\([^)]*\\))?\\s+(${NAME}(?:(?:::|\\.)${NAME})*)`,
)

/** `const name = (a, b) => {`, `export const name = async function (`. */
const VARIABLE_FUNCTION = new RegExp(
  `^\\s*(?:export\\s+)?(?:default\\s+)?(?:const|let|var)\\s+(${NAME})\\s*(?::[^=]+)?=\\s*(?:async\\s+)?(?:function\\b|(?:\\([^)]*\\)|${NAME})\\s*(?::[^=]+?)?\\s*=>)`,
)

/** `name = (a) => {` and `name: function (` inside a class or an object. */
const MEMBER_FUNCTION = new RegExp(
  `^\\s*(?:(?:static|readonly|private|public|protected)\\s+)*(${NAME})\\s*[:=]\\s*(?:async\\s+)?(?:function\\b|\\([^)]*\\)\\s*(?::[^=]+?)?\\s*=>)`,
)

/** `int main(void) {`, `async save(user): Promise<void> {`, `name() {`: a name, its arguments, and the block opening on the same line. */
const BLOCK_DEFINITION = new RegExp(
  `^\\s*((?:[A-Za-z_$][\\w$<>\\[\\],.*&?:\\s]*?[\\s*&])?)(${NAME}(?:::~?${NAME})*)\\s*(?:<[^>]*>)?\\s*\\([^()]*(?:\\([^()]*\\)[^()]*)*\\)\\s*(?:(?::|->)\\s*[^{;=]+?|(?:const|noexcept|override|final|throws\\s+[\\w.,\\s]+?)\\s*)*\\{\\s*$`,
)

/** `(defun name`, `(defn name`, `(define (name`. */
const LISP_DEFINITION = /^\s*\((?:cl-)?def[\w-]*\*?\s+\(?([^\s()]+)/

const HEADING = /^#{1,6}\s+(.+?)\s*#*\s*$/

/** Words that open a block and look like a call. None of them names anything. */
const NOT_NAMES = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'with', 'using', 'lock', 'foreach', 'elif', 'unless', 'until',
  'synchronized', 'do', 'else', 'function', 'when', 'match', 'select', 'guard', 'repeat', 'return', 'new',
])
/** Before a name, these make the line a statement that calls something. */
const NOT_A_DEFINITION = /\b(?:new|return|throw|await|yield|else|case|delete|typeof)\b/

/** Files that are prose. Their sections are named by headings, and a keyword in them means nothing. */
const PROSE = /\.(?:md|mdx|markdown|txt|rst|org|adoc)$/i

function clip(name: string): string {
  return name.slice(0, MAX_NAME_CHARS)
}

/** The name a line of code defines, or '' when it defines nothing that can be named. */
export function definitionName(text: string): string {
  const line = text.trimEnd()
  // A line that ends a statement declares or uses something. It does not enclose anything.
  if (line.endsWith(';')) return ''

  const lisp = LISP_DEFINITION.exec(line)
  if (lisp !== null) return clip(lisp[1] ?? '')
  const keyword = KEYWORD_DEFINITION.exec(line)
  if (keyword !== null) return clip(keyword[1] ?? '')
  const variable = VARIABLE_FUNCTION.exec(line) ?? MEMBER_FUNCTION.exec(line)
  if (variable !== null) return clip(variable[1] ?? '')

  const block = BLOCK_DEFINITION.exec(line)
  if (block === null) return ''
  const name = block[2] ?? ''
  if (NOT_NAMES.has(name) || NOT_A_DEFINITION.test(block[1] ?? '')) return ''

  return clip(name)
}

function indentOf(text: string): number {
  return text.length - text.trimStart().length
}

function headingAbove(lines: readonly string[], line: number): string {
  for (let index = Math.min(line, lines.length) - 1; index >= 0; index -= 1) {
    const heading = HEADING.exec(lines[index] ?? '')
    if (heading !== null) return clip(heading[1] ?? '')
  }

  return ''
}

/**
 * The name of the definition that encloses `line` (1-based): the nearest line
 * above that is indented less and defines something. In a prose file it is
 * the nearest heading above.
 */
export function enclosingName(lines: readonly string[], line: number, path = ''): string {
  if (PROSE.test(path)) return headingAbove(lines, line)

  // Below this indentation a line is outside the block the walk started in.
  let limit = Number.POSITIVE_INFINITY
  const first = Math.min(Math.max(line, 1), lines.length) - 1
  for (let index = first; index >= 0 && first - index <= MAX_SCAN; index -= 1) {
    const text = lines[index] ?? ''
    if (text.trim() === '') continue
    const indent = indentOf(text)
    if (indent >= limit) continue

    const name = definitionName(text)
    if (name !== '') return name
    // A brace on a line of its own belongs to the line above it.
    if (text.trim() === '{') {
      const opened = definitionName(`${lines[index - 1] ?? ''} {`)
      if (opened !== '') return opened
    }
    // A signature that wraps closes on a line of its own, and its first line is above at the same depth.
    limit = /^\s*[)\]}{]/.test(text) ? indent + 1 : indent
  }

  return ''
}
