// WHY: the only catalog; `componentContract.test.mts` fails when an exported component or variant map is missing here.
import React, { useCallback, useRef, useState } from 'react';
import { ScrollView, View, type LayoutChangeEvent } from 'react-native';
import { SdsSpacing } from '@skkuverse/shared';
import {
  Chip,
  ColorSchemeProvider,
  Txt,
  createThemedStyles,
  useResolvedScheme,
} from '@skkuverse/sds';
import { ActionStates } from './components/ActionStates';
import { BadgeStates } from './components/BadgeStates';
import { ButtonStates } from './components/ButtonStates';
import { CalloutStates } from './components/CalloutStates';
import { ChipStates } from './components/ChipStates';
import { FieldStates } from './components/FieldStates';
import { FoundationsStates } from './components/FoundationsStates';
import { ListStates } from './components/ListStates';
import { LoadingStates } from './components/LoadingStates';
import { OverlayStates } from './components/OverlayStates';
import { PressableStates } from './components/PressableStates';
import { ResultSectionStates } from './components/ResultSectionStates';
import { SelectionStates } from './components/SelectionStates';
import { SurfaceStates } from './components/SurfaceStates';
import { Section } from './components/Section';

type Scheme = 'light' | 'dark';

const SECTIONS = [
  { id: 'foundations', title: 'Foundations', note: 'Semantic colors, type, spacing, radius', Body: FoundationsStates },
  { id: 'button', title: 'Button', note: 'Grids from the recipe’s variant map', Body: ButtonStates },
  { id: 'pressable', title: 'Pressable', note: 'Surface roles and feedback modes (ADR 0014)', Body: PressableStates },
  { id: 'chip', title: 'Chip', note: 'Button · Toggle · Radio over one look', Body: ChipStates },
  { id: 'callout', title: 'Callout', note: 'Callout · ActionableCallout · DismissibleCallout', Body: CalloutStates },
  { id: 'result', title: 'ResultSection', note: 'size × asset × actions', Body: ResultSectionStates },
  { id: 'actions', title: 'TextButton · IconButton', note: 'variant × disabled', Body: ActionStates },
  { id: 'badge', title: 'Badge', note: 'size × status tone', Body: BadgeStates },
  { id: 'selection', title: 'Selection', note: 'Switch · Checkbox · SegmentedControl · Tab', Body: SelectionStates },
  { id: 'list', title: 'Lists', note: 'ListRow · ListHeader · Border · AccordionList · BadgeNavRow', Body: ListStates },
  { id: 'field', title: 'Fields', note: 'TextField · SearchField', Body: FieldStates },
  { id: 'loading', title: 'Loading', note: 'Skeleton shapes · Loader', Body: LoadingStates },
  { id: 'overlay', title: 'Overlays', note: 'Dialog · Toast · Sheet · FixedBottomCTA', Body: OverlayStates },
  { id: 'surface', title: 'Text and surfaces', note: 'Txt · Tossface · Glass', Body: SurfaceStates },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

export function SdsStatesScreen() {
  const [scheme, setScheme] = useState<Scheme>('light');
  return (
    <ColorSchemeProvider colorMode={scheme === 'dark' ? 'dark-only' : 'light-only'}>
      <CatalogPage scheme={scheme} onSchemeChange={setScheme} />
    </ColorSchemeProvider>
  );
}

function CatalogPage({ scheme, onSchemeChange }: { scheme: Scheme; onSchemeChange: (s: Scheme) => void }) {
  const styles = useStyles();
  const resolved = useResolvedScheme();
  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef<Partial<Record<SectionId, number>>>({});
  const headerHeight = useRef(0);

  const jumpTo = useCallback((id: SectionId) => {
    const y = offsets.current[id];
    if (y === undefined) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - headerHeight.current), animated: false });
  }, []);

  const onHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    headerHeight.current = event.nativeEvent.layout.height;
  }, []);

  return (
    <View style={styles.page}>
      <ScrollView
        ref={scrollRef}
        stickyHeaderIndices={[0]}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        {/* QUIRK(react-native): ScrollView puts a sticky header's own style on a wrapper, so the layout lives on an inner View. */}
        <View onLayout={onHeaderLayout}>
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <Chip.RadioRoot
                value={scheme}
                onValueChange={(value) => onSchemeChange(value === 'dark' ? 'dark' : 'light')}
                style={styles.schemeSwitch}
              >
                <Chip.RadioItem value="light" tone="brand" size="small">
                  <Chip.Label>Light</Chip.Label>
                </Chip.RadioItem>
                <Chip.RadioItem value="dark" tone="brand" size="small">
                  <Chip.Label>Dark</Chip.Label>
                </Chip.RadioItem>
              </Chip.RadioRoot>
              <Txt typography="t2" color="neutralSubtle">
                {`scheme: ${resolved}`}
              </Txt>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.jumps}>
              {SECTIONS.map(({ id, title }) => (
                <Chip.Button key={id} size="small" variant="outlineWeak" onPress={() => jumpTo(id)}>
                  <Chip.Label>{title}</Chip.Label>
                </Chip.Button>
              ))}
            </ScrollView>
          </View>
        </View>

        {SECTIONS.map(({ id, title, note, Body }) => (
          <Section
            key={id}
            title={title}
            note={note}
            onLayout={(event) => {
              offsets.current[id] = event.nativeEvent.layout.y;
            }}
          >
            <Body />
          </Section>
        ))}
      </ScrollView>
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  page: {
    flex: 1,
    backgroundColor: color.bg.layerDefault,
  },
  content: {
    paddingBottom: SdsSpacing.x16,
  },
  header: {
    gap: SdsSpacing.x2,
    paddingVertical: SdsSpacing.x2_5,
    backgroundColor: color.bg.layerDefault,
    borderBottomWidth: 1,
    borderBottomColor: color.stroke.neutralSubtle,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SdsSpacing.x4,
  },
  schemeSwitch: {
    flexDirection: 'row',
    gap: SdsSpacing.x1_5,
  },
  jumps: {
    gap: SdsSpacing.x1_5,
    paddingHorizontal: SdsSpacing.x4,
  },
}));
