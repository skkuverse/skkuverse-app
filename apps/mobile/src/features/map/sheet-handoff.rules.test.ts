/**
 * The campus sheet's hand-off to a modal.
 *
 * Two sheets on one screen must not stack: when a detail modal asks for the
 * screen the campus sheet goes down first, the modal rises once it has landed,
 * and the campus sheet returns to the detent it left when the modal goes. The
 * cases that would hurt are at the seams — a second modal asking while the
 * sheet is already down, a detent reported mid-close, a release with nothing
 * to restore, and a request made while the sheet is still rising back, which
 * its settled report has not caught up with.
 */

import { describe, expect, it } from 'vitest';
import type { MapDetent } from './sheet-detents.constants';
import { IDLE_HANDOFF, releaseHandoff, requestHandoff, sheetSettled, type SheetHandoff } from './sheet-handoff.rules';

/** The live index as the stack reads it: closed, or up and nearest a level. */
const up = (nearest: MapDetent) => ({ closed: false, nearest });
const DOWN = { closed: true, nearest: 'min' as const };

describe('requestHandoff', () => {
  it('closes an open sheet and holds the modal until it lands', () => {
    const { state, close, present } = requestHandoff({ ...IDLE_HANDOFF, level: 'mid' }, up('mid'));
    expect(close).toBe(true);
    expect(present).toBe(false);
    expect(state.restoreTo).toBe('mid');
    expect(state.waiting).toBe(true);
  });

  it('presents at once when the sheet is already down', () => {
    // A second modal replacing the first: the sheet is closed for the first
    // one, so there is nothing to wait for and nothing to close.
    const down: SheetHandoff = { level: 'closed', restoreTo: 'mid', waiting: false };
    const { state, close, present } = requestHandoff(down, DOWN);
    expect(close).toBe(false);
    expect(present).toBe(true);
    expect(state.restoreTo, 'the first modal’s restore point survives').toBe('mid');
    expect(state.waiting).toBe(false);
  });

  it('closes a sheet still rising back, though its last report says closed', () => {
    // The peek was dismissed, the list is rising back to mid, and a row
    // is tapped before the rise lands. gorhom has reported nothing since the
    // close, so only the live index knows the sheet is up.
    const down = sheetSettled(requestHandoff({ ...IDLE_HANDOFF, level: 'mid' }, up('mid')).state, 'closed').state;
    const rising = releaseHandoff(down).state;
    const { state, close, present } = requestHandoff(rising, up('min'));
    expect(close).toBe(true);
    expect(present, 'the peek must not land on the rising list').toBe(false);
    expect(state.restoreTo, 'the detent it was rising to').toBe('mid');
    expect(state.waiting).toBe(true);
  });

  it('never remembers a closed sheet as the place to return to', () => {
    // A settled close under a sheet that is visibly up: a stale report.
    const { state } = requestHandoff({ level: 'closed', restoreTo: null, waiting: false }, up('max'));
    expect(state.restoreTo).toBe('max');
    const low = requestHandoff({ level: 'closed', restoreTo: null, waiting: false }, up('min')).state;
    expect(low.restoreTo).toBe('min');
  });

  it('keeps the earliest restore point across nested requests', () => {
    const first = requestHandoff({ ...IDLE_HANDOFF, level: 'max' }, up('max')).state;
    const second = requestHandoff({ ...first, level: 'min' }, up('min'));
    expect(second.state.restoreTo).toBe('max');
  });
});

describe('sheetSettled', () => {
  it('presents the waiting modal when the sheet reports closed', () => {
    const waiting = requestHandoff({ ...IDLE_HANDOFF, level: 'mid' }, up('mid')).state;
    const { state, present } = sheetSettled(waiting, 'closed');
    expect(present).toBe(true);
    expect(state.waiting).toBe(false);
    expect(state.level).toBe('closed');
  });

  it('does not present on a detent that is not closed', () => {
    // gorhom reports every settled detent through the same callback.
    const waiting = requestHandoff({ ...IDLE_HANDOFF, level: 'mid' }, up('mid')).state;
    const { state, present } = sheetSettled(waiting, 'min');
    expect(present).toBe(false);
    expect(state.waiting).toBe(true);
    expect(state.level).toBe('min');
  });

  it('tracks the detent and presents nothing when no modal is waiting', () => {
    const { state, present } = sheetSettled(IDLE_HANDOFF, 'max');
    expect(present).toBe(false);
    expect(state.level).toBe('max');
  });

  it('presents once, not on every later closed report', () => {
    const waiting = requestHandoff({ ...IDLE_HANDOFF, level: 'mid' }, up('mid')).state;
    const first = sheetSettled(waiting, 'closed');
    const again = sheetSettled(first.state, 'closed');
    expect(again.present).toBe(false);
  });
});

describe('releaseHandoff', () => {
  it('returns the sheet to the detent it left', () => {
    const waiting = requestHandoff({ ...IDLE_HANDOFF, level: 'mid' }, up('mid')).state;
    const down = sheetSettled(waiting, 'closed').state;
    const { state, snapTo } = releaseHandoff(down);
    expect(snapTo).toBe('mid');
    expect(state.restoreTo).toBe(null);
    expect(state.waiting).toBe(false);
  });

  it('records the sheet at the detent it is sent back to', () => {
    const waiting = requestHandoff({ ...IDLE_HANDOFF, level: 'max' }, up('max')).state;
    const down = sheetSettled(waiting, 'closed').state;
    expect(releaseHandoff(down).state.level).toBe('max');
  });

  it('snaps nowhere when no hand-off was in progress', () => {
    // A modal dismissed that never took the screen — the sheet is where the
    // user left it and must not jump.
    const { snapTo } = releaseHandoff({ ...IDLE_HANDOFF, level: 'max' });
    expect(snapTo).toBe(null);
  });

  it('drops a modal still waiting, so a cancelled hand-off cannot present later', () => {
    const waiting = requestHandoff({ ...IDLE_HANDOFF, level: 'mid' }, up('mid')).state;
    const { state } = releaseHandoff(waiting);
    expect(state.waiting).toBe(false);
    expect(sheetSettled(state, 'closed').present).toBe(false);
  });
});
