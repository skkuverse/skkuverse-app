/**
 * QUIRK(react-native-screens): fullScreenModal, not formSheet: a formSheet's SectionList never scrolls
 * (software-mansion/react-native-screens#2424). Revisit once #2424 is fixed. The modal needs its own
 * SafeAreaProvider: the root one measures another view controller, so the first paint loses the top inset.
 */

import {
  SectionList,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { XIcon } from 'phosphor-react-native';
import { SdsRadius, SdsSpacing } from '@skkuverse/shared';
import {
  Chip,
  Pressable,
  ResultSection,
  SearchField,
  Toast,
  Txt,
  createThemedStyles,
} from '@skkuverse/sds';
import { logNoticesContentSelect } from '@/platform/analytics';
import { DeptRow } from './onboarding/DeptRow';
import { UnsupportedDeptSheet } from './onboarding/UnsupportedDeptSheet';
import { useNoticePicker } from './useNoticePicker';

function NoticePickerScreenInner({ tabKey }: { tabKey: string }) {
  const styles = useStyles();
  const {
    color,
    insets,
    chipMaxWidth,
    tab,
    umbrella,
    sourceById,
    maxSelection,
    sections,
    handleToggle,
    canConfirm,
    handleConfirm,
    handleClose,
    pending,
    query,
    setQuery,
    unsupportedTapped,
    setUnsupportedTapped,
    saving,
    saveFailed,
    setSaveFailed,
    t,
  } = useNoticePicker(tabKey);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* QUIRK(ios): fullScreenModal covers the status bar, so the header absorbs `insets.top` itself;
          titleWrap mirrors this padding inline. */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          bg="transparent"
          onPress={handleClose}
          hitSlop={10}
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        >
          <XIcon size={22} color={color.fg.neutral} />
        </Pressable>
        <View
          style={[styles.titleWrap, { top: insets.top + 8, bottom: 10 }]}
          pointerEvents="none"
        >
          {/* QUIRK(yoga): the absolute box spans only the content row; anchored to the outer edge, it
              centers the title above the X and done buttons. Baseline alignment lives on an inner row,
              since on the same View it overrode the centering. */}
          <View style={styles.titleRow}>
            <Txt
              typography="t7"
              fontWeight="bold"
              color="neutral"
              numberOfLines={1}
            >
              {tab?.label ?? ''}
            </Txt>
            <Txt
              typography="t3"
              color="neutralSubtle"
              numberOfLines={1}
            >
              ({pending.length}/{maxSelection})
            </Txt>
          </View>
        </View>
        <Pressable
          onPress={handleConfirm}
          disabled={!canConfirm}
          hitSlop={10}
          bg="transparent"
          style={styles.doneBtn}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canConfirm }}
        >
          <Txt
            typography="t5"
            fontWeight="semiBold"
            color={canConfirm ? 'brandContrast' : 'disabled'}
          >
            {saving ? t('notices.picker.saving') : t('notices.done')}
          </Txt>
        </Pressable>
      </View>

      {pending.length > 0 && (
        <View style={[styles.chipsWrap, styles.chipsRow]}>
          {pending.map((id) => {
            const src = sourceById.get(id);
            if (!src) return null;
            return (
              <Chip.Toggle
                key={id}
                checked
                tone="brand"
                size="small"
                onCheckedChange={() => {
                  logNoticesContentSelect({ content_type: 'picker_chip_remove', item_id: id });
                  handleToggle(id);
                }}
                style={{ maxWidth: chipMaxWidth }}
                accessibilityLabel={`${src.name} 제거`}
              >
                <Chip.Label>{src.name}</Chip.Label>
                <Chip.SuffixIcon>
                  <XIcon weight="bold" />
                </Chip.SuffixIcon>
              </Chip.Toggle>
            );
          })}
        </View>
      )}

      <View style={styles.searchWrap}>
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder={
            // WHY: the server-side functions kept outside this repository use 'dept' too, so a rename is one coordinated change.
            tab?.key === 'dept'
              ? t('onboarding.deptSearchPlaceholder')
              : t('notices.picker.searchPlaceholder')
          }
          hasClearButton
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isSelected = pending.includes(item.id);
          const atMax = pending.length >= maxSelection;
          if (!item.noticeAvailable) {
            // WHY: a source retired after the user picked it stays selected and deselects like any other;
            // tapping it again opens the sheet that explains why it cannot be re-added.
            return (
              <DeptRow
                name={item.name}
                selected={isSelected}
                unsupported
                variant="checkbox"
                onPress={() => {
                  if (isSelected) {
                    logNoticesContentSelect({
                      content_type: 'picker_row',
                      item_id: item.id,
                    });
                    handleToggle(item.id);
                  } else {
                    logNoticesContentSelect({
                      content_type: 'picker_unsupported',
                      item_id: item.id,
                    });
                    setUnsupportedTapped(item);
                  }
                }}
              />
            );
          }
          return (
            <DeptRow
              name={item.name}
              selected={isSelected}
              disabled={atMax && !isSelected}
              variant="checkbox"
              onPress={() => {
                logNoticesContentSelect({ content_type: 'picker_row', item_id: item.id });
                handleToggle(item.id);
              }}
            />
          );
        }}
        renderSectionHeader={({ section }) =>
          section.title ? (
            <Txt
              typography="t3"
              fontWeight="semiBold"
              color="neutralSubtle"
              style={styles.sectionHeader}
            >
              {section.title}
            </Txt>
          ) : null
        }
        ListEmptyComponent={
          <ResultSection
            size="medium"
            description={t('notices.picker.empty')}
            style={styles.emptyWrap}
          />
        }
        stickySectionHeadersEnabled={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom, 24) },
        ]}
        showsVerticalScrollIndicator={false}
        style={styles.list}
      />

      <UnsupportedDeptSheet
        source={unsupportedTapped}
        umbrella={umbrella}
        onAccept={(alt) => {
          // WHY: add-only; accepting the umbrella never removes one already picked.
          if (!pending.includes(alt.id)) handleToggle(alt.id);
          setUnsupportedTapped(null);
        }}
        onDismiss={() => setUnsupportedTapped(null)}
      />

      {/* WHY: a failed write keeps the modal open, and retry re-runs the same save. */}
      <Toast
        open={saveFailed}
        text={t('notices.picker.saveFailed')}
        button={
          <Toast.Button text={t('notices.picker.retry')} onPress={handleConfirm} />
        }
        onClose={() => setSaveFailed(false)}
      />
    </View>
  );
}

