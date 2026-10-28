import { useState } from 'react';
import { View } from 'react-native';
import {
  EnvelopeSimpleIcon,
  LinkIcon,
  MapPinIcon,
  MapTrifoldIcon,
  PhoneIcon,
} from 'phosphor-react-native';
import { useT, SdsSpacing, type TranslationKey } from '@skkuverse/shared';
import { Badge, IconButton, Pressable, TextButton, Txt, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import type {
  NoticeAction,
  NoticeActionKind,
  NoticeScreenBlock,
  NoticeScreenLine,
  NoticeScreenLineSource,
} from '../notice-facts.types';

interface Props {
  blocks: NoticeScreenBlock[];
  onLinePress: (line: NoticeScreenLine) => void;
  onLineAction: (action: NoticeAction) => void;
  onFooterLink: () => void;
}

const SOURCE_BADGE: Record<NoticeScreenLineSource, TranslationKey | null> = {
  body: null,
  title: null,
  poster: 'notices.screen.fromPoster',
};

const ACTION_ICON: Record<NoticeActionKind, typeof MapPinIcon> = {
  map: MapPinIcon,
  search: MapTrifoldIcon,
  call: PhoneIcon,
  email: EnvelopeSimpleIcon,
  link: LinkIcon,
};

const ACTION_LABEL: Record<NoticeActionKind, TranslationKey> = {
  map: 'notices.screen.action.map',
  search: 'notices.screen.action.search',
  call: 'notices.screen.action.call',
  email: 'notices.screen.action.email',
  link: 'notices.screen.action.link',
};

export function NoticeScreenBlocks({ blocks, onLinePress, onLineAction, onFooterLink }: Props) {
  const styles = useStyles();
  return (
    <View style={styles.blocks}>
      {blocks.map((block, index) => (
        <BlockView
          key={`${index}:${block.label}`}
          block={block}
          onLinePress={onLinePress}
          onLineAction={onLineAction}
          onFooterLink={onFooterLink}
        />
      ))}
    </View>
  );
}

function BlockView({
  block,
  onLinePress,
  onLineAction,
  onFooterLink,
}: Omit<Props, 'blocks'> & { block: NoticeScreenBlock }) {
  const styles = useStyles();
  const { tpl } = useT();
  const [isUnfolded, setIsUnfolded] = useState(false);
  const lines = isUnfolded ? [...block.lines, ...block.foldedLines] : block.lines;
  return (
    <View style={styles.block}>
      <Txt typography="t3" fontWeight="bold" color="neutralSubtle">
        {block.label}
      </Txt>
      {lines.map((line, index) => (
        <LineView
          key={index}
          line={line}
          number={block.isNumbered ? index + 1 : null}
          onLinePress={onLinePress}
          onLineAction={onLineAction}
        />
      ))}
      {!isUnfolded && block.foldedLines.length > 0 ? (
        <TextButton typography="t3" variant="arrow" color="neutralSubtle" onPress={() => setIsUnfolded(true)}>
          {tpl('notices.screen.moreLines', block.foldedLines.length)}
        </TextButton>
      ) : null}
      {block.footerLink !== null ? (
        <TextButton typography="t3" variant="arrow" color="brandContrast" onPress={onFooterLink}>
          {block.footerLink}
        </TextButton>
      ) : null}
    </View>
  );
}

function LineView({
  line,
  number,
  onLinePress,
  onLineAction,
}: Pick<Props, 'onLinePress' | 'onLineAction'> & { line: NoticeScreenLine; number: number | null }) {
  const styles = useStyles();
  const color = useSemanticColors();
  const { t } = useT();
  const badge = SOURCE_BADGE[line.source];
  return (
    <View style={styles.lineRow}>
      <Pressable bg="layerDefault" scaleScope="content" style={styles.lineText} onPress={() => onLinePress(line)}>
        <View style={styles.inline}>
          {number !== null ? (
            <Txt typography="t5" fontWeight="bold" color="brandContrast">
              {`${number}.`}
            </Txt>
          ) : null}
          <Txt typography="t5" color="neutral" style={styles.shrink}>
            {line.text}
          </Txt>
          {badge !== null ? (
            <Badge size="xsmall" color="neutralSubtle" backgroundColor="neutralWeak">
              {t(badge)}
            </Badge>
          ) : null}
        </View>
        {line.sub !== null ? (
          <Txt typography="t3" color="neutralSubtle">
            {line.sub}
          </Txt>
        ) : null}
      </Pressable>
      {line.actions.map((action, index) => {
        const Icon = ACTION_ICON[action.kind];
        return (
          <IconButton
            key={`${index}:${action.kind}`}
            variant="weak"
            iconSize={18}
            icon={<Icon size={18} color={color.fg.neutral} weight="fill" />}
            label={t(ACTION_LABEL[action.kind])}
            onPress={() => onLineAction(action)}
          />
        );
      })}
    </View>
  );
}

const useStyles = createThemedStyles(() => ({
  blocks: {
    gap: SdsSpacing.x6,
  },
  block: {
    gap: SdsSpacing.x2,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x2,
  },
  lineText: {
    flex: 1,
    gap: SdsSpacing.x0_5,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x1_5,
  },
  shrink: {
    flexShrink: 1,
  },
}));
