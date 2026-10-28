// WHY: here, not with the subway's own types, because the settings store keeps this on the device.

export type SubwayDirectionKey = 'up' | 'down';

/**
 * WHY: only a tap writes a key, so a missing one leaves the screen's default in charge; a code the
 * station no longer serves is ignored when read.
 */
export interface SubwayChoice {
  line?: string;
  direction?: Record<string, SubwayDirectionKey>;
}