export function NoticePickerScreen({ tabKey }: { tabKey: string }) {
  return (
    <SafeAreaProvider>
      <NoticePickerScreenInner tabKey={tabKey} />
    </SafeAreaProvider>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    backgroundColor: color.bg.layerDefault,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SdsSpacing.x3,
    paddingBottom: SdsSpacing.x2_5,
    minHeight: 52,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SdsRadius.full,
  },
  titleWrap: {
    // WHY: top and bottom are set inline, mirroring the header's content row, not the safe-area inset.
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: SdsSpacing.x1_5,
  },
  doneBtn: {
    marginLeft: 'auto',
    paddingHorizontal: SdsSpacing.x2_5,
    paddingVertical: SdsSpacing.x1_5,
    borderRadius: SdsRadius.r2,
  },
  chipsWrap: {
    paddingBottom: SdsSpacing.x2,
  },
  chipsRow: {
    paddingHorizontal: SdsSpacing.x4,
    gap: SdsSpacing.x2,
    rowGap: SdsSpacing.x2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  searchWrap: {
    paddingHorizontal: SdsSpacing.x4,
    paddingBottom: SdsSpacing.x2,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: SdsSpacing.x3,
    flexGrow: 1,
  },
  sectionHeader: {
    paddingHorizontal: SdsSpacing.x3,
    paddingTop: SdsSpacing.x3,
    paddingBottom: SdsSpacing.x1_5,
  },
  emptyWrap: {
    flexGrow: 0,
    paddingTop: SdsSpacing.x14,
  },
}));
