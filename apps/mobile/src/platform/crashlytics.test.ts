/**
 * A server list item a schema drops leaves a Crashlytics breadcrumb, once per
 * list per process, so the next report carries it without each drop becoming
 * a report of its own. Only the Crashlytics SDK is a double.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logSchemaDrop } from './crashlytics';

const crashlytics = vi.hoisted(() => ({ log: vi.fn(), recordError: vi.fn() }));

vi.mock('@react-native-firebase/crashlytics', () => ({
  getCrashlytics: () => ({}),
  log: crashlytics.log,
  recordError: crashlytics.recordError,
  setAttributes: vi.fn(),
  setUserId: vi.fn(),
}));

vi.mock('./ota', () => ({ releaseContext: () => ({}) }));

beforeEach(() => {
  crashlytics.log.mockClear();
  crashlytics.recordError.mockClear();
});

describe('logSchemaDrop', () => {
  it('leaves a breadcrumb naming the list, the index and why', () => {
    // Act
    logSchemaDrop('home.tiles', 2, new Error('title: expected string'));

    // Assert
    expect(crashlytics.log).toHaveBeenCalledTimes(1);
    expect(crashlytics.log.mock.calls[0][1]).toMatch(/home\.tiles\[2\].*title: expected string/);
    expect(crashlytics.recordError).not.toHaveBeenCalled();
  });

  it('leaves one breadcrumb per list, however many of its items drop', () => {
    // Act
    logSchemaDrop('home.sections', 0, new Error('a'));
    logSchemaDrop('home.sections', 3, new Error('b'));
    logSchemaDrop('banner.items', 0, 'not an object');

    // Assert
    expect(crashlytics.log.mock.calls.map(([, message]) => message)).toEqual([
      expect.stringMatching(/^schema\/drop home\.sections\[0\]/),
      expect.stringMatching(/^schema\/drop banner\.items\[0\]: not an object/),
    ]);
  });
});
