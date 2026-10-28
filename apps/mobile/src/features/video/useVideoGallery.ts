import { useState, useRef, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { getYoutubeMeta } from 'react-native-youtube-iframe';
import { EPISODES, TRAILERS, type VideoItem } from './video.constants';

export function useVideoGallery() {
  const router = useRouter();

  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [play, setPlay] = useState(false);
  const inFullscreen = useRef(false);

  const [titles, setTitles] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    [...EPISODES, ...TRAILERS].forEach(v => {
      getYoutubeMeta(v.id)
        .then(meta => {
          if (!cancelled) setTitles(t => ({ ...t, [v.id]: meta.title }));
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const playVideo = useCallback(
    (video: VideoItem) => {
      if (Platform.OS === 'android') {
        router.push({ pathname: '/video-player' as never, params: { videoId: video.id } });
        return;
      }
      if (video.id === activeVideoId) {
        setPlay(false);
        requestAnimationFrame(() => setPlay(true));
      } else {
        setPlay(false);
        setActiveVideoId(video.id);
      }
    },
    [activeVideoId, router],
  );

  const onReady = useCallback(() => {
    requestAnimationFrame(() => setPlay(true));
  }, []);

  // QUIRK(react-native-youtube-iframe): YouTube also fires 'buffering' during inline
  // loading, before iOS presents fullscreen, so orientation follows only
  // 'playing'/'paused'/'ended'; pause/end is the only exit cue.
  const onChangeState = useCallback((state: string) => {
    if (state === 'playing' && !inFullscreen.current) {
      inFullscreen.current = true;
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    } else if ((state === 'paused' || state === 'ended') && inFullscreen.current) {
      inFullscreen.current = false;
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      setPlay(false);
    }
  }, []);

  return { activeVideoId, play, titles, playVideo, onReady, onChangeState };
}
