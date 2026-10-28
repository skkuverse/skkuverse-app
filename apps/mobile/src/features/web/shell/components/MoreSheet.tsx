import { View } from 'react-native';
import { ArrowClockwiseIcon, BellIcon } from 'phosphor-react-native';
import { useT, SdsSpacing } from '@skkuverse/shared';
import { Sheet, createThemedStyles } from '@skkuverse/sds';
import { MenuRow } from './MenuRow';
import { MenuToggleRow } from './MenuToggleRow';

export function MoreSheet({
  open,
  onDismiss,
  showPushToggle,
  masterEnabled,
  pushOn,
  onTogglePush,
  onRefresh,
}: {
  open: boolean;
  onDismiss: () => void;
  showPushToggle: boolean;
  masterEnabled: boolean;
  pushOn: boolean;
  onTogglePush: (next: boolean) => void;
  onRefresh: () => void;
}) {
  const styles = useStyles();
  const { t } = useT();
  return (
    <Sheet
      open={open}
      onDismiss={onDismiss}
      position={{ kind: 'fit' }}
      backdrop
    >
      <Sheet.View style={styles.infoSheet}>
      <View style={styles.menuList}>
        {/* WHY: the push belongs to the mini app, not a booth on the map, so it is switched here. */}
        {showPushToggle ? (
          <MenuToggleRow
            icon={BellIcon}
            label={t('eskaraPush.toggle')}
            hint={masterEnabled ? undefined : t('eskaraPush.toggleHint')}
            value={pushOn}
            onValueChange={onTogglePush}
          />
        ) : null}
        <MenuRow icon={ArrowClockwiseIcon} label="새로고침" onPress={onRefresh} />
      </View>
      </Sheet.View>
    </Sheet>
  );
}

const useStyles = createThemedStyles(() => ({
  // WHY: Sheet adds no gutter of its own, so a sheet that wants one sets it.
  infoSheet: {
    paddingHorizontal: SdsSpacing.gutter,
    paddingBottom: SdsSpacing.x5,
  },
  menuList: {
    gap: SdsSpacing.x1,
  },
}));
