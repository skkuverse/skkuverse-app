import { SdsPalette, type Logo } from '@skkuverse/shared';
import { Txt, createThemedStyles } from '@skkuverse/sds';
import { ServiceLogo } from './ServiceLogo';
import type { PillLabelTone } from '../pill.rules';

/** WHY: shared by the bottom bar's pill and the header's, so the two never drift. */
export function ServicePillLabel({
  logo,
  faviconUri,
  name,
  tone,
  logoSize = 18,
}: {
  logo: Logo | null;
  faviconUri: string | null;
  name: string;
  tone: PillLabelTone;
  logoSize?: number;
}) {
  const styles = useStyles();
  return (
    <>
      <ServiceLogo logo={logo} faviconUri={faviconUri} size={logoSize} />
      <Txt typography="t4" fontWeight="semibold" style={[styles.titleText, tone === 'staticWhite' && styles.titleTextStaticWhite]} numberOfLines={1}>
        {name}
      </Txt>
    </>
  );
}


const useStyles = createThemedStyles(({ color }) => ({
  titleText: {
    flexShrink: 1,
    textAlign: 'center',
    color: color.fg.neutral,
  },
  titleTextStaticWhite: {
    color: SdsPalette.static.white,
  },
}));
