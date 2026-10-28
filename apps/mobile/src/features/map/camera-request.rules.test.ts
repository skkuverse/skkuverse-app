/**
 * What a camera settle decides about the campus toggle (ADR 0008), as the campus
 * screen's idle handler has decided it: agreement clears the card, an explicit
 * request that lands on a campus switches silently, and drift offers a card
 * unless a toggle pick or a dismissal silenced it.
 */

import { describe, it, expect } from 'vitest';
import type { CampusSuggestion } from './campus-proximity.types';
import {
  decideCameraIdle,
  decideRestore,
  reduceCameraRequest,
  type CameraRequest,
  type DecideCameraIdleInputs,
  type DecideRestoreInputs,
} from './camera-request.rules';
import { EXPLICIT_CAMERA_RESULT_WINDOW_MS } from './camera.constants';

const NOW = 1_000_000;
const SWITCH: CampusSuggestion = { campus: 'nsc', label: '자과캠', variant: 'switch' };
const SHOW: CampusSuggestion = { campus: 'hssc', label: '인사캠', variant: 'show' };
const LOCATE: CameraRequest = { kind: 'locate', at: NOW - 1000 };
const CHIP: CameraRequest = { kind: 'chip', at: NOW - 1000 };
const SHEET: CameraRequest = { kind: 'sheet', at: NOW - 1000 };
const LAUNCH: CameraRequest = { kind: 'launch', at: NOW - 1000 };
const STALE: CameraRequest = { kind: 'locate', at: NOW - EXPLICIT_CAMERA_RESULT_WINDOW_MS };

const inputs = (over: Partial<DecideCameraIdleInputs>): DecideCameraIdleInputs => ({
  tab: 'map',
  resolved: null,
  request: null,
  now: NOW,
  silenced: false,
  dismissedKey: null,
  ...over,
});

describe('decideCameraIdle', () => {
  it.each([
    // [label, inputs, decision, request left pending]
    ['agreement with no request', {}, { kind: 'agree' }, null],
    ['agreement while a locate waits for its camera', { request: LOCATE }, { kind: 'agree' }, LOCATE],
    ['agreement after the locate window ran out', { request: STALE }, { kind: 'agree' }, null],
    ['a locate landing on a campus', { resolved: SWITCH, request: LOCATE }, { kind: 'switch', campus: 'nsc' }, null],
    ['a chip landing on a campus', { resolved: SWITCH, request: CHIP }, { kind: 'switch', campus: 'nsc' }, null],
    ['a locate landing off both campuses', { resolved: SHOW, request: LOCATE }, { kind: 'show', suggestion: SHOW }, null],
    [
      'an explicit result after a toggle pick',
      { resolved: SHOW, request: LOCATE, silenced: true },
      { kind: 'show', suggestion: SHOW },
      null,
    ],
    [
      'an explicit result the user once dismissed',
      { resolved: SWITCH, request: CHIP, dismissedKey: 'nsc:switch' },
      { kind: 'switch', campus: 'nsc' },
      null,
    ],
    ['drift onto the other campus', { resolved: SWITCH }, { kind: 'show', suggestion: SWITCH }, null],
    ['drift after the request window ran out', { resolved: SWITCH, request: STALE }, { kind: 'show', suggestion: SWITCH }, null],
    ['drift after a toggle pick', { resolved: SWITCH, silenced: true }, { kind: 'none' }, null],
    ['drift to a card other than the dismissed one', { resolved: SWITCH, dismissedKey: 'hssc:show' }, { kind: 'show', suggestion: SWITCH }, null],
    ['drift to the very card dismissed', { resolved: SHOW, dismissedKey: 'hssc:show' }, { kind: 'none' }, null],
    ['a launch at a user off both campuses', { resolved: SHOW, request: LAUNCH }, { kind: 'show', suggestion: SHOW }, null],
    ['a launch at a user after a toggle pick', { resolved: SHOW, request: LAUNCH, silenced: true }, { kind: 'show', suggestion: SHOW }, null],
    ['a sheet framing the other campus', { resolved: SWITCH, request: SHEET }, { kind: 'none' }, null],
    ['a settle in another tab', { tab: 'transit', resolved: SWITCH, request: LOCATE }, { kind: 'none' }, LOCATE],
  ] as const)('%s', (_label, over, decision, pending) => {
    expect(decideCameraIdle(inputs(over))).toEqual({ decision, pending });
  });
});

