import { commentLines, commentsOf } from './extract.mjs';

const ROUTE = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\/\S*)/;

/** Every comment line in a `.client.ts` that opens with a route: the client's code already names it. */
export function routeCommentViolations(file, source) {
  if (!file.endsWith('.client.ts')) return [];
  return commentsOf(file, source).flatMap((comment) =>
    commentLines(comment).flatMap((line, i) => {
      const match = ROUTE.exec(line);
      return match ? [{ line: comment.line + i, message: `${match[1]} ${match[2].replace(/[.,:;]+$/, '')}` }] : [];
    }),
  );
}
