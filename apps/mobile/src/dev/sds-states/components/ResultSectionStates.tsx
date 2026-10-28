import React from 'react';
import { View } from 'react-native';
import { SdsSpacing } from '@skkuverse/shared';
import { MagnifyingGlassIcon } from 'phosphor-react-native';
import { ResultSection, resultSectionVariantMap, useSemanticColors } from '@skkuverse/sds';
import { Caption } from './Caption';
import { Group } from './Group';
import { useStyles } from './Section';
import { noop } from './catalog.constants';

const ASSETS = [true, false] as const;
const ACTION_COUNTS = [1, 2] as const;

export function ResultSectionStates() {
  const color = useSemanticColors();
  const styles = useStyles();
  const asset = <MagnifyingGlassIcon size={SdsSpacing.x10} color={color.fg.neutralSubtle} />;

  return (
    <>
      {resultSectionVariantMap.size.map((size) => (
        <Group key={size} label={`size="${size}" — asset × actions`}>
          {ASSETS.flatMap((withAsset) =>
            ACTION_COUNTS.map((actions) => (
              <View key={`${String(withAsset)}-${actions}`} style={stack}>
                <Caption>{`${withAsset ? 'asset' : 'no asset'} · ${actions === 1 ? 'primary only' : 'primary + secondary'}`}</Caption>
                <View style={styles.frame}>
                  <ResultSection
                    size={size}
                    asset={withAsset ? asset : undefined}
                    title="Nothing here yet"
                    description="A line of supporting detail under the title."
                    primaryActionProps={{ children: 'Try again', onPress: noop }}
                    secondaryActionProps={
                      actions === 2 ? { children: 'Go back', onPress: noop } : undefined
                    }
                  />
                </View>
              </View>
            )),
          )}
        </Group>
      ))}

      <Group label='Actions — primary loading · secondary disabled (size="medium")'>
        <View style={styles.frame}>
          <ResultSection
            size="medium"
            asset={asset}
            title="Loading the list"
            description="The primary action shows its loading state."
            primaryActionProps={{ children: 'Try again', onPress: noop, loading: true }}
            secondaryActionProps={{ children: 'Go back', onPress: noop, disabled: true }}
          />
        </View>
      </Group>

      <Group label='Primary tone — "neutral" (SEED) · "brand" (a sign-in gate)'>
        {(['neutral', 'brand'] as const).map((tone) => (
          <View key={tone} style={stack}>
            <Caption>{`tone="${tone}"`}</Caption>
            <View style={styles.frame}>
              <ResultSection
                size="medium"
                title="Sign in to see this"
                primaryActionProps={{ children: 'Sign in', onPress: noop, tone }}
              />
            </View>
          </View>
        ))}
      </Group>

      <Group label="Interactive — press the actions">
        <View style={styles.frame}>
          <ResultSection
            size="medium"
            title="Press me"
            primaryActionProps={{ children: 'Primary', onPress: noop }}
            secondaryActionProps={{ children: 'Secondary', onPress: noop }}
          />
        </View>
      </Group>
    </>
  );
}

const stack = { gap: SdsSpacing.x1_5 } as const;
