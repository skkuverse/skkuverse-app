/**
 * Detent resolution.
 *
 * The interesting behaviour is not the arithmetic — it is which sheets come out
 * marked `attachesAtTop`, because that one flag decides whether the surface is
 * drawn by an interpolating background or by gorhom's own `detached` mode.
 *
 * NOTE: packages/sds runs `node --test`. `detents.ts` imports nothing at all,
 * so it loads under plain Node with `--experimental-strip-types`.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  endsInPage,
  resolveSheetPosition,
  detentSnapPoint,
  largeHeightOf,
  pageSpacerHeight,
  steppedDetentIndex,
  SHEET_DETENT_PERCENT,
  SHEET_LARGE_PERCENT_FALLBACK,
} from './detents.ts';

/** A measured container: 874pt tall less a 59pt top safe area. */
const LARGE = 815;

describe('detentSnapPoint', () => {
  it('renders small and medium as percentages of the container', () => {
    assert.equal(detentSnapPoint('small', LARGE), `${SHEET_DETENT_PERCENT.small}%`);
    assert.equal(detentSnapPoint('medium', LARGE), `${SHEET_DETENT_PERCENT.medium}%`);
  });

  it('renders large as the measured height, not a percentage', () => {
    assert.equal(detentSnapPoint('large', LARGE), LARGE);
  });

  it('falls back to a percentage while the container is unmeasured', () => {
    // One frame before the first layout. A jump here would be visible.
    assert.equal(detentSnapPoint('large', null), `${SHEET_LARGE_PERCENT_FALLBACK}%`);
    assert.equal(detentSnapPoint('large', 0), `${SHEET_LARGE_PERCENT_FALLBACK}%`);
  });

  it('is unaffected by the container for the two fractional detents', () => {
    assert.equal(detentSnapPoint('small', null), detentSnapPoint('small', LARGE));
  });
});

describe('largeHeightOf: where an attached sheet stops', () => {
  it('is the container less the top safe area, so the status bar stays the screen’s', () => {
    assert.equal(largeHeightOf(874, 59, false), LARGE);
  });

  it('is the whole container for a sheet that is a page at its top, whose status-bar band is the page’s', () => {
    assert.equal(largeHeightOf(874, 59, true), 874);
  });

  it('is null while the container is unmeasured, whatever the sheet is', () => {
    assert.equal(largeHeightOf(0, 59, false), null);
    assert.equal(largeHeightOf(0, 59, true), null);
  });
});

describe('resolveSheetPosition — expandable', () => {
  it('attaches when the top detent is large', () => {
    const r = resolveSheetPosition(
      { kind: 'expandable', detents: ['small', 'medium', 'large'] },
      LARGE,
    );
    assert.deepEqual(r.snapPoints, ['45%', '65%', LARGE]);
    assert.equal(r.attachesAtTop, true);
    assert.equal(r.lastIndex, 2);
    assert.equal(r.initialIndex, 0);
    assert.equal(r.movesBetweenDetents, true);
    assert.equal(r.enableDynamicSizing, false);
  });

  it('does NOT attach when the top detent is not large', () => {
    // This is the case that gets gorhom's `detached` mode instead of an
    // interpolating background: the card keeps one shape the whole way.
    const r = resolveSheetPosition(
      { kind: 'expandable', detents: ['small', 'medium'] },
      LARGE,
    );
    assert.equal(r.attachesAtTop, false);
    assert.equal(r.movesBetweenDetents, true);
  });

  it('opens at the requested detent', () => {
    const r = resolveSheetPosition(
      { kind: 'expandable', detents: ['small', 'medium', 'large'], initial: 'medium' },
      LARGE,
    );
    assert.equal(r.initialIndex, 1);
  });

  it('opens at the lowest detent when `initial` is not one of them', () => {
    // The two props are independent, so the type system cannot catch this.
    // Opening low is the harmless answer: the sheet is visible and draggable.
    const r = resolveSheetPosition(
      { kind: 'expandable', detents: ['small', 'medium'], initial: 'large' },
      LARGE,
    );
    assert.equal(r.initialIndex, 0);
  });

  it('moves its endpoint with the detent count', () => {
    const two = resolveSheetPosition({ kind: 'expandable', detents: ['small', 'large'] }, LARGE);
    assert.equal(two.lastIndex, 1);
  });
});

