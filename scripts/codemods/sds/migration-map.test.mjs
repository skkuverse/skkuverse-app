// migration-map.json is the one place a migration mapping is decided, so
// every replacement it names has to exist in the token files, and every
// `exact` has to be true to the values: a K batch trusts it to change nothing
// on screen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { deltaE, parseColor } from './color.mjs';
import { loadTokens } from './tokens.mjs';

const map = JSON.parse(readFileSync(new URL('./migration-map.json', import.meta.url), 'utf8'));
const t = loadTokens();
const USES = new Set(['fg', 'bg', 'bgPressed', 'stroke', 'line', 'placeholder']);
const WEIGHTS = new Set(['regular', 'medium', 'semibold', 'bold']);

/** The light value a color `next` names, or undefined when it names nothing. */
function colorValue(next) {
  const [group, key, more] = next.split('.');
  if (group === 'SdsPalette' && key === 'static') return t.SdsPalette.static[more];
  if (more !== undefined || !t.semanticColorSteps[group]) return undefined;
  return t.SdsSemanticColors.light[group][key];
}

/** Every replacement an entry names: `next` and each `byContext` candidate. */
const targets = (entry) => [entry.next, ...Object.values(entry.byContext ?? {})].filter((n) => n !== null);

function checkEntry(where, entry) {
  assert.equal(typeof entry.exact, 'boolean', `${where}: exact`);
  assert.equal(typeof entry.needsVerification, 'boolean', `${where}: needsVerification`);
  if (entry.next === null && !entry.byContext) assert.ok(entry.reason, `${where}: a null next says why`);
  if (entry.byContext) assert.equal(entry.needsVerification, true, `${where}: a context choice needs a person`);
  if (!entry.exact) assert.equal(entry.needsVerification, true, `${where}: a change on screen needs verification`);
  if (entry.decision) assert.ok(map.decisions[entry.decision], `${where}: decision ${entry.decision} is recorded`);
}

test('every color mapping names an existing TDS name and an existing role, and exact is true to the light values', () => {
  for (const { previous, by } of map.colors) {
    const [api, name] = previous.split('.');
    assert.equal(api, 'SdsColors');
    assert.ok(t.SdsColors[name], `${previous} is not an SdsColors name`);
    for (const [use, entry] of Object.entries(by)) {
      const where = `${previous} ${use}`;
      assert.ok(USES.has(use), `${where}: unknown use`);
      checkEntry(where, entry);
      const values = targets(entry).map((next) => {
        const value = colorValue(next);
        assert.ok(value, `${where}: ${next} names no role or static palette value`);
        return value;
      });
      const same = values.length > 0 && values.every((v) => deltaE(parseColor(t.SdsColors[name]), parseColor(v)) < 0.5);
      assert.equal(entry.exact, same, `${where}: exact says ${entry.exact}, the values say ${same}`);
    }
  }
});

test('every spacing and radius mapping names a token of the same value', () => {
  for (const [scale, tokens, api] of [[map.spacing, t.SdsSpacing, 'SdsSpacing'], [map.radius, t.SdsRadius, 'SdsRadius']]) {
    for (const [value, entry] of Object.entries(scale)) {
      checkEntry(`${api} ${value}`, entry);
      const [prefix, key] = entry.next.split('.');
      assert.equal(prefix, api);
      assert.ok(key in tokens, `${entry.next} does not exist`);
      if (value !== 'pill') assert.equal(tokens[key], Number(value), `${value} maps to ${entry.next} = ${tokens[key]}`);
    }
  }
  assert.equal(t.SdsRadius[map.radius.pill.next.split('.')[1]], 9999);
});

test('every type mapping names a step of the scale or a Txt weight', () => {
  for (const [size, entry] of Object.entries(map.fontSize)) {
    checkEntry(`fontSize ${size}`, entry);
    const step = t.SdsTypeScale[entry.next];
    assert.ok(step, `fontSize ${size}: ${entry.next} is not a step`);
    assert.equal(entry.exact, step.fontSize === Number(size), `fontSize ${size}: exact`);
  }
  for (const [weight, entry] of Object.entries(map.fontWeight)) {
    checkEntry(`fontWeight ${weight}`, entry);
    assert.ok(WEIGHTS.has(entry.next), `fontWeight ${weight}: ${entry.next} is not a Txt weight`);
  }
});
