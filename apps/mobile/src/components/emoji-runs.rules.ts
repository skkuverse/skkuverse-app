/**
 * WHY: a symbol that is text by default (↔, →) stays text without VS16, or arrows in server text draw as
 * coloured tiles. Code point ranges, not `\p{Extended_Pictographic}`, so the engine's Unicode tables never
 * decide; a newer emoji inside these blocks is covered without a change.
 */

export type EmojiRun = { kind: 'text' | 'emoji'; value: string };

const VS15 = 0xfe0e;
const VS16 = 0xfe0f;
const ZWJ = 0x200d;
const KEYCAP = 0x20e3;
const TAG_END = 0xe007f;

/** EVIDENCE: Unicode's `Emoji_Presentation` pictographs in the BMP. */
const BMP_PRESENTATION: readonly (readonly [number, number])[] = [
  [0x231a, 0x231b], [0x23e9, 0x23ec], [0x23f0, 0x23f0], [0x23f3, 0x23f3],
  [0x25fd, 0x25fe], [0x2614, 0x2615], [0x2648, 0x2653], [0x267f, 0x267f],
  [0x2693, 0x2693], [0x26a1, 0x26a1], [0x26aa, 0x26ab], [0x26bd, 0x26be],
  [0x26c4, 0x26c5], [0x26ce, 0x26ce], [0x26d4, 0x26d4], [0x26ea, 0x26ea],
  [0x26f2, 0x26f3], [0x26f5, 0x26f5], [0x26fa, 0x26fa], [0x26fd, 0x26fd],
  [0x2705, 0x2705], [0x270a, 0x270b], [0x2728, 0x2728], [0x274c, 0x274c],
  [0x274e, 0x274e], [0x2753, 0x2755], [0x2757, 0x2757], [0x2795, 0x2797],
  [0x27b0, 0x27b0], [0x27bf, 0x27bf], [0x2b1b, 0x2b1c], [0x2b50, 0x2b50],
  [0x2b55, 0x2b55],
];

const TEXT_DEFAULT: readonly (readonly [number, number])[] = [
  [0x00a9, 0x00a9], [0x00ae, 0x00ae], [0x203c, 0x203c], [0x2049, 0x2049],
  [0x2122, 0x2122], [0x2139, 0x2139], [0x2194, 0x2199], [0x21a9, 0x21aa],
  [0x2328, 0x2328], [0x23cf, 0x23cf], [0x23ed, 0x23ef], [0x23f1, 0x23f2],
  [0x23f8, 0x23fa], [0x24c2, 0x24c2], [0x25aa, 0x25ab], [0x25b6, 0x25b6],
  [0x25c0, 0x25c0], [0x25fb, 0x25fc], [0x2600, 0x27bf], [0x2934, 0x2935],
  [0x2b05, 0x2b07], [0x3030, 0x3030], [0x303d, 0x303d], [0x3297, 0x3297],
  [0x3299, 0x3299],
  // EVIDENCE: the only enclosed letters Unicode makes emoji: 🅰 🅱 🅾 🅿.
  [0x1f170, 0x1f171], [0x1f17e, 0x1f17f],
];

const SUPPLEMENTARY: readonly (readonly [number, number])[] = [
  [0x1f004, 0x1f004], [0x1f0cf, 0x1f0cf], [0x1f18e, 0x1f18e], [0x1f191, 0x1f19a],
  [0x1f200, 0x1f2ff], [0x1f300, 0x1f64f], [0x1f680, 0x1f6ff], [0x1f7e0, 0x1f7ff],
  [0x1f900, 0x1f9ff], [0x1fa70, 0x1faff],
];

const inRanges = (cp: number, ranges: readonly (readonly [number, number])[]) =>
  ranges.some(([from, to]) => cp >= from && cp <= to);

const isRegionalIndicator = (cp: number) => cp >= 0x1f1e6 && cp <= 0x1f1ff;
const isSkinTone = (cp: number) => cp >= 0x1f3fb && cp <= 0x1f3ff;
const isTag = (cp: number) => cp >= 0xe0020 && cp <= TAG_END;
const isKeycapBase = (cp: number) => (cp >= 0x30 && cp <= 0x39) || cp === 0x23 || cp === 0x2a;

const isPictograph = (cp: number) =>
  inRanges(cp, SUPPLEMENTARY) || inRanges(cp, BMP_PRESENTATION) || inRanges(cp, TEXT_DEFAULT);

function emojiLength(cps: readonly number[], i: number): number {
  const cp = cps[i];
  const next = cps[i + 1];
  if (isKeycapBase(cp)) {
    if (next === KEYCAP) return 2;
    return next === VS16 && cps[i + 2] === KEYCAP ? 3 : 0;
  }
  if (isRegionalIndicator(cp)) return isRegionalIndicator(next) ? 2 : 1;
  if (next === VS15) return 0;
  const byDefault = inRanges(cp, SUPPLEMENTARY) || inRanges(cp, BMP_PRESENTATION);
  if (!byDefault && !(inRanges(cp, TEXT_DEFAULT) && next === VS16)) return 0;

  let end = i + 1;
  const extend = () => {
    if (cps[end] === VS16) end += 1;
    if (isSkinTone(cps[end])) end += 1;
  };
  extend();
  while (cps[end] === ZWJ && cps[end + 1] !== undefined && isPictograph(cps[end + 1])) {
    end += 2;
    extend();
  }
  if (isTag(cps[end])) {
    while (isTag(cps[end]) && cps[end] !== TAG_END) end += 1;
    if (cps[end] === TAG_END) end += 1;
  }
  return end - i;
}

export function toEmojiRuns(text: string): EmojiRun[] {
  const cps = Array.from(text, (ch) => ch.codePointAt(0) ?? 0);
  const runs: EmojiRun[] = [];
  const push = (kind: EmojiRun['kind'], value: string) => {
    const last = runs[runs.length - 1];
    if (last?.kind === kind) last.value += value;
    else runs.push({ kind, value });
  };
  let i = 0;
  while (i < cps.length) {
    const length = emojiLength(cps, i);
    if (length > 0) {
      push('emoji', String.fromCodePoint(...cps.slice(i, i + length)));
      i += length;
    } else {
      push('text', String.fromCodePoint(cps[i]));
      i += 1;
    }
  }
  return runs;
}
