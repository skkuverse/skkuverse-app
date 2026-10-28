import { View } from 'react-native';
import { Switch, Tossface, Txt, createThemedStyles } from '@skkuverse/sds';
import { SdsRadius, SdsSpacing } from '@skkuverse/shared';
import type { NoticeTab } from '@/features/notices/notices.types';

// SEE: docs/how-to/add-notice-tab.md; a new server tab key needs an entry here, or it shows the 📌 fallback.
export const TAB_EMOJI: Record<string, string> = {
  dept: '🎓',
  academic: '📖',
  scholarship: '💰',
  career: '💼',
  recruitment: '📣',
  event: '🎉',
  library: '📚',
  dorm: '🛏️',
  general: '📌',
};

interface TabToggleRowProps {
  tab: NoticeTab;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled: boolean;
}

export function TabToggleRow({ tab, checked, onChange, disabled }: TabToggleRowProps) {
  const styles = useStyles();
  const emoji = TAB_EMOJI[tab.key] ?? '📌';
  return (
    <View style={styles.tabRow}>
      <View style={styles.badge}>
        <Tossface size={22} style={styles.badgeEmoji}>{emoji}</Tossface>
      </View>
      <View style={styles.tabTitleWrap}>
        <Txt
          typography="t7"
          fontWeight="regular"
          color="neutral"
          style={styles.tabTitleText}
        >
          {tab.label}
        </Txt>
      </View>
      <View style={styles.switchWrap}>
        <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
      </View>
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SdsSpacing.x6,
    paddingVertical: SdsSpacing.x2_5,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: SdsRadius.r2_5,
    backgroundColor: color.bg.neutralWeak,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeEmoji: {
    // eslint-disable-next-line sds/no-type-size-literal -- the emoji's line box inside its badge; an emoji is not on the type scale
    lineHeight: 28,
  },
  tabTitleWrap: {
    flex: 1,
    marginLeft: SdsSpacing.x4,
    // WHY: the same 40pt envelope as the badge and `switchWrap`, so all three centre on one axis.
    height: 40,
    justifyContent: 'center',
  },
  tabTitleText: {
    // QUIRK(react-native): alignItems centres boxes, not glyphs, and a lineHeight at or under fontSize drops
    // leading only above (facebook/react-native#29507), so the default lineHeight stays and
    // verticalAlign centres the glyph in its line box.
    verticalAlign: 'middle',
  },
  switchWrap: {
    // WHY: the same envelope as `tabTitleWrap`, so the Switch and the label centre at one Y.
    height: 40,
    justifyContent: 'center',
  },
}));
