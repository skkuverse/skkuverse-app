import { useMemo, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useAuthStore,
  useNotificationStore,
  useSettingsStore,
  useT,
  type Campus,
  type TranslationKey,
} from '@skkuverse/shared';
import { useSemanticColors } from '@skkuverse/sds';
import { setPickerSelectionRemote } from '@/features/notifications/notifications.service';
import { logHandledError } from '@/platform/crashlytics';
import { logNoticesContentSelect } from '@/platform/analytics';
import { filterPickerSources } from './source-filters.rules';
import { findCollegeUmbrella, recommendCollegeMates } from './college-recommendation.rules';
import { useNoticeTabs } from './useNoticeTabs';
import type { TabSource } from './notices.types';

interface PickerSection {
  title: string;
  data: TabSource[];
}

// WHY: a static map keeps the key inside the TranslationKey union, which a built string would leave.
const CAMPUS_HEADER_KEY: Record<Campus, TranslationKey> = {
  hssc: 'campus.hssc',
  nsc: 'campus.nsc',
};

export function useNoticePicker(tabKey: string) {
  const router = useRouter();
  const { t } = useT();
  const color = useSemanticColors();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const chipMaxWidth = Math.min(Math.round(screenW * 0.6), 360);

  const { data: tabsConfig } = useNoticeTabs();
  const tab = useMemo(
    () => tabsConfig?.tabs.find((tt) => tt.key === tabKey) ?? null,
    [tabsConfig, tabKey],
  );

  const pickerSelections = useNotificationStore(
    (s) => s.preferences.pickerSelections ?? {},
  );
  const uid = useAuthStore((s) => s.uid);
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const subscriptionUid = !isAnonymous ? uid : null;

  const primaryDeptId = useSettingsStore((s) => s.primaryDeptId);
  const preferredCampus = useSettingsStore((s) => s.preferredCampus);

  // WHY: snapshot what is STORED, once at mount, never resolvePickerSelection(): its display fallback
  // (sources[0]) seeded into the buffer got saved as the user's intent, and that department never left.
  const [originalIds] = useState<string[]>(() => {
    if (!tab || tab.tabMode !== 'picker' || !tab.picker) return [];
    const validIds = new Set(tab.picker.sources.map((sc) => sc.id));
    return (pickerSelections[tab.key] ?? []).filter((id) => validIds.has(id));
  });
  const [pending, setPending] = useState<string[]>(originalIds);
  const [query, setQuery] = useState('');

  // WHY: an unsupported department that vanished from search read as a broken app, so it shows greyed.
  const sources = useMemo<TabSource[]>(
    () =>
      tab?.tabMode === 'picker' && tab.picker
        ? filterPickerSources(tab.picker.sources, { showUnsupported: true })
        : [],
    [tab],
  );

  const [unsupportedTapped, setUnsupportedTapped] = useState<TabSource | null>(
    null,
  );
  const umbrella = useMemo(
    () =>
      unsupportedTapped ? findCollegeUmbrella(unsupportedTapped, sources) : null,
    [unsupportedTapped, sources],
  );

  const sourceById = useMemo(
    () => new Map(sources.map((s) => [s.id, s])),
    [sources],
  );

  const maxSelection =
    tab?.tabMode === 'picker' && tab.picker ? tab.picker.maxSelection : 1;

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return sources;
    return sources.filter((s) => s.name.includes(q));
  }, [sources, query]);

  const sections = useMemo<PickerSection[]>(() => {
    if (!tab || filtered.length === 0) return [];
    // WHY: the server-side functions kept outside this repository use 'dept' too, so a rename is one coordinated change.
    if (tab.key === 'dept') {
      const primary = primaryDeptId
        ? sources.find((s) => s.id === primaryDeptId) ?? null
        : null;
      const { recommended, others } = recommendCollegeMates(primary, filtered);
      const out: PickerSection[] = [];
      if (recommended.length > 0) {
        out.push({
          title: t('onboarding.interestDept.recommendedSection'),
          data: recommended,
        });
      }
      out.push({
        title:
          recommended.length > 0
            ? t('onboarding.interestDept.othersSection')
            : '',
        data: others,
      });
      return out;
    }
    // WHY: 'both' gets its own section, so a dual-campus source is not filed under one campus.
    const otherCampus: Campus = preferredCampus === 'hssc' ? 'nsc' : 'hssc';
    const bothBucket: TabSource[] = [];
    const userBucket: TabSource[] = [];
    const otherBucket: TabSource[] = [];
    for (const src of filtered) {
      if (src.campus === 'both' || src.campus == null) {
        bothBucket.push(src);
      } else if (src.campus === preferredCampus) {
        userBucket.push(src);
      } else {
        otherBucket.push(src);
      }
    }
    const sectionCount =
      (bothBucket.length > 0 ? 1 : 0) +
      (userBucket.length > 0 ? 1 : 0) +
      (otherBucket.length > 0 ? 1 : 0);
    const showHeaders = sectionCount > 1;
    const out: PickerSection[] = [];
    if (bothBucket.length > 0) {
      out.push({
        title: showHeaders ? t('campus.both') : '',
        data: bothBucket,
      });
    }
    if (userBucket.length > 0) {
      out.push({
        title: showHeaders ? t(CAMPUS_HEADER_KEY[preferredCampus]) : '',
        data: userBucket,
      });
    }
    if (otherBucket.length > 0) {
      out.push({
        title: showHeaders ? t(CAMPUS_HEADER_KEY[otherCampus]) : '',
        data: otherBucket,
      });
    }
    return out;
  }, [tab, filtered, primaryDeptId, preferredCampus, sources, t]);

  const handleToggle = (id: string) => {
    setPending((prev) => {
      if (prev.includes(id)) {
        // WHY: an empty selection is allowed while editing; the confirm button blocks committing it.
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= maxSelection) return prev;
      return [...prev, id];
    });
  };

  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const canConfirm = pending.length > 0 && !saving;

  // WHY: await the write and dismiss only on success; a fire-and-forget save hid failed writes. The
  // spinner can last seconds in a wifi dead spot, since the promise settles on server ack.
  const handleConfirm = async () => {
    if (!canConfirm || !tab || !subscriptionUid) return;
    logNoticesContentSelect({
      content_type: 'picker_done',
      item_id: `${tab.key}/${pending.length}`,
    });
    setSaving(true);
    setSaveFailed(false);
    try {
      // WHY: a self-heal seed recreates the document with the user's real picks, not an empty one.
      await setPickerSelectionRemote(subscriptionUid, tab.key, pending, {
        pickerSelections: { [tab.key]: pending },
        onboarded: true,
      });
      router.back();
    } catch (e) {
      // WHY: Crashlytics triage queries depend on this label.
      logHandledError('notifications/picker-set', e);
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    // WHY: a dismiss mid-write would reopen the silent-failure hole this screen closes.
    if (saving) return;
    logNoticesContentSelect({
      content_type: 'picker_close',
      item_id: tab?.key ?? 'unknown',
    });
    router.back();
  };

  return {
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
  };
}
