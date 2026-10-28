import { View } from 'react-native';
import { SdsSpacing } from '@skkuverse/shared';
import { ListHeader, createThemedStyles } from '@skkuverse/sds';
import { TransitGroupFold } from './TransitGroupFold';
import { TransitItemRow } from './TransitItemRow';
import type { TransitGroup, TransitRowItem, TransitSection } from '../transit.types';

interface TransitSectionsProps {
  sections: TransitSection[];
  groups: { isExpanded: (group: TransitGroup) => boolean; onToggle: (group: TransitGroup) => void };
  onOpenRow: (item: TransitRowItem, sectionId: string, groupId?: string) => void;
}

export function TransitSections({ sections, groups, onOpenRow }: TransitSectionsProps) {
  const styles = useStyles();
  return sections.map((section, index) => (
    <View key={section.id} style={section.title == null && index > 0 ? undefined : styles.section}>
      {section.title != null && (
        <ListHeader
          style={styles.sectionHeader}
          title={
            <ListHeader.TitleParagraph typography="t5" fontWeight="bold" color="neutralSubtle">
              {section.title}
            </ListHeader.TitleParagraph>
          }
        />
      )}
      {section.items.map((item, i) => {
        const divider = section.items[i + 1]?.kind !== 'group';
        return item.kind === 'group' ? (
          <TransitGroupFold
            key={item.id}
            group={item}
            expanded={groups.isExpanded(item)}
            onToggle={() => groups.onToggle(item)}
            onOpenRow={(row) => onOpenRow(row, section.id, item.id)}
            divider={divider}
          />
        ) : (
          <TransitItemRow key={item.id} item={item} divider={divider} onPress={() => onOpenRow(item, section.id)} />
        );
      })}
    </View>
  ));
}

const useStyles = createThemedStyles(() => ({
  section: {
    paddingTop: SdsSpacing.x5,
  },
  sectionHeader: {
    paddingHorizontal: SdsSpacing.gutter,
    paddingTop: 0,
    paddingBottom: 0,
  },
}));
