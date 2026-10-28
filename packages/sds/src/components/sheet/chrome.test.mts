/**
 * Sheet chrome interpolation.
 *
 * Four values travel together as a glass sheet is dragged — how far along the
 * travel it is, the card's gap from the screen edges, its corner radius, and
 * how opaque it is — and the awkward cases are all at the ends of the range
 * rather than in the middle.
 *
 * NOTE: packages/sds runs `node --test`, a different runner from packages/shared's
 * vitest. `chrome.ts` imports nothing at all, so it loads under plain Node.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  sheetChromeAt,
  sheetPageProgress,
  sheetPageRamp,
  bottomCornerRadius,
  PAGE_RAMP_START,
  SHEET_FLOAT_INSET,
  SHEET_RADIUS_FLOATING,
  SHEET_RADIUS_ATTACHED,
  DISPLAY_CORNER_RADIUS,
  fillAt,
  sheetCardShape,
  sheetContentClip,
  SHEET_CLIP_REACH,
  type SheetCardKind,
} from './chrome.ts';

/** A three-detent sheet, the campus sheet's shape. */
const LAST = 2;

describe('sheetChromeAt', () => {
  it('floats fully at the collapsed detent', () => {
    assert.deepEqual(sheetChromeAt(0, LAST), {
      progress: 0,
      sideInset: SHEET_FLOAT_INSET,
      radius: SHEET_RADIUS_FLOATING,
      fillOpacity: 0,
      handleOpacity: 1,
    });
  });

  it('is exactly the attached sheet at the top detent', () => {
    assert.deepEqual(sheetChromeAt(LAST, LAST), {
      progress: 1,
      sideInset: 0,
      radius: SHEET_RADIUS_ATTACHED,
      fillOpacity: 1,
      handleOpacity: 1,
    });
  });

  it('half-closes its gaps at the middle detent but stays pure glass', () => {
    const mid = sheetChromeAt(1, LAST);
    assert.equal(mid.progress, 0.5);
    assert.equal(mid.sideInset, SHEET_FLOAT_INSET / 2);
    assert.equal(mid.radius, (SHEET_RADIUS_FLOATING + SHEET_RADIUS_ATTACHED) / 2);
    // The whole point of ramping the fill over the final segment only.
    assert.equal(mid.fillOpacity, 0);
  });

  it('keeps the glass clear across the entire first half of the travel', () => {
    for (const index of [0, 0.25, 0.5, 0.75, 1]) {
      assert.equal(
        sheetChromeAt(index, LAST).fillOpacity,
        0,
        `fill should still be clear at index ${index}`,
      );
    }
  });

  it('dissolves the glass evenly across the final segment', () => {
    assert.equal(sheetChromeAt(1.5, LAST).fillOpacity, 0.5);
    assert.equal(sheetChromeAt(1.25, LAST).fillOpacity, 0.25);
  });

  it('holds the floating card through a downward over-drag', () => {
    // animatedIndex dips below 0 when the sheet is over-dragged past its lowest
    // detent. The card is on screen and under the finger, so it must not snap
    // to the opaque attached geometry.
    assert.deepEqual(sheetChromeAt(-0.3, LAST), sheetChromeAt(0, LAST));
  });

  it('clamps a closed sheet to the same floating card', () => {
    assert.deepEqual(sheetChromeAt(-1, LAST), sheetChromeAt(0, LAST));
  });

  it('never overshoots above the top detent', () => {
    assert.deepEqual(sheetChromeAt(LAST + 0.4, LAST), sheetChromeAt(LAST, LAST));
  });

  it('degrades a single-detent sheet to the plain attached sheet', () => {
    assert.deepEqual(sheetChromeAt(0, 0), {
      progress: 1,
      sideInset: 0,
      radius: SHEET_RADIUS_ATTACHED,
      fillOpacity: 1,
      handleOpacity: 1,
    });
  });

  it('moves its endpoint with the detent count', () => {
    // A fourth detent must make index 3 the attached one, not index 2.
    assert.equal(sheetChromeAt(3, 3).sideInset, 0);
    assert.equal(sheetChromeAt(3, 3).fillOpacity, 1);
    assert.equal(sheetChromeAt(2, 3).fillOpacity, 0);
  });

  it('ramps `progress` so a caller can close a gap it alone knows', () => {
    // A modal's bottom gap is measured from the window, not from the screen's
    // root view, so it cannot come out of this function — the caller scales its
    // own float-state gap by (1 - progress) and lands on the same schedule.
    const modalFloatGap = 96;
    assert.equal(modalFloatGap * (1 - sheetChromeAt(0, LAST).progress), modalFloatGap);
    assert.equal(modalFloatGap * (1 - sheetChromeAt(1, LAST).progress), modalFloatGap / 2);
    assert.equal(modalFloatGap * (1 - sheetChromeAt(LAST, LAST).progress), 0);
  });
});

