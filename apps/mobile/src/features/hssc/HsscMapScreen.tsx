import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useLocalSearchParams } from 'expo-router';
import { HSSC_SVG_XML } from './map-svg.constants';
import { IMAGE_LAYOUT, SVG_WIDTH, SVG_HEIGHT } from './image-layout.constants';
import availableLines, { type LineEntry } from './available-lines.constants';
import { BUILDING_CENTERS } from './building-centers.constants';
import {
  ZoomableContainer,
  type ZoomableContainerRef,
} from './components/ZoomableContainer';
import { PlaceInfoCard } from './components/PlaceInfoCard';

// QUIRK(react-native-svg): Android's SvgView allocates width x height x density^2 x 4 bytes; the native
// 4257 x 3720 size crashed with 'trying to draw too large bitmap' (3.5.0). Lay out at 1/4, scale up by transform.
// Taps stay in viewBox coordinates because the outer content View keeps the full size; never downscale it.
const SVG_DOWNSCALE = 4;

export function HsscMapScreen() {
  const zoomableRef = useRef<ZoomableContainerRef>(null);
  const params = useLocalSearchParams<{ building?: string }>();

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedInfo: LineEntry | null = useMemo(() => {
    if (!selectedId) return null;
    return (availableLines as Record<string, LineEntry>)[selectedId] ?? null;
  }, [selectedId]);

  const handleReady = useCallback(() => {
    if (!params.building) return;
    const center = BUILDING_CENTERS[params.building];
    if (!center) return;
    const fitScale = zoomableRef.current?.getFitScale() ?? 0;
    if (fitScale <= 0) return;
    zoomableRef.current?.animateTo(center.cx, center.cy, fitScale * 1.5);
  }, [params.building]);

  const handleElementTap = useCallback((elementId: string) => {
    setSelectedId(elementId);
  }, []);

  const handleBackgroundTap = useCallback(() => {
    setSelectedId(null);
  }, []);

  const handlePreviousPress = useCallback(() => {
    if (!selectedInfo?.previousplace) return;
    const targetId = findIdByPlacename(selectedInfo.previousplace);
    if (targetId) setSelectedId(targetId);
  }, [selectedInfo]);

  const handleNextPress = useCallback(() => {
    if (!selectedInfo?.afterplace) return;
    const targetId = findIdByPlacename(selectedInfo.afterplace);
    if (targetId) setSelectedId(targetId);
  }, [selectedInfo]);

  const handleDismiss = useCallback(() => {
    setSelectedId(null);
  }, []);

  return (
    <View style={styles.root}>
      <ZoomableContainer
        ref={zoomableRef}
        contentWidth={SVG_WIDTH}
        contentHeight={SVG_HEIGHT}
        onElementTap={handleElementTap}
        onBackgroundTap={handleBackgroundTap}
        onReady={handleReady}
      >
        <View style={{ width: SVG_WIDTH, height: SVG_HEIGHT }}>
          {IMAGE_LAYOUT.map((entry, i) => (
            <Image
              key={i}
              source={entry.source}
              style={{
                position: 'absolute',
                left: entry.x,
                top: entry.y,
                width: entry.width,
                height: entry.height,
              }}
              resizeMode="stretch"
            />
          ))}

          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: SVG_WIDTH / SVG_DOWNSCALE,
              height: SVG_HEIGHT / SVG_DOWNSCALE,
              transformOrigin: '0% 0%',
              transform: [{ scale: SVG_DOWNSCALE }],
            }}
          >
            <SvgXml
              xml={HSSC_SVG_XML}
              width={SVG_WIDTH / SVG_DOWNSCALE}
              height={SVG_HEIGHT / SVG_DOWNSCALE}
            />
          </View>
        </View>
      </ZoomableContainer>

      {selectedInfo && (
        <PlaceInfoCard
          info={selectedInfo}
          onPreviousPress={handlePreviousPress}
          onNextPress={handleNextPress}
          onDismiss={handleDismiss}
        />
      )}
    </View>
  );
}

function findIdByPlacename(placename: string): string | null {
  for (const [id, entry] of Object.entries(availableLines)) {
    if ((entry as LineEntry).placename === placename) return id;
  }
  return null;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
