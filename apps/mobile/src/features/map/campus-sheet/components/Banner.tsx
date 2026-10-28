import { StyleSheet } from 'react-native';
import { Pressable } from '@skkuverse/sds';
import { Image } from 'expo-image';
import { SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { handleSduiAction } from '@/features/web/web.service';
import { logSduiContentSelect } from '@/platform/analytics';
import type { SduiBanner as BannerType } from '@/features/map/campus-sheet/campus-sheet.types';

interface Props {
  section: BannerType;
}

// eslint-disable-next-line sds/no-handbuilt-part -- a server-driven image banner, not a callout
export function Banner({ section }: Props) {
  return (
    <Pressable
      style={styles.container}
      onPress={() => {
        logSduiContentSelect({ content_type: 'sdui_banner', item_id: section.id });
        handleSduiAction({
          actionType: section.actionType,
          actionValue: section.actionValue,
          source: 'sdui',
        });
      }}
    >
      <Image
        source={section.imageUrl}
        style={styles.image}
        contentFit="cover"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: SdsSpacing.x2,
  },
  image: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: SdsRadius.r2_5,
  },
});
