export type Shell = 'native-tabs' | 'shared-map';

export function decideShell(override: Shell | null): Shell {
  return override ?? 'shared-map';
}
