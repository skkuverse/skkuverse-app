/**
 * Type tests for the API of Chip, Callout and ResultSection (ADR 0015), and
 * for the bypasses the types refuse (packages/sds/SDS.md "Lint rules"), run
 * by `yarn typecheck` (nothing imports this file, so it never reaches the
 * bundle). Each `@ts-expect-error` fails the typecheck if the line it guards
 * compiles.
 */
import React from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { asSdsColor, type FgColorName, type SdsColor } from '@skkuverse/shared';
import { useSemanticColors } from '../core/theme';
import { AccordionList } from './accordion-list';
import { Badge } from './badge';
import { Border } from './border';
import { Button } from './button';
import { ActionableCallout, Callout, DismissibleCallout } from './callout';
import { Chip } from './chip';
import { ListHeader } from './list-header';
import { TextButton } from './text-button';
import { IconButton } from './icon-button';
import { ListRow } from './list-row';
import { Loader } from './loader';
import { Pressable } from './pressable';
import { ResultSection } from './result-section';
import { Skeleton } from './skeleton';
import { Toast } from './toast';
import { Txt, type TxtColor } from './txt';
import type * as SdsApi from '../index';

const noop = () => {};

export function SeedComponentTypeTests() {
  return (
    <>
      <Chip.Toggle tone="brand" checked onCheckedChange={(checked: boolean) => void checked}>
        <Chip.Label>label</Chip.Label>
      </Chip.Toggle>
      {/* A button is never selected, so it has no tone. */}
      {/* @ts-expect-error — no tone on Chip.Button */}
      <Chip.Button tone="brand" onPress={noop}>
        <Chip.Label>label</Chip.Label>
      </Chip.Button>
      {/* @ts-expect-error — SEED's outlineStrong is left out */}
      <Chip.Button variant="outlineStrong" onPress={noop}>
        <Chip.Label>label</Chip.Label>
      </Chip.Button>
      {/* @ts-expect-error — a radio item names its value */}
      <Chip.RadioItem>
        <Chip.Label>label</Chip.Label>
      </Chip.RadioItem>

      <Callout tone="critical" description="text" />
      {/* @ts-expect-error — SEED's magic tone is Daangn's own */}
      <Callout tone="magic" description="text" />
      {/* @ts-expect-error — a tappable callout carries no link */}
      <ActionableCallout description="text" onPress={noop} linkProps={{ children: 'link', onPress: noop }} />
      {/* @ts-expect-error — the close button's label is the caller's */}
      <DismissibleCallout description="text" />

      {/* The Button speaks ADR 0015 too (sds-7): tone, variant, a word size. */}
      <Button tone="critical" variant="weak" size="xsmall" onPress={noop}>
        label
      </Button>
      {/* @ts-expect-error — a look is a tone, never a type */}
      <Button type="primary" onPress={noop}>
        label
      </Button>
      {/* @ts-expect-error — the treatment is a variant; style is not the Button's */}
      <Button style="weak" onPress={noop}>
        label
      </Button>
      {/* @ts-expect-error — TDS's size words are gone */}
      <Button size="big" onPress={noop}>
        label
      </Button>
      {/* @ts-expect-error — TDS's light button is the neutral tone under a dark scheme */}
      <Button tone="light" onPress={noop}>
        label
      </Button>

      {/* So do the other legacy components: no `type` names a look, and sizes are words. */}
      <Loader tone="staticWhite" />
      {/* @ts-expect-error — the Loader's meaning is a tone */}
      <Loader type="dark" />
      <Border variant="height16" />
      {/* @ts-expect-error — the Border's kind is a variant */}
      <Border type="full" />
      <ListRow contents={<ListRow.Texts layout="1RowTypeA" top="t" />} verticalPadding="xsmall" />
      {/* @ts-expect-error — a text layout is a layout */}
      <ListRow.Texts type="1RowTypeA" top="t" />
      {/* @ts-expect-error — extraSmall is xsmall */}
      <ListRow verticalPadding="extraSmall" />
      <Badge size="xsmall">x</Badge>
      {/* @ts-expect-error — tiny is xsmall */}
      <Badge size="tiny">x</Badge>
      <IconButton icon={null} variant="outline" label="x" />
      {/* @ts-expect-error — the IconButton's variants are the Button's words */}
      <IconButton icon={null} variant="clear" label="x" />

      <ResultSection size="medium" primaryActionProps={{ children: 'retry', onPress: noop, loading: true }} />
      {/* @ts-expect-error — the old Button vocabulary does not reach the new component */}
      <ResultSection primaryActionProps={{ children: 'retry', onPress: noop, type: 'primary' }} />
      {/* @ts-expect-error — the secondary action is a ghost button with no loading state */}
      <ResultSection secondaryActionProps={{ children: 'later', onPress: noop, loading: true }} />
    </>
  );
}

