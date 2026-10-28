import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import * as Application from 'expo-application';
import { MapPinIcon, PanoramaIcon } from 'phosphor-react-native';
import {
  useT,
  SdsRadius,
  SdsSpacing,
} from '@skkuverse/shared';
import {
  Pressable,
  Skeleton,
  Txt,
  useSemanticColors,
  createThemedStyles,
} from '@skkuverse/sds';
import { TossfaceRuns } from '@/components/TossfaceRuns';
import { openExternalUrl } from '@/platform/handoff';
import { openAppFirst } from '@/features/web/web.service';
import { logBusContentSelect } from '@/platform/analytics';
import { OPENABLE_APP_SCHEMES } from '../../../../../config/external-apps';
import { BoardingMapCard } from '../BoardingMapCard';
import { describeMap } from '../boarding-map.rules';
import { naverWebMapUrl, nmapPlaceUrl } from '../boarding-links.rules';
import type { BoardingStop } from '../../transit.types';

export function BoardingStopDetail({
  stop,
  onOpenPhoto,
}: {
  stop: BoardingStop;
  onOpenPhoto: (uri: string, label: string) => void;
}) {
  const styles = useStyles();
  const color = useSemanticColors();
  const { t, tpl } = useT();
  const [photoShown, setPhotoShown] = useState(false);
  const { coords, map, photoUrl, streetViewUrl } = stop;

  const openMap = () => {
    if (!coords) return;
    logBusContentSelect({ content_type: 'boarding_map', item_id: stop.id });
    const place = { lat: coords.lat, lng: coords.lng, name: stop.name };
    const appname = Application.applicationId;
    void openAppFirst(
      { url: naverWebMapUrl(place), ...(appname && { appUrl: nmapPlaceUrl(place, appname) }) },
      openExternalUrl,
      OPENABLE_APP_SCHEMES,
    );
  };

  return (
    <View style={styles.detail}>
      {stop.detail ? (
        <Txt typography="t4" color="neutralSubtle">
          <TossfaceRuns text={stop.detail} />
        </Txt>
      ) : null}

      {photoUrl ? (
        <Pressable
          accessibilityRole="imagebutton"
          accessibilityLabel={tpl('schedule.boarding.photo', stop.name)}
          onPress={() => {
            logBusContentSelect({ content_type: 'boarding_photo', item_id: stop.id });
            onOpenPhoto(photoUrl, stop.name);
          }}
          bg="layerBasement"
          style={styles.photoFrame}
        >
          {photoShown ? null : (
            <Skeleton.Animate>
              <Skeleton width="100%" borderRadius={SdsRadius.r3} style={styles.shimmer} />
            </Skeleton.Animate>
          )}
          <Image
            // QUIRK(expo-image): keeps the old bitmap until a new one loads, and switching routes swaps every photo.
            key={photoUrl}
            source={{ uri: photoUrl }}
            style={styles.photo}
            contentFit="cover"
            transition={150}
            onDisplay={() => setPhotoShown(true)}
            onError={() => setPhotoShown(true)}
            accessibilityIgnoresInvertColors
          />
        </Pressable>
      ) : null}

      {coords && map ? (
        <BoardingMapCard
          stop={{ ...stop, coords, map }}
          onPress={openMap}
          accessibilityLabel={describeMap(stop.name, map)}
        />
      ) : null}

      <View style={styles.actions}>
        {streetViewUrl ? (
          <ActionButton
            icon={<PanoramaIcon size={16} color={color.fg.neutralMuted} />}
            label={t('schedule.boarding.streetView')}
            onPress={() => {
              logBusContentSelect({ content_type: 'boarding_street_view', item_id: stop.id });
              void openExternalUrl(streetViewUrl);
            }}
          />
        ) : null}
        {coords ? (
          <ActionButton
            icon={<MapPinIcon size={16} color={color.fg.neutralMuted} />}
            label={t('schedule.boarding.openMap')}
            onPress={openMap}
          />
        ) : null}
      </View>
    </View>
  );
}

function ActionButton({ icon, label, onPress }: { icon: ReactNode; label: string; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      bg="neutralWeak"
      style={styles.action}
    >
      {icon}
      <Txt typography="t4" fontWeight="semiBold" color="neutralMuted" style={styles.actionLabel}>
        {label}
      </Txt>
    </Pressable>
  );
}

const useStyles = createThemedStyles(() => ({
  detail: {
    marginTop: SdsSpacing.x1,
    gap: SdsSpacing.x2_5,
  },
  photoFrame: {
    aspectRatio: 4 / 3,
    borderRadius: SdsRadius.r3,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  shimmer: {
    ...StyleSheet.absoluteFill,
    height: '100%',
  },
  actions: {
    flexDirection: 'row',
    gap: SdsSpacing.x2,
  },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SdsSpacing.x1_5,
    paddingVertical: SdsSpacing.x2_5,
    borderRadius: SdsRadius.r2_5,
  },
  actionLabel: {
    flexShrink: 1,
  },
}));
