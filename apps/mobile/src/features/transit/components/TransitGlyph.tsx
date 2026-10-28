import { useState } from 'react';
import { Image } from 'expo-image';

const SHUTTLE_ICON = require('../../../../assets/icons/toss_bus_skkubus.svg');
const VILLAGE_ICON = require('../../../../assets/icons/toss_bus_citybus.svg');
const DEFAULT_ICON = require('../../../../assets/icons/toss_bus_default.svg');
const SUBWAY_ICON = require('../../../../assets/icons/toss_subway.svg');

const ICON_MAP: Record<string, number> = {
  shuttle: SHUTTLE_ICON as number,
  village: VILLAGE_ICON as number,
  default: DEFAULT_ICON as number,
  subway: SUBWAY_ICON as number,
};

interface TransitGlyphProps {
  iconType: string;
  size?: number;
}

export function TransitGlyph({ iconType, size = 28 }: TransitGlyphProps) {
  const [hasError, setHasError] = useState(false);
  const localIcon = ICON_MAP[iconType];

  if (localIcon) {
    return (
      <Image
        source={localIcon}
        style={{ width: size, height: size }}
        contentFit="contain"
      />
    );
  }

  return (
    <Image
      source={hasError ? DEFAULT_ICON : { uri: iconType }}
      style={{ width: size, height: size }}
      contentFit="contain"
      onError={() => setHasError(true)}
    />
  );
}
