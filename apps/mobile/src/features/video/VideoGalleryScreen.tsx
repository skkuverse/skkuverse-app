import { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlayIcon, PlayCircleIcon, CaretRightIcon, ArrowLeftIcon } from 'phosphor-react-native';
import YoutubePlayer from 'react-native-youtube-iframe';
import { EPISODES, TRAILERS, SHOW, type VideoItem } from './video.constants';
import { useVideoGallery } from './useVideoGallery';
import { openExternalUrl } from '@/platform/handoff';
import { SdsPalette, SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { ColorSchemeProvider, Pressable, createThemedStyles, Txt, useSemanticColors } from '@skkuverse/sds';

const BLUR_BANDS = [
  { bottom: 0.0, intensity: 92 },
  { bottom: 0.11, intensity: 70 },
  { bottom: 0.22, intensity: 52 },
  { bottom: 0.33, intensity: 38 },
  { bottom: 0.44, intensity: 25 },
  { bottom: 0.55, intensity: 14 },
  { bottom: 0.66, intensity: 6 },
];

// WHY: dark-only scheme; what sits on a photo (play marks, back arrow, scrim) is static.
export function VideoGalleryScreen() {
  return (
    <ColorSchemeProvider colorMode="dark-only">
      <VideoGallery />
    </ColorSchemeProvider>
  );
}

function VideoGallery() {
  const styles = useStyles();
  const color = useSemanticColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const heroHeight = Math.min(width * 1.15, height * 0.62);
  const cardWidth = Math.min(width * 0.72, 300);

  const { activeVideoId, play, titles, playVideo, onReady, onChangeState } = useVideoGallery();
  const [descExpanded, setDescExpanded] = useState(false);

  const renderCard = (video: VideoItem) => (
    <Pressable
      key={video.id}
      style={{ width: cardWidth }}
      onPress={() => playVideo(video)}
    >
      <View style={styles.cardThumbWrap}>
        <Image source={{ uri: video.thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <View style={styles.cardPlay} pointerEvents="none">
          <PlayCircleIcon size={44} color={SdsPalette.static.white} weight="fill" />
        </View>
      </View>
      <Txt typography="t5" fontWeight="bold" color="neutral" style={styles.cardLabel} numberOfLines={1}>
        {video.label}
      </Txt>
      <Txt typography="t3" color="neutralSubtle" style={styles.cardTitle} numberOfLines={2}>
        {titles[video.id] ?? ''}
      </Txt>
    </Pressable>
  );

  return (
    <View style={styles.root}>
      {Platform.OS === 'ios' && activeVideoId && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <YoutubePlayer
            key={activeVideoId}
            videoId={activeVideoId}
            play={play}
            mute={false}
            height={height}
            width={width}
            controls={true}
            webViewStyle={{ opacity: 0.99 }}
            onReady={onReady}
            onChangeState={onChangeState}
            onError={(e: string) => console.warn('[youtube] player error code:', e)}
            initialPlayerParams={{ rel: false, iv_load_policy: 3 }}
            webViewProps={{ allowsInlineMediaPlayback: false }}
          />
        </View>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { height: heroHeight }]}>
          <Image source={SHOW.hero} style={StyleSheet.absoluteFill} contentFit="cover" />
          {/* QUIRK(ios): MaskedView+BlurView does not backdrop-blur, so blur bands stack. */}
          {BLUR_BANDS.map((b, i) => (
            <BlurView
              key={i}
              intensity={b.intensity}
              tint="default"
              experimentalBlurMethod="dimezisBlurView"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: heroHeight * b.bottom,
                height: heroHeight * 0.13,
              }}
            />
          ))}
          <LinearGradient
            colors={['transparent', color.bg.overlay, SdsPalette.static.blackAlpha900]}
            locations={[0.4, 0.72, 1]}
            style={[styles.scrim, { height: heroHeight }]}
          />
          <View style={styles.heroContent}>
            <Txt typography="t13" fontWeight="bold">
              {SHOW.title}
            </Txt>
            <Txt typography="t4" fontWeight="semibold" color="neutralMuted">{SHOW.subtitle}</Txt>
            <Pressable bg="neutralInverted" style={styles.heroPlayBtn} onPress={() => playVideo(EPISODES[0])}>
              <PlayIcon size={18} color={color.fg.neutralInverted} weight="fill" />
              <Txt typography="t6" fontWeight="bold" color="neutralInverted">재생</Txt>
            </Pressable>
          </View>
        </View>
        {/* SEE: docs/reference/design-usage.md PRESS-08 */}
        <Pressable bg="transparent" feedback="color" style={styles.descWrap} onPress={() => setDescExpanded(e => !e)}>
          <Txt typography="t4" color="neutralMuted" numberOfLines={descExpanded ? undefined : 3}>
            {SHOW.description}
          </Txt>
          <Txt typography="t4" fontWeight="bold" color="neutralSubtle" style={styles.moreBtn}>{descExpanded ? '접기' : '더 보기'}</Txt>
        </Pressable>
        <Txt typography="t9" fontWeight="bold" style={styles.sectionLabel}>
          에피소드
        </Txt>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
        >
          {EPISODES.map(renderCard)}
        </ScrollView>
        <Txt typography="t9" fontWeight="bold" style={styles.sectionLabel}>
          예고편
        </Txt>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
        >
          {TRAILERS.map(renderCard)}
        </ScrollView>
        <Txt typography="t9" fontWeight="bold" style={styles.sectionLabel}>
          출연진 및 제작진
        </Txt>
        <View style={styles.staffBox}>
          {SHOW.staff.map(s => (
            <View key={s.role} style={styles.staffRow}>
              <Txt typography="t4" fontWeight="bold" color="neutralSubtle" style={styles.staffRole}>
                {s.role}
              </Txt>
              <Txt typography="t4" style={styles.staffNames}>
                {s.names}
              </Txt>
            </View>
          ))}
        </View>
        <Pressable
          bg="transparent"
          style={styles.channelRow}
          onPress={() => void openExternalUrl(SHOW.channelUrl)}
        >
          <Txt typography="t5" fontWeight="bold" color="neutral">{SHOW.channelName}</Txt>
          <CaretRightIcon size={18} color={color.fg.neutralSubtle} weight="bold" />
        </Pressable>
      </ScrollView>

      <Pressable
        onPress={() => router.back()}
        hitSlop={10}
        bg="overlay"
        style={[styles.backBtn, { top: insets.top + 6 }]}
      >
        <ArrowLeftIcon size={22} color={SdsPalette.static.white} weight="bold" />
      </Pressable>
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  root: { flex: 1, backgroundColor: color.bg.layerDefault },
  scroll: { flex: 1, backgroundColor: color.bg.layerDefault },
  content: { paddingBottom: SdsSpacing.x14 },
  hero: { width: '100%', justifyContent: 'flex-end', backgroundColor: color.bg.neutralWeak },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  heroContent: { paddingHorizontal: SdsSpacing.gutter, paddingBottom: SdsSpacing.x4_5, gap: SdsSpacing.x2 },
  heroPlayBtn: {
    marginTop: SdsSpacing.x2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SdsSpacing.x2,
    borderRadius: SdsRadius.r2_5,
    paddingVertical: SdsSpacing.x3,
    overflow: 'hidden',
  },

  descWrap: { paddingHorizontal: SdsSpacing.gutter, paddingTop: SdsSpacing.x4_5 },
  moreBtn: {
    marginTop: SdsSpacing.x1_5,
  },
  sectionLabel: {
    paddingHorizontal: SdsSpacing.gutter,
    // eslint-disable-next-line sds/no-spacing-literal -- the section's drawn lead-in, midway between x6 and x7; kept as drawn until a screenshot-reviewed batch picks one (2pt either way)
    paddingTop: 26,
    paddingBottom: SdsSpacing.x3_5,
  },
  rail: { paddingHorizontal: SdsSpacing.gutter, gap: SdsSpacing.x3 },
  cardThumbWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: SdsRadius.r2_5,
    overflow: 'hidden',
    backgroundColor: color.bg.neutralWeak,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardPlay: { alignItems: 'center', justifyContent: 'center' },
  cardLabel: { marginTop: SdsSpacing.x2 },
  cardTitle: { marginTop: SdsSpacing.x0_5 },
  staffBox: { paddingHorizontal: SdsSpacing.gutter, gap: SdsSpacing.x2_5 },
  staffRow: { flexDirection: 'row', gap: SdsSpacing.x3_5, alignItems: 'flex-start' },
  staffRole: {
    width: 44,
  },
  staffNames: { flex: 1 },
  backBtn: {
    position: 'absolute',
    left: 16,
    width: 36,
    height: 36,
    borderRadius: SdsRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  channelRow: {
    marginTop: SdsSpacing.x7,
    marginHorizontal: SdsSpacing.gutter,
    paddingVertical: SdsSpacing.x4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.stroke.neutralMuted,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
}));
