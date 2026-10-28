// File-level exceptions to sds/* rules: the second of the three ways an sds/*
// rule may be switched off (ADR 0016). The other two are the rule's `files`
// scope in eslint.config.js, for whole areas the rule does not govern, and a
// line-level `// eslint-disable-next-line sds/<rule> -- <reason>`.
//
// An entry belongs here when a whole file is outside a rule's purpose, such as
// a data table of route colors or a primitive that implements the very thing a
// rule bans elsewhere. eslint.config.js turns each entry's rules off for its
// files. `yarn sds:exceptions` lists every entry, and
// scripts/eslint/sds-exceptions.test.mjs fails on an entry whose file is gone
// or whose reason is empty.
//
//   files:  exact paths from the repository root, never a glob (a glob is a
//           scope, which belongs in the rule's own config block)
//   rules:  sds/* rule IDs the plugin defines
//   reason: why the rule does not apply to these files
'use strict';

/** @type {{ files: string[], rules: string[], reason: string }[]} */
module.exports = [
  // ── Primitives: the theme layer resolves what the rules ban elsewhere ──
  {
    files: ['packages/sds/src/core/theme.ts'],
    rules: ['sds/no-static-theme'],
    reason: 'the theme layer itself: it resolves the role table per scheme, once, for everything else to read',
  },
  {
    files: ['packages/sds/src/components/txt/Txt.tsx', 'packages/sds/src/components/tossface/Tossface.tsx'],
    rules: ['sds/no-rn-text'],
    reason: "the primitives that wrap React Native's Text: Txt draws WantedSans on the type scale, Tossface draws emoji",
  },

  // ── Data and illustration colors ──
  {
    files: ['apps/mobile/src/features/hssc/map-svg.constants.ts'],
    rules: ['sds/no-color-in-string', 'sds/no-color-literal'],
    reason: 'data color, not UI: the HSSC campus map drawn as SVG markup, with each line in its route color',
  },
  {
    files: ['apps/mobile/src/features/map/components/MapThumb.tsx'],
    rules: ['sds/no-color-literal'],
    reason: "data color, not UI: an illustration of each map style (basic, satellite, terrain) in that style's own palette",
  },
  {
    files: ['apps/mobile/src/components/GoogleIcon.tsx'],
    rules: ['sds/no-color-literal'],
    reason: "data color, not UI: Google's logo in the brand colors its sign-in guidelines fix",
  },
  {
    files: ['apps/mobile/src/features/games/registry.rules.ts'],
    rules: ['sds/no-color-literal'],
    reason: "data color, not UI: each game page's own background and scrim, which the native host paints around the page to match it",
  },
  {
    files: ['apps/mobile/src/features/games/apple-game/Overlay.tsx'],
    rules: ['sds/no-color-literal'],
    reason: "data color, not UI: the apple game's title, start prompt and pause card in the game's own palette, over the board its page paints the same in both schemes",
  },
  {
    files: ['apps/mobile/src/features/games/wave-run/Overlay.tsx'],
    rules: ['sds/no-color-literal'],
    reason: "data color, not UI: the wave game's title, controls and pause card in the game's own palette, over the sky and field its page paints the same in both schemes",
  },
  {
    files: ['apps/mobile/src/features/games/suika-game/Overlay.tsx'],
    rules: ['sds/no-color-literal'],
    reason: "data color, not UI: the suika game's title, hint and pause card in the game's own palette, over the box its page paints the same in both schemes",
  },
  {
    files: ['apps/mobile/src/features/games/building-stack/Overlay.tsx'],
    rules: ['sds/no-color-literal'],
    reason: "data color, not UI: the building stack game's title, start prompt and pause card in the game's own palette, over the sky its page paints the same in both schemes",
  },
  {
    files: ['apps/mobile/src/features/games/bigger-building/Overlay.tsx'],
    rules: ['sds/no-color-literal'],
    reason: "data color, not UI: the bigger building game's title, start prompt and pause card in the game's own palette, over the black board its page paints the same in both schemes",
  },

  // ── Display type ──
  {
    files: ['apps/mobile/src/features/home/components/HeroBanner.tsx'],
    rules: ['sds/no-rn-text'],
    reason: "the home banner's animated wordmark: display type at its own size (HEADING_FONT), in slots whose widths are measured from its glyphs, which no Txt step holds",
  },

  // ── Dev-only screens ──
  {
    files: ['apps/mobile/src/dev/debug-logs/DebugLogsScreen.tsx'],
    rules: ['sds/no-font-family-literal', 'sds/no-color-literal', 'sds/no-rn-text', 'sds/no-type-size-literal'],
    reason: 'dev-only diagnostic: the debug log screen draws a monospace terminal view at its own sizes, which no Txt step or face holds, and is removed before release (RELEASE-GATE(debug-menu))',
  },
];
