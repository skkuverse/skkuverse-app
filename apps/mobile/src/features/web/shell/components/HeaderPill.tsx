import { View } from 'react-native';
import { SdsSpacing, type Logo } from '@skkuverse/shared';
import { GlassSurface, createThemedStyles } from '@skkuverse/sds';
import { ServicePillLabel } from './ServicePillLabel';
import type { PillLabelTone } from '../pill.rules';

// WHY: the height of iOS 26's system bar-button capsules beside it; the bar's collapsed 36 looked small.
const HEADER_PILL_H = 44;

/**
 * QUIRK(react-native-screens): on iOS 26 a custom `headerTitle` view is laid out outside the navbar and
 * clipped, so the pill sits in the left items; the caller's `maxWidth` clears the back and more buttons.
 */
export function HeaderPill({
  logo,
  faviconUri,
  name,
  tone,
  maxWidth,
}: {
  logo: Logo | null;
  faviconUri: string | null;
  name: string;
  tone: PillLabelTone;
  maxWidth: number;
}) {
  const styles = useStyles();
  return (
    <GlassSurface style={[styles.headerPill, { maxWidth }]}>
      <View style={styles.headerPillInner}>
        <ServicePillLabel logo={logo} faviconUri={faviconUri} name={name} tone={tone} logoSize={20} />
      </View>
    </GlassSurface>
  );
}


const useStyles = createThemedStyles(() => ({
  headerPill: {
    height: HEADER_PILL_H,
    borderRadius: HEADER_PILL_H / 2,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  headerPillInner: {
    flex: 1,
    paddingHorizontal: SdsSpacing.x3_5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SdsSpacing.x1_5,
  },
}));
