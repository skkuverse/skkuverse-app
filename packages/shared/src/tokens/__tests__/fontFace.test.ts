import { describe, it, expect } from 'vitest';
import { resolveWantedSansFace, toFontWeightValue, wantedSansFaceFor } from '../fontFace';

describe('wantedSansFaceFor', () => {
  it('leaves iOS on the logical family and the real weight', () => {
    expect(wantedSansFaceFor('ios', '600')).toEqual({ fontFamily: 'WantedSans', fontWeight: '600' });
  });

  it('names the file on Android and keeps the weight below 700', () => {
    expect(wantedSansFaceFor('android', '400')).toEqual({ fontFamily: 'WantedSans-Regular', fontWeight: '400' });
    expect(wantedSansFaceFor('android', '500')).toEqual({ fontFamily: 'WantedSans-Medium', fontWeight: '400' });
    expect(wantedSansFaceFor('android', '700')).toEqual({ fontFamily: 'WantedSans-Bold', fontWeight: '400' });
  });

  // iOS draws semibold with Medium (nearest face in UIFontWeight space), so
  // Android must too or every semiBold label is heavier there.
  it('draws semibold with Medium, as iOS does', () => {
    expect(wantedSansFaceFor('android', '600').fontFamily).toBe('WantedSans-Medium');
  });

  it('lands weights without a face on the nearest one', () => {
    expect(wantedSansFaceFor('android', '300').fontFamily).toBe('WantedSans-Regular');
    expect(wantedSansFaceFor('android', '900').fontFamily).toBe('WantedSans-Bold');
  });
});

describe('toFontWeightValue', () => {
  it('reads keywords, numbers and numeric strings', () => {
    expect(toFontWeightValue('bold')).toBe('700');
    expect(toFontWeightValue('normal')).toBe('400');
    expect(toFontWeightValue('semibold')).toBe('600');
    expect(toFontWeightValue(500)).toBe('500');
    expect(toFontWeightValue('800')).toBe('800');
  });

  it('treats unset or unreadable as the platform default', () => {
    expect(toFontWeightValue(undefined)).toBe('400');
    expect(toFontWeightValue('nonsense')).toBe('400');
  });
});

describe('resolveWantedSansFace', () => {
  it('resolves the final weight of a logical-family style on Android', () => {
    expect(resolveWantedSansFace('android', { fontFamily: 'WantedSans', fontWeight: 'bold' })).toEqual({
      fontFamily: 'WantedSans-Bold',
      fontWeight: '400',
    });
  });

  it('changes nothing on iOS', () => {
    expect(resolveWantedSansFace('ios', { fontFamily: 'WantedSans', fontWeight: '700' })).toBeNull();
  });

  // A file name has already lost the weight it was chosen for, and another
  // family (Tossface, Courier) is none of this resolver's business.
  it('leaves other families alone, including an already-resolved file', () => {
    expect(resolveWantedSansFace('android', { fontFamily: 'WantedSans-Bold', fontWeight: '400' })).toBeNull();
    expect(resolveWantedSansFace('android', { fontFamily: 'Courier' })).toBeNull();
    expect(resolveWantedSansFace('android', {})).toBeNull();
  });
});
