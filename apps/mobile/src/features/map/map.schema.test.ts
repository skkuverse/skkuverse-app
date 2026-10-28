/**
 * Design D4's named differences: a null or malformed layer, campus, chip or
 * overlay drops alone, the rest parse exactly as the hand parser parsed them
 * without it, and the drop is reported once under its list's name.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { parseOrThrow, setDropReporter } from '@skkuverse/shared';
import { mapConfigSchema } from './map-config.schema';
import { mapOverlaysSchema } from './overlay.schema';
import liveConfig from './__fixtures__/map-config-live.json';
import liveCampus from './__fixtures__/map-overlays-campus-live.json';

const parseConfig = (data: unknown) => parseOrThrow(mapConfigSchema, data, 'map.config');
const parseOverlays = (data: unknown) => parseOrThrow(mapOverlaysSchema, data, 'map.overlays');

const CONFIG = (liveConfig as unknown as { data: Record<string, unknown[]> }).data;
const OVERLAYS = (liveCampus as unknown as { data: Record<string, unknown[]> }).data;

const reports: [string, number][] = [];
setDropReporter((where, index) => reports.push([where, index]));
afterEach(() => {
  reports.length = 0;
});

/** `data` with item `index` of `list` replaced, and with it removed. */
function variants(data: Record<string, unknown[]>, list: string, index: number, item: unknown) {
  const replaced = [...data[list]];
  replaced[index] = item;
  const removed = data[list].filter((_, i) => i !== index);
  return { withItem: { ...data, [list]: replaced }, without: { ...data, [list]: removed } };
}

const positions = (n: number) => [...new Set([0, Math.floor(n / 2), n - 1])];

describe('a malformed config item drops alone and is reported once', () => {
  it.each(
    (['layers', 'campuses', 'chips'] as const).flatMap((list) =>
      positions(CONFIG[list].length).flatMap((index) =>
        [null, 'not an item'].map((item) => [list, index, item] as const),
      ),
    ),
  )('%s[%i] = %j', (list, index, item) => {
    // Arrange
    const { withItem, without } = variants(CONFIG, list, index, item);

    // Act
    const parsed = parseConfig(withItem);

    // Assert
    expect(parsed).toStrictEqual(parseConfig(without));
    expect(reports).toStrictEqual([[`map.${list}`, index]]);
  });
});

describe('a malformed overlay drops alone and is reported once', () => {
  it.each(
    positions(OVERLAYS.overlays.length).flatMap((index) =>
      [null, 7].map((item) => [index, item] as const),
    ),
  )('overlays[%i] = %j', (index, item) => {
    // Arrange
    const { withItem, without } = variants(OVERLAYS, 'overlays', index, item);

    // Act
    const parsed = parseOverlays(withItem);

    // Assert
    expect(parsed).toStrictEqual(parseOverlays(without));
    expect(reports).toStrictEqual([['map.overlays', index]]);
  });

  it('skips a kind this build has no renderer for without blanking the layer', () => {
    // Arrange
    const unknown = { ...(OVERLAYS.overlays[0] as object), id: 'new', kind: 'heatmap' };
    const data = { overlays: [...OVERLAYS.overlays, unknown] };

    // Act
    const parsed = parseOverlays(data);

    // Assert
    expect(parsed).toStrictEqual(parseOverlays(OVERLAYS));
    expect(reports).toStrictEqual([]);
  });
});
