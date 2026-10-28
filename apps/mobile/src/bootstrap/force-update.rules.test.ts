/**
 * The force-update gate blocks a launch below the server's `minVersion`,
 * except on a device whose OS is too old to install the store build that
 * minimum asks for: blocking that one is a screen with no exit. The server
 * names that OS floor (`minOsVersion`); without one the app keeps its own iOS
 * floor and gives Android no exemption.
 */

import { describe, it, expect } from 'vitest';
import { parseAppConfig } from '@skkuverse/shared';
import { IOS_LATEST_STORE_MIN_OS, IOS_MIN_OS_RAISED_IN, isForceUpdateRequired } from './force-update.rules';

type Platform = 'ios' | 'android';

/** The gate as the app runs it: the platform section goes through the parser first. */
const gate = (platform: Platform, served: Record<string, unknown>, osVersion: string, appVersion = '3.6.1') => {
  const config = parseAppConfig({ meta: { code: 200 }, data: { [platform]: served } })[platform];
  return isForceUpdateRequired({
    platform,
    osVersion,
    appVersion,
    minVersion: config.minVersion,
    minOsVersion: config.minOsVersion,
  });
};

describe('isForceUpdateRequired with the server floor', () => {
  it('lets in an iPhone below the floor and blocks one at or above it', () => {
    const ios = (os: string) => gate('ios', { minVersion: '3.6.2', minOsVersion: '16.4' }, os);
    for (const os of ['15.2', '16.1.1', '16.3', '16.3.1']) expect(ios(os)).toBe(false);
    for (const os of ['16.4', '16.4.1', '17.0', '26.0']) expect(ios(os)).toBe(true);
  });

  it('compares iOS versions as numbers, not strings', () => {
    const ios = (os: string) => gate('ios', { minVersion: '3.6.2', minOsVersion: '16.4' }, os);
    expect(ios('9.0')).toBe(false);
    expect(ios('16.10')).toBe(true);
  });

  it('follows the floor the server names, not the app constant', () => {
    // A future store build on iOS 17: a 16.5 iPhone cannot install it.
    expect(gate('ios', { minVersion: '3.8.0', minOsVersion: '17.0' }, '16.5')).toBe(false);
    expect(gate('ios', { minVersion: '3.8.0', minOsVersion: '17.0' }, '17.0')).toBe(true);
    // A floor below the app constant applies even under 3.6.2.
    expect(gate('ios', { minVersion: '3.6.1', minOsVersion: '15.1' }, '15.0')).toBe(false);
  });

  it('compares Android as an integer API level', () => {
    const android = (os: string) => gate('android', { minVersion: '3.6.2', minOsVersion: '26' }, os);
    expect(android('24')).toBe(false);
    expect(android('25')).toBe(false);
    expect(android('26')).toBe(true);
    expect(android('35')).toBe(true);
    // '9' > '26' as strings; as API levels it is below.
    expect(android('9')).toBe(false);
  });

  // The gate only nudges toward a store build; trapping a device it cannot
  // show is able to install that build is the failure this rule exists for.
  it('lets a device in when its own OS version is unreadable', () => {
    for (const os of ['', 'abc', '16.x', '16..4', '-1', '16.4 beta', '16.4.1.2']) {
      expect(gate('ios', { minVersion: '3.6.2', minOsVersion: '16.4' }, os)).toBe(false);
    }
    for (const os of ['', 'abc', '26.1', '-1']) {
      expect(gate('android', { minVersion: '3.6.2', minOsVersion: '24' }, os)).toBe(false);
    }
  });

  it('never blocks an app at or above minVersion', () => {
    expect(gate('ios', { minVersion: '3.6.2', minOsVersion: '16.4' }, '17.0', '3.6.2')).toBe(false);
    expect(gate('android', { minVersion: '3.6.2', minOsVersion: '24' }, '34', '3.7.0')).toBe(false);
  });
});

describe('isForceUpdateRequired without a usable server floor', () => {
  // Absent and malformed both read as "the server did not say".
  const unsaid = [{}, { minOsVersion: 'abc' }, { minOsVersion: 16.4 }, { minOsVersion: '16.4.1.2' }];

  it('names the iOS floor of the 3.6.2 store build', () => {
    expect(IOS_LATEST_STORE_MIN_OS).toBe('16.4');
    expect(IOS_MIN_OS_RAISED_IN).toBe('3.6.2');
  });

  it('falls back to the app iOS floor for a minimum of 3.6.2 or later', () => {
    for (const extra of unsaid) {
      const ios = (os: string) => gate('ios', { minVersion: '3.6.2', ...extra }, os);
      for (const os of ['15.2', '16.1.1', '16.3', '16.3.1', '', 'abc']) expect(ios(os)).toBe(false);
      for (const os of ['16.4', '16.4.1', '17.0', '26.0']) expect(ios(os)).toBe(true);
    }
  });

  it('exempts no iPhone from a minimum below 3.6.2, which installs on 15.1', () => {
    for (const extra of unsaid) {
      expect(gate('ios', { minVersion: '3.6.1', ...extra }, '15.2', '3.5.4')).toBe(true);
    }
  });

  it('gives Android no OS exemption', () => {
    for (const extra of [...unsaid, { minOsVersion: '7.0' }]) {
      expect(gate('android', { minVersion: '3.6.2', ...extra }, '24')).toBe(true);
      expect(gate('android', { minVersion: '3.6.2', ...extra }, '')).toBe(true);
    }
  });
});
