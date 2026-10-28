import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RULES, treeViolations } from './comments/tree.mjs';

const violations = treeViolations();

for (const rule of RULES) {
  test(`${rule.name}: every comment in scope follows it`, () => {
    const found = violations.filter((v) => v.rule === rule.name).map((v) => `${v.file}:${v.line}: ${v.message}`);
    assert.deepEqual(found, [], 'run node scripts/architecture/comments.mjs --report for the list');
  });
}
