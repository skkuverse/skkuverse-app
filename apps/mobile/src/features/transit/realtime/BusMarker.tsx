import { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useT, type FgColorName } from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';
import { BusIcon } from 'phosphor-react-native';
import { LicensePlate } from './LicensePlate';
import { PulseAnimation } from '../components/PulseAnimation';
import {
  LEFT_PADDING,
  PLATE_GUTTER,
  PULSE_SIZE,
  markerTarget,
  markerTop,
  planMarker,
  planTrajectoryMarker,
  shouldSnap,
  type LineShape,
  type MarkerPlanState,
  type PlanStamp,
} from './marker-geometry.rules';
import { SdsPalette, SdsSpacing } from '@skkuverse/shared';
import type { LiveVehicle, RealtimeCrowding, VehiclePosition } from '../transit.types';

interface BusMarkerProps {
  vehicle: LiveVehicle & { position: VehiclePosition };
  line: LineShape;
  hasPlates: boolean;
  isLowFloor: boolean;
  color: string;
  refreshIntervalSec: number;
  clockOffsetMs: number;
  pollAtMs: number;
  resumedAtMs: number;
  holding: boolean;
  nowMs: number;
}

const DIMMED_OPACITY = 0.4;

// WHY: the body-size `…Contrast` steps, since the label is small text, as the timetable draws it.
const CROWDING_COLOR: Record<RealtimeCrowding, FgColorName> = {
  relaxed: 'positiveContrast',
  normal: 'warningContrast',
  crowded: 'criticalContrast',
};

export function BusMarker({
  vehicle,
  line,
  hasPlates,
  isLowFloor,
  color,
  refreshIntervalSec,
  clockOffsetMs,
  pollAtMs,
  resumedAtMs,
  holding,
  nowMs: now,
}: BusMarkerProps) {
  const { t } = useT();
  // CONTRACT(skkuverse-server): skkuverse-server/docs/decisions/0014-jongro-realtime-from-topis.md serves
  // `passengerCount` as taps in minus taps out, which overcounts riders who skip the tap-out, so only
  // the crowding level is drawn.
  const crowding = vehicle.crowding;

  const { s: at, dimmed, following, standing } = markerTarget(
    vehicle.position,
    vehicle.trajectory,
    line,
    now + clockOffsetMs,
  );
  const top = markerTop(at, line);

  const reduceMotion = useReducedMotion();
  const animatedTop = useSharedValue(top);
  const opacity = useSharedValue(holding ? 0 : 1);
  const plan = useRef<MarkerPlanState | undefined>(undefined);
  const lastPlan = useRef<PlanStamp | undefined>(undefined);
  useEffect(() => {
    if (holding) {
      opacity.value = plan.current ? DIMMED_OPACITY : 0;
      return;
    }
    opacity.value = dimmed ? DIMMED_OPACITY : 1;
    // WHY: buses moved while the screen was away; forgetting the plan makes the planner place the
    // marker where the bus is, instead of gliding it from where it was drawn.
    if (shouldSnap(lastPlan.current, { nowMs: now, pollAtMs, resumedAtMs })) plan.current = undefined;
    lastPlan.current = { atMs: now, pollAtMs };
    const next = following
      ? planTrajectoryMarker(plan.current, top, now)
      : planMarker(plan.current, top, now, refreshIntervalSec * 1000, standing);
    plan.current = next.state;
    animatedTop.value =
      next.glide && !reduceMotion
        ? withTiming(next.top, { duration: 1000, easing: Easing.linear })
        : next.top;
  }, [
    animatedTop,
    opacity,
    top,
    now,
    following,
    standing,
    dimmed,
    holding,
    refreshIntervalSec,
    reduceMotion,
    pollAtMs,
    resumedAtMs,
  ]);
  const positionStyle = useAnimatedStyle(() => ({ top: animatedTop.value, opacity: opacity.value }));

  return (
    <Animated.View
      style={[styles.container, positionStyle]}
    >
      <View style={styles.plateColumn}>
        <View>
          {hasPlates && <LicensePlate plateNumber={vehicle.plateNumber} color={color} />}
          {(crowding || isLowFloor) && (
            <View style={styles.underPlate}>
              {crowding && (
                <Txt typography="t1" fontWeight="semiBold" color={CROWDING_COLOR[crowding]} numberOfLines={1}>
                  {t(`realtime.crowding.${crowding}`)}
                </Txt>
              )}
              {isLowFloor && (
                <Txt typography="t1" fontWeight="semiBold" color="informativeContrast" numberOfLines={1}>
                  {t('realtime.lowFloor')}
                </Txt>
              )}
            </View>
          )}
        </View>
      </View>
      <View style={styles.pulseContainer}>
        <PulseAnimation color={color} size={PULSE_SIZE} />
        <View style={[styles.innerDot, { backgroundColor: color }]}>
          {/* WHY: the route color is data, so the glyph on it is static white. */}
          <BusIcon size={14} color={SdsPalette.static.white} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    width: PLATE_GUTTER + LEFT_PADDING / 2 + PULSE_SIZE / 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  plateColumn: {
    flex: 1,
    alignItems: 'flex-end',
    paddingRight: SdsSpacing.x1_5,
  },
  // WHY: absolute, so the lines leave the marker's height, and with it its top on the dot, unchanged; a little
  // wider than the plate, so Spacious or Low-floor fits on one line.
  underPlate: {
    position: 'absolute',
    top: '100%',
    left: -SdsSpacing.x2,
    right: -SdsSpacing.x2,
    alignItems: 'center',
  },
  pulseContainer: {
    width: PULSE_SIZE,
    height: PULSE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerDot: {
    width: PULSE_SIZE,
    height: PULSE_SIZE,
    borderRadius: PULSE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
