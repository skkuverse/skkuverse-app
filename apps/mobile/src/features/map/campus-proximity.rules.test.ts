/**
 * Campus proximity.
 *
 * Coordinates are the real ones the server returns from `GET /map/config`, so a
 * campus moving on the server is a reason for these to be revisited rather than
 * a reason for them to keep passing.
 */

import { describe, expect, it } from 'vitest';
import {
  distanceMeters,
  resolveCampusSuggestion,
} from './campus-proximity.rules';
import type { CampusDef } from './map-config.types';
import { DEFAULT_CAMPUS_RADIUS_M } from './map.constants';

const HSSC = { lat: 37.587241, lng: 126.992858 };
const NSC = { lat: 37.29358, lng: 126.974942 };

const campus = (over: Partial<CampusDef> & Pick<CampusDef, 'id'>): CampusDef => ({
  label: over.id === 'hssc' ? '인사캠' : '자과캠',
  centerLat: over.id === 'hssc' ? HSSC.lat : NSC.lat,
  centerLng: over.id === 'hssc' ? HSSC.lng : NSC.lng,
  defaultZoom: 15.8,
  defaultTilt: 0,
  defaultBearing: 0,
  ...over,
});

const CAMPUSES: CampusDef[] = [campus({ id: 'hssc' }), campus({ id: 'nsc' })];

/** Metres north of a point, near enough at these latitudes. */
const northOf = (lat: number, metres: number) => lat + metres / 111_320;

describe('distanceMeters', () => {
  it('measures the gap between the two campuses', () => {
    const d = distanceMeters(HSSC.lat, HSSC.lng, NSC.lat, NSC.lng);
    // The measured 32,692m, with room for the earth-radius constant to differ.
    expect(d > 32_000 && d < 33_500, `got ${d}`).toBeTruthy();
  });

  it('is zero for a point against itself', () => {
    expect(distanceMeters(HSSC.lat, HSSC.lng, HSSC.lat, HSSC.lng)).toBe(0);
  });
});

describe('resolveCampusSuggestion', () => {
  it('says nothing while the camera is on the selected campus', () => {
    expect(resolveCampusSuggestion({
        cameraLat: HSSC.lat,
        cameraLng: HSSC.lng,
        campuses: CAMPUSES,
        selectedCampus: 'hssc',
      })).toBe(null);
  });

  it('still says nothing just inside the selected campus radius', () => {
    expect(resolveCampusSuggestion({
        cameraLat: northOf(HSSC.lat, DEFAULT_CAMPUS_RADIUS_M - 50),
        cameraLng: HSSC.lng,
        campuses: CAMPUSES,
        selectedCampus: 'hssc',
      })).toBe(null);
  });

  it('offers a switch when the camera sits on the other campus', () => {
    const s = resolveCampusSuggestion({
      cameraLat: HSSC.lat,
      cameraLng: HSSC.lng,
      campuses: CAMPUSES,
      selectedCampus: 'nsc',
    });
    expect(s).toStrictEqual({ campus: 'hssc', label: '인사캠', variant: 'switch' });
  });

  it('offers to show the nearest campus when the camera is on neither', () => {
    // Just outside 인사캠, and far from 자과캠.
    const s = resolveCampusSuggestion({
      cameraLat: northOf(HSSC.lat, DEFAULT_CAMPUS_RADIUS_M + 200),
      cameraLng: HSSC.lng,
      campuses: CAMPUSES,
      selectedCampus: 'nsc',
    });
    expect(s).toStrictEqual({ campus: 'hssc', label: '인사캠', variant: 'show' });
  });

  it('offers the selected campus back when the camera drifts off it', () => {
    // Not a no-op: the toggle does not move, but this is the way home.
    const s = resolveCampusSuggestion({
      cameraLat: northOf(HSSC.lat, DEFAULT_CAMPUS_RADIUS_M + 200),
      cameraLng: HSSC.lng,
      campuses: CAMPUSES,
      selectedCampus: 'hssc',
    });
    expect(s).toStrictEqual({ campus: 'hssc', label: '인사캠', variant: 'show' });
  });

  it('picks the nearer campus from the midpoint between them', () => {
    const midLat = (HSSC.lat + NSC.lat) / 2;
    const nudgedToNsc = midLat - 0.01;
    const s = resolveCampusSuggestion({
      cameraLat: nudgedToNsc,
      cameraLng: (HSSC.lng + NSC.lng) / 2,
      campuses: CAMPUSES,
      selectedCampus: 'hssc',
    });
    expect(s?.campus).toBe('nsc');
    expect(s?.variant).toBe('show');
  });

  it("honours the server's radius over the fallback", () => {
    // A 100m campus: a point 500m out is now outside it, where the 1000m
    // fallback would have called it inside and returned null.
    const tight: CampusDef[] = [campus({ id: 'hssc', radiusM: 100 }), campus({ id: 'nsc' })];
    const s = resolveCampusSuggestion({
      cameraLat: northOf(HSSC.lat, 500),
      cameraLng: HSSC.lng,
      campuses: tight,
      selectedCampus: 'hssc',
    });
    expect(s?.variant).toBe('show');
  });

  it('says nothing when the config carries no campuses', () => {
    expect(resolveCampusSuggestion({
        cameraLat: HSSC.lat,
        cameraLng: HSSC.lng,
        campuses: [],
        selectedCampus: 'hssc',
      })).toBe(null);
  });
});