describe('resolveSheetPosition — stuck', () => {
  it('is one snap point with nowhere to travel', () => {
    const r = resolveSheetPosition({ kind: 'stuck', detent: 'medium' }, LARGE);
    assert.deepEqual(r.snapPoints, ['65%']);
    assert.equal(r.movesBetweenDetents, false);
    assert.equal(r.lastIndex, 0);
    assert.equal(r.attachesAtTop, false);
  });

  it('attaches when stuck at large', () => {
    const r = resolveSheetPosition({ kind: 'stuck', detent: 'large' }, LARGE);
    assert.deepEqual(r.snapPoints, [LARGE]);
    assert.equal(r.attachesAtTop, true);
  });

  it('passes a custom height straight through', () => {
    assert.deepEqual(
      resolveSheetPosition({ kind: 'stuck', height: '38%' }, LARGE).snapPoints,
      ['38%'],
    );
    assert.deepEqual(
      resolveSheetPosition({ kind: 'stuck', height: 420 }, LARGE).snapPoints,
      [420],
    );
  });

  it('never treats a custom height as large, however tall', () => {
    // The escape hatch buys a height and nothing else. A glass sheet declared
    // this way stays a floating card, which is why the named form is the one
    // to reach for.
    assert.equal(
      resolveSheetPosition({ kind: 'stuck', height: '99%' }, LARGE).attachesAtTop,
      false,
    );
  });
});

describe('resolveSheetPosition — fit', () => {
  it('hands sizing to gorhom and never attaches', () => {
    const r = resolveSheetPosition({ kind: 'fit' }, LARGE);
    assert.equal(r.snapPoints, undefined);
    assert.equal(r.enableDynamicSizing, true);
    assert.equal(r.attachesAtTop, false);
    // One size means nowhere to travel. Swiping it away is `dismissible`.
    assert.equal(r.movesBetweenDetents, false);
    assert.equal(r.lastIndex, 0);
  });
});

describe('resolveSheetPosition — height overrides', () => {
  it('replaces the fractional detents while keeping their names', () => {
    // The campus sheet's case: its two low detents are load bearing elsewhere
    // on the screen (the locate button's anchor is computed from them), so it
    // supplies its own numbers and still says small / medium / large.
    const r = resolveSheetPosition(
      {
        kind: 'expandable',
        detents: ['small', 'medium', 'large'],
        heights: { small: '24%', medium: '42%' },
      },
      LARGE,
    );
    assert.deepEqual(r.snapPoints, ['24%', '42%', LARGE]);
    // The names survived, so the surface rule still applies unchanged.
    assert.equal(r.attachesAtTop, true);
  });

  it('leaves an un-overridden detent at its default', () => {
    const r = resolveSheetPosition(
      { kind: 'expandable', detents: ['small', 'medium'], heights: { small: 200 } },
      LARGE,
    );
    assert.deepEqual(r.snapPoints, [200, `${SHEET_DETENT_PERCENT.medium}%`]);
  });

  it('cannot override large, whatever is passed', () => {
    // `large` means attached, not a number. Letting it be one would break the
    // rule the surface table rests on.
    assert.equal(
      detentSnapPoint('large', LARGE, { small: '10%', medium: '20%' }),
      LARGE,
    );
  });
});

describe('steppedDetentIndex: a screen reader moving the sheet one detent', () => {
  it('moves up and down one detent from where the sheet rests', () => {
    assert.equal(steppedDetentIndex(1, 2, 'increment'), 2);
    assert.equal(steppedDetentIndex(1, 2, 'decrement'), 0);
  });

  it('reads a sheet caught mid-drag as the detent it is nearest', () => {
    assert.equal(steppedDetentIndex(1.4, 2, 'increment'), 2);
    assert.equal(steppedDetentIndex(0.6, 2, 'decrement'), 0);
  });

  it('goes nowhere past the top or below the lowest detent: the handle never closes the sheet', () => {
    assert.equal(steppedDetentIndex(2, 2, 'increment'), null);
    assert.equal(steppedDetentIndex(0, 2, 'decrement'), null);
  });

  it('raises a closed sheet to its lowest detent', () => {
    assert.equal(steppedDetentIndex(-1, 2, 'increment'), 0);
    assert.equal(steppedDetentIndex(-1, 2, 'decrement'), null);
  });
});

