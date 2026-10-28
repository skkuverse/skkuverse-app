import { View } from 'react-native';
import { SdsSpacing } from '@skkuverse/shared';
import { ListHeader, Txt, createThemedStyles } from '@skkuverse/sds';
import type { ThisWeekItem, ThisWeekScreenSectionText } from '../this-week.types';
import { FeedRow } from './FeedRow';

interface FeedSectionsProps {
  sections: readonly ThisWeekScreenSectionText[];
  onOpenRow: (item: ThisWeekItem) => void;
}

export function FeedSections({ sections, onOpenRow }: FeedSectionsProps) {
  const styles = useStyles();
  return (
    <View style={styles.list}>
      {sections.map((section) => (
        <View key={section.group}>
          <ListHeader
            style={styles.header}
            title={
              <ListHeader.TitleParagraph typography="t5" fontWeight="bold" color="neutralSubtle">
                {section.label}
              </ListHeader.TitleParagraph>
            }
          />
          {section.emptyLine !== null ? (
            <Txt typography="t4" color="neutralSubtle" style={styles.emptyLine}>
              {section.emptyLine}
            </Txt>
          ) : null}
          {section.rows.map((row) => (
            <FeedRow key={row.row.item.id} text={row} onOpen={onOpenRow} />
          ))}
        </View>
      ))}
    </View>
  );
}

const useStyles = createThemedStyles(() => ({
  list: {
    gap: SdsSpacing.x5,
  },
  // WHY: no inset at the sides; the caller's gutter is the inset.
  header: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: SdsSpacing.x1,
  },
  emptyLine: {
    paddingVertical: SdsSpacing.x2,
  },
}));
