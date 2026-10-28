import { StyleSheet, View } from 'react-native';
import { TextField, Txt } from '@skkuverse/sds';
import { useT, SdsSpacing } from '@skkuverse/shared';
import { NICKNAME_MAX, validateNickname } from '../profile.rules';

interface Props {
  value: string;
  onChange: (nickname: string) => void;
  onSubmit: () => void;
}

export function NicknameStep({ value, onChange, onSubmit }: Props) {
  const { t } = useT();
  const check = validateNickname(value);
  // WHY: too short and a lone jamo (a syllable still being typed) are not errors; a stray character is wrong whatever comes next.
  const stray = /[^가-힣a-zA-Z0-9_ㄱ-ㅎㅏ-ㅣ]/.test(value.normalize('NFC').trim());
  const composing = /[ㄱ-ㅎㅏ-ㅣ]/.test(value);
  const error =
    check === 'tooLong'
      ? t('profile.nicknameTooLong')
      : check === 'invalidChars' && (stray || !composing)
        ? t('profile.nicknameInvalid')
        : null;

  return (
    <View style={styles.container}>
      <Txt typography="t11" fontWeight="bold" color="neutral" style={styles.title}>
        {t('profile.nicknameTitle')}
      </Txt>
      <Txt typography="t5" color="neutralSubtle" style={styles.subtitle}>
        {t('profile.nicknameSubtitle')}
      </Txt>
      <TextField
        variant="box"
        value={value}
        onChangeText={onChange}
        placeholder={t('profile.nicknamePlaceholder')}
        help={error ?? t('profile.nicknameHelp')}
        hasError={error !== null}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={NICKNAME_MAX + 4}
        returnKeyType="done"
        onSubmitEditing={onSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { marginTop: SdsSpacing.x2, marginBottom: SdsSpacing.x3_5 },
  subtitle: { marginBottom: SdsSpacing.x6 },
});
