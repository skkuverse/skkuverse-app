import { Fragment, type ReactNode } from 'react';
import { View } from 'react-native';
import { useT, SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { Border, TextButton, createThemedStyles } from '@skkuverse/sds';
import { track } from '@/platform/analytics';
import type { PlacedAttachments, RunAttachment, RunAttachmentKind } from './run-attachments.rules';
import type { OnStationPress } from './schedule.types';
import { TossfaceRuns } from '@/components/TossfaceRuns';

// WHY: `ScheduleRow`'s dot column and rail, so the rail lines up through the box.
const DOT_COLUMN = 16;
const RAIL = { left: 7, width: 2 } as const;

interface RunAttachmentsProps {
  group: PlacedAttachments;
  runKey: string;
  rail: boolean;
  last: boolean;
  onStationPress: OnStationPress;
}

export function RunAttachments({ group, runKey, rail, last, onStationPress }: RunAttachmentsProps) {
  const styles = useStyles();
  const onAction = (attachment: RunAttachment) =>
    track('schedule_attachment_action', { kind: attachment.kind, id: attachment.id, run_key: runKey });
  return (
    <View style={[styles.line, last && styles.lineLast]}>
      <View style={styles.dotColumn}>{rail ? <View style={styles.rail} /> : null}</View>
      <View style={styles.box}>
        {group.items.map((attachment, i) => {
          const Renderer = RENDERERS[attachment.kind];
          return (
            <Fragment key={attachment.id}>
              {i > 0 ? <Border /> : null}
              <Renderer attachment={attachment} onAction={() => onAction(attachment)} onStationPress={onStationPress} />
            </Fragment>
          );
        })}
      </View>
    </View>
  );
}

type RendererProps = { attachment: RunAttachment; onAction: () => void; onStationPress: OnStationPress };

const RENDERERS: Record<RunAttachmentKind, (props: RendererProps) => ReactNode> = {
  transfer: TransferItem,
};

function TransferItem({ attachment, onAction, onStationPress }: RendererProps) {
  const styles = useStyles();
  const { tpl } = useT();
  const { stationId, title } = attachment.payload;
  const label = tpl('schedule.liveTrains', title);
  return (
    <TextButton
      typography="t3"
      fontWeight="semiBold"
      variant="arrow"
      accessibilityLabel={label}
      onPress={() => {
        onAction();
        onStationPress(stationId, 'schedule_transfer');
      }}
      style={styles.item}
    >
      <TossfaceRuns text={label} />
    </TextButton>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  line: {
    flexDirection: 'row',
    paddingHorizontal: SdsSpacing.gutter,
    gap: SdsSpacing.x2_5,
  },
  lineLast: {
    paddingBottom: SdsSpacing.x2,
  },
  dotColumn: {
    width: DOT_COLUMN,
  },
  rail: {
    position: 'absolute',
    left: RAIL.left,
    width: RAIL.width,
    top: 0,
    bottom: 0,
    backgroundColor: color.bg.neutralWeak,
  },
  box: {
    flex: 1,
    marginVertical: SdsSpacing.x1,
    paddingHorizontal: SdsSpacing.x3,
    borderRadius: SdsRadius.r2_5,
    backgroundColor: color.bg.neutralMuted,
  },
  item: {
    alignSelf: 'stretch',
    minHeight: 44,
    justifyContent: 'center',
  },
}));