// Txt's color is the foreground role names, each a member of its own, so a
// misspelt name is refused like a hex (sds-7).
const roleName: Extract<TxtColor, FgColorName> = 'neutralSubtle';
// @ts-expect-error — a name that is no foreground role is not among them
const notARole: Extract<TxtColor, FgColorName> = 'neutralSubtl';
void roleName;
void notARole;

const sheet = StyleSheet.create({ box: { padding: 8 }, surface: { backgroundColor: '#FFFFFF' } });
const textSheet = StyleSheet.create({ solid: { lineHeight: 20 } });

/** A role's value is branded, the press surface is `bg`, and Txt owns its type: shipped weights only, no type keys in `style`. */
export function RefusalTypeTests() {
  const color = useSemanticColors();
  // A color that arrives as data, vouched for.
  const vouched: SdsColor = asSdsColor('#1F3D2E');
  // @ts-expect-error — a hex is not a role's value
  const hex: SdsColor = '#191F28';

  return (
    <>
      {/* A role's value still fits wherever React Native takes a color. */}
      <ActivityIndicator color={color.fg.brand} />
      {/* Txt's color is a role name; a color that arrives as data goes through style.color (sds-7). */}
      <Txt color="neutralSubtle">x</Txt>
      <Txt style={{ color: vouched }}>x</Txt>
      {/* @ts-expect-error — a hex is not a role name */}
      <Txt color="#191F28">x</Txt>
      {/* @ts-expect-error — nor is a role's value or a vouched color: data goes through style.color */}
      <Txt color={hex}>x</Txt>

      <Pressable bg="neutralWeak" style={sheet.box} />
      {/* @ts-expect-error — the surface is `bg`, which has a pressed pair */}
      <Pressable style={{ backgroundColor: color.bg.neutralWeak }} />
      {/* @ts-expect-error — a sheet's surface is refused too */}
      <Pressable style={sheet.surface} />
      {/* @ts-expect-error — a component that forwards its style to a Pressable refuses it as well */}
      <Chip.Button style={{ backgroundColor: color.bg.brandSolid }} onPress={noop}>
        <Chip.Label>label</Chip.Label>
      </Chip.Button>

      {/* A foreground role name, resolved by Txt in the current scheme. */}
      <Txt color="neutralSubtle">x</Txt>
      <Txt color="onBrandSolid">x</Txt>

      {/* An SDS color prop takes a role name, never a color string (sds-7). */}
      <Badge color="informative" backgroundColor="informativeWeak">x</Badge>
      {/* A route color from data, vouched for. */}
      <Badge color={vouched} backgroundColor={vouched}>x</Badge>
      {/* @ts-expect-error — a hex is not a role */}
      <Badge color="#FF0000">x</Badge>
      {/* @ts-expect-error — nor is a background hex */}
      <Badge backgroundColor="#FFEEEE">x</Badge>
      <TextButton typography="t5" color="placeholder">x</TextButton>
      {/* @ts-expect-error — a TextButton's color is a role */}
      <TextButton typography="t5" color="#8B95A1">x</TextButton>
      {/* @ts-expect-error — the Button's label is its tone's; no free override */}
      <Button color="#FFFFFF" onPress={noop}>
        label
      </Button>
      {/* @ts-expect-error — an IconButton's surface is its variant's */}
      <IconButton icon={null} bgColor="#3182F6" label="x" />
      <ListHeader.TitleParagraph color="neutralMuted">x</ListHeader.TitleParagraph>
      {/* @ts-expect-error — a header's text color is a role */}
      <ListHeader.TitleParagraph color="#4E5968">x</ListHeader.TitleParagraph>
      <Loader customStrokeColor="brandContrast" />
      {/* @ts-expect-error — a spinner's stroke is a role */}
      <Loader customStrokeColor="#FF6600" />
      <AccordionList sections={[]} expandedIndex={null} onToggle={noop} renderItem={() => null} keyExtractor={() => ''} accentColor="brand" />
      {/* @ts-expect-error — the accent is a role */}
      <AccordionList sections={[]} expandedIndex={null} onToggle={noop} renderItem={() => null} keyExtractor={() => ''} accentColor="#1A8A5C" />

      <Txt fontWeight="semiBold">x</Txt>
      {/* @ts-expect-error — WantedSans has no extra-bold face */}
      <Txt fontWeight="extraBold">x</Txt>

      {/* Txt's style takes layout, alignment and a data color; the type keys are Txt's (sds-7). */}
      <Txt style={[sheet.box, { textAlign: 'center', color: vouched }]}>x</Txt>
      {/* @ts-expect-error — the size is `typography` */}
      <Txt style={{ fontSize: 15 }}>x</Txt>
      {/* @ts-expect-error — a sheet's line height is refused too */}
      <Txt style={textSheet.solid}>x</Txt>
      {/* @ts-expect-error — the tracking belongs to the step */}
      <Txt style={[sheet.box, { letterSpacing: -0.2 }]}>x</Txt>
      {/* @ts-expect-error — the family is WantedSans, set by Txt */}
      <Txt style={{ fontFamily: 'Courier' }}>x</Txt>
      {/* @ts-expect-error — the weight is `fontWeight` */}
      <Txt style={{ fontWeight: '700' }}>x</Txt>

      {/* A disabled row fades; TDS's type1 / type2 switch is gone (ADR 0015: an on/off mode is a boolean). */}
      <ListRow contents={null} disabled />
      {/* @ts-expect-error — no disabledStyle */}
      <ListRow contents={null} disabled disabledStyle="type1" />
      {/* A skeleton takes a shape, or a radius of its own, never both (sds-7). */}
      <Skeleton shape="avatar" height={40} />
      <Skeleton borderRadius={12} height={40} />
      {/* @ts-expect-error — the shape sets the radius */}
      <Skeleton shape="text" borderRadius={12} />
      {/* A toast's time is decided (TOAST-05): 3 s, or 5 s with an action. */}
      {/* @ts-expect-error — no duration of the caller's */}
      <Toast open text="x" duration={5} onClose={noop} />
    </>
  );
}

// The TDS theme layer is not public API (sds-7): a role is read through
// useSemanticColors() or createThemedStyles(), a subtree is pinned with
// ColorSchemeProvider, and SDSProvider takes no button token override.
// @ts-expect-error — useAdaptive is gone
export type NoUseAdaptive = typeof SdsApi.useAdaptive;
// @ts-expect-error — AdaptiveColorProvider is gone
export type NoAdaptiveColorProvider = typeof SdsApi.AdaptiveColorProvider;
// @ts-expect-error — colorSeeds is gone
export type NoColorSeeds = typeof SdsApi.colorSeeds;
// @ts-expect-error — getAdaptiveColors is gone
export type NoGetAdaptiveColors = typeof SdsApi.getAdaptiveColors;
// @ts-expect-error — no token override reaches the Button
export const noTokenOverride: SdsApi.SDSProviderProps = { token: { color: { primary: '#000000' } } };
// Nor are the TDS color names: the app reads roles.
// @ts-expect-error — SdsColors is gone from @skkuverse/shared
export type NoSdsColors = typeof import('@skkuverse/shared').SdsColors;
// @ts-expect-error — and so is its per-mode resolver
export type NoResolveSdsColors = typeof import('@skkuverse/shared').resolveSdsColors;
