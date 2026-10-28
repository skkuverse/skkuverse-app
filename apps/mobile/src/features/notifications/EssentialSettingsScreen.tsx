import { ScrollView, View } from 'react-native';
import { Callout, ListRow, Switch, createThemedStyles } from '@skkuverse/sds';
import { SdsSpacing, useT } from '@skkuverse/shared';
import { AnonymousGate } from './AnonymousGate';
import { HintBanner } from './HintBanner';
import { useEssentialSettings } from './useEssentialSettings';

export default function EssentialSettingsScreen() {
  const styles = useStyles();
  const { t } = useT();
  const { authReady, masterEnabled } = useEssentialSettings();

  if (!authReady) return <AnonymousGate />;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {!masterEnabled && <HintBanner message={t('notifications.masterOffHint')} />}

        <ListRow
          contents={
            <ListRow.Texts
              layout="2RowTypeA"
              top={t('notifications.essentialDetailSwitchLabel')}
              bottom={t('notifications.essentialDetailDesc')}
            />
          }
          right={
            <Switch checked disabled />
          }
        />

        <Callout
          title={t('notifications.essentialLockedTitle')}
          description={t('notifications.essentialLockedBody')}
          style={styles.infoCard}
        />
      </ScrollView>
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    backgroundColor: color.bg.layerDefault,
  },
  scroll: {
    paddingBottom: SdsSpacing.x8,
  },
  infoCard: {
    marginTop: SdsSpacing.x5,
    marginHorizontal: SdsSpacing.x4,
  },
}));
