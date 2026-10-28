// WHY: no glow, since the notices are pinned at the scroller's top edge, which would clip the halo.
import { StarFourIcon } from 'phosphor-react-native';
import { Callout } from '@skkuverse/sds';
import { TossfaceRuns } from '@/components/TossfaceRuns';
import { COMPACT_CALLOUT } from './InfoBanner';

export function AiNotice({ text }: { text: string }) {
  return <Callout tone="ai" prefixIcon={<StarFourIcon weight="fill" />} description={<TossfaceRuns text={text} />} style={COMPACT_CALLOUT} />;
}
