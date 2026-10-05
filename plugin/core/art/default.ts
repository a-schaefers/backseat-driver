import type { SpriteArt } from '../sprite'

/**
 * Claude Code's own mascot, pixel for pixel its block drawing (` ▐▛███▜▌ `,
 * `▝▜█████▛▘`, `  ▘▘ ▝▝  `): an orange body with two eyes, arms at the
 * sides, four short legs.
 *
 * Each letter is a color from the palette and `.` is see-through; two rows of
 * pixels make one row of terminal cells. Preview with `npm run persona`.
 */
const art: SpriteArt = {
  palette: {
    O: 0xd97757, // body
    o: 0xe89a7e, // body, lit
    d: 0xb85e42, // body, shaded
    K: 0x2a1a14, // eye
  },
  // prettier-ignore
  rest: [
    '..oooooooooooo..', // 0
    '..OOOOOOOOOOOO..', // 1
    '..OOKOOOOOOKOO..', // 2
    '..OOKOOOOOOKOO..', // 3
    'dOOOOOOOOOOOOOOd', // 4
    'dOOOOOOOOOOOOOOd', // 5
    '..OOOOOOOOOOOO..', // 6
    '..dddddddddddd..', // 7
    '...d.d....d.d...', // 8
    '...d.d....d.d...', // 9
  ],
  talk: {
    2: '..OOKOOOOOOKOO.d',
    3: '..OOKOOOOOOKOOOd',
    4: 'dOOOOOOOOOOOOO..',
    5: 'dOOOOOOOOOOOOO..',
  },
  blink: {
    2: '..OOOOOOOOOOOO..',
    3: '..OKKOOOOOOKKO..',
  },
  think: {
    1: '..OOKOOOOOOKOO..',
    3: '..OOOOOOOOOOOO..',
  },
  mouth: 2,
}

export default art
