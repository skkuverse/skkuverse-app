// SEE: docs/decisions/0026-comments-say-only-what-the-code-cannot.md
import { ts } from '../imports.mjs';

/** An eslint directive the rules skip: `eslint-enable`, or an `eslint-disable` that gives its reason after ` -- `. */
const ESLINT_DIRECTIVE = /^eslint-enable\b|^eslint-disable(?:-next-line|-line)?\b.*\s--\s+\S/;
/**
 * A comment no rule reads: triple-slash, `@ts-expect-error` with its reason, a one-line
 * `@deprecated` naming its replacement (the compiler and editors read it), the shebang.
 */
const DIRECTIVE = /^(?:\/\/\/\s*<|\/[/*]\s*@ts-expect-error\s+\S|\/\*\*\s*@deprecated\s+\S[^\n]*\*\/$|#!)/;

const isJsDocNode = (node) => node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode;

/**
 * Every comment as `{ line, endLine, kind, ownLine, jsxOwnLine, raw }`, found through the parser's
 * token positions. WHY: a `//` inside a string, a template, a regex or JSX text is not a comment.
 */
export function commentsOf(file, source) {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  const ranges = new Map();
  const jsxText = [];
  const collect = (list) => {
    for (const range of list ?? []) ranges.set(range.pos, range);
  };
  const visit = (node) => {
    if (isJsDocNode(node)) return;
    if (ts.isJsxText(node)) {
      jsxText.push([node.pos, node.end]);
      return;
    }
    collect(ts.getLeadingCommentRanges(source, node.getFullStart()));
    collect(ts.getTrailingCommentRanges(source, node.getEnd()));
    for (const child of node.getChildren(sourceFile)) visit(child);
  };
  visit(sourceFile);
  const inJsxText = (pos) => jsxText.some(([start, end]) => pos >= start && pos < end);
  return [...ranges.values()]
    .filter((range) => !inJsxText(range.pos))
    .sort((a, b) => a.pos - b.pos)
    .map((range) => {
      const start = sourceFile.getLineAndCharacterOfPosition(range.pos);
      const before = source.slice(sourceFile.getPositionOfLineAndCharacter(start.line, 0), range.pos);
      return {
        line: start.line + 1,
        endLine: sourceFile.getLineAndCharacterOfPosition(range.end).line + 1,
        kind: range.kind === ts.SyntaxKind.SingleLineCommentTrivia ? 'line' : 'block',
        ownLine: before.trim() === '',
        jsxOwnLine: /^\s*\{\s*$/.test(before),
        raw: source.slice(range.pos, range.end),
      };
    });
}

/** A comment's lines without `//`, `/*`, `*` and the closing marker. */
export function commentLines(comment) {
  return comment.raw.split('\n').map((line) =>
    line
      .replace(/^\s*(?:\/\/+|\/\*+|\*+(?!\/))/, '')
      .replace(/\*+\/\s*$/, '')
      .trim(),
  );
}

export function isDirective(comment) {
  return DIRECTIVE.test(comment.raw);
}

/**
 * The runs a reader takes in as one comment, as `{ line, text }`: a block comment, or adjacent
 * own-line `//` comments. Blank lines and reasoned eslint directives are left out of `text`.
 */
export function commentBlocks(comments) {
  const blocks = [];
  let previous;
  for (const comment of comments) {
    const text = commentLines(comment).filter((line) => line !== '' && !ESLINT_DIRECTIVE.test(line));
    const continues =
      previous !== undefined &&
      comment.kind === 'line' &&
      previous.kind === 'line' &&
      comment.ownLine &&
      previous.ownLine &&
      comment.line === previous.endLine + 1;
    const last = blocks.at(-1);
    if (continues && last) {
      if (last.text.length === 0) last.line = comment.line;
      last.text.push(...text);
    } else {
      blocks.push({ line: comment.line, text });
    }
    previous = comment;
  }
  return blocks.filter((block) => block.text.length > 0);
}

/** The comment blocks of a source, compiler directives left out. */
export function blocksOf(file, source) {
  return commentBlocks(commentsOf(file, source).filter((comment) => !isDirective(comment)));
}

/** How a block is named in a report: its first line, cut to 60 characters. */
export function headOf(block) {
  return block.text[0].slice(0, 60).trimEnd();
}