describe('sheetPageProgress: the final-segment ramp', () => {
  it('is 0 up to the second-last detent, 1 at the last, and linear between', () => {
    assert.equal(sheetPageProgress(0, LAST), 0);
    assert.equal(sheetPageProgress(LAST - 1, LAST), 0);
    assert.equal(sheetPageProgress(LAST - 0.5, LAST), 0.5);
    assert.equal(sheetPageProgress(LAST, LAST), 1);
  });

  it('clamps an over-drag at either end', () => {
    assert.equal(sheetPageProgress(-1, LAST), 0);
    assert.equal(sheetPageProgress(LAST + 0.4, LAST), 1);
  });

  it('is the schedule the fill already follows', () => {
    for (const index of [0, 1, 1.25, 1.5, 2]) {
      assert.equal(sheetChromeAt(index, LAST).fillOpacity, sheetPageProgress(index, LAST));
    }
  });
});

describe('sheetPageRamp: the last half of the final segment', () => {
  it('is 0 until the final segment is half done, 1 at the last detent, and linear between', () => {
    assert.equal(PAGE_RAMP_START, 0.5);
    assert.equal(sheetPageRamp(0, LAST), 0);
    assert.equal(sheetPageRamp(LAST - 1, LAST), 0);
    assert.equal(sheetPageRamp(LAST - 0.5, LAST), 0);
    assert.equal(sheetPageRamp(LAST - 0.25, LAST), 0.5);
    assert.equal(sheetPageRamp(LAST, LAST), 1);
  });

  it('clamps an over-drag at either end', () => {
    assert.equal(sheetPageRamp(-1, LAST), 0);
    assert.equal(sheetPageRamp(LAST + 0.4, LAST), 1);
  });

  it('moves its endpoint with the detent count', () => {
    assert.equal(sheetPageRamp(2.75, 3), 0.5);
    assert.equal(sheetPageRamp(2, 3), 0);
  });
});

describe('sheetChromeAt with pageAtTop', () => {
  it('squares the corners and hides the handle at the top detent', () => {
    const top = sheetChromeAt(LAST, LAST, true);
    assert.equal(top.radius, 0);
    assert.equal(top.handleOpacity, 0);
    assert.equal(top.fillOpacity, 1);
    assert.equal(top.sideInset, 0);
  });

  it('squares up and fades the handle over the last half of the final segment, while the fill ramps over all of it', () => {
    // Half-way through the final segment the fill is half in, but the page has not started.
    const half = sheetChromeAt(LAST - 0.5, LAST, true);
    assert.equal(half.radius, sheetChromeAt(LAST - 0.5, LAST).radius);
    assert.equal(half.handleOpacity, 1);
    assert.equal(half.fillOpacity, 0.5);
    // Three quarters through, the page is half-way: corners half squared, grabber half gone.
    const late = sheetChromeAt(LAST - 0.25, LAST, true);
    assert.equal(late.radius, sheetChromeAt(LAST - 0.25, LAST).radius / 2);
    assert.equal(late.handleOpacity, 0.5);
    assert.equal(late.fillOpacity, 0.75);
  });

  it('follows sheetPageRamp for the corners and the grabber', () => {
    for (const index of [1, 1.5, 1.6, 1.9, 2]) {
      const chrome = sheetChromeAt(index, LAST, true);
      const ramp = sheetPageRamp(index, LAST);
      assert.equal(chrome.handleOpacity, 1 - ramp, `handle at index ${index}`);
      assert.equal(chrome.radius, sheetChromeAt(index, LAST).radius * (1 - ramp), `radius at index ${index}`);
    }
  });

  it('is the floating card untouched below the final segment', () => {
    assert.deepEqual(sheetChromeAt(0, LAST, true), sheetChromeAt(0, LAST));
    assert.deepEqual(sheetChromeAt(1, LAST, true), sheetChromeAt(1, LAST));
  });

  it('changes nothing when off', () => {
    for (const index of [0, 1, 1.5, 2]) {
      assert.deepEqual(sheetChromeAt(index, LAST, false), sheetChromeAt(index, LAST));
    }
    assert.equal(sheetChromeAt(LAST, LAST).radius, SHEET_RADIUS_ATTACHED);
    assert.equal(sheetChromeAt(LAST, LAST).handleOpacity, 1);
  });
});

