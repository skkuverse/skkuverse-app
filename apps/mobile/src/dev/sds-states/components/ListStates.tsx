import React, { useState } from 'react';
import { View } from 'react-native';
import {
  AccordionList,
  Badge,
  BadgeNavRow,
  Border,
  ListHeader,
  ListRow,
  Txt,
  borderVariantMap,
  listRowVariantMap,
  type AccordionSection,
} from '@skkuverse/sds';
import { Caption } from './Caption';
import { Group } from './Group';
import { useStyles } from './Section';
import { noop } from './catalog.constants';

interface Room {
  id: string;
  name: string;
}

const FLOORS: AccordionSection<Room>[] = [
  { title: '1F', items: [{ id: '101', name: 'Lobby' }, { id: '102', name: 'Café' }, { id: '103', name: 'Lab A' }, { id: '104', name: 'Lab B' }] },
  { title: '2F', items: [{ id: '201', name: 'Lecture room' }, { id: '202', name: 'Office' }] },
];

export function ListStates() {
  const styles = useStyles();
  const [expanded, setExpanded] = useState<number | null>(0);
  const [showAll, setShowAll] = useState<Record<number, boolean>>({});

  return (
    <>
      <Group label="ListRow — verticalPadding (listRowVariantMap)">
        <View style={styles.frame}>
          {listRowVariantMap.verticalPadding.map((verticalPadding, index) => (
            <React.Fragment key={verticalPadding}>
              {index > 0 ? <Border variant="padding24" /> : null}
              <ListRow
                verticalPadding={verticalPadding}
                contents={<ListRow.Texts layout="1RowTypeA" top={`verticalPadding="${verticalPadding}"`} />}
                withArrow
                onPress={noop}
              />
            </React.Fragment>
          ))}
        </View>
      </Group>

      <Group label="ListRow — horizontalPadding · alignment · faded">
        <View style={styles.frame}>
          {listRowVariantMap.horizontalPadding.map((horizontalPadding) => (
            <ListRow
              key={horizontalPadding}
              horizontalPadding={horizontalPadding === 'none' ? 0 : undefined}
              contents={<ListRow.Texts layout="2RowTypeA" top={`horizontalPadding="${horizontalPadding}"`} bottom="A second line" />}
              onPress={noop}
            />
          ))}
          <Border variant="full" />
          {listRowVariantMap.leftAlignment.map((alignment) => (
            <ListRow
              key={alignment}
              leftAlignment={alignment}
              rightAlignment={alignment}
              left={<ListRow.LeftText>Left</ListRow.LeftText>}
              contents={
                <ListRow.Texts layout="3RowTypeA" top={`alignment="${alignment}"`} middle="The main line" bottom="And a third" />
              }
              right={<Badge size="small">Right</Badge>}
            />
          ))}
          <Border variant="full" />
          {listRowVariantMap.faded.map((faded) => (
            <ListRow
              key={String(faded)}
              disabled={faded}
              contents={<ListRow.Texts layout="1RowTypeB" top={faded ? 'disabled (faded)' : 'enabled'} />}
              withArrow
              onPress={noop}
            />
          ))}
        </View>
      </Group>

      <Group label="ListHeader — upper · right text · right arrow · lower">
        <ListHeader
          upper={<ListHeader.DescriptionParagraph>Upper description</ListHeader.DescriptionParagraph>}
          title={<ListHeader.TitleParagraph typography="t7" fontWeight="bold">Title</ListHeader.TitleParagraph>}
          right={<ListHeader.RightText typography="t3">Right text</ListHeader.RightText>}
        />
        <ListHeader
          title={<ListHeader.TitleParagraph typography="t9" fontWeight="bold">A larger title</ListHeader.TitleParagraph>}
          right={<ListHeader.RightArrow typography="t3" onPress={noop}>More</ListHeader.RightArrow>}
          lower={<ListHeader.DescriptionParagraph>Lower description</ListHeader.DescriptionParagraph>}
        />
      </Group>

      <Group label="Border — variant (borderVariantMap)">
        {borderVariantMap.variant.map((variant) => (
          <View key={variant} style={styles.rowBlock}>
            <Caption>{`variant="${variant}"`}</Caption>
            <Border variant={variant} />
          </View>
        ))}
      </Group>

      <Group label="AccordionList — expanded, show more, highlighted">
        <View style={styles.frame}>
          <AccordionList
            sections={FLOORS}
            expandedIndex={expanded}
            onToggle={setExpanded}
            maxVisible={3}
            showAllMap={showAll}
            onShowAll={(index) => setShowAll((prev) => ({ ...prev, [index]: true }))}
            showMoreLabel={(remaining) => `+${remaining} more`}
            keyExtractor={(room) => room.id}
            highlightKey="102"
            renderItem={(room, _index, highlighted) => (
              <Txt typography="t4" fontWeight={highlighted ? 'semiBold' : 'regular'} color={highlighted ? 'brand' : 'neutral'}>
                {`${room.id} · ${room.name}`}
              </Txt>
            )}
          />
        </View>
      </Group>

      <Group label="BadgeNavRow — with subtitle · disabled">
        <View style={styles.frame}>
          <BadgeNavRow badge="A" title="A row with a badge" subtitle="And its subtitle" onPress={noop} />
          <BadgeNavRow badge="B" title="Disabled" onPress={noop} disabled />
        </View>
      </Group>
    </>
  );
}