describe('pageSpacerHeight: what a page sheet opens above its content', () => {
  it('is the top inset less the grabber, which already stands above the content and fades out at the page', () => {
    assert.equal(pageSpacerHeight(59, 22), 37);
  });

  it('is never negative on a device whose inset is shorter than the grabber', () => {
    assert.equal(pageSpacerHeight(20, 22), 0);
    assert.equal(pageSpacerHeight(0, 22), 0);
  });
});

describe('resolveSheetPosition: stops a host resolved itself', () => {
  const LOW_MID_TOP = {
    kind: 'stops',
    stops: [
      { kind: 'covered', height: 209, label: 'Collapsed' },
      { kind: 'covered', height: '55%', label: 'Middle' },
      { kind: 'covered', height: 703, label: 'Expanded' },
    ],
    initialIndex: 2,
  } as const;
  const WITH_PAGE = {
    kind: 'stops',
    stops: [
      { kind: 'covered', height: 209 },
      { kind: 'covered', height: 481 },
      { kind: 'page', label: 'Full screen' },
    ],
    initialIndex: 0,
  } as const;

  it('hands gorhom the covered heights as they are where nothing floats, and never sizes to content', () => {
    const resolved = resolveSheetPosition(LOW_MID_TOP, LARGE);
    assert.deepEqual(resolved.snapPoints, [209, '55%', 703]);
    assert.equal(resolved.enableDynamicSizing, false, 'a dynamic detent would shift every index the host names');
    assert.equal(resolved.lastIndex, 2);
    assert.equal(resolved.movesBetweenDetents, true);
  });

  it('keeps the index the host holds constant, whatever the stops', () => {
    assert.equal(resolveSheetPosition(LOW_MID_TOP, LARGE).initialIndex, 2);
    assert.equal(resolveSheetPosition(WITH_PAGE, LARGE).initialIndex, 0);
  });

  it('takes the float gap off a floating card, so its top lands at the covered height; a percentage passes through', () => {
    assert.deepEqual(resolveSheetPosition(LOW_MID_TOP, LARGE, 8).snapPoints, [201, '55%', 695]);
  });

  it('attaches only at a page top, which is the whole container and keeps every gap', () => {
    const page = resolveSheetPosition(WITH_PAGE, 874, 8);
    assert.equal(page.attachesAtTop, true);
    assert.deepEqual(page.snapPoints, [209, 481, 874]);
    assert.equal(resolveSheetPosition(LOW_MID_TOP, LARGE).attachesAtTop, false);
    assert.equal(endsInPage(WITH_PAGE), true);
    assert.equal(endsInPage(LOW_MID_TOP), false);
    assert.equal(endsInPage({ kind: 'expandable', detents: ['small', 'large'] }), false);
  });

  it('falls back to a percentage for an unmeasured page, as large does', () => {
    assert.equal(resolveSheetPosition(WITH_PAGE, null).snapPoints?.[2], `${SHEET_LARGE_PERCENT_FALLBACK}%`);
  });

  it('names each stop for a screen reader by index', () => {
    assert.deepEqual(resolveSheetPosition(LOW_MID_TOP, LARGE).stopLabels, ['Collapsed', 'Middle', 'Expanded']);
    assert.deepEqual(resolveSheetPosition(WITH_PAGE, LARGE).stopLabels, [undefined, undefined, 'Full screen']);
  });
});

describe('resolveSheetPosition: a fill schedule on stops', () => {
  it('reads each stop’s fill into a per-index table, absent as glass', () => {
    const scheduled = resolveSheetPosition(
      {
        kind: 'stops',
        stops: [
          { kind: 'covered', height: 209, fill: 0 },
          { kind: 'covered', height: 481 },
          { kind: 'covered', height: 703, fill: 1 },
        ],
        initialIndex: 0,
      },
      LARGE,
    );
    assert.deepEqual(scheduled.fillByIndex, [0, 0, 1]);
  });

  it('leaves every other sheet without one, so its surface is what it was', () => {
    const noFill = resolveSheetPosition(
      { kind: 'stops', stops: [{ kind: 'covered', height: 209 }, { kind: 'covered', height: 481 }], initialIndex: 0 },
      LARGE,
    );
    assert.equal(noFill.fillByIndex, null);
    assert.equal(resolveSheetPosition({ kind: 'expandable', detents: ['small', 'large'] }, LARGE).fillByIndex, null);
    assert.equal(resolveSheetPosition({ kind: 'stuck', detent: 'medium' }, LARGE).fillByIndex, null);
    assert.equal(resolveSheetPosition({ kind: 'fit' }, LARGE).fillByIndex, null);
  });
});
