import { ScrollView, StyleSheet, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, Txt, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import { SdsRadius, SdsSpacing, useT, type TranslationKey } from '@skkuverse/shared';
import { openInAppBrowser } from '@/platform/handoff';

interface AttributionEntry {
  nameKey: TranslationKey;
  url: string;
  providerKey: TranslationKey;
  descKey: TranslationKey;
}

const ENTRIES: AttributionEntry[] = [
  {
    nameKey: 'campus.hsscMap',
    url: 'https://www.skku.edu',
    providerKey: 'attribution.skku',
    descKey: 'attribution.officialData',
  },
  {
    nameKey: 'campus.nscMap',
    url: 'https://www.skku.edu',
    providerKey: 'attribution.skku',
    descKey: 'attribution.officialData',
  },
  {
    nameKey: 'attribution.shuttle',
    url: 'https://www.skku.edu',
    providerKey: 'attribution.skku',
    descKey: 'attribution.officialTransit',
  },
];

const inAppBrowserOptions: WebBrowser.WebBrowserOpenOptions = {
  presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
  dismissButtonStyle: 'close',
  showTitle: true,
  enableBarCollapsing: true,
};

export function AttributionsScreen() {
  const styles = useStyles();
  const { t } = useT();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Txt typography="t5" color="neutralSubtle">
          {t('attribution.notice')}
        </Txt>
        <View style={styles.divider} />
      </View>
      {ENTRIES.map((entry) => (
        <AttributionRow key={entry.nameKey} entry={entry} />
      ))}
    </ScrollView>
  );
}

function AttributionRow({ entry }: { entry: AttributionEntry }) {
  const styles = useStyles();
  const color = useSemanticColors();
  const { t } = useT();

  return (
    <View style={styles.row}>
      <Txt typography="t9" fontWeight="bold" color="neutral">
        {t(entry.nameKey)}
      </Txt>
      <Pressable
        // SEE: docs/reference/design-usage.md PRESS-08
        bg="transparent"
        feedback="color"
        style={styles.linkPress}
        onPress={() => void openInAppBrowser(entry.url, {
          ...inAppBrowserOptions,
          controlsColor: color.fg.brand,
          toolbarColor: color.bg.layerDefault,
        })}>
        <Txt typography="t5" color="brand" style={styles.link}>
          {entry.url}
        </Txt>
      </Pressable>
      <Txt typography="t5" color="neutralSubtle">
        {t(entry.providerKey)}
      </Txt>
      <Txt typography="t5" color="neutralSubtle">
        {`▶ ${t(entry.descKey)}`}
      </Txt>
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    backgroundColor: color.bg.layerDefault,
  },
  content: {
    paddingBottom: SdsSpacing.x8,
  },
  header: {
    paddingHorizontal: SdsSpacing.x5,
    paddingTop: SdsSpacing.x3,
    paddingBottom: SdsSpacing.x5,
    gap: SdsSpacing.x5,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.stroke.neutralMuted,
  },
  row: {
    paddingHorizontal: SdsSpacing.x5,
    paddingVertical: SdsSpacing.x3,
    gap: SdsSpacing.x0_5,
  },
  linkPress: {
    borderRadius: SdsRadius.r1,
  },
  link: {
    textDecorationLine: 'underline',
  },
}));
