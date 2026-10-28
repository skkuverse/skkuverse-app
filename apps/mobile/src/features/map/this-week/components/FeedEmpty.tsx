import { CalendarBlankIcon } from 'phosphor-react-native';
import { SdsSpacing, useT } from '@skkuverse/shared';
import { ResultSection, useSemanticColors } from '@skkuverse/sds';

export function FeedEmpty({ onOpenNotices }: { onOpenNotices: () => void }) {
  const { t } = useT();
  const color = useSemanticColors();
  return (
    <ResultSection
      size="medium"
      asset={<CalendarBlankIcon size={SdsSpacing.x10} color={color.fg.neutralSubtle} />}
      title={t('thisWeek.empty.all')}
      primaryActionProps={{ children: t('thisWeek.empty.allAction'), onPress: onOpenNotices }}
    />
  );
}
