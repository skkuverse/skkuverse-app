/**
 * Boarding map card geometry.
 * The walking path is 정자역 3번 출구 from the server's stop catalog
 * (skkuverse-server PR #204, 2026-10-08; served as `map` since `fa2fd86`).
 */

import { describe, expect, it } from 'vitest';
import {
  ARROW_GAP_PT,
  MAX_CARD_ZOOM,
  arrowGapPt,
  cardPoints,
  describeMap,
  distanceMeters,
  fitCamera,
  metersPerPoint,
  trimPathEnd,
  type CardMap,
  type LatLng,
} from './boarding-map.rules';

const JEONGJA: LatLng[] = [
  { lat: 37.365922, lng: 127.107774 },
  { lat: 37.365882, lng: 127.107844 },
  { lat: 37.365712, lng: 127.107844 },
  { lat: 37.365699, lng: 127.107876 },
  { lat: 37.365581, lng: 127.107876 },
  { lat: 37.365499, lng: 127.107906 },
];

function pathLength(path: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += distanceMeters(path[i - 1], path[i]);
  return total;
}

describe('metersPerPoint', () => {
  it('uses the NAVER scale: half the 256 pt web maps at one zoom, halving per level', () => {
    expect(Math.abs(metersPerPoint(0, 0) - 78271.51696) < 1e-6).toBeTruthy();
    expect(Math.abs(metersPerPoint(37.5, 17) * 2 - metersPerPoint(37.5, 16)) < 1e-9).toBeTruthy();
  });
});

describe('fitCamera', () => {
  it('centres on the path and keeps every point inside the padded card', () => {
    const cam = fitCamera(JEONGJA, 335, 180, 36);
    const mpp = metersPerPoint(cam.latitude, cam.zoom);
    for (const p of JEONGJA) {
      const dx = distanceMeters({ lat: cam.latitude, lng: cam.longitude }, { lat: cam.latitude, lng: p.lng }) / mpp;
      const dy = distanceMeters({ lat: cam.latitude, lng: cam.longitude }, { lat: p.lat, lng: cam.longitude }) / mpp;
      expect(dx <= 335 / 2 - 36 + 0.5, `x ${dx}`).toBeTruthy();
      expect(dy <= 180 / 2 - 36 + 0.5, `y ${dy}`).toBeTruthy();
    }
  });

  it('caps the zoom for a walk of a few metres', () => {
    const cam = fitCamera(JEONGJA.slice(0, 2), 335, 180, 36);
    expect(cam.zoom).toBe(MAX_CARD_ZOOM);
  });

  it('zooms out past the cap only for a walk wider than the card', () => {
    const far: LatLng[] = [JEONGJA[0], { lat: 37.3755, lng: 127.1195 }];
    expect(fitCamera(far, 335, 180, 36).zoom < fitCamera(JEONGJA, 335, 180, 36).zoom).toBeTruthy();
  });
});

describe('trimPathEnd', () => {
  it('shortens the path by the given distance and keeps its start', () => {
    const trimmed = trimPathEnd(JEONGJA, 5);
    expect(trimmed[0]).toStrictEqual(JEONGJA[0]);
    expect(Math.abs(pathLength(JEONGJA) - pathLength(trimmed) - 5) < 0.01).toBeTruthy();
  });

  it('moves the end point back along the last segment', () => {
    const trimmed = trimPathEnd(JEONGJA, 2);
    const end = trimmed[trimmed.length - 1];
    expect(trimmed.length).toBe(JEONGJA.length);
    expect(Math.abs(distanceMeters(end, JEONGJA[5]) - 2) < 0.01).toBeTruthy();
  });

  it('crosses vertices when the cut is longer than the last segment', () => {
    const last = distanceMeters(JEONGJA[4], JEONGJA[5]);
    const trimmed = trimPathEnd(JEONGJA, last + 1);
    expect(trimmed.length).toBe(JEONGJA.length - 1);
  });

  it('never cuts more than half the path', () => {
    const trimmed = trimPathEnd(JEONGJA, 10_000);
    expect(Math.abs(pathLength(trimmed) - pathLength(JEONGJA) / 2) < 0.01).toBeTruthy();
    expect(trimmed.length >= 2).toBeTruthy();
  });

  it('leaves the path alone for no cut or a single point', () => {
    expect(trimPathEnd(JEONGJA, 0)).toStrictEqual(JEONGJA);
    expect(trimPathEnd(JEONGJA.slice(0, 1), 5)).toStrictEqual(JEONGJA.slice(0, 1));
  });
});

const STOP = JEONGJA[5];
const EXIT3 = { id: 'exit3', label: 'Exit 3', coords: JEONGJA[0] };
const BOARDING: CardMap = { markers: [EXIT3], paths: [{ from: 'exit3', to: 'stop', points: JEONGJA }] };
const DROP_OFF: CardMap = {
  markers: [EXIT3],
  paths: [{ from: 'stop', to: 'exit3', points: [...JEONGJA].reverse() }],
};
const PIN_ONLY: CardMap = { markers: [], paths: [] };

describe('cardPoints', () => {
  it('holds the stop, every marker and every walk point', () => {
    const points = cardPoints(STOP, BOARDING);
    expect(points.length).toBe(1 + 1 + JEONGJA.length);
    expect(points[0]).toStrictEqual(STOP);
  });

  it('is the stop alone on a pin-only card, which the camera centres at the cap', () => {
    const cam = fitCamera(cardPoints(STOP, PIN_ONLY), 335, 180, 36);
    expect(cam.zoom).toBe(MAX_CARD_ZOOM);
    expect(Math.abs(cam.latitude - STOP.lat) < 1e-9 && Math.abs(cam.longitude - STOP.lng) < 1e-9).toBeTruthy();
  });
});

describe('arrowGapPt', () => {
  it('stops short of the pin, of an exit circle, and of nothing', () => {
    expect(arrowGapPt('stop', BOARDING)).toBe(ARROW_GAP_PT.stop);
    expect(arrowGapPt('exit3', DROP_OFF)).toBe(ARROW_GAP_PT.marker);
    expect(arrowGapPt('exit3', PIN_ONLY)).toBe(0);
  });
});

describe('describeMap', () => {
  it('names each walk from where it starts to where it ends', () => {
    expect(describeMap('Jeongja Stn. Exit 3', BOARDING)).toBe('Exit 3 → Jeongja Stn. Exit 3');
    expect(describeMap('Jeongja Stn. Exit 2', DROP_OFF)).toBe('Jeongja Stn. Exit 2 → Exit 3');
  });

  it('names the stop and its markers when there is no walk', () => {
    expect(describeMap('Jeongja Stn. Exit 2', { markers: [EXIT3], paths: [] })).toBe('Jeongja Stn. Exit 2, Exit 3');
    expect(describeMap('Gangnam median', PIN_ONLY)).toBe('Gangnam median');
  });

  it('falls back to the stop when the marker at a walk end was dropped', () => {
    expect(describeMap('Jeongja Stn. Exit 3', { ...BOARDING, markers: [] })).toBe('Jeongja Stn. Exit 3');
  });
});
