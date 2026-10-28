#!/usr/bin/env node
// K5, CM2: a font-size literal in a WantedSans style to a step of the type scale.
//
//   node scripts/codemods/sds/typo-literal.mjs [--write] [--allow-dirty] [--allow-added-line-height] [paths]
//
// A style object moves when it already draws WantedSans (it spreads
// `wantedSans(…)` or an `SdsTypo` style, and sets no literal `fontFamily`),
// its `fontSize` literal maps exactly to a step (migration-map.json), and it
// sets no `fontWeight` literal. `fontSize: 11` becomes `...SdsTypeScale.t1`
// in its place:
//
// - a `lineHeight` literal equal to the step's goes with it, and nothing
//   changes on screen;
// - with no line height set before the size (literal or from a spread), the
//   step adds one. That changes the line box, so it moves only with
//   --allow-added-line-height, and the report names the site for a
//   screenshot.
//
// What it leaves, listed in its report: a style with no WantedSans family of
// its own (React Native's Text in the system font, which V4 moves to Txt, or
// a Txt style, which txt-style-lift.mjs reads), an
// off-scale or approximate size, a line height that differs from the step's
// (H3), a literal family (a monospace view), and a `fontWeight` literal.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

import { applyEdits, runCodemod } from './codemod.mjs';
import { addNamedImports, nodeTestedFiles, parse } from './imports.mjs';
import { loadTokens } from './tokens.mjs';
import { removeProp } from './txt-style-lift.mjs';

const MAP = JSON.parse(readFileSync(new URL('./migration-map.json', import.meta.url), 'utf8'));
const { SdsTypeScale } = loadTokens();

const propName = (n) => (n && (ts.isIdentifier(n) || ts.isStringLiteral(n)) ? n.text : null);

function numberOf(n) {
  while (n && (ts.isParenthesizedExpression(n) || ts.isAsExpression(n))) n = n.expression;
  return n && ts.isNumericLiteral(n) ? Number(n.text) : null;
}

/** The step a spread sets the line height of (`...SdsTypo.t5Regular`, `...SdsTypeScale.t5`), or null. */
function spreadStep(spread, sf) {
  const m = /^(?:SdsTypo\.(t\d+)[A-Z]\w*|SdsTypeScale\.(t\d+))$/.exec(spread.expression.getText(sf));
  return m ? (m[1] ?? m[2]) : null;
}

/** Whether a spread sets the WantedSans family. */
const setsFamily = (spread, sf) => /^(?:wantedSans\(|SdsTypo\.)/.test(spread.expression.getText(sf));

/** The transform for one file; `allowAddedLineHeight` lets a step add a line height. */
export function makeTransform({ allowAddedLineHeight = false } = {}) {
  return function transform(file, text) {
    const sf = parse(file, text);
    const edits = [];
    const unresolved = [];
    const line = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
    const nodeTested = nodeTestedFiles().has(file);
    (function visit(n) {
      if (ts.isObjectLiteralExpression(n)) {
        const props = n.properties;
        const size = props.find((p) => ts.isPropertyAssignment(p) && propName(p.name) === 'fontSize' && numberOf(p.initializer) !== null);
        if (size) {
          const leave = (reason) => unresolved.push({ line: line(size), reason: `fontSize: ${numberOf(size.initializer)}: ${reason}` });
          const value = numberOf(size.initializer);
          const entry = MAP.fontSize[String(value)];
          const family = props.find((p) => ts.isPropertyAssignment(p) && propName(p.name) === 'fontFamily');
          const weight = props.find((p) => ts.isPropertyAssignment(p) && propName(p.name) === 'fontWeight');
          const spreads = props.filter(ts.isSpreadAssignment);
          const lh = props.find((p) => ts.isPropertyAssignment(p) && propName(p.name) === 'lineHeight');
          if (nodeTested) leave('in a file a plain-Node test imports');
          else if (family) leave('sets its own fontFamily');
          else if (!spreads.some((s) => setsFamily(s, sf))) leave('sets no WantedSans family of its own (a Txt style is the style lift\'s; a Text moves to Txt in V4)');
          else if (weight) leave('sets a fontWeight literal');
          else if (!entry || !entry.exact) leave(entry ? `${entry.next} is not the same size` : 'off the type scale');
          else {
            const step = entry.next;
            const target = SdsTypeScale[step].lineHeight;
            const sizeAt = props.indexOf(size);
            // The line height in force where the size sits, and whether a later one overrides the step's.
            let before = null;
            for (const p of props.slice(0, sizeAt)) {
              if (ts.isSpreadAssignment(p) && spreadStep(p, sf)) before = SdsTypeScale[spreadStep(p, sf)].lineHeight;
              if (p === lh) before = numberOf(lh.initializer);
            }
            const after = props.slice(sizeAt + 1).filter((p) => p === lh || (ts.isSpreadAssignment(p) && spreadStep(p, sf)));
            const lhValue = lh ? numberOf(lh.initializer) : null;
            if (lh && lhValue === null) leave('its lineHeight is not a literal');
            else if (lh && lhValue !== target) leave(`lineHeight ${lhValue} is not ${step}'s ${target} (H3)`);
            else if (!lh && after.length) leave('a later spread sets the line height');
            else if (!lh && before !== target && !allowAddedLineHeight) leave(`${step} adds a line height of ${target} (--allow-added-line-height)`);
            else {
              edits.push({ start: size.getStart(sf), end: size.getEnd(), text: `...SdsTypeScale.${step}` });
              if (lh) edits.push(removeProp(sf, lh));
              if (!lh && before !== target) unresolved.push({ line: line(size), reason: `moved; ${step} adds a line height of ${target}: check this screen` });
            }
          }
        }
      }
      ts.forEachChild(n, visit);
    })(sf);
    if (!edits.some((e) => e.text.startsWith('...SdsTypeScale'))) return { edits: [], unresolved };
    edits.push(...addNamedImports(sf, ['SdsTypeScale'], '@skkuverse/shared'));
    return { edits: [{ start: 0, end: text.length, text: applyEdits(text, edits) }], unresolved };
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  runCodemod({ name: 'typo-literal', transform: makeTransform({ allowAddedLineHeight: process.argv.includes('--allow-added-line-height') }) });
}
