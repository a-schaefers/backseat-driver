import type { SpriteArt } from '../sprite'

/**
 * ThePrimeagen, in the spirit of: a shaved head under a headset, heavy brows,
 * the horseshoe mustache straight down to the jaw, a dark hoodie.
 *
 * Each letter is a color from the palette and `.` is see-through; two rows of
 * pixels make one row of terminal cells. Preview with `npm run persona`.
 */
const art: SpriteArt = {
  palette: {
    K: 0x16110f, // outline
    A: 0x2b2b30, // headset
    a: 0x5c5c66, // headset, lit
    Q: 0x1e1e22, // ear cup
    q: 0xc23fae, // ear cup ring
    S: 0xeec09a, // skin
    s: 0xcf9774, // skin, shaded
    T: 0xfbdcc0, // skin, lit
    h: 0x3a2618, // brows
    W: 0xf4f4f4, // eye white
    E: 0x2c3e50, // eye
    U: 0x4a2e1c, // mustache
    u: 0x6b4429, // mustache, lit
    M: 0x5e2420, // mouth
    D: 0x2e2e36, // hoodie
    d: 0x1f1f25, // hoodie, shaded
    C: 0xd8d8d8, // hoodie string
  },
  // prettier-ignore
  rest: [
    '....AAaaaaaaaaAA....', // 0
    '...AKKTTTTTTTTKKA...', // 1
    '..AKSTTTTTTTTTTSKA..', // 2
    '..AKSSSTTTTTTSSSKA..', // 3
    '.AKSSSSSSSSSSSSSSKA.', // 4
    '.AKSSSSSSSSSSSSSSKA.', // 5
    'QQKShhhhSSSShhhhSKQQ', // 6
    'QqKSSSSSSSSSSSSSSKqQ', // 7
    'QqKSWEESSSSSSEEWSKqQ', // 8
    'QqKSSSSSSssSSSSSSKqQ', // 9
    'QqKSSSSSssssSSSSSKqQ', // 10
    'QQKsSSSsTssTsSSSsKQQ', // 11
    '..KSSUUUUUUUUUUSSK..', // 12
    '..KSSUUSMMMMSUUSSK..', // 13
    '..KSSUUSSSSSSUUSSK..', // 14
    '...KSUUSSSSSSUUSK...', // 15
    '....KUUSSSSSSUUK....', // 16
    '..aDDKKssssssKKDDA..', // 17
    '.aDDDDKssssssKDDDDd.', // 18
    'dDDDDDDCDssDCDDDDDDd', // 19
  ],
  talk: {
    13: '..KSSUUMMMMMMUUSSK..',
    14: '..KSSUUSMMMMSUUSSK..',
  },
  blink: {
    8: 'QqKShhhSSSSSShhhSKqQ',
  },
  think: {
    6: 'QQKSSSSSSSSSSSSSSKQQ',
    7: 'QqKShhhhSSSShhhhSKqQ',
    8: 'QqKSEEWSSSSSSWEESKqQ',
  },
  mouth: 7,
}

export default art
