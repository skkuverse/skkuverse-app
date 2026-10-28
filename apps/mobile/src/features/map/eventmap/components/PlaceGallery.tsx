/**
 * WHY: photos are keyed by URL, not block id: ids repeat across places, the sheet stays mounted across pins,
 * and expo-image holds the old bitmap until the new one loads. A plain React Native ScrollView, since a
 * gorhom scrollable cannot nest inside another.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  type GestureResponderEvent,
  Modal,
  ScrollView,
  type StyleProp,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  Image,
  type ImageContentFit,
  type ImageLoadEventData,
  type ImageStyle,
} from 'expo-image';
import { XIcon } from 'phosphor-react-native';
import {
  pickI18nText,
  SdsPalette,
  SdsRadius,
  SdsSpacing,
} from '@skkuverse/shared';
import { ColorSchemeProvider, Pressable, Skeleton, Txt, createThemedStyles } from '@skkuverse/sds';
import { SchemeStatusBar } from '@/components/SchemeStatusBar';
import { SHEET_GUTTER } from './sheet-layout.constants';
import { trackPlaceAction } from './usePlaceNavigate';
import { SOLO_IMAGE_DEFAULT_ASPECT, soloImageSize, type PlaceImage } from '../place-detail.rules';
import { useAppLanguage } from '../../useAppLanguage';

const THUMB_WIDTH = 256;
const THUMB_HEIGHT = 192;
const SOLO_MAX_WIDTH = 320;
const SOLO_MAX_HEIGHT = 440;
const SHEET_MAX_WIDTH = 600;

/** WHY: media keys are content-hashed, so a URL's aspect never changes and a reopened sheet starts at the right height. */
const soloAspects = new Map<string, number>();

export function PlaceGallery({ images }: { images: readonly PlaceImage[] }) {
  const styles = useStyles();
  const lang = useAppLanguage();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const viewerRef = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();

  const closeViewer = useCallback(() => setOpenIndex(null), []);
  const positionViewer = useCallback(() => {
    if (openIndex !== null) {
      viewerRef.current?.scrollTo({ x: openIndex * width, animated: false });
    }
  }, [openIndex, width]);

  if (images.length === 0) return null;
  const openAt = (index: number) => {
    trackPlaceAction('gallery', String(index));
    setOpenIndex(index);
  };
  const solo = images.length === 1 ? images[0] : null;

  return (
    <>
      {solo ? (
        <SoloImage
          key={solo.url}
          uri={solo.url}
          caption={solo.caption ? pickI18nText(solo.caption, lang) : null}
          onOpen={() => openAt(0)}
        />
      ) : (
        <ScrollView
          horizontal
          directionalLockEnabled
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.bleed}
          contentContainerStyle={styles.row}
        >
          {images.map((image, index) => (
            <GalleryThumbnail
              key={image.url}
              uri={image.url}
              caption={image.caption ? pickI18nText(image.caption, lang) : null}
              onOpen={() => openAt(index)}
            />
          ))}
        </ScrollView>
      )}

      {/* QUIRK(ios): a Modal's children stay mounted until its dismiss finishes, and Fabric's ScrollView emits onMomentumScrollEnd when it leaves the window, so a pager that wrote openIndex reopened the viewer on every X. */}
      <Modal
        visible={openIndex !== null}
        animationType="fade"
        statusBarTranslucent
        onShow={positionViewer}
        onRequestClose={closeViewer}
      >
        <ColorSchemeProvider colorMode="dark-only">
          <SchemeStatusBar />
          <ViewerPages images={images} viewerRef={viewerRef} onClose={closeViewer} />
        </ColorSchemeProvider>
      </Modal>
    </>
  );
}

