import type {
  SubwayChoice,
} from '@skkuverse/shared';
import type { SubwayDirection, SubwayLineArrivals } from './subway.types';

export type SubwayTap = 'line' | 'direction';

export type SubwayChoiceSource = 'param' | 'remembered' | 'default';

export type SubwayViewSource = 'line_tap' | 'direction_tap' | SubwayChoiceSource;

export interface ToSubwayScreenChoiceInputs {
  lineParam: string | undefined;
  saved: SubwayChoice | undefined;
}

export interface SubwayScreenChoice {
  line: SubwayLineArrivals;
  direction: SubwayDirection;
  source: SubwayChoiceSource;
}

// WHY: a code the station does not serve, and a saved direction the line lacks (a terminus), are skipped.
export function toSubwayScreenChoice(
  lines: readonly SubwayLineArrivals[],
  { lineParam, saved }: ToSubwayScreenChoiceInputs,
): SubwayScreenChoice | undefined {
  const byCode = (code: string | undefined) =>
    code ? lines.find((l) => l.line.code === code) : undefined;
  const fromParam = byCode(lineParam);
  const fromSaved = fromParam ? undefined : byCode(saved?.line);
  const line = fromParam ?? fromSaved ?? lines[0];
  if (!line) return undefined;

  const savedDirection = saved?.direction?.[line.line.code];
  const restored = savedDirection
    ? line.directions.find((d) => d.direction === savedDirection)
    : undefined;
  const direction = restored ?? line.directions.find((d) => d.direction === 'up') ?? line.directions[0];
  if (!direction) return undefined;

  const source: SubwayChoiceSource = fromParam
    ? 'param'
    : fromSaved || restored
      ? 'remembered'
      : 'default';
  return { line, direction, source };
}

export function decideSubwayViewSource(
  tap: SubwayTap | null,
  picked: SubwayChoiceSource,
): SubwayViewSource {
  if (tap) return tap === 'line' ? 'line_tap' : 'direction_tap';
  return picked;
}
