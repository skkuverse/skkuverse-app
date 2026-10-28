/**
 * The server's published place-detail fixtures read cleanly: every detail it
 * serves is kept, and no drop is reported.
 */
import { describe, expect, it } from 'vitest';
import { parseOrThrow, setDropReporter } from '@skkuverse/shared';
import { placeDetailsSchema } from './place-detail.schema';
import boothSynthetic from '../__fixtures__/server-event-details.booth-synthetic.json';
import production from '../__fixtures__/server-event-details.production-ko.json';

describe('the server place-detail fixtures', () => {
  it.each(Object.entries({ boothSynthetic, production }))('%s keeps every detail', (_name, fixture) => {
    // Arrange
    const reports: [string, number][] = [];
    setDropReporter((where, index) => reports.push([where, index]));

    // Act
    const details = parseOrThrow(placeDetailsSchema, fixture.data, 'eventmap.details');

    // Assert
    expect(Object.keys(details)).toHaveLength(Object.keys((fixture.data as { details: object }).details).length);
    expect(reports).toStrictEqual([]);
  });

  it.each(Object.entries({ boothSynthetic, production }))('%s reads back unchanged', (_name, fixture) => {
    // Act
    const details = parseOrThrow(placeDetailsSchema, fixture.data, 'eventmap.details');

    // Assert
    expect(details).toStrictEqual(fixture.data.details);
  });
});
