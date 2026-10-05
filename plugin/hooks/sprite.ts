/**
 * Pixel art for the animated persona, drawn into terminal cells: each cell
 * holds two pixels, one above the other, as an upper half block with the top
 * pixel for its color and the bottom pixel for its background. The art itself
 * lives in `art/`, one file per character. Everything here is plain values.
 */
import type { Pose } from './avatar'

/**
 * One character's pixel art, as an artist edits it.
 *
 * `rest` is the whole picture, one string per row of pixels, every row the
 * same length and an even number of rows. Each letter is a color from
 * `palette`; `.` is see-through. The other poses give only the rows that
 * differ from `rest`, by row number from 0.
 */
export type SpriteArt = {
  palette: Readonly<Record<string, number>>
  rest: readonly string[]
  talk?: Readonly<Record<number, string>>
  blink?: Readonly<Record<number, string>>
  think?: Readonly<Record<number, string>>
  /** The row of cells (two rows of pixels each, from 0) the speech bubble's tail points at. */
  mouth: number
}

/** A color, `0xRRGGBB`, or null for see-through. */
export type Pixel = number | null

/** A Raster cell's color for the terminal's own background. */
const DEFAULT_COLOR = 0x01000000
const UPPER_HALF = 0x2580
const LOWER_HALF = 0x2584
const SPACE = 0x20

/** The picture in one pose, as rows of pixels. */
export function poseGrid(art: SpriteArt, pose: Pose): readonly string[] {
  const changes = pose === 'rest' ? undefined : art[pose]

  return art.rest.map((row, index) => changes?.[index] ?? row)
}

/** The rows of pixels as colors. An unknown letter is see-through, as `.` is. */
export function pixels(art: SpriteArt, pose: Pose): Pixel[][] {
  return poseGrid(art, pose).map(row => [...row].map(letter => art.palette[letter] ?? null))
}

/** How many terminal cells the picture takes. */
export function spriteSize(art: SpriteArt): { columns: number; rows: number } {
  return { columns: art.rest[0]?.length ?? 0, rows: Math.ceil(art.rest.length / 2) }
}

/** Whether the terminal's background is dark or light, as the theme says. */
export type Backdrop = 'dark' | 'light'

/** The theme's backdrop from its name in `/config` (`dark`, `light-daltonized`, ...). Unknown is dark. */
export function backdropOf(theme: unknown): Backdrop {
  return typeof theme === 'string' && theme.includes('light') ? 'light' : 'dark'
}

/**
 * A color taken down for a character at rest, as dim text is: greyer, and
 * nearer the background, so that it steps back on a dark terminal and on a
 * light one alike. A Raster has no dim of its own.
 */
export function dimmed(color: number, backdrop: Backdrop = 'dark'): number {
  const r = (color >> 16) & 0xff
  const g = (color >> 8) & 0xff
  const b = color & 0xff
  const grey = (r + g + b) / 3
  const fade =
    backdrop === 'dark'
      ? (value: number) => Math.round((value * 0.4 + grey * 0.6) * 0.75)
      : (value: number) => Math.round((value * 0.45 + grey * 0.55) * 0.65 + 0xf5 * 0.35)

  return (fade(r) << 16) | (fade(g) << 8) | fade(b)
}

/**
 * The picture as Raster cells: for each cell, its character, foreground and
 * background, row by row. A cell with only its bottom pixel drawn is a lower
 * half block over the terminal's own background, and a cell with neither is
 * a space, so the art stands on whatever the terminal's background is.
 * `dim` names the backdrop to dim it for, or is null for full color.
 */
export function cellWords(grid: readonly (readonly Pixel[])[], dim: Backdrop | null = null): Uint32Array {
  const shade = (pixel: Pixel) => (pixel === null ? null : dim !== null ? dimmed(pixel, dim) : pixel)
  const columns = grid[0]?.length ?? 0
  const rows = Math.ceil(grid.length / 2)
  const words = new Uint32Array(columns * rows * 3)
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const top = shade(grid[row * 2]?.[column] ?? null)
      const bottom = shade(grid[row * 2 + 1]?.[column] ?? null)
      const at = (row * columns + column) * 3
      if (top === null && bottom === null) words.set([SPACE, DEFAULT_COLOR, DEFAULT_COLOR], at)
      else if (top === null) words.set([LOWER_HALF, bottom ?? DEFAULT_COLOR, DEFAULT_COLOR], at)
      else words.set([UPPER_HALF, top, bottom ?? DEFAULT_COLOR], at)
    }
  }

  return words
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** Standard padded base64, which is what a Raster's `cells` are. */
export function base64(bytes: Uint8Array): string {
  let text = ''
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index] ?? 0
    const b = bytes[index + 1] ?? 0
    const c = bytes[index + 2] ?? 0
    const triple = (a << 16) | (b << 8) | c
    text += BASE64[(triple >> 18) & 63]
    text += BASE64[(triple >> 12) & 63]
    text += index + 1 < bytes.length ? BASE64[(triple >> 6) & 63] : '='
    text += index + 2 < bytes.length ? BASE64[triple & 63] : '='
  }

  return text
}

/** Little-endian bytes of the words, whatever this machine's own order. */
function littleEndian(words: Uint32Array): Uint8Array {
  const bytes = new Uint8Array(words.length * 4)
  const view = new DataView(bytes.buffer)
  words.forEach((word, index) => view.setUint32(index * 4, word, true))

  return bytes
}

const drawn = new WeakMap<SpriteArt, Map<string, string>>()

/** A Raster's `cells` for the character in a pose, dimmed for a backdrop or not. Worked out once per character and pose. */
export function rasterCells(art: SpriteArt, pose: Pose, dim: Backdrop | null): string {
  const poses = drawn.get(art) ?? new Map<string, string>()
  drawn.set(art, poses)
  const key = `${pose}:${dim}`
  const known = poses.get(key)
  if (known !== undefined) return known
  const cells = base64(littleEndian(cellWords(pixels(art, pose), dim)))
  poses.set(key, cells)

  return cells
}
