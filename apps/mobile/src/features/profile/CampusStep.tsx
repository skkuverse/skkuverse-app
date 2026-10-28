import { View, StyleSheet } from 'react-native';
import { Txt } from '@skkuverse/sds';
import { useT, type Campus, SdsSpacing } from '@skkuverse/shared';
import { CampusCard } from './components/CampusCard';
import { logOnboardingStep } from '@/platform/analytics';

interface Props {
  selected: Campus | null;
  onSelect: (campus: Campus) => void;
  subtitle?: string;
  track?: boolean;
}

export function CampusStep({ selected, onSelect, subtitle, track = true }: Props) {
  const { t } = useT();
  const handleSelect = (campus: Campus) => {
    if (track) logOnboardingStep({ step: 'campus', action: 'select_campus', detail: campus });
    onSelect(campus);
  };
  return (
    <View style={styles.container}>
      <Txt typography="t11" fontWeight="bold" color="neutral" style={styles.title}>
        {t('onboarding.campusTitle')}
      </Txt>
      <Txt typography="t5" color="neutralSubtle" style={styles.subtitle}>
        {subtitle ?? t('onboarding.campusSubtitle')}
      </Txt>
      <CampusCard
        name={t('onboarding.hsscName')}
        location={t('onboarding.hsscLocation')}
        selected={selected === 'hssc'}
        onPress={() => handleSelect('hssc')}
      />
      <CampusCard
        name={t('onboarding.nscName')}
        location={t('onboarding.nscLocation')}
        selected={selected === 'nsc'}
        onPress={() => handleSelect('nsc')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    marginTop: SdsSpacing.x2,
    marginBottom: SdsSpacing.x3_5,
  },
  subtitle: {
    marginBottom: SdsSpacing.x9,
  },
});
