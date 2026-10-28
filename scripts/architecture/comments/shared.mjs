import { blocksOf } from './extract.mjs';

const FEATURE_DIR = /^apps\/mobile\/src\/features\/([^/]+)\//;
const SHARED_LAYER = /^(?:packages\/[^/]+\/src|apps\/mobile\/src\/platform|apps\/mobile\/src\/components)\//;

/** The feature names: the folders under apps/mobile/src/features that hold a file. */
export function featuresOf(files) {
  return [...new Set(files.flatMap((file) => FEATURE_DIR.exec(file)?.[1] ?? []))].sort();
}

export function isSharedLayer(file) {
  return SHARED_LAYER.test(file);
}

const pascal = (feature) =>
  feature
    .split('-')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join('');

/**
 * The feature references in a comment, in order. WHY: a feature counts as a folder path, a file or
 * a hook (`useMapHost`), never a word, a component, or a segment of another path such as an endpoint.
 */
function featureReferences(text, features) {
  const found = [];
  const add = (pattern) => {
    for (const m of text.matchAll(pattern)) found.push([m.index, m[0]]);
  };
  for (const feature of features) {
    add(new RegExp(String.raw`(?<![\w-])features\/${feature}\/`, 'g'));
    add(new RegExp(String.raw`(?<![\w/.-])(?:\.{1,2}\/)*${feature}\/`, 'g'));
    add(new RegExp(String.raw`(?<![\w/.-])${feature}(?:[.-][\w-]+)+\.(?:tsx?|json)\b`, 'g'));
    add(new RegExp(String.raw`(?<![\w$])use${pascal(feature)}[A-Z][A-Za-z0-9]*`, 'g'));
  }
  return found.sort((a, b) => a[0] - b[0]).map(([, ref]) => ref);
}

/** Every feature a comment in a shared layer names. */
export function sharedCommentViolations(file, source, { features }) {
  if (!isSharedLayer(file)) return [];
  return blocksOf(file, source).flatMap((block) =>
    featureReferences(block.text.join(' '), features).map((ref) => ({ line: block.line, message: ref })),
  );
}
