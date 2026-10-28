import { blocksOf, headOf } from './extract.mjs';

const HANGUL = /[ᄀ-ᇿ㄰-㆏ꥠ-꥿가-힯ힰ-퟿]/;
const ALLOW_KOREAN = /conventions:allow-korean:\s*\S/;

/**
 * Every block holding a line of Hangul that does not carry the `conventions:allow-korean: <reason>`
 * marker. WHY: product copy is a string, and no rule reads strings.
 */
export function hangulCommentViolations(file, source) {
  return blocksOf(file, source)
    .filter((block) => block.text.some((line) => HANGUL.test(line) && !ALLOW_KOREAN.test(line)))
    .map((block) => ({ line: block.line, message: headOf(block) }));
}
