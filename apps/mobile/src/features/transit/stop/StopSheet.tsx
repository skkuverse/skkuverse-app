import { View } from 'react-native';
import { BusIcon, CaretLeftIcon, CaretRightIcon } from 'phosphor-react-native';
import { SdsSpacing, useT } from '@skkuverse/shared';
import {
  IconButton,
  Loader,
  ResultSection,
  Sheet,
  SheetCloseButton,
  Txt,
  createThemedStyles,
  useSemanticColors,
} from '@skkuverse/sds';
import type { MapSheetTrackingProps, MapSheetViewProps } from '@/features/map/sheet-views.types';
import { useViewTracking } from '@/platform/analytics';
import { StopRouteRow } from './components/StopRouteRow';
import { useStopSheet } from './useStopSheet';

export function StopSheet({ tab, entry, sheet }: MapSheetViewProps<'bus_stop'>) {
  const styles = useStyles();
  const color = useSemanticColors();
  const { t, tpl } = useT();
  const { status, name, steps, lineEntry, rows, onClose, onRetry, bottomPadding } = useStopSheet(tab, entry, sheet);

  return (
    <>
      <View style={styles.header}>
        {steps && (
          <IconButton
            icon={<CaretLeftIcon size={22} color={steps.onPrev ? color.fg.neutral : color.fg.disabled} />}
            label={t('transit.stop.prevStop')}
            disabled={!steps.onPrev}
            onPress={steps.onPrev}
          />
        )}
        <View style={styles.title}>
          <Txt
            typography="t7"
            fontWeight="bold"
            color="neutral"
            numberOfLines={1}
            textAlign={steps ? 'center' : undefined}
          >
            {name}
          </Txt>
          {lineEntry && (
            <Txt typography="t2" color="neutralMuted" numberOfLines={1} textAlign={steps ? 'center' : undefined}>
              {lineEntry.towards ? tpl('transit.stop.towards', lineEntry.towards) : t('transit.stop.terminal')}
            </Txt>
          )}
        </View>
        {steps && (
          <IconButton
            icon={<CaretRightIcon size={22} color={steps.onNext ? color.fg.neutral : color.fg.disabled} />}
            label={t('transit.stop.nextStop')}
            disabled={!steps.onNext}
            onPress={steps.onNext}
          />
        )}
        <SheetCloseButton label={t('common.close')} onPress={onClose} />
      </View>
      <Sheet.ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: bottomPadding }}>
        {status === 'ready' ? (
          rows.length > 0 ? (
            rows.map((row) => <StopRouteRow key={row.key} row={row} />)
          ) : (
            <Txt typography="t3" color="neutralMuted" style={styles.empty}>
              {t('transit.stop.noService')}
            </Txt>
          )
        ) : status === 'loading' ? (
          <View style={styles.state}>
            <Loader size="medium" delay={700} />
          </View>
        ) : (
          <ResultSection
            size="large"
            asset={<BusIcon size={SdsSpacing.x10} color={color.fg.neutralSubtle} />}
            title={status === 'gone' ? t('transit.stop.gone') : t('transit.stop.loadFailed')}
            primaryActionProps={status === 'gone' ? undefined : { children: t('common.retry'), onPress: onRetry }}
          />
        )}
      </Sheet.ScrollView>
    </>
  );
}

export function StopSheetTracking({ entry }: MapSheetTrackingProps<'bus_stop'>) {
  useViewTracking('stop_sheet', entry.request.stopId, entry.request.source);
  return null;
}

const useStyles = createThemedStyles(() => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x2,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: SdsSpacing.gutter,
    paddingBottom: SdsSpacing.x2,
  },
  title: {
    flex: 1,
  },
  scroll: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  empty: {
    paddingHorizontal: SdsSpacing.gutter,
    paddingVertical: SdsSpacing.x4,
  },
  state: {
    paddingVertical: SdsSpacing.x8,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
