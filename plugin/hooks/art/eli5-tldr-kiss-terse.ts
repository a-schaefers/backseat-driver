import type { SpriteArt } from '../sprite'

/**
 * Tux in a top hat, after the KISS Linux penguin. Its dark edges facing the
 * light are rimmed in slate, so that it holds up on a dark terminal.
 *
 * Each letter is a color from the palette and `.` is see-through; two rows of
 * pixels make one row of terminal cells. Preview with `npm run persona`.
 */
const art: SpriteArt = {
  palette: {
    K: 0x0a0a0c, k: 0x5a6078, // outline
    Z: 0x2e2e36, // hat
    z: 0x6a6a78, // hat, lit
    R: 0x8a4fd0, // hat band
    X: 0x18181c, // head and back
    x: 0x3c3c48, // head, lit
    W: 0xf4f4f0, // face and belly
    w: 0xc8c8cc, // belly, shaded
    P: 0x111111, // pupil
    Y: 0xf2b632, // beak and feet
    y: 0xc98a1a, // beak, shaded
  },
  // prettier-ignore
  rest: [
    '......kkkkkkkk......', // 0
    '.....KZzZZZZzZK.....', // 1
    '.....KZzZZZZzZK.....', // 2
    '.....KZZZZZZZZK.....', // 3
    '.....KRRRRRRRRK.....', // 4
    '...kkZZZZZZZZZZKK...', // 5
    '....kXXXXXXXXXXK....', // 6
    '...kXxXXXXXXXXxXK...', // 7
    '...KXWWWXXXXWWWXK...', // 8
    '...KXWPWXXXXWPWXK...', // 9
    '...KXXWYYYYYYWXXK...', // 10
    '...KXWWWyyyyWWWXK...', // 11
    '..kXXWWWWWWWWWWXXK..', // 12
    '..KXWWWWWWWWWWWWXK..', // 13
    '.kXXWWWWWWWWWWWWXXK.', // 14
    '.KXXWWWWWWWWWWWWXXK.', // 15
    '..KXwWWWWWWWWWWwXK..', // 16
    '...KXwwWWWWWWwwXK...', // 17
    '...KYYYYKKKKYYYYK...', // 18
    '..KYYYYK....KYYYYK..', // 19
  ],
  talk: {
    11: '...KXWWWPPPPWWWXK...',
    12: '..KXXWWWyyyyWWWXXK..',
  },
  blink: {
    8: '...KXXWXXXXXXWXXK...',
    9: '...KXWXWXXXXWXWXK...',
  },
  think: {
    8: '...KXWPWXXXXWPWXK...',
    9: '...KXWWWXXXXWWWXK...',
  },
  mouth: 5,
}

export default art
