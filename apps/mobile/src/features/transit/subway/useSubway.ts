import { useNow } from '@/platform/clock';
import { useServerClockOffset } from '../components/useServerClockOffset';
import { useSubwayChoice } from './useSubwayChoice';
import { useSubwayTracking } from './useSubwayTracking';
import { useSubwayArrivals } from './useSubwayArrivals';

// WHY: `arrivalAt` is a server instant, so the clock is the server's as the device sees it, or a skewed phone counts down off.
export function useSubway(station: string, lineParam: string | undefined, source: string | undefined) {
  const { data, isLoading, isError, refetch } = useSubwayArrivals(station);
  const clockOffsetMs = useServerClockOffset(data?.serverNowMs, data?.receivedAtMs ?? 0);
  const now = useNow(1000) + clockOffsetMs;
  const { choice, onSelectLine, onSelectDirection } = useSubwayChoice(station, lineParam, data?.lines);

  const lines = data?.lines ?? [];
  const line = choice?.line;
  const lineIndex = line ? lines.indexOf(line) : 0;
  const directions = line?.directions ?? [];
  const direction = choice?.direction;
  const tracking = useSubwayTracking({
    station,
    lineParam,
    source,
    shown: choice
      ? {
          line: choice.line.line.code,
          direction: choice.direction.direction,
          trains: choice.direction.trains.length,
          picked: choice.source,
        }
      : undefined,
    failed: isError && !data,
    retry: refetch,
  });

  return {
    data,
    isLoading,
    isError,
    now,
    lines,
    line,
    lineIndex,
    directions,
    direction,
    tracking,
    onSelectLine,
    onSelectDirection,
  };
}
