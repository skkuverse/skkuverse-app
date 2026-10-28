import { View } from 'react-native';
import { Image } from 'expo-image';
import {
  SdsSpacing,
  getLocalizedText,
  useT,
  SdsRadius,
} from '@skkuverse/shared';
import { Txt, useSemanticColors, createThemedStyles } from '@skkuverse/sds';
import { BuildingsIcon, ArrowsDownUpIcon, PersonArmsSpreadIcon } from 'phosphor-react-native';
import type { Building } from '../building.types';
import { useAppLanguage } from '../../useAppLanguage';

interface BuildingHeaderProps {
  building: Building;
  onClose?: () => void;
}

export function BuildingHeader({ building }: BuildingHeaderProps) {
  const styles = useStyles();
  const color = useSemanticColors();
  const lang = useAppLanguage();
  const { t } = useT();
  const name = getLocalizedText(building.name, lang);

  const subtitleParts: string[] = [building.campusLabel];
  if (building.displayNo) subtitleParts.push(`${t('building.buildingNo')} ${building.displayNo}`);
  const subtitle = subtitleParts.join(' · ');

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        {building.image ? (
          <Image
            source={{
              uri: building.image.url,
              headers: { Referer: 'https://www.skku.edu/' },
            }}
            style={styles.thumbnail}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
            <BuildingsIcon size={24} color={color.fg.placeholder} />
          </View>
        )}

        <View style={styles.nameBlock}>
          <Txt
            typography="t10"
            fontWeight="bold"
            color="neutral"
            numberOfLines={2}
          >
            {name}
          </Txt>
          <Txt
            typography="t3"
            fontWeight="regular"
            color="neutralSubtle"
            style={styles.subtitle}
          >
            {subtitle}
          </Txt>
        </View>
      </View>

      {building.accessibility &&
        (building.accessibility.elevator || building.accessibility.toilet) && (
          <View style={styles.accessRow}>
            {building.accessibility.elevator && (
              <View style={styles.accessBadge}>
                <ArrowsDownUpIcon size={14} color={color.fg.neutralSubtle} />
                <Txt typography="t3" fontWeight="regular" color="neutralSubtle">
                  {t('building.elevator')}
                </Txt>
              </View>
            )}
            {building.accessibility.toilet && (
              <View style={styles.accessBadge}>
                <PersonArmsSpreadIcon size={14} color={color.fg.neutralSubtle} />
                <Txt typography="t3" fontWeight="regular" color="neutralSubtle">
                  {t('building.accessibleRestroom')}
                </Txt>
              </View>
            )}
          </View>
        )}
    </View>
  );
}

const THUMB_SIZE = 60;

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    paddingHorizontal: SdsSpacing.x6,
    paddingTop: SdsSpacing.x4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x4,
  },
  thumbnail: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: SdsRadius.r3_5,
    backgroundColor: color.bg.neutralWeak,
  },
  thumbnailPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameBlock: {
    flex: 1,
  },
  subtitle: {
    marginTop: SdsSpacing.x0_5,
  },
  accessRow: {
    flexDirection: 'row',
    gap: SdsSpacing.x2,
    marginTop: SdsSpacing.x3,
  },
  accessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x1,
    paddingHorizontal: SdsSpacing.x2_5,
    paddingVertical: SdsSpacing.x1,
    borderRadius: SdsRadius.r2,
    borderWidth: 1,
    borderColor: color.stroke.neutralMuted,
  },
}));
