// WHY: apps/mobile/scripts/export-tab-icons.mjs mirrors these glyphs and scales for the iOS 26 NativeTabs PNGs; change both.
import type { ComponentType } from 'react';
import { BusIcon, MapTrifoldIcon, MegaphoneSimpleIcon, SquaresFourIcon } from 'phosphor-react-native';
import type { TabRoute } from '@skkuverse/shared';

export interface TabIconProps {
  size?: number;
  color?: string;
  weight?: 'regular' | 'fill';
}

export interface TabGlyph {
  Icon: ComponentType<TabIconProps>;
  scale: number;
}

export const TAB_GLYPHS: Readonly<Record<TabRoute, TabGlyph>> = {
  home: { Icon: SquaresFourIcon, scale: 1 },
  notices: { Icon: MegaphoneSimpleIcon, scale: 1 },
  campus: { Icon: MapTrifoldIcon, scale: 1 },
  // EVIDENCE: resvg ink box at 26pt is 74x58 against MegaphoneSimple's 63x54; 0.86 brings it to 64x50.
  transit: { Icon: BusIcon, scale: 0.86 },
};
