import { StyleSheet } from 'react-native';
import { ActionableCallout, Tossface } from '@skkuverse/sds';
import { SdsSpacing } from '@skkuverse/shared';
import { handleSduiAction } from '@/features/web/web.service';
import { logSduiContentSelect } from '@/platform/analytics';
import type { SduiNotice as NoticeType } from '@/features/map/campus-sheet/campus-sheet.types';

interface Props {
  section: NoticeType;
}

export function Notice({ section }: Props) {
  return (
    <ActionableCallout
      tone="warning"
      prefixIcon={<Tossface size={16}>{'\u{1F4E2}'}</Tossface>}
      description={section.title}
      style={styles.container}
      onPress={() => {
        logSduiContentSelect({ content_type: 'notice_widget', item_id: section.actionValue });
        handleSduiAction({
          actionType: section.actionType,
          actionValue: section.actionValue,
          source: 'sdui',
        });
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SdsSpacing.x2,
  },
});
