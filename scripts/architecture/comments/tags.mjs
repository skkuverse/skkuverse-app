import { blocksOf, headOf } from './extract.mjs';

/** WHY: a CONTRACT names a path a reader can open, so only a public repository is a target. */
export const CONTRACT_REPOS = [
  'skkuverse',
  'skkuverse-server',
  'skkuverse-web',
  'skkuverse-mini',
  'skkuverse-crawler',
  'skkuverse-ai',
];

const SYSTEM = String.raw`[a-z][a-z0-9]*(?:-[a-z0-9]+)*`;
const TAG = new RegExp(String.raw`^(?:WHY:|QUIRK\(${SYSTEM}\):|CONTRACT\((${SYSTEM})\):|EVIDENCE:|SEE:)\s+\S`);
const CITED_PATH = new RegExp(String.raw`(?<![\w/.-])(?:${CONTRACT_REPOS.join('|')})\/[\w.-]+`);
const SEE_PATH = /^SEE:\s+(docs\/[^\s#]+?)[.,;:)]*(?:[\s#]|$)/;

function tagProblem(text, exists) {
  const first = text[0];
  const tag = TAG.exec(first);
  if (!tag) return 'untagged';
  const contractRepo = tag[1];
  if (contractRepo !== undefined) {
    if (!CONTRACT_REPOS.includes(contractRepo)) return `unknown repo ${contractRepo}`;
    if (!CITED_PATH.test(text.join(' '))) return 'no <repo>/<path> cited';
  }
  if (first.startsWith('SEE:')) {
    const cited = SEE_PATH.exec(first)?.[1];
    if (cited === undefined) return 'no docs/ path';
    // WHY: doc-paths checks a cited .md, its section included.
    if (!cited.endsWith('.md') && !exists(cited)) return `missing ${cited}`;
  }
  return undefined;
}

/** Every block whose first line opens with no tag, or with a malformed one (`[reason]` appended). */
export function commentTagViolations(file, source, { exists }) {
  return blocksOf(file, source).flatMap((block) => {
    const problem = tagProblem(block.text, exists);
    if (problem === undefined) return [];
    const head = headOf(block);
    return [{ line: block.line, message: problem === 'untagged' ? head : `${head} [${problem}]` }];
  });
}
