import { describe, it, expect } from 'vitest';
import { trackPosition } from './countdown.rules';
import { TRACK_TICKS, TRACK_WINDOW_MS, directionSide, trackX, trainTrackPosition, trainsOnTrack } from './track.rules';

describe('trainTrackPosition', () => {
  const now = Date.parse('2026-10-17T02:40:00.000Z');
  const min = 60_000;
  const at = (stopsAway: number | null, inMs: number) => ({ stopsAway, arrivalAt: now + inMs });
  const [prev, twoBefore] = TRACK_TICKS;

  it('holds a seen train at the station it was seen at while its time is still far', () => {
    expect(trainTrackPosition(at(1, 10 * min), now)).toBe(prev);
    expect(trainTrackPosition(at(2, 10 * min), now)).toBe(twoBefore);
  });

  it('moves a seen train on by its time inside the stretch it is on', () => {
    // One stop out, due in a minute: past the previous station, short of this one.
    const p = trainTrackPosition(at(1, 1 * min), now);
    expect(p).toBe(trackPosition(now + 1 * min, now, TRACK_WINDOW_MS));
    expect(p).toBeGreaterThan(prev);
  });

  it('never lets a seen train pass the next station before it is seen there', () => {
    // Two stops out but due in 30 s by its time: it waits short of the previous station.
    const p = trainTrackPosition(at(2, 30_000), now);
    expect(p).toBeLessThan(prev);
    expect(p).toBeGreaterThan(twoBefore);
  });

  it('keeps a train approaching this station (1, ADR 0022 C4) past the previous one and short of this one', () => {
    const p = trainTrackPosition(at(1, 0), now);
    expect(p).toBeGreaterThan(prev);
    expect(p).toBeLessThan(1);
  });

  it('puts a train standing here (0, ADR 0022 C4) at the station, whatever its time says', () => {
    expect(trainTrackPosition(at(0, 10 * min), now)).toBe(1);
  });

  it('keeps a train three or more stations out short of the second tick', () => {
    expect(trainTrackPosition(at(3, 30_000), now)).toBeLessThan(twoBefore);
  });

  it('places a train nobody has seen by its time alone', () => {
    expect(trainTrackPosition(at(null, 3 * min), now)).toBe(
      trackPosition(now + 3 * min, now, TRACK_WINDOW_MS),
    );
  });
});

describe('trainsOnTrack', () => {
  const train = (trainNo: string, onTrack: boolean) => ({ trainNo, onTrack });

  it('draws the next two trains', () => {
    // Act & Assert
    expect(trainsOnTrack([train('1', true), train('2', true), train('3', true)]).map((t) => t.trainNo)).toEqual(['1', '2']);
  });

  it('leaves off a train it cannot place, and does not reach past the next two for another', () => {
    // Act & Assert
    expect(trainsOnTrack([train('1', false), train('2', true), train('3', true)]).map((t) => t.trainNo)).toEqual(['2']);
    expect(trainsOnTrack([train('1', true), train('2', false), train('3', true)]).map((t) => t.trainNo)).toEqual(['1']);
  });
});

describe('directionSide', () => {
  it('points up to the left and down to the right, as a station sign does', () => {
    expect(directionSide('up')).toBe('left');
    expect(directionSide('down')).toBe('right');
  });
});

describe('trackX', () => {
  it('draws a direction heading right as placed: this station at the right end', () => {
    expect(trackX(1, 'right')).toBe(1);
    expect(trackX(0, 'right')).toBe(0);
    expect(trackX(0.25, 'right')).toBe(0.25);
  });

  it('mirrors a direction heading left: this station at the left end, trains coming from the right', () => {
    expect(trackX(1, 'left')).toBe(0);
    expect(trackX(0, 'left')).toBe(1);
    expect(trackX(0.25, 'left')).toBe(0.75);
  });

  it('mirrors the ticks onto the other half alike', () => {
    expect(TRACK_TICKS.map((tick) => trackX(tick, 'left'))).toEqual(
      TRACK_TICKS.map((tick) => 1 - tick),
    );
  });
});
