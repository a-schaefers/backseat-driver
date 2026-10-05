// Draws the persona art as it shows in a terminal, for whoever is editing it.
//   npm run persona -- [out folder] [voice]
// prints each character in truecolor half blocks, and writes one PNG per
// character: its four poses on a dark and on a light background, then the rest
// pose dimmed as it is for that background, each pixel drawn as a square of SCALE pixels.
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

import { cellWords, dimmed, pixels, type Pixel, type SpriteArt } from '../plugin/hooks/sprite.ts'

const POSES = ['rest', 'talk', 'blink', 'think'] as const
const SCALE = 10
const GAP = 4
const BACKGROUNDS = [
  { color: 0x1e1e1e, backdrop: 'dark' },
  { color: 0xf5f5f5, backdrop: 'light' },
] as const

function ansi(grid: Pixel[][]): string {
  const words = cellWords(grid)
  const columns = grid[0]?.length ?? 0
  const lines: string[] = []
  for (let at = 0; at < words.length; at += columns * 3) {
    let line = ''
    for (let cell = at; cell < at + columns * 3; cell += 3) {
      const [code, fg, bg] = [words[cell]!, words[cell + 1]!, words[cell + 2]!]
      const color = (c: number, layer: 38 | 48) => (c === 0x01000000 ? `\x1b[${layer + 1}m` : `\x1b[${layer};2;${(c >> 16) & 255};${(c >> 8) & 255};${c & 255}m`)
      line += `${color(fg, 38)}${color(bg, 48)}${String.fromCodePoint(code)}`
    }
    lines.push(`${line}\x1b[0m`)
  }

  return lines.join('\n')
}

function crc32(bytes: Uint8Array): number {
  let crc = ~0
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }

  return ~crc >>> 0
}

function png(width: number, height: number, rgb: Uint8Array): Buffer {
  const chunk = (type: string, data: Uint8Array) => {
    const body = Buffer.concat([Buffer.from(type), data])
    const out = Buffer.alloc(body.length + 8)
    out.writeUInt32BE(data.length, 0)
    body.copy(out, 4)
    out.writeUInt32BE(crc32(body), body.length + 4)

    return out
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header.set([8, 2, 0, 0, 0], 8)
  const raw = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y += 1) raw.set(rgb.subarray(y * width * 3, (y + 1) * width * 3), y * (width * 3 + 1) + 1)

  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array())])
}

const out = process.argv[2] ?? 'local/persona-preview'
mkdirSync(out, { recursive: true })
const folder = new URL('../plugin/hooks/art/', import.meta.url)
const only = process.argv[3]
for (const file of readdirSync(folder).filter(name => name.endsWith('.ts')).sort()) {
  const voice = file.replace(/\.ts$/, '')
  if (only !== undefined && voice !== only) continue
  const art = ((await import(new URL(file, folder).href)) as { default: SpriteArt }).default
  for (const [index, row] of art.rest.entries()) if (row.length !== art.rest[0]!.length) console.log(`${voice}: row ${index} is ${row.length} wide`)
  for (const pose of ['talk', 'blink', 'think'] as const) for (const [index, row] of Object.entries(art[pose] ?? {})) if (row.length !== art.rest[0]!.length) console.log(`${voice} ${pose}: row ${index} is ${row.length} wide`)
  const grids = POSES.map(pose => pixels(art, pose))
  const width = art.rest[0]!.length
  const height = art.rest.length
  const panels = [...grids, grids[0]!]
  const imageWidth = (panels.length * (width + GAP) + GAP) * SCALE
  const imageHeight = (BACKGROUNDS.length * (height + GAP) + GAP) * SCALE
  const rgb = new Uint8Array(imageWidth * imageHeight * 3).fill(0x80)
  BACKGROUNDS.forEach(({ color: background, backdrop }, band) => {
    panels.forEach((grid, panel) => {
      const isDim = panel === panels.length - 1
      for (let y = -1; y <= height; y += 1) {
        for (let x = -1; x <= width; x += 1) {
          const pixel = grid[y]?.[x] ?? null
          const color = pixel === null ? background : isDim ? dimmed(pixel, backdrop) : pixel
          for (let dy = 0; dy < SCALE; dy += 1) {
            for (let dx = 0; dx < SCALE; dx += 1) {
              const px = ((panel * (width + GAP) + GAP + x) * SCALE + dx) as number
              const py = ((band * (height + GAP) + GAP + y) * SCALE + dy) as number
              rgb.set([(color >> 16) & 255, (color >> 8) & 255, color & 255], (py * imageWidth + px) * 3)
            }
          }
        }
      }
    })
  })
  writeFileSync(`${out}/${voice}.png`, png(imageWidth, imageHeight, rgb))
  console.log(`${voice} (${width}x${height / 2} cells)`)
  console.log(grids.map(ansi).join('\n\n'))
}
