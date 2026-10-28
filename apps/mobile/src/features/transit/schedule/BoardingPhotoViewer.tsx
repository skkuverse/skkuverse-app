// QUIRK(react-native): only iOS's ScrollView zooms, so Android shows the photo fitted to the screen.
import { Modal, ScrollView, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { XIcon } from 'phosphor-react-native';
import { useT, SdsPalette, SdsRadius } from '@skkuverse/shared';
import { ColorSchemeProvider, Pressable, createThemedStyles } from '@skkuverse/sds';
import { SchemeStatusBar } from '@/components/SchemeStatusBar';

interface BoardingPhotoViewerProps {
  uri: string | null;
  label?: string;
  onClose: () => void;
}

export function BoardingPhotoViewer({ uri, label, onClose }: BoardingPhotoViewerProps) {
  return (
    <Modal visible={uri !== null} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <ColorSchemeProvider colorMode="dark-only">
        <SchemeStatusBar />
        <PhotoPage uri={uri} label={label} onClose={onClose} />
      </ColorSchemeProvider>
    </Modal>
  );
}

function PhotoPage({ uri, label, onClose }: BoardingPhotoViewerProps) {
  const styles = useStyles();
  const { t } = useT();
  const { width, height } = useWindowDimensions();

  return (
    <View style={styles.viewer}>
      <ScrollView
        maximumZoomScale={4}
        minimumZoomScale={1}
        centerContent
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.page}
      >
        {uri ? (
          <Image
            source={{ uri }}
            style={{ width, height }}
            contentFit="contain"
            accessibilityIgnoresInvertColors
            accessibilityLabel={label}
          />
        ) : null}
      </ScrollView>
      <Pressable
        bg="overlay"
        style={styles.close}
        onPress={onClose}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={t('schedule.boarding.closePhoto')}
      >
        <XIcon size={26} color={SdsPalette.static.white} weight="bold" />
      </Pressable>
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  viewer: { flex: 1, backgroundColor: color.bg.layerBasement },
  page: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  close: {
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
