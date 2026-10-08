/**
 * What the tutor says it is showing, for whoever checks it against the
 * screen (`scripts/jack.py`, with the debug log on).
 *
 * Part of the Claude Code adapter: it reads Claude Code's element tree
 * (`Text`, `Button` with its `hotkey`, `Markdown`, `Select`, `Raster`).
 *
 * A drawing is a tree of elements handed to Claude Code. Whether it reached
 * the screen is not something the mod can see: a pane can be open and never
 * placed, and a session can go on drawing in a process nobody is looking at.
 * So the mod writes down what it drew, as the pieces of text a person would
 * read, and the checker looks for them where the person is looking.
 */

/** One drawing, as last handed over. */
export type Shown = {
  /** When, in milliseconds since the epoch. */
  at: number
  /** `dock` or `inline` for the pane. '' above the prompt, where there is one place. */
  placement: string
  columns: number
  rows: number
  isFocused: boolean
  isCompact: boolean
  /** The pieces of text in it, in the order drawn. */
  texts: string[]
  /** The window over it where the surface says: the first row on the screen (0 at the top) and the rows it may show. */
  scroll?: { offset: number; bodyRows: number }
  /** The rows j and k walk, by key, in the order drawn (`rowKeysOf`). */
  rowKeys?: string[]
  /** The row j and k last put the focus ring on, on the tab drawn, and when; absent when none. */
  ring?: { key: string; at: number }
}

function inline(value: unknown): string {
  if (value === null || value === undefined || typeof value === 'boolean') return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.map(inline).join('')
  if (typeof value !== 'object') return ''

  return inline((value as { children?: unknown }).children)
}

function tidy(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * The pieces of text in a drawing, in the order drawn: each `Text`, each
 * button's label (with its key, where it is drawn with one), each line of a
 * `Markdown`, each pick as "label: value". Pictures say nothing.
 */
export function textsOf(tree: unknown): string[] {
  const texts: string[] = []
  const push = (text: string): void => {
    const piece = tidy(text)
    if (piece !== '') texts.push(piece)
  }
  const walk = (node: unknown): void => {
    if (node === null || node === undefined || typeof node === 'boolean') return
    if (typeof node === 'string' || typeof node === 'number') return push(String(node))
    if (Array.isArray(node)) return node.forEach(walk)
    if (typeof node !== 'object') return
    const { type, props, children } = node as { type?: unknown; props?: unknown; children?: unknown }
    const given = (typeof props === 'object' && props !== null ? props : {}) as Record<string, unknown>
    if (type === 'Text') return push(inline(children))
    if (type === 'Button') {
      const label = typeof given.label === 'string' ? given.label : ''

      return push(typeof given.hotkey === 'string' && given.plain === true ? `${given.hotkey}: ${label}` : label)
    }
    if (type === 'Markdown') return String(given.text ?? '').split('\n').forEach(push)
    if (type === 'Select') return push(`${String(given.label ?? '')}: ${String(given.value ?? '')}`)
    if (type === 'Raster' || type === 'Image') return

    return walk(children)
  }
  walk(tree)

  return texts
}

/**
 * The keys of the rows a drawing lists, in the order drawn: every Button
 * without a hotkey. A keyed control is pressed by its key; everything else is
 * a row j and k put the ring on, for Enter to press (2026-10-07).
 */
export function rowKeysOf(tree: unknown): string[] {
  const keys: string[] = []
  const walk = (node: unknown): void => {
    if (node === null || node === undefined || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(walk)
    const { type, props, children } = node as { type?: unknown; props?: unknown; children?: unknown }
    const given = (typeof props === 'object' && props !== null ? props : {}) as Record<string, unknown>
    if (type === 'Button') {
      if (typeof given.hotkey !== 'string' && typeof given.key === 'string' && given.key !== '') keys.push(given.key)

      return
    }
    walk(children)
  }
  walk(tree)

  return keys
}

/** Whether two drawings say the same. */
/** The spinner behind a tab at work, at any tick, read as its first frame: a drawing a tick later is the same drawing. */
function despun(text: string): string {
  return text.replace(/(?<=\s)[✢✳✶✻✽](?=\s|$)/g, '·')
}

export function isSameShown(one: Shown | null, other: Shown | null): boolean {
  if (one === null || other === null) return one === other

  // The spinner's frames apart: logging a `shown` record for every one made forty-five records in half a minute (the third ui-truth pass, 2026-10-06).
  return one.placement === other.placement && one.columns === other.columns && one.isFocused === other.isFocused && despun(one.texts.join('\n')) === despun(other.texts.join('\n'))
}
