/**
 * WHY: a widget owns no horizontal gutter; the card's inset animates as the sheet rises, so only the caller
 * can measure it from the right edge. Vertical spacing stays with the widget.
 */

import { View } from 'react-native';
import { ButtonGrid } from './components/ButtonGrid';
import { SectionTitle } from './components/SectionTitle';
import { Notice } from './components/Notice';
import { Banner } from './components/Banner';
import { BannerCarousel } from './components/BannerCarousel';
import type { SduiSection } from '@/features/map/campus-sheet/campus-sheet.types';

function renderSection(section: SduiSection): React.ReactNode {
  switch (section.type) {
    case 'button_grid':
      return <ButtonGrid key={section.id} section={section} />;

    case 'section_title':
      return <SectionTitle key={section.id} section={section} />;

    case 'notice':
      return <Notice key={section.id} section={section} />;

    case 'banner':
      return <Banner key={section.id} section={section} />;

    case 'banner_carousel':
      return <BannerCarousel key={section.id} section={section} />;

    case 'spacer':
      return <View key={section.id} style={{ height: section.height }} />;

    case 'unknown':
      // WHY: an unknown section type renders nothing, so an older build survives a new section.
      return null;

    default: {
      const _exhaustive: never = section;
      return _exhaustive;
    }
  }
}

interface SduiSectionListProps {
  sections: SduiSection[];
}

export function SduiSectionList({ sections }: SduiSectionListProps) {
  return <>{sections.map(renderSection)}</>;
}
