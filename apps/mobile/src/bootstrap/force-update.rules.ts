import { isVersionLessThan } from '@skkuverse/shared';

/**
 * QUIRK(expo): SDK 57 raised `deploymentTarget` to 16.4, so the 3.6.2 store build cannot install below it.
 * WHY: a constant, since a binary's own deploymentTarget never exceeds the iOS it runs on; later floors come from the server.
 */
export const IOS_LATEST_STORE_MIN_OS = '16.4';

export const IOS_MIN_OS_RAISED_IN = '3.6.2';

const DEVICE_OS_RE = {
  ios: /^\d+(\.\d+){0,2}$/,
  android: /^\d+$/,
} as const;

type Platform = keyof typeof DEVICE_OS_RE;

function meetsFloor(platform: Platform, os: string, floor: string): boolean {
  return platform === 'ios' ? !isVersionLessThan(os, floor) : Number(os) >= Number(floor);
}

function fallbackFloor(platform: Platform, minVersion: string): string | null {
  if (platform !== 'ios' || isVersionLessThan(minVersion, IOS_MIN_OS_RAISED_IN)) return null;
  return IOS_LATEST_STORE_MIN_OS;
}

export function isForceUpdateRequired(input: {
  platform: Platform;
  osVersion: string;
  appVersion: string;
  minVersion: string;
  minOsVersion: string | null;
}): boolean {
  const { platform, osVersion, appVersion, minVersion, minOsVersion } = input;
  if (!isVersionLessThan(appVersion, minVersion)) return false;
  const floor = minOsVersion ?? fallbackFloor(platform, minVersion);
  if (floor === null) return true;
  // WHY: an unreadable OS lets the user in; blocking a device that may be unable to install the build is a screen with no exit.
  if (!DEVICE_OS_RE[platform].test(osVersion)) return false;
  return meetsFloor(platform, osVersion, floor);
}
