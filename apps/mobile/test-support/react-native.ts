// A stand-in for react-native under vitest (apps/mobile/vitest.config.ts):
// Node cannot parse the real package (Flow), and the modules a test loads only
// read `Platform` at module scope. A test that needs more renders nothing here.
export const Platform = {
  OS: 'ios' as const,
  Version: '26.0',
  select: <T>(options: { ios?: T; android?: T; native?: T; default?: T }): T | undefined =>
    options.ios ?? options.native ?? options.default,
};
