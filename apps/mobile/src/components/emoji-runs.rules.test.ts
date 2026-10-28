import { describe, expect, it } from 'vitest';
import { toEmojiRuns } from './emoji-runs.rules';

const text = (value: string) => ({ kind: 'text', value });
const emoji = (value: string) => ({ kind: 'emoji', value });

describe('toEmojiRuns', () => {
  it('keeps text without emoji as one run, and empty text as none', () => {
    expect(toEmojiRuns('정자역 3번 출구')).toEqual([text('정자역 3번 출구')]);
    expect(toEmojiRuns('')).toEqual([]);
  });

  it('splits emoji out of the words around them', () => {
    expect(toEmojiRuns('🚇 정자역에서 갈아타요 🙂')).toEqual([
      emoji('🚇'),
      text(' 정자역에서 갈아타요 '),
      emoji('🙂'),
    ]);
  });

  it('leaves the arrows the commute server sends as text', () => {
    // Live strings from GET /bus/config/commute and the 강남·양재 notices.
    for (const served of ['역 ↔ 자과캠 시범 운행', 'N센터 인근 → CNS센터 → 학생회관 인근', '등교: 강남역 → 양재역']) {
      expect(toEmojiRuns(served)).toEqual([text(served)]);
    }
  });

  it('draws a text-default symbol as emoji only with the emoji selector', () => {
    expect(toEmojiRuns('⚠ 주의')).toEqual([text('⚠ 주의')]);
    expect(toEmojiRuns('⚠️ 주의')).toEqual([emoji('⚠️'), text(' 주의')]);
    expect(toEmojiRuns('❤️')).toEqual([emoji('❤️')]);
    expect(toEmojiRuns('©')).toEqual([text('©')]);
  });

  it('keeps an emoji-default pictograph as text under the text selector', () => {
    expect(toEmojiRuns('⭐︎')).toEqual([text('⭐︎')]);
    expect(toEmojiRuns('⭐')).toEqual([emoji('⭐')]);
  });

  it('keeps a sequence whole: skin tone, ZWJ, keycap, flag, tags', () => {
    expect(toEmojiRuns('👍🏽')).toEqual([emoji('👍🏽')]);
    expect(toEmojiRuns('👩‍💻 개발')).toEqual([emoji('👩‍💻'), text(' 개발')]);
    expect(toEmojiRuns('🏃‍♀️')).toEqual([emoji('🏃‍♀️')]);
    expect(toEmojiRuns('1️⃣번')).toEqual([emoji('1️⃣'), text('번')]);
    expect(toEmojiRuns('3번')).toEqual([text('3번')]);
    expect(toEmojiRuns('🇰🇷')).toEqual([emoji('🇰🇷')]);
    expect(toEmojiRuns('🏴󠁧󠁢󠁳󠁣󠁴󠁿')).toEqual([emoji('🏴󠁧󠁢󠁳󠁣󠁴󠁿')]);
  });

  it('joins adjacent emoji into one run', () => {
    expect(toEmojiRuns('🚌🚇')).toEqual([emoji('🚌🚇')]);
  });

  it('leaves a ZWJ that joins nothing as text', () => {
    expect(toEmojiRuns('🚇‍역')).toEqual([emoji('🚇'), text('‍역')]);
  });
});
