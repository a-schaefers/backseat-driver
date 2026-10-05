import type { SpriteArt } from '../sprite'

/**
 * Linus Torvalds, in the spirit of: thin sandy-grey hair combed back from a
 * high hairline, a broad face with full cheeks and a soft jaw, thin dark
 * rectangular glasses, a half smile, a plain blue crew-neck T-shirt.
 *
 * Each letter is a color from the palette and `.` is see-through; two rows of
 * pixels make one row of terminal cells. Preview with `npm run persona`.
 */
const art: SpriteArt = {
  palette: {
    K: 0x1a1210, // outline
    H: 0xb4a084, // hair, shaded
    J: 0xd2c4a8, // hair, thin and swept back
    g: 0xa8a29a, // grey at the sides
    h: 0x8a7458, // brows
    S: 0xf0c5a0, // skin
    s: 0xd29a76, // skin, shaded
    T: 0xffdcc0, // skin, lit
    G: 0x4a403a, // glasses, thin dark frame
    L: 0xd4e4ec, // lens
    E: 0x26303a, // eye
    P: 0xdca084, // lip
    M: 0x6e2c25, // mouth
    B: 0x2f5f95, // T-shirt
    b: 0x1f4068, // T-shirt, shaded
    l: 0xd8b294, // eyelid, through the lens
  },
  // prettier-ignore
  rest: [
    '......KKKKKKKK......', // 0
    '....KKJJJTJJJJKK....', // 1
    '...KJJHJJJTJJHJJK...', // 2
    '..KgTTJJHJJJHJTTgK..', // 3
    '..KgSTTJJTJJJTTSgK..', // 4
    '..KgSSTTTJJTTTSSgK..', // 5
    '..KgSSTTTTTTTTSSgK..', // 6
    '..KgSSSSSSShhhSSgK..', // 7
    '..KgSShhhSSSSSSSgK..', // 8
    '.KKGGGGGGSSGGGGGGKK.', // 9
    'KsKGllllGGGGllllGKsK', // 10
    'KsKGLEELGSSGLEELGKsK', // 11
    '.KSGGGGGGSSGGGGGGSK.', // 12
    '.KSSSSSSSssSSSSSSSK.', // 13
    '.KsSSSSSsTTsSSSSSsK.', // 14
    '.KsSSSSSSSSSSSSSSsK.', // 15
    '.KssSSMMMMMMMSSSssK.', // 16
    '.KssSSMSSPPPSSSSssK.', // 17
    '.KsssSSSSSSSSSSsssK.', // 18
    '..KKssSSSSSSSSssKK..', // 19
    '.BBBBBKKssssKKBBBBB.', // 20
    'bBBBBBBbbbbbbBBBBBBb', // 21
  ],
  talk: {
    16: '.KssSSMMMMMMMSSSssK.',
    17: '.KssSSMMMMMMSSSSssK.',
  },
  blink: {
    10: 'KsKGllllGGGGllllGKsK',
    11: 'KsKGEEEEGSSGEEEEGKsK',
  },
  think: {
    7: '..KgSShhhSShhhSSgK..',
    8: '..KgSSSSSSSSSSSSgK..',
    10: 'KsKGLLELGGGGLLLEGKsK',
    11: 'KsKGLLLLGSSGLLLLGKsK',
  },
  mouth: 8,
}

export default art
