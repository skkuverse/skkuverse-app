/**
 * A place opened from a page above the tabs (ADR 0022 d7, amended 2026-10-27):
 * its entry carries the page as `origin`, a user's close of it returns there,
 * and nothing else does.
 */

import { describe, expect, it } from 'vitest';
import { EMPTY_TASK, decideBack, dismissAction, reduceMapTask, toLinkOpening, topEntry } from './map-task.rules';
import { decideClose, toPageOrigin, type CloseTrigger } from './sheet-close.rules';
import type { MapSheetRequest, MapTaskState, PageOrigin } from './sheet-stack.types';

const ROUTE: PageOrigin = { href: '/routes/[routeId]', params: { routeId: 'hssc-to-nsc', source: 'return' } };
const STATION: MapSheetRequest = { kind: 'subway_station', stationId: '0150', source: 'route_detail' };
const OTHER_STATION: MapSheetRequest = { kind: 'subway_station', stationId: '0151', source: 'pin' };
const STOP: MapSheetRequest = { kind: 'bus_stop', stopId: '01-123', source: 'route_detail' };
const LINE: MapSheetRequest = { kind: 'line', groupId: 'hssc', source: 'tab' };
const CHIP: MapSheetRequest = { kind: 'chip', chipId: 'eskara26_view_bar' };

const keyOf = (request: MapSheetRequest) => JSON.stringify(request);

function opened(
  state: MapTaskState,
  type: 'push' | 'select' | 'open',
  request: MapSheetRequest,
  origin?: PageOrigin,
): MapTaskState {
  return reduceMapTask(state, { type, request, key: keyOf(request), layers: {}, detent: 'min', ...(origin && { origin }) });
}

/** A line the user had open, then a station a route page opened over it. */
const fromPage = opened(opened(EMPTY_TASK, 'push', LINE), 'push', STATION, ROUTE);

describe('the reducer carries a page origin', () => {
  it('on the entry a push, a select or an open creates', () => {
    for (const type of ['push', 'select', 'open'] as const) {
      expect(topEntry(opened(EMPTY_TASK, type, STATION, ROUTE))?.origin).toEqual(ROUTE);
    }
  });

  it('on no entry an ordinary opening creates', () => {
    expect(topEntry(opened(EMPTY_TASK, 'push', STATION))).not.toHaveProperty('origin');
  });

  it('to the entry a select puts in place of a top of the same kind: a pin swapped in still returns to the page', () => {
    const swapped = opened(fromPage, 'select', OTHER_STATION);

    expect(topEntry(swapped)?.request).toBe(OTHER_STATION);
    expect(topEntry(swapped)?.origin).toEqual(ROUTE);
  });

  it('to no entry a select pushes over a top of another kind', () => {
    const above = opened(fromPage, 'select', STOP);

    expect(topEntry(above)).not.toHaveProperty('origin');
    expect(above.stack.at(-2)?.origin).toEqual(ROUTE);
  });

  it('onto the same sheet already on top, which the push otherwise leaves alone', () => {
    const again = opened(opened(EMPTY_TASK, 'push', STATION), 'push', STATION, ROUTE);

    expect(again.stack).toHaveLength(1);
    expect(topEntry(again)?.origin).toEqual(ROUTE);
  });

  it('nowhere once popToRoot or an open from outside has cleared the stack', () => {
    expect(reduceMapTask(fromPage, { type: 'popToRoot' }).stack).toStrictEqual([]);
    expect(opened(fromPage, 'open', STOP).stack.every((entry) => entry.origin === undefined)).toBe(true);
  });

  it('nowhere after dropOrigins, which keeps every entry otherwise', () => {
    const dropped = reduceMapTask(fromPage, { type: 'dropOrigins' });

    expect(dropped.stack.map((entry) => entry.request)).toStrictEqual([LINE, STATION]);
    expect(dropped.stack.every((entry) => !('origin' in entry))).toBe(true);
  });

  it('dropOrigins on a task with none returns the same task, so leaving a tab re-renders nothing', () => {
    const plain = opened(EMPTY_TASK, 'push', LINE);

    expect(reduceMapTask(plain, { type: 'dropOrigins' })).toBe(plain);
  });
});

