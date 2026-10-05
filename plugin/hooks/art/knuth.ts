import type { SpriteArt } from '../sprite'

/**
 * Donald Knuth, in the spirit of: a bald dome, white tufts at the sides,
 * round gold wire glasses, a wide warm grin, a red sweater over a white collar.
 *
 * Each letter is a color from the palette and `.` is see-through; two rows of
 * pixels make one row of terminal cells. Preview with `npm run persona`.
 */
const art: SpriteArt = {
  palette: {
    K: 0x1c1410, // outline
    S: 0xf2c8a8, // skin
    s: 0xd59c7c, // skin, shaded
    T: 0xfde2cc, // skin, lit
    R: 0xeaa28c, // cheek
    W: 0xe8e8e4, // white hair
    w: 0xb8b8b2, // white hair, shaded
    h: 0x9a948c, // brows
    Y: 0xb08a3a, // glasses, gold wire
    L: 0xdfeef4, // lens
    E: 0x2a3440, // eye
    M: 0x6e2c25, // mouth
    N: 0xf8f4ee, // teeth
    Q: 0xa63a32, // sweater
    q: 0x7a2822, // sweater, shaded
    C: 0xf0f0ec, // collar
  },
  // prettier-ignore
  rest: [
    '......KKKKKKKK......', // 0
    '....KKSTTTTTTSKK....', // 1
    '...KSSTTTTTTTTSSK...', // 2
    '..KSSSSTTSSTTSSSSK..', // 3
    '..KSSSSSSSSSSSSSSK..', // 4
    '..KKSSSSSSSSSSSSKK..', // 5
    'KwWWSSSSSSSSSSSSWWwK', // 6
    'KWWShhhSSSSSShhhSWWK', // 7
    'KWsSSYYYSSSSYYYSSsWK', // 8
    'KWsSYLLLYYYYLLLYSsWK', // 9
    'KwKSYLELYSSYLELYSKwK', // 10
    '.KwSSYYYSSSSYYYSSwK.', // 11
    '..KSSSSSssssSSSSSK..', // 12
    '..KsRRSSsTTsSSRRsK..', // 13
    '..KsSMSSSSSSSSMSsK..', // 14
    '..KsSSMNNNNNNMSSsK..', // 15
    '...KsSSMMMMMMSSsK...', // 16
    '....KsSSSSSSSSsK....', // 17
    '..qCCKKssssssKKCCq..', // 18
    'qQQQQQCCssssCCQQQQQq', // 19
  ],
  talk: {
    16: '...KsSMMMMMMMMSsK...',
    17: '....KsSSMMMMSSsK....',
  },
  blink: {
    10: 'KwKSYEEEYSSYEEEYSKwK',
  },
  think: {
    9: 'KWsSYLELYYYYLELYSsWK',
    10: 'KwKSYLLLYSSYLLLYSKwK',
  },
  mouth: 7,
}

export default art
