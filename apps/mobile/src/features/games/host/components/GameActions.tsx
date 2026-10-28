import { StyleSheet, View } from 'react-native';
import { SpeakerHighIcon, SpeakerSlashIcon, TrophyIcon, XIcon } from 'phosphor-react-native';
import { GlassIconButton, useSemanticColors } from '@skkuverse/sds';
import { useT, SdsSpacing } from '@skkuverse/shared';

interface Props {
  top: number;
  soundOn: boolean | null;
  ranked: boolean;
  onToggleSound(): void;
  onOpenBoard(): void;
  onClose(): void;
}

export function GameActions({ top, soundOn, ranked, onToggleSound, onOpenBoard, onClose }: Props) {
  const color = useSemanticColors();
  const { t } = useT();
  return (
    <View style={[styles.actions, { top }]} pointerEvents="box-none">
      {soundOn !== null && (
        <GlassIconButton
          icon={
            soundOn ? (
              <SpeakerHighIcon size={20} color={color.fg.neutral} weight="bold" />
            ) : (
              <SpeakerSlashIcon size={20} color={color.fg.neutral} weight="bold" />
            )
          }
          onPress={onToggleSound}
          label={t(soundOn ? 'game.soundOff' : 'game.soundOn')}
        />
      )}
      {ranked && (
        <GlassIconButton icon={<TrophyIcon size={20} color={color.fg.neutral} weight="bold" />} onPress={onOpenBoard} label={t('game.leaderboard')} />
      )}
      <GlassIconButton icon={<XIcon size={20} color={color.fg.neutral} weight="bold" />} onPress={onClose} label={t('common.close')} />
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { position: 'absolute', right: 16, flexDirection: 'row', gap: SdsSpacing.x2_5 },
});
