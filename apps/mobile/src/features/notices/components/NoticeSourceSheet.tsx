import { forwardRef, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomSheetScrollViewMethods } from '@gorhom/bottom-sheet';
import { ArrowSquareOutIcon } from 'phosphor-react-native';
import { useT, SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { Pressable, Sheet, Txt, type SheetRef, useSemanticColors, createThemedStyles } from '@skkuverse/sds';
import { NoticeMarkdownView } from '../NoticeMarkdownView';
import { toQuoteFocus, type NoticeQuoteFocus } from '../notice-screen.rules';

interface Props {
  markdown: string | null;
  sourceUrl?: string | null;
  onCopyText?: (text: string) => void;
  onOpenOriginal?: () => void;
  onClose: () => void;
  quote?: string | null;
  /** WHY: a new id on every line tap, so a second tap on the same line scrolls back to it. */
  quoteTapId?: number;
}

// WHY: a few lines above the quoted one stay in view, so it reads in its context.
const QUOTE_LEAD = SdsSpacing.x16;

/**
 * WHY: the one action is a fixed footer, where the reader is after the last line; BottomSheetFooter moves
 * with the sheet and the keyboard. `paddingHorizontal: 20` matches NoticeMarkdownView's `width - 40` image width.
 */
export const NoticeSourceSheet = forwardRef<SheetRef, Props>(
  function NoticeSourceSheet(
    { markdown, sourceUrl, onCopyText, onOpenOriginal, onClose, quote = null, quoteTapId = 0 },
    ref,
  ) {
    const styles = useStyles();
    const color = useSemanticColors();
    const { t } = useT();
    const insets = useSafeAreaInsets();
    const focus = useMemo(() => toQuoteFocus(markdown, quote), [markdown, quote]);
    const scrollRef = useRef<BottomSheetScrollViewMethods>(null);
    const highlight = useRef<{ focus: NoticeQuoteFocus; y: number } | null>(null);
    const scrollToQuote = useCallback(
      (y: number) => scrollRef.current?.scrollTo({ y: Math.max(0, y - QUOTE_LEAD), animated: true }),
      [],
    );
    const onHighlightLayout = (event: LayoutChangeEvent) => {
      highlight.current = { focus, y: event.nativeEvent.layout.y };
      scrollToQuote(event.nativeEvent.layout.y);
    };
    useEffect(() => {
      if (highlight.current?.focus === focus) scrollToQuote(highlight.current.y);
    }, [quoteTapId, focus, scrollToQuote]);

    const footer = useMemo(
      () => (
        <View
          style={[
            styles.footer,
            // WHY: a device with no home indicator (insets.bottom 0) still gets a minimum margin.
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          {sourceUrl && onOpenOriginal ? (
            <Pressable
              onPress={onOpenOriginal}
              accessibilityRole="button"
              accessibilityLabel={t('notices.openInBrowser')}
              bg="neutralWeak"
              style={styles.button}
            >
              <Txt
                typography="t5"
                fontWeight="semibold"
                color="neutral"
              >
                {t('notices.openInBrowser')}
              </Txt>
              <ArrowSquareOutIcon size={14} color={color.fg.neutralSubtle} />
            </Pressable>
          ) : null}
          {/* WHY: after a long notice the thumb is at the bottom, so it closes there without scrolling back up. */}
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            // WHY: one step lower contrast than the primary action, so the eye goes there first.
            bg="neutralMuted"
            style={[styles.button, styles.closeButton]}
          >
            <Txt typography="t5" fontWeight="semibold" color="neutralSubtle">
              {t('common.close')}
            </Txt>
          </Pressable>
        </View>
      ),
      [sourceUrl, onOpenOriginal, onClose, insets.bottom, t, color, styles],
    );

    return (
      <Sheet
        ref={ref}
        position={{ kind: 'stuck', detent: 'large' }}
        footer={footer}
      >
        <Sheet.ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: FOOTER_HEIGHT + Math.max(insets.bottom, 12) },
          ]}
        >
          {focus.kind === 'found' ? (
            <>
              <NoticeMarkdownView markdown={focus.before} sourceUrl={sourceUrl} onCopyText={onCopyText} />
              <View style={styles.highlight} onLayout={onHighlightLayout}>
                <NoticeMarkdownView markdown={focus.line} sourceUrl={sourceUrl} onCopyText={onCopyText} />
              </View>
              <NoticeMarkdownView markdown={focus.after} sourceUrl={sourceUrl} onCopyText={onCopyText} />
            </>
          ) : (
            <>
              {focus.kind === 'pinned' ? (
                <View style={[styles.highlight, styles.pinned]} onLayout={onHighlightLayout}>
                  <Txt typography="t5" color="neutral">
                    {focus.quote}
                  </Txt>
                  <Txt typography="t3" color="neutralSubtle">
                    {t('notices.screen.quoteNotFound')}
                  </Txt>
                </View>
              ) : null}
              <NoticeMarkdownView markdown={markdown} sourceUrl={sourceUrl} onCopyText={onCopyText} />
            </>
          )}
        </Sheet.ScrollView>
      </Sheet>
    );
  },
);

/** EVIDENCE: one button is 49 (13 * 2 padding plus t5's 22.5 line), so two plus the gap and top padding of 8 each. */
const FOOTER_HEIGHT = 49 * 2 + 8 + 8;

const useStyles = createThemedStyles(({ color }) => ({
  content: {
    paddingHorizontal: SdsSpacing.gutter,
    paddingTop: SdsSpacing.x1,
  },
  footer: {
    paddingHorizontal: SdsSpacing.gutter,
    paddingTop: SdsSpacing.x2,
    gap: SdsSpacing.x2,
    backgroundColor: color.bg.layerFloating,
  },
  // WHY: the same form as the detail screen's 'read more', since both mean "see more of this notice".
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SdsSpacing.x1_5,
    paddingVertical: SdsSpacing.x3,
    borderRadius: SdsRadius.r3,
  },
  closeButton: {
    overflow: 'hidden',
  },
  highlight: {
    marginHorizontal: -SdsSpacing.x1_5,
    paddingHorizontal: SdsSpacing.x1_5,
    borderRadius: SdsRadius.r2,
    backgroundColor: color.bg.warningWeak,
  },
  pinned: {
    gap: SdsSpacing.x1,
    paddingVertical: SdsSpacing.x3,
    marginBottom: SdsSpacing.x4,
  },
}));
