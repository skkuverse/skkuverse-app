/** SEE: docs/decisions/0008-campus-camera-reconciliation.md */

import type { Campus } from '@skkuverse/shared';
import type { CampusSuggestion, DismissedSuggestionKey } from './campus-proximity.types';
import type { MapTabId } from './map-config.types';
import type { MapCameraSnapshot } from './sheet-stack.types';
import { EXPLICIT_CAMERA_RESULT_WINDOW_MS } from './camera.constants';

/** WHY: `launch` is a cold start at the user, answered as a locate press is (ADR 0022 d1). */
export type CameraRequestKind = 'locate' | 'chip' | 'sheet' | 'launch';

export interface CameraRequest {
  kind: CameraRequestKind;
  at: number;
}

/**
 * QUIRK(naver-map): switching tracking on emits an idle at the old position, so only a settle that produces a
 * decision consumes a request. SEE: docs/decisions/0008-campus-camera-reconciliation.md ("Consequences")
 */
export type CameraRequestEvent =
  | { type: 'raise'; kind: CameraRequestKind; at: number }
  | { type: 'cancel' }
  /**
   * WHY: only a sheet just pushed and framing nothing reads the padding settle as its own; a revealed sheet is
   * the restore's to stamp, and a waiting locate or chip keeps its answer.
   */
  | { type: 'padding'; tab: MapTabId; top: { camera: MapCameraSnapshot | null } | null; at: number }
  | { type: 'settle'; pending: CameraRequest | null };

export function reduceCameraRequest(pending: CameraRequest | null, event: CameraRequestEvent): CameraRequest | null {
  switch (event.type) {
    case 'raise':
      return { kind: event.kind, at: event.at };
    case 'cancel':
      return null;
    case 'padding':
      if (event.tab !== 'map' || pending !== null || !event.top || event.top.camera !== null) return pending;
      return { kind: 'sheet', at: event.at };
    case 'settle':
      return event.pending;
  }
}

export type CameraIdleDecision =
  | { kind: 'agree' }
  | { kind: 'switch'; campus: Campus }
  | { kind: 'show'; suggestion: CampusSuggestion }
  | { kind: 'none' };

export interface CameraIdleOutcome {
  decision: CameraIdleDecision;
  pending: CameraRequest | null;
}

export interface DecideCameraIdleInputs {
  tab: MapTabId;
  resolved: CampusSuggestion | null;
  request: CameraRequest | null;
  now: number;
  /** WHY: a toggle pick this session silences drift (ADR 0008 §3). */
  silenced: boolean;
  dismissedKey: DismissedSuggestionKey | null;
}

export function decideCameraIdle({
  tab,
  resolved,
  request,
  now,
  silenced,
  dismissedKey,
}: DecideCameraIdleInputs): CameraIdleOutcome {
  // WHY: the ADR 0008 card belongs to the map tab's task alone.
  if (tab !== 'map') return { decision: { kind: 'none' }, pending: request };

  const explicit = request !== null && now - request.at < EXPLICIT_CAMERA_RESULT_WINDOW_MS ? request : null;

  // WHY: an explicit request stays unanswered, since its camera may not have arrived yet.
  if (resolved === null) return { decision: { kind: 'agree' }, pending: explicit };

  if (explicit) {
    // WHY: opening a place never changes the campus selection (ADR 0022 d5).
    if (explicit.kind === 'sheet') return { decision: { kind: 'none' }, pending: null };
    if (resolved.variant === 'switch') return { decision: { kind: 'switch', campus: resolved.campus }, pending: null };
    // WHY: offered even after a toggle pick, since this answers a request the user made a second ago.
    return { decision: { kind: 'show', suggestion: resolved }, pending: null };
  }

  if (silenced || dismissedKey === `${resolved.campus}:${resolved.variant}`) {
    return { decision: { kind: 'none' }, pending: null };
  }
  return { decision: { kind: 'show', suggestion: resolved }, pending: null };
}

export type RestoreDecision =
  | { kind: 'skip' }
  | { kind: 'move'; request: 'sheet' | null };

export interface DecideRestoreInputs {
  tab: MapTabId;
  resolved: CampusSuggestion | null;
  request: CameraRequest | null;
  now: number;
}

/**
 * WHY: a locate or chip still inside its window outranks the restore (ADR 0008 §3). Otherwise the restore stamps
 * `'sheet'` only when its settle could raise a card; a stamp the toggle agrees with stayed pending and
 * silenced the drift card of the user's next pan.
 */
export function decideRestore({ tab, resolved, request, now }: DecideRestoreInputs): RestoreDecision {
  const explicitPending =
    request !== null && request.kind !== 'sheet' && now - request.at < EXPLICIT_CAMERA_RESULT_WINDOW_MS;
  if (explicitPending) return { kind: 'skip' };
  return { kind: 'move', request: tab === 'map' && resolved !== null ? 'sheet' : null };
}
