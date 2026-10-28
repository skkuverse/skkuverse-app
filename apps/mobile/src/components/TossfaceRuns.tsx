import { Tossface } from '@skkuverse/sds';
import { toEmojiRuns } from './emoji-runs.rules';

/**
 * QUIRK(react-native): a nested span lays out on its parent's line and ignores padding, so a nested
 * `Tossface` gets no Android headroom; a line-sized emoji in a body line fits anyway.
 * WHY: text without emoji comes back as the string itself, so any served string can be wrapped.
 */
export function TossfaceRuns({ text }: { text: string }) {
  const runs = toEmojiRuns(text);
  if (!runs.some((run) => run.kind === 'emoji')) return text;
  return runs.map((run, i) =>
    run.kind === 'emoji' ? <Tossface key={i}>{run.value}</Tossface> : run.value,
  );
}
