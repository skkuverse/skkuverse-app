import { ScrollView, View } from 'react-native';
import { ListHeader, ListRow, Switch, createThemedStyles } from '@skkuverse/sds';
import { useT, SdsSpacing } from '@skkuverse/shared';
import { AnonymousGate } from './AnonymousGate';
import { HintBanner } from './HintBanner';
import { useServicesSettings } from './useServicesSettings';

export default function ServicesSettingsScreen() {
  const styles = useStyles();
  const { t } = useT();
  const { authReady, masterEnabled, checked, handleToggle } = useServicesSettings();

  if (!authReady) return <AnonymousGate />;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {!masterEnabled && <HintBanner message={t('notifications.masterOffHint')} />}

        <ListRow
          contents={
            <ListRow.Texts
              layout="2RowTypeA"
              top={t('notifications.servicesDetailSwitchLabel')}
              bottom={t('notifications.servicesDetailDesc')}
            />
          }
          right={
            <Switch
              checked={checked}
              onCheckedChange={handleToggle}
              disabled={!masterEnabled}
            />
          }
        />

        <View style={styles.section}>
          <ListHeader
            title={
              <ListHeader.TitleParagraph typography="t7" fontWeight="bold">
                {t('notifications.servicesIncludesTitle')}
              </ListHeader.TitleParagraph>
            }
          />
          <ListRow
            contents={
              <ListRow.Texts layout="1RowTypeA" top={t('notifications.servicesIncludes1')} />
            }
          />
          <ListRow
            contents={
              <ListRow.Texts layout="1RowTypeA" top={t('notifications.servicesIncludes2')} />
            }
          />
          <ListRow
            contents={
              <ListRow.Texts layout="1RowTypeA" top={t('notifications.servicesIncludes3')} />
            }
          />
        </View>
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
  section: {
    marginTop: SdsSpacing.x4,
  },
}));
