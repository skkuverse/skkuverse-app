// WHY: no schedule math; every time is one the server stated, read as KST from the epoch, never the device zone.

import {
  formatKstDateTime,
  formatKstTime,
  kstDate,
  MS_PER_DAY,
  MS_PER_MINUTE,
  t,
  tpl,
  type AppLanguage,
} from '@skkuverse/shared';
import type {
  BarSegmentView,
  BoardCall,
  CampusRoutesAnswer,
  NotRunningOption,
  OptionView,
  RideTimingView,
  RideView,
  RouteLeg,
  RouteOption,
  RunView,
  TimelineItemView,
} from './campus-routes.types';
import { ROUTES_STALE_MS } from './campus-routes.constants';
import { GENERIC_LEG_EMOJI, LEG_EMOJI } from './emoji.constants';

// WHY: counting from the server's clock keeps a mis-set phone right; a device HTTP-cache replay inside the 15 s max-age reads up to that early.
export function serverNowAt(answer: Pick<CampusRoutesAnswer, 'serverNowMs' | 'receivedAtMs'> | undefined, deviceNow: number): number {
  if (answer?.serverNowMs === undefined) return deviceNow;
  return deviceNow + answer.serverNowMs - answer.receivedAtMs;
}

// WHY: a subway time for one train and a predicted bus read plain; each is a specific run or vehicle, not a headway guess.
export function callTimeText(call: BoardCall, at: number, lang: AppLanguage): string {
  const time = formatKstTime(at);
  return call.isHeadwayGuess ? tpl(lang, 'campusRoutes.approx', time) : time;
}

// WHY: "arriving now" under a minute or once the time has passed, since a listed run can still be at the stop.
export function countdownText(call: BoardCall, at: number, now: number, lang: AppLanguage): string {
  const minutes = Math.floor((at - now) / MS_PER_MINUTE);
  if (minutes < 1) return t(lang, 'campusRoutes.arrivingNow');
  const text = tpl(lang, 'campusRoutes.inMinutes', minutes);
  return call.isHeadwayGuess ? tpl(lang, 'campusRoutes.approx', text) : text;
}

export function stopsSummaryText(between: number, isRail: boolean, minutes: number, lang: AppLanguage): string {
  const duration = tpl(lang, 'campusRoutes.duration', minutes);
  return tpl(lang, isRail ? 'campusRoutes.stations' : 'campusRoutes.busStops', between + 1, duration);
}

export function serviceTimeText(at: number, now: number, lang: AppLanguage): string {
  const day = kstDate(at);
  if (day === kstDate(now)) return formatKstTime(at);
  if (day === kstDate(now + MS_PER_DAY)) return tpl(lang, 'campusRoutes.tomorrow', formatKstTime(at));
  return formatKstDateTime(at, (key) => t(lang, key));
}

const SEPARATOR = ' · ';

export function statusText(option: NotRunningOption, now: number, lang: AppLanguage): string {
  const next = option.nextServiceAt === undefined ? undefined : serviceTimeText(option.nextServiceAt, now, lang);
  switch (option.reason) {
    case 'unavailable':
      return t(lang, 'campusRoutes.unavailable');
    case 'notStarted':
      return next === undefined ? t(lang, 'campusRoutes.notStarted') : `${t(lang, 'campusRoutes.notStarted')}${SEPARATOR}${next}`;
    case 'ended':
      return next === undefined
        ? t(lang, 'campusRoutes.ended')
        : `${t(lang, 'campusRoutes.ended')}${SEPARATOR}${tpl(lang, 'campusRoutes.nextService', next)}`;
  }
}

export function leaveText(leaveAt: number, now: number, lang: AppLanguage): string {
  const minutes = Math.floor((leaveAt - now) / MS_PER_MINUTE);
  return minutes < 1 ? t(lang, 'campusRoutes.leaveNow') : tpl(lang, 'campusRoutes.leaveIn', minutes);
}

// WHY: at least one minute, so a step shorter than a minute still takes a slot.
export function wholeMinutes(ms: number): number {
  return Math.max(1, Math.round(ms / MS_PER_MINUTE));
}

export function legEmoji(icon: string): string {
  return Object.hasOwn(LEG_EMOJI, icon) ? (LEG_EMOJI[icon] ?? GENERIC_LEG_EMOJI) : GENERIC_LEG_EMOJI;
}

// WHY: never due before a first answer, which the mount's own fetch is already asking for.
export function isRefetchDue(dataUpdatedAt: number, now: number): boolean {
  return dataUpdatedAt !== 0 && now - dataUpdatedAt >= ROUTES_STALE_MS;
}

type RideLeg = Extract<RouteLeg, { kind: 'ride' }>;

// WHY: owner decision 2026-10-26: every ride shows its nearest runs from now; only a ride with no run listed (a headway-only bus) shows its planned run.
function toRideTiming(leg: RideLeg, now: number, lang: AppLanguage): RideTimingView {
  if (leg.upcoming.length === 0) {
    return { kind: 'planned', board: { text: callTimeText(leg.board, leg.startAt, lang), isLastRun: leg.board.isLastRun } };
  }
  return {
    kind: 'upcoming',
    runs: leg.upcoming.map((call): RunView => ({ text: countdownText(call, call.at, now, lang), isLastRun: call.isLastRun })),
  };
}

function toRideView(leg: RideLeg, now: number, lang: AppLanguage): RideView {
  return {
    label: leg.label,
    emoji: legEmoji(leg.icon),
    ...(leg.color === undefined ? {} : { color: leg.color }),
    board: leg.from,
    alight: leg.to,
    timing: toRideTiming(leg, now, lang),
    // WHY: with the stops unknown there is nothing to count, and the bar above already gives the minutes.
    stopsSummary:
      leg.stops === null ? null : stopsSummaryText(leg.stops.length, leg.isRail, wholeMinutes(leg.durationSec * 1000), lang),
    stops: leg.stops ?? [],
  };
}

function toTimeline(legs: [RouteLeg, ...RouteLeg[]], now: number, lang: AppLanguage): TimelineItemView[] {
  const first = legs[0];
  const last = legs.at(-1) ?? first;
  const items: TimelineItemView[] = first.kind === 'ride' ? [] : [{ kind: 'start', place: first.from }];
  for (const leg of legs) {
    if (leg.kind === 'ride') {
      items.push({ kind: 'ride', ...toRideView(leg, now, lang) });
    } else {
      const minutes = tpl(lang, 'campusRoutes.duration', wholeMinutes(leg.durationSec * 1000));
      items.push({ kind: 'step', emoji: legEmoji(leg.icon), text: `${leg.label} ${minutes}` });
    }
  }
  if (last.kind !== 'ride') items.push({ kind: 'end', place: last.to });
  return items;
}

function toBarSegment(leg: RouteLeg): BarSegmentView {
  const minutes = wholeMinutes(leg.durationSec * 1000);
  return leg.color === undefined ? { minutes } : { minutes, color: leg.color };
}

export function toOptionView(option: RouteOption, now: number, lang: AppLanguage): OptionView {
  const warnings = option.warnings.map((w) => w.message);
  if (option.status === 'notRunning') {
    return { status: 'notRunning', name: option.name, statusLine: statusText(option, now, lang), warnings };
  }
  return {
    status: 'running',
    name: option.name,
    minutes: wholeMinutes(option.arriveAt - option.leaveAt),
    leave: leaveText(option.leaveAt, now, lang),
    warnings,
    bar: option.legs.map(toBarSegment),
    timeline: toTimeline(option.legs, now, lang),
  };
}
