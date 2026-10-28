import { blocksOf, headOf } from './extract.mjs';

export const MAX_COMMENT_LINES = 3;

/** Every block over MAX_COMMENT_LINES lines of text. */
export function longCommentViolations(file, source) {
  return blocksOf(file, source)
    .filter((block) => block.text.length > MAX_COMMENT_LINES)
    .map((block) => ({ line: block.line, message: headOf(block) }));
}
