import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeCommentViolations } from './routes.mjs';

const SOURCE = [
  '// GET /map/config?campus=hssc',
  '/**',
  ' * POST /games/run. Records one run.',
  ' */',
  '// The handler behind GET /map/config.',
  '// GETS no route here',
].join('\n');

test('finds a route at the start of a comment line in a client', () => {
  // Act & Assert
  assert.deepEqual(routeCommentViolations('apps/mobile/src/features/map/map.client.ts', SOURCE), [
    { line: 1, message: 'GET /map/config?campus=hssc' },
    { line: 3, message: 'POST /games/run' },
  ]);
});

test('checks only clients: the file whose code names the endpoint', () => {
  // Act & Assert
  assert.deepEqual(routeCommentViolations('apps/mobile/src/features/map/map.schema.ts', SOURCE), []);
});