/** WHY: dark in either theme; a caption and the close mark sit on the photo and are static white. */
function ViewerPages({
  images,
  viewerRef,
  onClose,
}: {
  images: readonly PlaceImage[];
  viewerRef: React.RefObject<ScrollView | null>;
  onClose: () => void;
}) {
  const styles = useViewerStyles();
  const lang = useAppLanguage();
  const { width, height } = useWindowDimensions();
  return (
    <View style={styles.viewer}>
      <ScrollView
        ref={viewerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
      >
        {images.map((image) => (
          <View key={image.url} style={[styles.viewerPage, { width, height }]}>
            <Image
              source={{ uri: image.url }}
              style={{ width, height }}
              contentFit="contain"
              accessibilityIgnoresInvertColors
            />
            {image.caption ? (
              <Txt typography="t5" style={[styles.viewerCaption, { color: SdsPalette.static.white }]}>
                {pickI18nText(image.caption, lang)}
              </Txt>
            ) : null}
          </View>
        ))}
      </ScrollView>
      <Pressable
        bg="overlay"
        style={styles.viewerClose}
        onPress={onClose}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Close image viewer"
      >
        <XIcon size={26} color={SdsPalette.static.white} weight="bold" />
      </Pressable>
    </View>
  );
}

/** WHY: an upward sheet drag past the tap slop is left alone, even before a nested ScrollView claims it. */
function useTapNotDrag(onTap: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  return {
    onTouchStart: (event: GestureResponderEvent) => {
      start.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
      moved.current = false;
    },
    onTouchMove: (event: GestureResponderEvent) => {
      if (start.current === null) return;
      const dx = event.nativeEvent.pageX - start.current.x;
      const dy = event.nativeEvent.pageY - start.current.y;
      if (Math.hypot(dx, dy) > 8) moved.current = true;
    },
    onPress: () => {
      if (!moved.current) onTap();
    },
  };
}

function GalleryThumbnail({
  uri,
  caption,
  onOpen,
}: {
  uri: string;
  caption: string | null;
  onOpen: () => void;
}) {
  const styles = useStyles();
  const tap = useTapNotDrag(onOpen);

  return (
    <Pressable accessibilityRole="imagebutton" {...tap}>
      <LoadingImage
        uri={uri}
        style={styles.thumb}
        contentFit="cover"
        accessibilityLabel={caption ?? undefined}
      />
      {caption ? (
        <Txt typography="t3" color="neutralSubtle" numberOfLines={1} style={styles.caption}>
          {caption}
        </Txt>
      ) : null}
    </Pressable>
  );
}

/** WHY: `contain`, not `cover`: before the aspect loads, a wrong guess letterboxes rather than cutting the poster. */
function SoloImage({
  uri,
  caption,
  onOpen,
}: {
  uri: string;
  caption: string | null;
  onOpen: () => void;
}) {
  const styles = useStyles();
  const tap = useTapNotDrag(onOpen);
  const { width: windowWidth } = useWindowDimensions();
  const [aspect, setAspect] = useState(() => soloAspects.get(uri) ?? SOLO_IMAGE_DEFAULT_ASPECT);
  const size = useMemo(() => {
    const column = Math.min(windowWidth, SHEET_MAX_WIDTH) - 2 * SHEET_GUTTER;
    return soloImageSize(aspect, Math.min(column, SOLO_MAX_WIDTH), SOLO_MAX_HEIGHT);
  }, [aspect, windowWidth]);

  return (
    <Pressable accessibilityRole="imagebutton" style={styles.solo} {...tap}>
      <LoadingImage
        uri={uri}
        style={[styles.soloImage, size]}
        contentFit="contain"
        onLoad={(event) => {
          const loaded = event.source.width / event.source.height;
          if (!Number.isFinite(loaded) || loaded <= 0) return;
          soloAspects.set(uri, loaded);
          setAspect(loaded);
        }}
        accessibilityLabel={caption ?? undefined}
      />
      {caption ? (
        <Txt
          typography="t3"
          color="neutralSubtle"
          numberOfLines={1}
          style={[styles.soloCaption, { width: size.width }]}
        >
          {caption}
        </Txt>
      ) : null}
    </Pressable>
  );
}

/**
 * WHY: the shimmer sits behind the image, so a cached photo covers it on its first frame; it goes on
 * `onDisplay` (drawn, not just fetched) or `onError`.
 */
function LoadingImage({
  uri,
  style,
  contentFit,
  onLoad,
  accessibilityLabel,
}: {
  uri: string;
  style: StyleProp<ImageStyle>;
  contentFit: ImageContentFit;
  onLoad?: (event: ImageLoadEventData) => void;
  accessibilityLabel?: string;
}) {
  const styles = useStyles();
  const [shown, setShown] = useState(false);

  return (
    <View>
      {shown ? null : (
        <Skeleton.Animate>
          <Skeleton width="100%" borderRadius={SdsRadius.r3} style={styles.shimmer} />
        </Skeleton.Animate>
      )}
      <Image
        source={{ uri }}
        style={[style, shown ? null : styles.loading]}
        contentFit={contentFit}
        transition={150}
        onLoad={onLoad}
        onDisplay={() => setShown(true)}
        onError={() => setShown(true)}
        accessibilityIgnoresInvertColors
        accessibilityLabel={accessibilityLabel}
      />
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  bleed: { marginHorizontal: -SHEET_GUTTER, flexGrow: 0 },
  row: { paddingHorizontal: SHEET_GUTTER, gap: SdsSpacing.x1_5 },
  thumb: {
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    borderRadius: SdsRadius.r3,
    backgroundColor: color.bg.neutralWeak,
  },
  caption: { width: THUMB_WIDTH, marginTop: SdsSpacing.x1 },
  solo: { alignSelf: 'center' },
  soloImage: { borderRadius: SdsRadius.r3, backgroundColor: color.bg.neutralWeak },
  loading: { backgroundColor: 'transparent' },
  shimmer: { ...StyleSheet.absoluteFill, height: '100%' },
  soloCaption: { marginTop: SdsSpacing.x1, textAlign: 'center' },
}));

const useViewerStyles = createThemedStyles(({ color }) => ({
  viewer: { flex: 1, backgroundColor: color.bg.layerBasement },
  viewerPage: { justifyContent: 'center', alignItems: 'center' },
  viewerCaption: {
    position: 'absolute',
    bottom: 64,
    left: 20,
    right: 20,
    textAlign: 'center',
  },
  viewerClose: {
    position: 'absolute',
    top: 56,
    right: 20,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SdsRadius.full,
    overflow: 'hidden',
  },
}));
