import { commentLines, commentsOf } from './extract.mjs';

const RULE = String.raw`(?:-{3,}|={3,}|[─━═]{2,})`;
const DIVIDER = new RegExp(String.raw`^\/\/\s*${RULE}(?=\s|$)(.*)$`);
const BLOCK_DIVIDER = new RegExp(String.raw`^${RULE}(?=\s|$)(.*)$`);
const TRAILING_RULE = new RegExp(String.raw`${RULE}\s*$`);

const headingOf = (rest) => rest.replace(TRAILING_RULE, '').trim();

/**
 * Every section divider: an own-line `//` or JSX comment that opens with a rule, or a rule as a line
 * of a multi-line block comment, where a bare rule underlines the line above it.
 */
export function sectionCommentViolations(file, source) {
  return commentsOf(file, source).flatMap((comment) => {
    if (comment.kind === 'line') {
      const match = comment.ownLine ? DIVIDER.exec(comment.raw) : null;
      return match ? [{ line: comment.line, message: headingOf(match[1]) || '(rule)' }] : [];
    }
    if (comment.endLine === comment.line) {
      // WHY: JSX has no line comment, so `{/* --- Header --- */}` on its own line is its divider.
      const match = comment.jsxOwnLine ? BLOCK_DIVIDER.exec(commentLines(comment)[0]) : null;
      return match ? [{ line: comment.line, message: headingOf(match[1]) || '(rule)' }] : [];
    }
    return commentLines(comment).flatMap((text, i, lines) => {
      const match = BLOCK_DIVIDER.exec(text);
      if (!match) return [];
      const above = lines
        .slice(0, i)
        .reverse()
        .find((line) => line !== '');
      return [{ line: comment.line + i, message: headingOf(match[1]) || above || '(rule)' }];
    });
  });
}
