/** A run of changed lines with its surrounding context, as in a unified diff. */
export type Hunk = {
  /** 1-based first line in the old and the new text, and how many lines each side spans. */
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  /** Each line prefixed with ' ' (context), '-' (removed) or '+' (added). */
  lines: string[]
}

type Op = { kind: ' ' | '-' | '+'; text: string }

/** Above this many cells the table is not built, and the whole middle counts as replaced. */
const MAX_CELLS = 4_000_000

export function splitLines(text: string): string[] {
  if (text === '') return []
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  // A final newline ends the last line. It does not start an empty one.
  if (lines[lines.length - 1] === '') lines.pop()

  return lines
}

/** The edit script between two line lists, by longest common subsequence. */
function editScript(before: readonly string[], after: readonly string[]): Op[] {
  let start = 0
  while (start < before.length && start < after.length && before[start] === after[start]) start += 1
  let endBefore = before.length
  let endAfter = after.length
  while (endBefore > start && endAfter > start && before[endBefore - 1] === after[endAfter - 1]) {
    endBefore -= 1
    endAfter -= 1
  }

  const a = before.slice(start, endBefore)
  const b = after.slice(start, endAfter)
  const ops: Op[] = before.slice(0, start).map(text => ({ kind: ' ', text }))

  if (a.length * b.length > MAX_CELLS) {
    for (const text of a) ops.push({ kind: '-', text })
    for (const text of b) ops.push({ kind: '+', text })
  } else {
    // lengths[i][j]: the longest common subsequence of a[i..] and b[j..].
    const width = b.length + 1
    const lengths = new Uint32Array((a.length + 1) * width)
    for (let i = a.length - 1; i >= 0; i -= 1) {
      for (let j = b.length - 1; j >= 0; j -= 1) {
        lengths[i * width + j] =
          a[i] === b[j]
            ? (lengths[(i + 1) * width + j + 1] ?? 0) + 1
            : Math.max(lengths[(i + 1) * width + j] ?? 0, lengths[i * width + j + 1] ?? 0)
      }
    }
    let i = 0
    let j = 0
    while (i < a.length && j < b.length) {
      const left = a[i] ?? ''
      const right = b[j] ?? ''
      if (left === right) {
        ops.push({ kind: ' ', text: left })
        i += 1
        j += 1
      } else if ((lengths[(i + 1) * width + j] ?? 0) >= (lengths[i * width + j + 1] ?? 0)) {
        ops.push({ kind: '-', text: left })
        i += 1
      } else {
        ops.push({ kind: '+', text: right })
        j += 1
      }
    }
    for (; i < a.length; i += 1) ops.push({ kind: '-', text: a[i] ?? '' })
    for (; j < b.length; j += 1) ops.push({ kind: '+', text: b[j] ?? '' })
  }

  for (const text of before.slice(endBefore)) ops.push({ kind: ' ', text })

  return ops
}

/** The changes from `before` to `after`, grouped into hunks with `context` unchanged lines around each. */
export function diffLines(before: string, after: string, context = 3): Hunk[] {
  const ops = editScript(splitLines(before), splitLines(after))
  const hunks: Hunk[] = []
  let oldLine = 1
  let newLine = 1
  let current: Hunk | null = null
  /** Unchanged lines seen since the last change inside the current hunk. */
  let trailing = 0

  for (let index = 0; index < ops.length; index += 1) {
    const op = ops[index]
    if (op === undefined) continue

    if (op.kind === ' ') {
      if (current !== null) {
        if (trailing < context) {
          current.lines.push(` ${op.text}`)
          current.oldLines += 1
          current.newLines += 1
          trailing += 1
        } else {
          // Close the hunk unless another change follows within reach of its context.
          const reach = ops.slice(index, index + context + 1)
          if (reach.some(next => next.kind !== ' ')) {
            current.lines.push(` ${op.text}`)
            current.oldLines += 1
            current.newLines += 1
          } else {
            hunks.push(current)
            current = null
          }
        }
      }
      oldLine += 1
      newLine += 1
      continue
    }

    if (current === null) {
      const lead = ops
        .slice(Math.max(0, index - context), index)
        .filter(previous => previous.kind === ' ')
        .map(previous => ` ${previous.text}`)
      current = {
        oldStart: oldLine - lead.length,
        oldLines: lead.length,
        newStart: newLine - lead.length,
        newLines: lead.length,
        lines: lead,
      }
    }
    trailing = 0
    current.lines.push(`${op.kind}${op.text}`)
    if (op.kind === '-') {
      current.oldLines += 1
      oldLine += 1
    } else {
      current.newLines += 1
      newLine += 1
    }
  }
  if (current !== null) hunks.push(current)

  return hunks
}

/** Hunks as unified diff text, without the file header. */
export function formatHunks(hunks: readonly Hunk[]): string {
  return hunks
    .map(hunk =>
      [`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`, ...hunk.lines].join('\n'),
    )
    .join('\n')
}
