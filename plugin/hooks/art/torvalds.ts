import type { SpriteArt } from '../sprite'

/**
 * Linus Torvalds, in the spirit of: a high forehead under a receding sandy
 * hairline going grey at the sides, heavy rectangular glasses, a broad face,
 * a smirk, a blue T-shirt.
 *
 * Each letter is a color from the palette and `.` is see-through; two rows of
 * pixels make one row of terminal cells. Preview with `npm run persona`.
 */
const art: SpriteArt = {
  palette: {
    K: 0x1a1210, H: 0xb09a7c, J: 0xd8c8aa, h: 0x7a6048, g: 0xa8a29a,
    S: 0xf0c5a0, s: 0xd29a76, T: 0xffdcc0, G: 0x2e2a28, L: 0xc8dde8, E: 0x26303a,
    P: 0xdca084, M: 0x6e2c25, W: 0xf6f1ea, B: 0x2f5f95, b: 0x1f4068, C: 0xe9e9e9,
  },
  // prettier-ignore
  rest: [
    '......KKKKKKKK......', // 0
    '....KKJJJJJJJJKK....', // 1
    '...KHJJJJHJJJJJHK...', // 2
    '..KgTTHJJJJJJHTTgK..', // 3
    '..KgSTTHJJJJHTTSgK..', // 4
    '..KgSSTTTHHTTTSSgK..', // 5
    '..KgSSSSSSSSSSSSgK..', // 6
    '..KgShhhSSSShhhSgK..', // 7
    '.KKGGGGGGSSGGGGGGKK.', // 8
    'KsKGLELLGGGGLLELGKsK', // 9
    'KsKGLELLGSSGLLELGKsK', // 10
    '.KSGGGGGGSSGGGGGGSK.', // 11
    '..KSSSSSSssSSSSSSK..', // 12
    '..KsSSSSsTTsSSSSsK..', // 13
    '..KsSSSSSSSSSSMSsK..', // 14
    '..KsSSSMMMMMMMSSsK..', // 15
    '..KssSSSSPPPSSSssK..', // 16
    '...KssSSSSSSSSssK...', // 17
    '..BBBKKssssssKKBBB..', // 18
    'bBBBBBBbbbbbbBBBBBBb', // 19
  ],
  talk: {
    14: '..KsSSSSSSSSSSSSsK..',
    15: '..KsSSSSMMMMMSSSsK..',
    16: '..KssSSSSMMMSSSssK..',
  },
  blink: {
    9: 'KsKGLLLLGGGGLLLLGKsK',
    10: 'KsKGLEELGSSGLEELGKsK',
  },
  think: {
    6: '..KgShhhSSSShhhSgK..',
    7: '..KgSSSSSSSSSSSSgK..',
    9: 'KsKGLLELGGGGLLLEGKsK',
    10: 'KsKGLLLLGSSGLLLLGKsK',
  },
  mouth: 7,
}
export default art
