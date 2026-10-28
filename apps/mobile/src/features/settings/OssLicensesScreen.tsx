import { FlatList, StyleSheet, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, Txt, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import { SdsRadius, SdsSpacing, useT } from '@skkuverse/shared';
import licensesData from '../../../assets/oss-licenses.json';
import { openInAppBrowser } from '@/platform/handoff';

interface LicenseEntry {
  name: string;
  version: string;
  license: string;
  homepage: string | null;
  repository: string | null;
  author: string | null;
}

const PACKAGES = Array.from(
  new Map(
    (licensesData.packages as LicenseEntry[]).map((p) => [`${p.name}@${p.version}`, p]),
  ).values(),
);

const inAppBrowserOptions: WebBrowser.WebBrowserOpenOptions = {
  presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
  dismissButtonStyle: 'close',
  showTitle: true,
  enableBarCollapsing: true,
};

export function OssLicensesScreen() {
  const styles = useStyles();
  const { t } = useT();

  return (
    <FlatList
      style={styles.container}
      data={PACKAGES}
      keyExtractor={(item) => `${item.name}@${item.version}`}
      renderItem={({ item }) => <LicenseRow item={item} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Txt typography="t5" color="neutralSubtle">
            {t('settings.ossNotice')}
          </Txt>
          <View style={styles.divider} />
        </View>
      }
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      initialNumToRender={20}
      windowSize={10}
      removeClippedSubviews
    />
  );
}

function LicenseRow({ item }: { item: LicenseEntry }) {
  const styles = useStyles();
  const color = useSemanticColors();
  const url = item.homepage ?? item.repository;

  return (
    <View style={styles.row}>
      <Txt typography="t9" fontWeight="bold" color="neutral">
        {item.name}
      </Txt>
      {url ? (
        <Pressable
          // SEE: docs/reference/design-usage.md PRESS-08
          bg="transparent"
          feedback="color"
          style={styles.linkPress}
          onPress={() => void openInAppBrowser(url, {
              ...inAppBrowserOptions,
              controlsColor: color.fg.brand,
              toolbarColor: color.bg.layerDefault,
            })}>
          <Txt typography="t5" color="brand" style={styles.link}>
            {url}
          </Txt>
        </Pressable>
      ) : null}
      {item.author ? (
        <Txt typography="t5" color="neutralSubtle">
          {item.author}
        </Txt>
      ) : null}
      <Txt typography="t5" color="neutralSubtle">
        {`▶ ${item.license}`}
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
