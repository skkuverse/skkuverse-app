import { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ImageIcon, LinkIcon, PaperclipIcon, SparkleIcon } from 'phosphor-react-native';
import { SdsRadius, SdsSpacing } from '@skkuverse/shared';
import type { BgColorName, FgColorName } from '@skkuverse/shared';
import {
  Badge,
  Button,
  Callout,
  FixedBottomCTA,
  TextButton,
  Txt,
  createThemedStyles,
  useSemanticColors,
} from '@skkuverse/sds';
import type { SketchDetail, SketchStatusTone } from './notice-sketch.types';
import { SketchBlocks } from './SketchBlocks';

const STATUS_TONE: Record<SketchStatusTone, { fg: FgColorName; bg: BgColorName }> = {
  open: { fg: 'brandContrast', bg: 'brandWeak' },
  soon: { fg: 'criticalContrast', bg: 'criticalWeak' },
  closed: { fg: 'neutralSubtle', bg: 'neutralWeak' },
  stopped: { fg: 'warningContrast', bg: 'warningWeak' },
  neutral: { fg: 'neutral', bg: 'neutralWeak' },
};

const COLLAPSED_COPY: Record<NonNullable<SketchDetail['collapsed']>, string> = {
  closed: '마감된 모집이라 내용을 접어 뒀어요.',
  cancelled: '취소된 일정이라 내용을 접어 뒀어요.',
};

export function SketchDetailView({ detail }: { detail: SketchDetail }) {
  const styles = useStyles();
  const color = useSemanticColors();
  const scroll = useRef<ScrollView>(null);
  const [expanded, setExpanded] = useState(false);
  const [bodyOpen, setBodyOpen] = useState(false);
  const [quote, setQuote] = useState<string | null>(null);

  const showQuote = (next: string) => {
    setQuote(next || null);
    setBodyOpen(true);
    requestAnimationFrame(() => scroll.current?.scrollToEnd({ animated: true }));
  };

  return (
    <View style={styles.screen}>
      <ScrollView ref={scroll} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Txt typography="t6" fontWeight="bold" color="neutral">
            {detail.originalTitle}
          </Txt>
          <View style={styles.inline}>
            <Txt typography="t3" color="neutralSubtle">
              {`${detail.board} · ${detail.firstSeen}`}
            </Txt>
            {detail.englishOnly ? (
              <Badge size="xsmall" color="neutralSubtle" backgroundColor="neutralWeak">
                영문 공지
              </Badge>
            ) : null}
          </View>
          {detail.change ? (
            <Txt typography="t3" color="informativeContrast">
              {`${detail.change.what} ${detail.change.before} → ${detail.change.after}`}
            </Txt>
          ) : null}
        </View>

        {detail.status ? (
          <View style={styles.inline}>
            <Badge
              size="small"
              color={STATUS_TONE[detail.status.tone].fg}
              backgroundColor={STATUS_TONE[detail.status.tone].bg}
            >
              {detail.status.word}
            </Badge>
            {detail.status.detail ? (
              <Txt typography="t5" fontWeight="semiBold" color="neutral">
                {detail.status.detail}
              </Txt>
            ) : null}
          </View>
        ) : null}

        {detail.staffOnly ? (
          <Callout tone="neutral" description="교직원 대상 공지예요. 원문만 보여드려요." />
        ) : (
          <View style={styles.inline}>
            <SparkleIcon size={14} color={color.fg.ai} weight="fill" />
            <Txt typography="t2" color="ai" style={styles.shrink}>
              {detail.posterOnly
                ? 'AI가 포스터를 읽고 정리했어요 · 줄을 누르면 원문을 보여드려요'
                : 'AI가 원문을 정리했어요 · 줄을 누르면 원문 문장을 보여드려요'}
            </Txt>
          </View>
        )}

        {detail.blocks.length > 0 ? (
          !detail.collapsed || expanded ? (
            <SketchBlocks blocks={detail.blocks} onQuote={showQuote} />
          ) : (
            <Callout
              tone="neutral"
              description={COLLAPSED_COPY[detail.collapsed]}
              linkProps={{ children: '펼치기', onPress: () => setExpanded(true) }}
            />
          )
        ) : null}

        <View style={styles.original}>
          <Txt typography="t3" fontWeight="bold" color="neutralSubtle">
            원문
          </Txt>
          {detail.original.posters > 0 ? (
            <View style={styles.posters}>
              {Array.from({ length: detail.original.posters }, (_, i) => (
                <View key={i} style={styles.poster}>
                  <ImageIcon size={24} color={color.fg.neutralSubtle} />
                </View>
              ))}
            </View>
          ) : null}
          {detail.original.attachments.map((file) => (
            <View key={file.name} style={styles.inline}>
              <PaperclipIcon size={16} color={color.fg.neutralSubtle} />
              <Txt typography="t4" fontWeight="semiBold" color="neutral">
                {file.role}
              </Txt>
              <Txt typography="t3" color="neutralSubtle" numberOfLines={1} style={styles.shrink}>
                {file.name}
              </Txt>
            </View>
          ))}
          {detail.original.links.map((link) => (
            <View key={link.role} style={styles.inline}>
              <LinkIcon size={16} color={color.fg.neutralSubtle} />
              <Txt typography="t4" fontWeight="semiBold" color="neutral">
                {link.role}
              </Txt>
              <Txt typography="t3" color="neutralSubtle">
                {link.domain}
              </Txt>
            </View>
          ))}
          {bodyOpen ? (
            <View style={styles.body}>
              <Txt typography="t4" color="neutral">
                {detail.original.body}
              </Txt>
              {quote ? (
                <View style={styles.highlight}>
                  <Txt typography="t4" color="neutral">
                    {quote}
                  </Txt>
                </View>
              ) : null}
            </View>
          ) : null}
          <View style={styles.inline}>
            <TextButton typography="t3" variant="arrow" color="neutralSubtle" onPress={() => setBodyOpen((v) => !v)}>
              {bodyOpen ? '원문 접기' : '원문 펼치기'}
            </TextButton>
            <TextButton typography="t3" variant="arrow" color="neutralSubtle" onPress={() => {}}>
              원본 페이지
            </TextButton>
          </View>
        </View>
      </ScrollView>

      {detail.action ? (
        <FixedBottomCTA>
          <Button tone="brand" size="large" display="block" onPress={() => {}}>
            {detail.action.label}
          </Button>
        </FixedBottomCTA>
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  screen: {
    flex: 1,
    backgroundColor: color.bg.layerDefault,
  },
  content: {
    paddingHorizontal: SdsSpacing.gutter,
    paddingTop: SdsSpacing.x4,
    paddingBottom: SdsSpacing.x16,
    gap: SdsSpacing.x5,
  },
  header: {
    gap: SdsSpacing.x1_5,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SdsSpacing.x1_5,
  },
  shrink: {
    flexShrink: 1,
  },
  original: {
    gap: SdsSpacing.x2_5,
    paddingTop: SdsSpacing.x4,
    borderTopWidth: 1,
    borderTopColor: color.stroke.neutralWeak,
  },
  posters: {
    flexDirection: 'row',
    gap: SdsSpacing.x2,
  },
  poster: {
    width: SdsSpacing.x16 + SdsSpacing.x4,
    height: SdsSpacing.x16 + SdsSpacing.x12,
    borderRadius: SdsRadius.r2,
    backgroundColor: color.bg.neutralWeak,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    gap: SdsSpacing.x2,
  },
  highlight: {
    borderRadius: SdsRadius.r1,
    paddingHorizontal: SdsSpacing.x1,
    backgroundColor: color.bg.warningWeak,
  },
}));
