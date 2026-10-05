import type { SpriteArt } from '../sprite'

/**
 * Donald Knuth, in the spirit of: a long head under a high bald dome, white
 * hair at the sides, small round gold wire glasses, a gentle smile, a dark
 * sweater over a white shirt collar.
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
    W: 0xe8e8e4, // white hair
    w: 0xb8b8b2, // white hair, shaded
    h: 0x9a948c, // brows
    Y: 0xc8a050, // glasses, thin gold wire
    L: 0xdfeef4, // lens
    E: 0x2a3440, // eye
    M: 0x6e2c25, // mouth
    N: 0xf8f4ee, // teeth
    C: 0xf0f0ec, // shirt collar
    D: 0x3a4458, // sweater, dark
  },
  // prettier-ignore
  rest: [
    '.......KKKKKK.......', // 0
    '.....KKTTTTTTKK.....', // 1
    '....KSTTTTTTTTSK....', // 2
    '....KSSTTTTTTSSK....', // 3
    '...KSSSSTTTTSSSSK...', // 4
    '...KSSSSSSSSSSSSK...', // 5
    '...KSSSSSSSSSSSSK...', // 6
    '...KSSSSSSSSSSSSK...', // 7
    '..KWShhhSSSShhhSWK..', // 8
    '.KWWSYYYSSSSYYYSWWK.', // 9
    '.KWWYLELYSSYLELYWWK.', // 10
    'KsWWYLLLYYYYLLLYWWsK', // 11
    '.KWWSYYYSSSSYYYSWWK.', // 12
    '..KWSSSSSssSSSSSWK..', // 13
    '...KSSSSsTTsSSSSK...', // 14
    '...KSSSssssssSSSK...', // 15
    '...KsSSSSSSSSSSsK...', // 16
    '...KsSSMSSSSMSSsK...', // 17
    '...KsSSSMMMMSSSsK...', // 18
    '...KssSSSSSSSSssK...', // 19
    '....KKssSSSSssKK....', // 20
    'DDDDDCCKssssKCCDDDDD', // 21
  ],
  talk: {
    18: '...KsSSMMMMMMSSsK...',
    19: '...KssSSMMMMSSssK...',
  },
  blink: {
    10: '.KWWYEEEYSSYEEEYWWK.',
  },
  think: {
    7: '...KShhhSSSShhhSK...',
    8: '..KWSSSSSSSSSSSSWK..',
    10: '.KWWYLLEYSSYLLEYWWK.',
  },
  mouth: 8,
}

export default art