describe('bottomCornerRadius', () => {
  it('keeps the bottom corners concentric with the display at every detent', () => {
    // The rule that makes them stay inside the screen's own rounding: a rect
    // inset by i needs a corner of at least R - i, or the OS mask slices it.
    for (const index of [0, 0.5, 1, 1.5, 2]) {
      const c = sheetChromeAt(index, LAST);
      const bottomGap = SHEET_FLOAT_INSET * (1 - c.progress);
      const bottom = bottomCornerRadius(c.radius, bottomGap);
      assert.ok(
        bottom >= DISPLAY_CORNER_RADIUS - bottomGap - 1e-9,
        `index ${index}: bottom ${bottom} would be cut at gap ${bottomGap}`,
      );
      assert.ok(bottom >= c.radius, 'bottom is never tighter than the top');
    }
  });

  it('is the display radius once the gap has closed', () => {
    assert.equal(bottomCornerRadius(SHEET_RADIUS_ATTACHED, 0), DISPLAY_CORNER_RADIUS);
  });

  it('never returns tighter than the top radius, however large the gap', () => {
    // A modal card sitting a long way off the bottom of the window: the
    // concentric rule would ask for a corner smaller than the design value.
    assert.equal(bottomCornerRadius(SHEET_RADIUS_FLOATING, 200), SHEET_RADIUS_FLOATING);
  });
});

describe('fillAt: a glass sheet’s fill on a per-stop schedule', () => {
  const GLASS_GLASS_SOLID = [0, 0, 1];

  it('is the stop’s fill at a whole index, and ramps linearly across the segment into a solid stop', () => {
    assert.equal(fillAt(0, GLASS_GLASS_SOLID), 0);
    assert.equal(fillAt(1, GLASS_GLASS_SOLID), 0);
    assert.equal(fillAt(1.5, GLASS_GLASS_SOLID), 0.5);
    assert.equal(fillAt(2, GLASS_GLASS_SOLID), 1);
  });

  it('clamps a closed sheet and an over-drag to the nearest stop', () => {
    assert.equal(fillAt(-1, GLASS_GLASS_SOLID), 0);
    assert.equal(fillAt(2.4, GLASS_GLASS_SOLID), 1);
  });
});

describe('sheetCardShape: the outline every background draws', () => {
  it('is the attached sheet\'s rounded top and square bottom, ending with its body', () => {
    assert.deepEqual(sheetCardShape('attached', 1, LAST, false, 8), { top: SHEET_RADIUS_ATTACHED, bottom: 0, gap: null });
  });

  it('is the floating card at every index, ending with its body, which gorhom has already lifted', () => {
    for (const index of [0, 0.5, 1, 2]) {
      assert.deepEqual(sheetCardShape('floating', index, LAST, false, 8), {
        top: SHEET_RADIUS_FLOATING,
        bottom: bottomCornerRadius(SHEET_RADIUS_FLOATING, 8),
        gap: null,
      });
    }
  });

  it('squares its top corners at a page level, whichever background draws the card', () => {
    // The bug: an attached card (Android, iOS < 26, a solid sheet) kept its
    // 20pt corners at the page level, whose top meets the screen's, and two
    // wedges of map showed behind the status bar.
    const kinds: SheetCardKind[] = ['attached', 'floating', 'travelling'];
    for (const kind of kinds) {
      assert.equal(sheetCardShape(kind, LAST, LAST, true, 8).top, 0, kind);
    }
  });

  it('rounds an attached card as before below the page ramp, and on a sheet with no page', () => {
    for (const index of [0, 1, 1.5]) {
      assert.equal(sheetCardShape('attached', index, LAST, true, 8).top, SHEET_RADIUS_ATTACHED, `index ${index}`);
    }
    assert.equal(sheetCardShape('attached', LAST, LAST, false, 8).top, SHEET_RADIUS_ATTACHED);
  });

  it('squares an attached card on the page ramp the glass card follows', () => {
    for (const index of [1.5, 1.6, 1.75, 1.9, 2]) {
      assert.equal(
        sheetCardShape('attached', index, LAST, true, 8).top,
        SHEET_RADIUS_ATTACHED * (1 - sheetPageRamp(index, LAST)),
        `index ${index}`,
      );
    }
  });

  it('agrees with the content clip at the page level, which cuts nothing off the top', () => {
    for (const kind of ['attached', 'travelling'] as const) {
      assert.equal(sheetContentClip(kind, LAST, LAST, true, 8, { ...frameAt(0), handleHeight: 0 }).top, 0, kind);
    }
  });

  it('travels with sheetChromeAt, its bottom gap closing as it attaches', () => {
    for (const index of [0, 0.7, 1, 1.5, 2]) {
      const { progress, radius } = sheetChromeAt(index, LAST, true);
      const gap = 8 * (1 - progress);
      assert.deepEqual(sheetCardShape('travelling', index, LAST, true, 8), {
        top: radius,
        bottom: bottomCornerRadius(radius, gap),
        gap,
      });
    }
  });
});

