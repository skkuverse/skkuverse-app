import { useState, useCallback } from 'react';
import { View, useWindowDimensions, StatusBar } from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeftIcon } from 'phosphor-react-native';
import { SdsPalette, SdsRadius } from '@skkuverse/shared';
import { ColorSchemeProvider, Pressable, createThemedStyles } from '@skkuverse/sds';

interface Props {
  videoId: string;
}

// QUIRK(android): WebView has no play-to-native-fullscreen (iOS only), so this screen locks landscape.
export function VideoPlayerScreen({ videoId }: Props) {
  return (
    <ColorSchemeProvider colorMode="dark-only">
      <VideoPlayer videoId={videoId} />
    </ColorSchemeProvider>
  );
}

function VideoPlayer({ videoId }: Props) {
  const styles = useStyles();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const fitW = height * (16 / 9);
  const videoW = fitW <= width ? fitW : width;
  const videoH = fitW <= width ? height : width * (9 / 16);

  const [isPlaying, setIsPlaying] = useState(false);

  useFocusEffect(
    useCallback(() => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      return () => {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      };
    }, []),
  );

  const onReady = useCallback(() => {
    requestAnimationFrame(() => setIsPlaying(true));
  }, []);

  const handleBack = useCallback(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).finally(() => {
      router.back();
    });
  }, [router]);

  return (
    <View style={styles.root}>
      <StatusBar hidden />
      <View style={styles.center}>
        <YoutubePlayer
          videoId={videoId}
          play={isPlaying}
          mute={false}
          height={videoH}
          width={videoW}
          controls={true}
          webViewStyle={{ opacity: 0.99 }}
          onReady={onReady}
          onError={(e: string) => console.warn('[youtube] player error code:', e)}
          initialPlayerParams={{ rel: false, iv_load_policy: 3 }}
          forceAndroidAutoplay
        />
      </View>

      <Pressable
        onPress={handleBack}
        hitSlop={12}
        bg="overlay"
        style={[styles.backBtn, { top: Math.max(insets.top, 10), left: Math.max(insets.left, 10) }]}
      >
        <ArrowLeftIcon size={24} color={SdsPalette.static.white} weight="bold" />
      </Pressable>
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  root: {
    flex: 1,
    backgroundColor: color.bg.layerBasement,
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtn: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: SdsRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
}));