describe('decideClose: only a close the user makes returns to the page', () => {
  const top = topEntry(fromPage)!;
  const table: [CloseTrigger, MapTaskStateAction, PageOrigin | null][] = [
    [{ kind: 'close' }, { type: 'pop' }, ROUTE],
    [{ kind: 'back' }, { type: 'pop' }, ROUTE],
    [{ kind: 'cardDismiss', id: top.id }, { type: 'dismiss', id: top.id }, ROUTE],
    [{ kind: 'retap' }, { type: 'popToRoot' }, null],
    [{ kind: 'linkArrival' }, { type: 'popToRoot' }, null],
    [{ kind: 'linkArrival', id: top.id }, { type: 'dismiss', id: top.id }, null],
    [{ kind: 'navigateAway', id: top.id }, null, null],
    [{ kind: 'releaseChip' }, { type: 'releaseChip' }, null],
    [{ kind: 'dataGone', id: top.id }, { type: 'dismiss', id: top.id }, null],
  ];

  it.each(table)('%o: %o, returning to %o', (trigger, action, returnTo) => {
    expect(decideClose(fromPage, trigger)).toStrictEqual({ action, returnTo });
  });

  it('returns nowhere when the closed sheet was opened on the map', () => {
    const plain = opened(EMPTY_TASK, 'push', STATION);

    expect(decideClose(plain, { kind: 'close' })).toStrictEqual({ action: { type: 'pop' }, returnTo: null });
  });

  it('returns nowhere from a sheet pushed over the origin, and to the page from the origin once revealed', () => {
    const above = opened(fromPage, 'push', STOP);

    expect(decideClose(above, { kind: 'close' }).returnTo).toBeNull();
    expect(decideClose(reduceMapTask(above, { type: 'pop' }), { kind: 'close' }).returnTo).toEqual(ROUTE);
  });

  it('returns from the card that carried the origin wherever it sat, and nowhere for an id already gone', () => {
    const chipOver = opened(fromPage, 'push', CHIP);
    const station = chipOver.stack.at(-2)!;

    expect(decideClose(chipOver, { kind: 'cardDismiss', id: station.id }).returnTo).toEqual(ROUTE);
    expect(decideClose(chipOver, { kind: 'cardDismiss', id: 999 })).toStrictEqual({ action: { type: 'dismiss', id: 999 }, returnTo: null });
  });
});

type MapTaskStateAction = ReturnType<typeof decideClose>['action'];

describe('back with a page origin on top', () => {
  it('pops at once, without collapsing a raised sheet first: the user is going back to the page', () => {
    const raised = reduceMapTask(fromPage, { type: 'setDetent', detent: 'max' });

    expect(decideBack(raised, () => 'min')).toStrictEqual({ kind: 'pop' });
  });

  it('still collapses a raised sheet that came from the map', () => {
    const raised = reduceMapTask(opened(EMPTY_TASK, 'push', STATION), { type: 'setDetent', detent: 'max' });

    expect(decideBack(raised, () => 'min')).toStrictEqual({ kind: 'collapse', to: 'min' });
  });
});

describe('dismissAction names a close that returns to the page', () => {
  it('as return, whatever is below it', () => {
    expect(dismissAction(fromPage)).toBe('return');
    expect(dismissAction(opened(EMPTY_TASK, 'push', STATION, ROUTE))).toBe('return');
  });
});

describe('toLinkOpening: a place a page opened stacks on what is open', () => {
  it('pushes, never replacing the sheet the user had open, whatever the source', () => {
    expect(toLinkOpening('route_detail', ROUTE)).toBe('push');
    expect(toLinkOpening('deeplink', ROUTE)).toBe('push');
  });
});

describe('toPageOrigin', () => {
  it('marks the page a return, over the source it was opened with', () => {
    expect(toPageOrigin({ href: '/bus/schedule', params: { groupId: 'campus', source: 'tab' } })).toStrictEqual({
      href: '/bus/schedule',
      params: { groupId: 'campus', source: 'return' },
    });
  });

  it('marks a page that named no source too', () => {
    expect(toPageOrigin({ href: '/routes/[routeId]', params: { routeId: 'a' } }).params).toStrictEqual({
      routeId: 'a',
      source: 'return',
    });
  });
});
