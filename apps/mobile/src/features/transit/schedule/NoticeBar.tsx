import { StyleSheet } from 'react-native';
import { WarningIcon, InfoIcon } from 'phosphor-react-native';
import { SdsSpacing } from '@skkuverse/shared';
import { Callout, type CalloutTone } from '@skkuverse/sds';
import { TossfaceRuns } from '@/components/TossfaceRuns';
import { COMPACT_CALLOUT, INFO_BANNER_TONES } from './InfoBanner';
import type { ScheduleTone } from './schedule.types';
import type { ScheduleNotice, ScheduleNoticeStyle } from '../transit.types';

interface NoticeBarProps {
  notice: ScheduleNotice;
  tone?: ScheduleTone;
}

/** WHY: an `ai` notice is drawn by `AiNotice`, never here; it falls back to info. */
const STYLE_TONES: Record<Exclude<ScheduleNoticeStyle, 'ai'>, CalloutTone> = {
  warning: 'warning',
  info: INFO_BANNER_TONES.colored,
};

export function NoticeBar({ notice, tone = 'colored' }: NoticeBarProps) {
  const calloutTone =
    tone === 'neutral' ? INFO_BANNER_TONES.neutral : STYLE_TONES[notice.style === 'ai' ? 'info' : notice.style];
  const Icon = notice.style === 'warning' ? WarningIcon : InfoIcon;

  return (
    <Callout tone={calloutTone} prefixIcon={<Icon weight="fill" />} description={<TossfaceRuns text={notice.text} />} style={[COMPACT_CALLOUT, styles.container]} />
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: SdsSpacing.gutter,
    marginTop: SdsSpacing.x1_5,
  },
});
