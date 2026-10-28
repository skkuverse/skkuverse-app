import { useCallback, useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { type BannerCarousel, type BannerImage, type BannerItem, SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { LoopingPager } from '@/components/LoopingPager';
import { handleSduiAction } from '@/features/web/web.service';
import { logHomeContentSelect } from '@/platform/analytics';
import { HeroBanner } from './HeroBanner';
import { Pressable, createThemedStyles } from '@skkuverse/sds';

interface Props {
  carousel: BannerCarousel;
}

// WHY: a carousel with nothing left to show still shows the app's own banner.
const DEFAULT_ONLY: readonly BannerItem[] = [{ type: 'default' }];

const SLOT_MARGIN = 16;

export function HomeBannerCarousel({ carousel }: Props) {
  const styles = useStyles();
  const pages = carousel.items.length > 0 ? carousel.items : DEFAULT_ONLY;
  const looping = pages.length > 1;
  const pageKey = useMemo(() => pages.map((p) => (p.type === 'image' ? p.id : 'default')).join('|'), [pages]);
  const { width: windowWidth } = useWindowDimensions();

  const renderPage = useCallback(
    (i: number, current: boolean) => {
      const page = pages[i] as BannerItem;
      return page.type === 'image' ? (
        <ImagePage item={page} />
      ) : (
        // WHY: as the only page it is always current, so it keeps its own loop.
        <HeroBanner fill active={looping ? current : undefined} />
      );
    },
    [pages, looping],
  );

  return (
    <LoopingPager
      pageCount={pages.length}
      pageKey={pageKey}
      height={{ forWidth: (w) => w / carousel.aspectRatio, estimatedWidth: windowWidth - SLOT_MARGIN * 2 }}
      autoRotateMs={carousel.autoRotateSec * 1000}
      renderPage={renderPage}
      counter="bottomRight"
      style={styles.slot}
    />
  );
}

function ImagePage({ item }: { item: BannerImage }) {
  const styles = useStyles();
  const image = (
    <Image
      source={{ uri: item.imageUrl }}
      style={styles.image}
      contentFit="cover"
      cachePolicy="memory-disk"
      transition={150}
      accessible={!item.action}
      accessibilityLabel={item.alt}
    />
  );
  if (!item.action) return image;

  const { actionType, actionValue } = item.action;
  return (
    <Pressable
      style={styles.image}
      onPress={() => {
        logHomeContentSelect({ content_type: 'banner', item_id: item.id });
        handleSduiAction({ actionType, actionValue, source: 'home_banner' });
      }}
      accessibilityRole="button"
      accessibilityLabel={item.alt}
    >
      {image}
    </Pressable>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  // WHY: the slot owns the margins and the clip, so every page is cut alike.
  slot: {
    marginHorizontal: SLOT_MARGIN,
    marginBottom: SdsSpacing.x3,
    borderRadius: SdsRadius.r4,
    overflow: 'hidden',
    backgroundColor: color.bg.brandWeak,
  },
  image: {
    width: '100%',
    height: '100%',
  },
}));
