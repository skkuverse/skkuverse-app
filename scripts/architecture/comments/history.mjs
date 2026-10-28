import { blocksOf } from './extract.mjs';

/** WHY: "used to" counts only with a subject, so "x is used to build" is not history. */
export const HISTORY_PHRASES = [
  ['used to', /(?<![.:;!?]\s|^|\b(?:is|are|be|been|being|was|were|get|gets|got|getting)\s)\bused to\b/i],
  ['legacy', /\blegacy\b/i],
  ['ported', /\bported\b/i],
  ['byte-parity', /\bbyte[- ]parity\b/i],
  ['as it always has', /\bas (?:it|they) always (?:has|have|had|did)\b/i],
  ['previously', /\bpreviously\b/i],
  ['replaced by', /\breplaced by\b|\bwas replaced\b/i],
  ['formerly', /\bformerly\b/i],
  ['before the refactor', /\bbefore the (?:refactor|port|migration)\b/i],
  ['as before', /\b(?:as|than) before\b|\bas (?:it|they) (?:was|were|did)\b/i],
  ['originally', /\boriginally\b/i],
];

/** Every history phrase a block uses. */
export function historyCommentViolations(file, source) {
  return blocksOf(file, source).flatMap((block) => {
    const text = block.text.join(' ');
    return HISTORY_PHRASES.filter(([, pattern]) => pattern.test(text)).map(([phrase]) => ({
      line: block.line,
      message: phrase,
    }));
  });
}
