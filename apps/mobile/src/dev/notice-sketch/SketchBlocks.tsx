import { View } from 'react-native';
import { EnvelopeSimpleIcon, MapPinIcon, PhoneIcon } from 'phosphor-react-native';
import { SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { Badge, Pressable, TextButton, Txt, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import type { SketchBlock, SketchLine, SketchLineAction } from './notice-sketch.types';

const ACTION_ICON: Record<SketchLineAction, typeof MapPinIcon> = {
  map: MapPinIcon,
  call: PhoneIcon,
  email: EnvelopeSimpleIcon,
};

export function SketchBlocks({ blocks, onQuote }: { blocks: SketchBlock[]; onQuote: (quote: string) => void }) {
  const styles = useStyles();
  return (
    <View style={styles.blocks}>
      {blocks.map((block) => (
        <View key={block.label} style={styles.block}>
          <Txt typography="t3" fontWeight="bold" color="neutralSubtle">
            {block.label}
          </Txt>
          {block.lines.map((line, i) => (
            <BlockLine key={i} line={line} index={block.numbered ? i + 1 : null} onQuote={onQuote} />
          ))}
          {block.foldedCount ? (
            <TextButton typography="t3" variant="arrow" color="neutralSubtle" onPress={() => {}}>
              {`${block.foldedCount}개 더 보기`}
            </TextButton>
          ) : null}
          {block.footerLink ? (
            <TextButton typography="t3" variant="arrow" color="brandContrast" onPress={() => onQuote('')}>
              {block.footerLink}
            </TextButton>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function BlockLine({
  line,
  index,
  onQuote,
}: {
  line: SketchLine;
  index: number | null;
  onQuote: (quote: string) => void;
}) {
  const styles = useStyles();
  const color = useSemanticColors();
  return (
    <View style={styles.lineRow}>
      <Pressable bg="layerDefault" scaleScope="content" style={styles.lineText} onPress={() => onQuote(line.quote)}>
        <View style={styles.inline}>
          {index !== null ? (
            <Txt typography="t5" fontWeight="bold" color="brandContrast">
              {`${index}.`}
            </Txt>
          ) : null}
          <Txt typography="t5" color="neutral" style={styles.shrink}>
            {line.text}
          </Txt>
          {line.fromPoster ? (
            <Badge size="xsmall" color="neutralSubtle" backgroundColor="neutralWeak">
              포스터
            </Badge>
          ) : null}
        </View>
        {line.sub ? (
          <Txt typography="t3" color="neutralSubtle">
            {line.sub}
          </Txt>
        ) : null}
      </Pressable>
      {(line.actions ?? []).map((action) => {
        const Icon = ACTION_ICON[action];
        return (
          <Pressable key={action} bg="neutralWeak" style={styles.action} onPress={() => {}}>
            <Icon size={18} color={color.fg.neutral} />
          </Pressable>
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
  action: {
    width: SdsSpacing.x9,
    height: SdsSpacing.x9,
    borderRadius: SdsRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
