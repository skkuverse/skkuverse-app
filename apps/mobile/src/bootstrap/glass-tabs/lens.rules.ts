// WHY: derived from expo-glass-tabs 0.1.1 (MIT, David Mokos), whose notice is LICENSE beside this file.

export function lensSpan(lead: number, trail: number, maxLag: number): { from: number; cells: number } {
  'worklet';
  const lag = Math.max(-maxLag, Math.min(maxLag, trail - lead));
  return { from: Math.min(lead, lead + lag), cells: Math.abs(lag) };
}

export interface ScrubRelease {
  start: number;
  release: number;
  crossedCell: boolean;
}

// QUIRK(ios): a finger that visited another cell and came back selects nothing, as the system bar's does.
export function scrubReleaseSelects({ start, release, crossedCell }: ScrubRelease): boolean {
  'worklet';
  return release !== start || !crossedCell;
}
