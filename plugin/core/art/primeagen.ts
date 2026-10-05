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
    N: 0xf4f0e8, // teeth
  },
  // prettier-ignore
  rest: [
    '....AAaaaaaaaaAA....', // 0
    '...AKKTTTTTTTTKKA...', // 1
    '..AKTTTTTTTTTTTTKA..', // 2
    '..AKSSTTTTTTTTSSKA..', // 3
    '.AKShhSSSSSSSShhSKA.', // 4
    '.AKSSShhhSShhhSSSKA.', // 5
    'QQKSSSSSSSSSSSSSSKQQ', // 6
    'QqKSSWWWSSSSWWWSSKqQ', // 7
    'QqKSSWEWSSSSWEWSSKqQ', // 8
    'QqKSSSSSSssSSSSSSKqQ', // 9
    'QqKSSSSSssssSSSSSKqQ', // 10
    'QQKsSSSsTssTsSSSsKQQ', // 11
    '..KSSUUUUUUUUUUSSK..', // 12
    '..KSSUUNNNNNNUUSSK..', // 13
    '..KSSUUMMMMMMUUSSK..', // 14
    '..KSSUUSSSSSSUUSSK..', // 15
    '..KSSUUSSTTSSUUSSK..', // 16
    '..KsSUUSTTTTSUUSsK..', // 17
    '...KssSSSSSSSSssK...', // 18
    '....KKKssssssKKK....', // 19
    '.aDDDDKssssssKDDDDa.', // 20
    'dDDDDDDCDssDCDDDDDDd', // 21
  ],
  talk: {
    13: '..KSSUUNNNNNNUUSSK..',
    14: '..KSSUUMMMMMMUUSSK..',
    15: '..KSSUUMMMMMMUUSSK..',
    16: '..KSSUUSMMMMSUUSSK..',
  },
  blink: {
    7: 'QqKSSSSSSSSSSSSSSKqQ',
    8: 'QqKSSEEESSSSEEESSKqQ',
  },
  think: {
    7: 'QqKSSWEWSSSSWEWSSKqQ',
    8: 'QqKSSWWWSSSSWWWSSKqQ',
  },
  mouth: 6,
}

export default art
