/**
 * WHY: in the summary so the collapsed card carries them. Each link leads with a glyph or logo, since a grey
 * pill with a word alone reads as a tag; both handlers dismiss the sheet before navigating
 * (SEE: `usePlaceNavigate.ts`).
 */

import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { InstagramLogoIcon, LinkSimpleIcon } from 'phosphor-react-native';
import {
  parseMiniAppTarget,
  pickI18nText,
  SdsRadius,
  useT,
  type Logo,
  SdsSpacing,
} from '@skkuverse/shared';
import { Chip, Pressable, Txt, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import { MiniAppEmojiLogo } from '@/components/MiniAppEmojiLogo';
import { useMiniAppIndex } from '@/features/web/useMiniAppIndex';
import { SHEET_GUTTER } from './sheet-layout.constants';
import { useInstagramNavigate, usePlaceNavigate } from './usePlaceNavigate';
import { NAVIGABLE_ACTION_TYPES } from '../place-detail.rules';
import type { PlaceAction, PlaceInstagramAction } from '../place-detail.types';
import type { MarkerAction } from '../../overlay.types';
import { useAppLanguage } from '../../useAppLanguage';

export function PlaceActionsRow({
  actions,
  detailActions,
  onNavigateAway,
}: {
  actions: readonly MarkerAction[];
  detailActions: readonly PlaceAction[];
  onNavigateAway?: () => void;
}) {
  const styles = useStyles();
  const { t } = useT();
  const lang = useAppLanguage();
  const openInstagram = useInstagramNavigate();
  const navigate = usePlaceNavigate(onNavigateAway);
  const { data: miniApps } = useMiniAppIndex();

  const instagram = detailActions.find((a) => a.type === 'instagram');
  const links = detailActions.filter((a) => a.type === 'link');
  const legacy = actions.filter((a) => NAVIGABLE_ACTION_TYPES.has(a.actionType));

  if (!instagram && links.length === 0 && legacy.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.scroll, styles.bleed]}
      contentContainerStyle={styles.row}
    >
      {instagram ? (
        <LinkPill
          label={t('eventmap.instagram')}
          icon={<InstagramLogoIcon />}
          onPress={() => openInstagram(instagram)}
        />
      ) : null}

      {links.map((action) => (
        <LinkPill
          key={action.id}
          label={pickI18nText(action.label, lang)}
          onPress={() =>
            navigate({
              actionType: 'external',
              actionValue: action.url,
              title: pickI18nText(action.label, lang),
              kind: 'link',
            })
          }
        />
      ))}

      {legacy.map((action) => (
        <LinkPill
          key={`legacy-${action.id}`}
          label={pickI18nText(action.label, lang)}
          icon={
            action.actionType === 'miniapp' ? (
              <MiniAppLogoIcon
                logo={
                  miniApps?.find((m) => m.id === parseMiniAppTarget(action.actionValue)?.id)
                    ?.shellLogo
                }
              />
            ) : undefined
          }
          onPress={() =>
            navigate({
              actionType: action.actionType,
              actionValue: action.actionValue,
              title: pickI18nText(action.label, lang),
            })
          }
        />
      ))}
    </ScrollView>
  );
}

export function InstagramInlineButton({ action }: { action: PlaceInstagramAction }) {
  const color = useSemanticColors();
  const styles = useStyles();
  const { t } = useT();
  const openInstagram = useInstagramNavigate();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('eventmap.instagram')}
      hitSlop={8}
      onPress={() => openInstagram(action)}
      bg="neutralMuted"
      style={styles.inlinePill}
    >
      <InstagramLogoIcon size={14} color={color.fg.neutral} />
      <Txt typography="t3" fontWeight="semiBold" color="neutral" numberOfLines={1}>
        {t('eventmap.instagram.inline')}
      </Txt>
    </Pressable>
  );
}

const ICON_SIZE = 16;

function LinkGlyph() {
  return <LinkSimpleIcon weight="bold" />;
}

function MiniAppLogoIcon({ logo }: { logo: Logo | null | undefined }) {
  const styles = useStyles();
  const uri = logo?.kind === 'remote' ? logo.uri : undefined;
  const [failed, setFailed] = useState(false);
  // WHY: clear the failure while rendering, so the first frame with a new uri already tries the image.
  const [attemptUri, setAttemptUri] = useState(uri);
  if (attemptUri !== uri) {
    setAttemptUri(uri);
    setFailed(false);
  }

  if (logo?.kind === 'emoji') {
    return <MiniAppEmojiLogo emoji={logo.emoji} size={ICON_SIZE} />;
  }
  if (!uri || failed) return <LinkGlyph />;
  return (
    <Image
      source={{ uri }}
      style={styles.miniAppLogo}
      contentFit="cover"
      onError={() => setFailed(true)}
    />
  );
}

function LinkPill({
  label,
  icon = <LinkGlyph />,
  onPress,
}: {
  label: string;
  icon?: React.ReactNode;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Chip.Button onPress={onPress} style={styles.linkPill}>
      <Chip.PrefixIcon>{icon}</Chip.PrefixIcon>
      <Chip.Label>{label}</Chip.Label>
    </Chip.Button>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  // WHY: a horizontal ScrollView otherwise claims the summary's spare height.
  scroll: { flexGrow: 0 },
  bleed: { marginHorizontal: -SHEET_GUTTER },
  row: { paddingHorizontal: SHEET_GUTTER, gap: SdsSpacing.x2, alignItems: 'center' },
  // WHY: wide enough for the Instagram pill's full call to action; the row scrolls, so the cap only stops one
  // authored label taking it all.
  linkPill: { maxWidth: 236 },
  miniAppLogo: { width: ICON_SIZE, height: ICON_SIZE, borderRadius: SdsRadius.r1 },
  inlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x1,
    height: 28,
    paddingHorizontal: SdsSpacing.x2_5,
    borderRadius: SdsRadius.full,
    overflow: 'hidden',
  },
}));
