import { afterEach, describe, expect, it, vi } from 'vitest';
import { SdsTypo as neutralTypo, typoWeights, type FontWeightValue } from '../typography';

// textStyles.ts binds the neutral table to Platform.OS at load, so each
// platform gets a fresh module with its own react-native stub.
async function loadFor(os: 'ios' | 'android') {
  vi.resetModules();
  vi.doMock('react-native', () => ({ Platform: { OS: os } }));
  return import('../textStyles');
}

afterEach(() => {
  vi.doUnmock('react-native');
});

const weights = Object.values(typoWeights);

// On Android the family is the font file, and a weight below 700 makes
// ReactFontManager load it as named (fontFace.ts). Semibold draws with
// Medium, as iOS does.
const ANDROID_FACE: Record<(typeof weights)[number], { fontFamily: string; fontWeight: FontWeightValue }> = {
  '400': { fontFamily: 'WantedSans-Regular', fontWeight: '400' },
  '500': { fontFamily: 'WantedSans-Medium', fontWeight: '400' },
  '600': { fontFamily: 'WantedSans-Medium', fontWeight: '400' },
  '700': { fontFamily: 'WantedSans-Bold', fontWeight: '400' },
};

describe('the app SdsTypo on iOS', () => {
  it('keeps the logical family and the real weight for each weight', async () => {
    const { wantedSans } = await loadFor('ios');
    for (const weight of weights) {
      expect(wantedSans(weight), weight).toEqual({ fontFamily: 'WantedSans', fontWeight: weight });
    }
  });

  it('equals the neutral table', async () => {
    const { SdsTypo } = await loadFor('ios');
    expect(SdsTypo).toEqual(neutralTypo);
  });
});

describe('the app SdsTypo on Android', () => {
  it('names the WantedSans file for each weight', async () => {
    const { wantedSans } = await loadFor('android');
    for (const weight of weights) {
      expect(wantedSans(weight), weight).toEqual(ANDROID_FACE[weight]);
    }
  });

  it('draws every style in its weight file at its size', async () => {
    const { SdsTypo } = await loadFor('android');
    expect(Object.keys(SdsTypo)).toEqual(Object.keys(neutralTypo));
    for (const [name, style] of Object.entries(neutralTypo)) {
      expect(SdsTypo[name as keyof typeof SdsTypo], name).toEqual({
        ...ANDROID_FACE[style.fontWeight as keyof typeof ANDROID_FACE],
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
      });
    }
  });

  it('draws a bold title in the Bold file', async () => {
    const { SdsTypo } = await loadFor('android');
    expect(SdsTypo.t10Bold).toEqual({ fontFamily: 'WantedSans-Bold', fontWeight: '400', fontSize: 22, lineHeight: 31 });
  });
});