/** A 874pt container, the 402x874 screen, and the 22pt handle row. */
const CONTAINER = 874;
const HANDLE = 22;
/** A travelling sheet's content box: its top detent's height, less the handle. */
const TOP_DETENT_POSITION = 60;
const CONTENT = CONTAINER - TOP_DETENT_POSITION - HANDLE;

function frameAt(bodyTop: number) {
  return { containerHeight: CONTAINER, bodyTop, handleHeight: HANDLE, contentHeight: CONTENT };
}

describe('sheetContentClip: the content is cut to the card', () => {
  it('lifts the bottom clip from the content box\'s bottom to the card\'s, at a level below the top', () => {
    // The bug: at a level below the top the content box runs to the container
    // and past it, while the card ends `gap` above the container's bottom.
    const index = 1;
    const bodyTop = 400;
    const card = sheetCardShape('travelling', index, LAST, false, 8);
    const clip = sheetContentClip('travelling', index, LAST, false, 8, frameAt(bodyTop));
    const contentBottom = bodyTop + HANDLE + CONTENT;
    assert.equal(contentBottom - clip.overhang, CONTAINER - (card.gap ?? 0));
    assert.equal(clip.bottom, card.bottom);
  });

  it('lands on the card\'s bottom edge at every position of the drag', () => {
    for (const [index, bodyTop] of [[0, 700], [0.5, 560], [1, 400], [1.5, 230], [2, TOP_DETENT_POSITION]] as const) {
      const card = sheetCardShape('travelling', index, LAST, true, 8);
      const clip = sheetContentClip('travelling', index, LAST, true, 8, frameAt(bodyTop));
      const clippedBottom = bodyTop + HANDLE + CONTENT - clip.overhang;
      assert.ok(Math.abs(clippedBottom - (CONTAINER - (card.gap ?? 0))) < 1e-9, `index ${index}`);
    }
  });

  it('rounds the content\'s top concentric with the card, the handle row in between', () => {
    const clip = sheetContentClip('floating', 0, LAST, false, 8, frameAt(0));
    assert.equal(clip.top, SHEET_RADIUS_FLOATING - HANDLE);
    const headless = sheetContentClip('floating', 0, LAST, false, 8, { ...frameAt(0), handleHeight: 0 });
    assert.equal(headless.top, SHEET_RADIUS_FLOATING);
  });

  it('never rounds the top below zero, a handle taller than the corner squaring it', () => {
    assert.equal(sheetContentClip('attached', 0, LAST, false, 8, frameAt(0)).top, 0);
  });

  it('counts an unmeasured handle as none', () => {
    const clip = sheetContentClip('floating', 0, LAST, false, 8, { ...frameAt(0), handleHeight: -999 });
    assert.equal(clip.top, SHEET_RADIUS_FLOATING);
  });

  it('leaves an attached or a floating card\'s content box where it is, since its card ends with its body', () => {
    for (const kind of ['attached', 'floating'] as const) {
      assert.equal(sheetContentClip(kind, 1, LAST, false, 8, frameAt(400)).overhang, 0);
    }
  });

  it('draws a travelling card\'s clip attached until the container is measured, as its background does', () => {
    const clip = sheetContentClip('travelling', 0, LAST, false, 8, { ...frameAt(-1), containerHeight: 0 });
    assert.deepEqual(clip, { top: 0, bottom: 0, overhang: 0 });
  });

  it('never moves the clip down, a content box that ends above the card keeping its own bottom', () => {
    const clip = sheetContentClip('travelling', 2, LAST, false, 8, { ...frameAt(TOP_DETENT_POSITION), contentHeight: 100 });
    assert.equal(clip.overhang, 0);
  });

  it('keeps every radius within SHEET_CLIP_REACH, so the corners a clip does not own stay off the content', () => {
    const kinds: SheetCardKind[] = ['attached', 'floating', 'travelling'];
    for (const kind of kinds) {
      for (let index = -1; index <= 3; index += 0.25) {
        for (const gap of [0, 8, 40]) {
          for (const page of [false, true]) {
            const card = sheetCardShape(kind, index, LAST, page, gap);
            assert.ok(card.top <= SHEET_CLIP_REACH && card.bottom <= SHEET_CLIP_REACH, `${kind} ${index} ${gap}`);
          }
        }
      }
    }
  });
});
