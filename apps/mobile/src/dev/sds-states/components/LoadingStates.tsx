import React from 'react';
import { View } from 'react-native';
import { Loader, Skeleton, type LoaderTone, type SkeletonShape } from '@skkuverse/sds';
import { Caption } from './Caption';
import { Cell } from './Cell';
import { Group } from './Group';
import { Row } from './Row';
import { useStyles } from './Section';

const SHAPES = ['text', 'card', 'avatar'] as const satisfies readonly SkeletonShape[];
const SIZES = ['small', 'medium', 'large'] as const;
const TONES = ['neutral', 'brand', 'staticWhite'] as const satisfies readonly LoaderTone[];

export function LoadingStates() {
  const styles = useStyles();
  return (
    <>
      <Group label="Skeleton — shape (Skeleton.Animate shimmers)">
        <Skeleton.Animate>
          <Row>
            <Cell caption='shape="avatar"'>
              <Skeleton shape="avatar" height={48} />
            </Cell>
            <Cell caption='shape="card"'>
              <Skeleton shape="card" width={96} height={64} />
            </Cell>
          </Row>
          <View style={styles.rowBlock}>
            <Caption>{'shape="text"'}</Caption>
            <Skeleton shape="text" width="80%" />
            <Skeleton shape="text" width="60%" height={12} />
          </View>
        </Skeleton.Animate>
        <Row label="still (no Skeleton.Animate)">
          {SHAPES.map((shape) => (
            <Skeleton key={shape} shape={shape} width={shape === 'avatar' ? undefined : 64} height={32} />
          ))}
        </Row>
      </Group>

      {TONES.map((tone) => (
        <Group key={tone} label={`Loader tone="${tone}" — size`}>
          <View style={tone === 'staticWhite' ? styles.darkBackdrop : undefined}>
            <Row>
              {SIZES.map((size) => (
                <Loader key={size} size={size} tone={tone} />
              ))}
            </Row>
          </View>
        </Group>
      ))}

      <Group label="Loader — with a label · after a delay (LOAD-05)">
        <Row>
          <Loader size="medium" tone="neutral" label="Loading" />
          <Loader size="medium" tone="brand" delay={800} />
        </Row>
      </Group>
    </>
  );
}
