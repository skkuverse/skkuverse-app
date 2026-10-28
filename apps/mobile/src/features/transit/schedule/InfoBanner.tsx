import { InfoIcon } from 'phosphor-react-native';
import { StyleSheet } from 'react-native';
import { SdsSpacing } from '@skkuverse/shared';
import { Callout, type CalloutTone } from '@skkuverse/sds';
import { TossfaceRuns } from '@/components/TossfaceRuns';
import type { ScheduleTone } from './schedule.types';

interface InfoBannerProps {
  text: string;
  tone?: ScheduleTone;
}

export const INFO_BANNER_TONES: Record<ScheduleTone, CalloutTone> = {
  colored: 'informative',
  neutral: 'neutral',
};

/** EVIDENCE: dropping the default x3_5 padding and 50 pt floor makes a one-line notice 36 pt instead of 50. */
export const COMPACT_CALLOUT = StyleSheet.create({
  root: { paddingVertical: SdsSpacing.x2, minHeight: 0 },
}).root;

export function InfoBanner({ text, tone = 'colored' }: InfoBannerProps) {
  return <Callout tone={INFO_BANNER_TONES[tone]} prefixIcon={<InfoIcon weight="fill" />} description={<TossfaceRuns text={text} />} style={COMPACT_CALLOUT} />;
}