describe('decideRestore', () => {
  const restoreInputs = (over: Partial<DecideRestoreInputs>): DecideRestoreInputs => ({
    tab: 'map',
    resolved: null,
    request: null,
    now: NOW,
    ...over,
  });

  it.each([
    // [label, inputs, decision]
    ['a locate still waiting for its camera', { request: LOCATE, resolved: SWITCH }, { kind: 'skip' }],
    ['a chip still waiting for its camera', { request: CHIP }, { kind: 'skip' }],
    ['a locate, in another tab', { tab: 'transit', request: LOCATE }, { kind: 'skip' }],
    ['a restore onto the other campus', { resolved: SWITCH }, { kind: 'move', request: 'sheet' }],
    ['a restore off both campuses', { resolved: SHOW }, { kind: 'move', request: 'sheet' }],
    ['a restore the toggle agrees with', {}, { kind: 'move', request: null }],
    ['a restore after the locate window ran out', { request: STALE, resolved: SWITCH }, { kind: 'move', request: 'sheet' }],
    ['a restore over an earlier restore', { request: SHEET, resolved: SWITCH }, { kind: 'move', request: 'sheet' }],
    ['an agreeing restore over an earlier restore', { request: SHEET }, { kind: 'move', request: null }],
    ['a restore in another tab', { tab: 'transit', resolved: SWITCH }, { kind: 'move', request: null }],
  ] as const)('%s', (_label, over, decision) => {
    expect(decideRestore(restoreInputs(over))).toEqual(decision);
  });

  /** The host's request slot after a restore: a stamp replaces it, anything else leaves it. */
  function slotAfterRestore(request: CameraRequest | null, restored: CampusSuggestion | null): CameraRequest | null {
    const restore = decideRestore(restoreInputs({ request, resolved: restored }));
    return restore.kind === 'move' && restore.request ? { kind: restore.request, at: NOW } : request;
  }

  it('lets a locate pressed just before a card is dismissed still switch the campus', () => {
    // Arrange: the dismissal reveals a sheet framed on the selected campus.
    const pending = slotAfterRestore(LOCATE, null);

    // Act: the GPS fix lands on the other campus.
    const settle = decideCameraIdle(inputs({ resolved: SWITCH, request: pending }));

    // Assert
    expect(settle.decision).toEqual({ kind: 'switch', campus: 'nsc' });
  });

  it('leaves the drift card of the next pan alone after a restore the toggle agrees with', () => {
    // Arrange
    const restoreSettle = decideCameraIdle(inputs({ request: slotAfterRestore(null, null) }));

    // Act: the user pans onto the other campus a moment later.
    const pan = decideCameraIdle(inputs({ resolved: SWITCH, request: restoreSettle.pending }));

    // Assert
    expect(pan.decision).toEqual({ kind: 'show', suggestion: SWITCH });
  });

  it('raises no card for a restore onto the other campus', () => {
    // Act
    const settle = decideCameraIdle(inputs({ resolved: SWITCH, request: slotAfterRestore(null, SWITCH) }));

    // Assert
    expect(settle).toEqual({ decision: { kind: 'none' }, pending: null });
  });
});

describe('reduceCameraRequest: the one request slot a settle answers', () => {
  const at = (ms: number) => NOW + ms;

  it('keeps a locate through the idle tracking emits at the old position, and switches on the real fix', () => {
    // Arrange
    const raised = reduceCameraRequest(null, { type: 'raise', kind: 'locate', at: at(0) });

    // Act: the first idle comes while the camera is still where the toggle agrees.
    const atOld = decideCameraIdle(inputs({ request: raised, resolved: null, now: at(100) }));
    const pending = reduceCameraRequest(raised, { type: 'settle', pending: atOld.pending });
    const atFix = decideCameraIdle(inputs({ request: pending, resolved: SWITCH, now: at(1500) }));

    // Assert
    expect(pending).toEqual({ kind: 'locate', at: at(0) });
    expect(atFix).toEqual({ decision: { kind: 'switch', campus: 'nsc' }, pending: null });
  });

  it('drops a locate whose permission was refused, so the next pan reads as drift', () => {
    // Arrange
    const raised = reduceCameraRequest(null, { type: 'raise', kind: 'locate', at: at(0) });

    // Act
    const cancelled = reduceCameraRequest(raised, { type: 'cancel' });
    const pan = decideCameraIdle(inputs({ request: cancelled, resolved: SWITCH, now: at(800) }));

    // Assert
    expect(cancelled).toBeNull();
    expect(pan.decision).toEqual({ kind: 'show', suggestion: SWITCH });
  });

  it('drops a locate still waiting when the user picks a campus', () => {
    // Arrange
    const raised = reduceCameraRequest(null, { type: 'raise', kind: 'locate', at: at(0) });

    // Act
    const picked = reduceCameraRequest(raised, { type: 'cancel' });

    // Assert
    expect(picked).toBeNull();
  });

  it('lets a later request replace the one waiting', () => {
    // Act
    const next = reduceCameraRequest(LOCATE, { type: 'raise', kind: 'chip', at: at(0) });

    // Assert
    expect(next).toEqual({ kind: 'chip', at: at(0) });
  });

  it('switches silently for a chip whose camera settles inside its window, and asks once the window has passed', () => {
    // Arrange
    const chip = reduceCameraRequest(null, { type: 'raise', kind: 'chip', at: at(0) });

    // Act
    const inside = decideCameraIdle(inputs({ request: chip, resolved: SWITCH, now: at(EXPLICIT_CAMERA_RESULT_WINDOW_MS - 1) }));
    const after = decideCameraIdle(inputs({ request: chip, resolved: SWITCH, now: at(EXPLICIT_CAMERA_RESULT_WINDOW_MS) }));

    // Assert
    expect(inside.decision).toEqual({ kind: 'switch', campus: 'nsc' });
    expect(after.decision).toEqual({ kind: 'show', suggestion: SWITCH });
  });

  describe("a padding change stamps 'sheet' only for a sheet just pushed on the map tab", () => {
    const FRESH = { camera: null };
    const FRAMED = { camera: { latitude: 37.58, longitude: 126.99, zoom: 16, tilt: 0, bearing: 0 } };

    it('stamps a fresh push, whose own frame is still waiting on its data', () => {
      // Act
      const stamped = reduceCameraRequest(null, { type: 'padding', tab: 'map', top: FRESH, at: at(0) });

      // Assert
      expect(stamped).toEqual({ kind: 'sheet', at: at(0) });
    });

    it.each([
      ['a revealed sheet, which the restore stamps', null, 'map', FRAMED],
      ['the root, with no sheet', null, 'map', null],
      ['the transit tab, which raises no card', null, 'transit', FRESH],
      ['a locate still waiting for its answer', LOCATE, 'map', FRESH],
    ] as const)('leaves the slot alone for %s', (_, pending, tab, top) => {
      // Act
      const next = reduceCameraRequest(pending, { type: 'padding', tab, top, at: at(0) });

      // Assert
      expect(next).toBe(pending);
    });
  });
});
