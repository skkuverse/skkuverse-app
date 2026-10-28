import { describe, expect, test, vi } from 'vitest';
import { HotUpdater } from '@hot-updater/react-native';
import { createUpdateStager, isGateOpen, isPrereleaseBuild, type StageableUpdate } from './ota';
import { PRERELEASE_GATES } from './ota.rules';

// Only the staging logic is under test; the SDK it sits beside is a double.
vi.mock('@hot-updater/react-native', () => ({ HotUpdater: {} }));

// Mirrors a checkForUpdate() result: updateBundle() resolves `result` (or
// rejects with `error`) and counts its calls.
function fakeUpdate(
  transitionKind: StageableUpdate['transitionKind'],
  { result = true, error }: { result?: boolean; error?: Error } = {},
) {
  const calls = { updateBundle: 0 };
  const update: StageableUpdate = {
    transitionKind,
    updateBundle: async () => {
      calls.updateBundle++;
      if (error) throw error;
      return result;
    },
  };
  return { update, calls };
}

describe('stageUpdate', () => {
  // The iOS round's bug: after a catalog change (and after every applied
  // update) the check adopts the running bundle, and the old code reloaded.
  test('ADOPT_RELEASE alone: records the selection, no reload', async () => {
    const stage = createUpdateStager();
    const { update, calls } = fakeUpdate('ADOPT_RELEASE');
    expect(await stage(update)).toBe(false);
    expect(calls.updateBundle, 'the adoption must still be recorded').toBe(1);
  });

  test('INSTALL: reload as before', async () => {
    const stage = createUpdateStager();
    const { update, calls } = fakeUpdate('INSTALL');
    expect(await stage(update)).toBe(true);
    expect(calls.updateBundle).toBe(1);
  });

  test('USE_BUILTIN and USE_EMBEDDED switch the next launch: reload', async () => {
    for (const kind of ['USE_BUILTIN', 'USE_EMBEDDED'] as const) {
      const stage = createUpdateStager();
      expect(await stage(fakeUpdate(kind).update), kind).toBe(true);
    }
  });

  // A result without a transition kind keeps the old meaning of true.
  test('no transitionKind: treated as a real update', async () => {
    const stage = createUpdateStager();
    expect(await stage(fakeUpdate(undefined).update)).toBe(true);
  });

  // A short resume stages B silently; the next check adopts B (the selected
  // bundle) while A still runs, and a long resume must still apply B.
  test('ADOPT_RELEASE after a real update staged in this runtime: reload', async () => {
    const stage = createUpdateStager();
    expect(await stage(fakeUpdate('INSTALL').update)).toBe(true);
    expect(await stage(fakeUpdate('ADOPT_RELEASE').update)).toBe(true);
  });

  test('updateBundle() false: nothing staged, a later adoption stays no-reload', async () => {
    const stage = createUpdateStager();
    expect(await stage(fakeUpdate('INSTALL', { result: false }).update)).toBe(false);
    expect(await stage(fakeUpdate('ADOPT_RELEASE').update)).toBe(false);
  });

  test('updateBundle() rejects: the error reaches the caller, nothing staged', async () => {
    const stage = createUpdateStager();
    const boom = new Error('download failed');
    await expect(stage(fakeUpdate('INSTALL', { error: boom }).update)).rejects.toBe(boom);
    expect(await stage(fakeUpdate('ADOPT_RELEASE').update)).toBe(false);
  });

  test('each stager tracks its own runtime', async () => {
    const first = createUpdateStager();
    await first(fakeUpdate('INSTALL').update);
    const second = createUpdateStager();
    expect(await second(fakeUpdate('ADOPT_RELEASE').update)).toBe(false);
  });
});

// vitest builds with __DEV__ false, so these are release builds, told apart by
// the channel the binary was built for.
describe('isPrereleaseBuild in a release build', () => {
  const onChannel = (channel: string) => Object.assign(HotUpdater, { getChannel: () => channel });

  test('the beta channel is a prerelease build', () => {
    // Arrange
    onChannel('beta');
    // Act
    const prerelease = isPrereleaseBuild();
    // Assert
    expect(prerelease).toBe(true);
  });

  test('the production channel, and any channel it does not expect, are not', () => {
    for (const channel of ['production', 'staging', '']) {
      // Arrange
      onChannel(channel);
      // Act
      const prerelease = isPrereleaseBuild();
      // Assert
      expect(prerelease, channel).toBe(false);
    }
  });
});

describe('isGateOpen in a release build', () => {
  const onChannel = (channel: string) => Object.assign(HotUpdater, { getChannel: () => channel });

  test('every gate is open on the beta channel and closed in production, as isPrereleaseBuild is', () => {
    for (const [channel, expected] of [
      ['beta', true],
      ['production', false],
    ] as const) {
      // Arrange
      onChannel(channel);
      // Act
      const open = PRERELEASE_GATES.map((gate) => isGateOpen(gate));
      // Assert
      expect(open, channel).toStrictEqual(PRERELEASE_GATES.map(() => expected));
    }
  });
});
