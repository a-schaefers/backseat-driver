/**
 * How a character is drawn, at the best the surface allows: truecolor pixel
 * art where the terminal's Raster is there, the plain-text drawing where it
 * is not. A layout calls `characterArt` and puts the result where it likes;
 * the speech bubble beside it is the layout's.
 */
import type { Elements } from 'claude-code'

import type { Avatar, Pose } from '../core/avatar'
import { rasterCells, spriteSize } from '../core/sprite'
import type { Backdrop } from '../core/sprite'

/** The elements a character is drawn with. `Raster` only the terminal has. */
export type CharacterKit = Pick<Elements['terminal'], 'Box' | 'Text'> & { Raster?: Elements['terminal']['Raster'] }

/** The drawing's size in cells, and the row its speech bubble's tail points at. */
export type ArtShape = { columns: number; rows: number; mouth: number }

/** How the character will be drawn with this kit: in pixels when it can be. */
export function artShape(kit: CharacterKit, avatar: Avatar): ArtShape {
  if (kit.Raster !== undefined) return { ...spriteSize(avatar.art), mouth: avatar.art.mouth }

  return { columns: avatar.frames.rest[0]?.length ?? 0, rows: avatar.frames.rest.length, mouth: avatar.mouth }
}

/** The character in a pose, dim while it rests. Pixels are dimmed toward the terminal's background, which the theme says. */
export function characterArt(kit: CharacterKit, avatar: Avatar, pose: Pose, isResting: boolean, backdrop: Backdrop = 'dark') {
  const { Box, Text, Raster } = kit
  if (Raster !== undefined) {
    const { columns, rows } = spriteSize(avatar.art)

    return <Raster key="persona" columns={columns} rows={rows} cells={rasterCells(avatar.art, pose, isResting ? backdrop : null)} />
  }

  return (
    <Box flexDirection="column">
      {avatar.frames[pose].map(line => (
        <Text color={avatar.color} dimColor={isResting} wrap="truncate-end">
          {line}
        </Text>
      ))}
    </Box>
  )
}
