import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SdsSpacing } from '@skkuverse/shared';
import { Txt, createThemedStyles } from '@skkuverse/sds';

interface Props {
  width: number;
  title: string;
  body: string;
  figure: ReactNode;
}

// WHY: type matches the notices landing (t13, t8), so the third page and the notices gate read as
// one screen shown twice.
export function IntroPage({ width, title, body, figure }: Props) {
  const styles = useStyles();
  return (
    <View style={[styles.page, { width }]}>
      <View>
        <Txt typography="t13" fontWeight="bold">
          {title}
        </Txt>
        <Txt typography="t8" color="neutralSubtle" style={styles.subtitle}>
          {body}
        </Txt>
      </View>
      <View style={styles.figure}>{figure}</View>
    </View>
  );
}

const useStyles = createThemedStyles(() => ({
  page: {
    // QUIRK(react-native): no `flex: 1`; in a horizontal ScrollView it sets flexBasis 0 against the
    // explicit `width` and collapses every page.
    paddingTop: SdsSpacing.x8,
    // WHY: padding sits on the page, not a parent, so the ScrollView runs edge-to-edge and paging snaps on
    // the window width.
    paddingHorizontal: SdsSpacing.x6,
  },
  subtitle: {
    marginTop: SdsSpacing.x4,
  },
  figure: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: SdsSpacing.x7,
  },
}));
