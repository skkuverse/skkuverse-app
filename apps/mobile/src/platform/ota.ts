import { HotUpdater, type ReleaseTransitionKind } from '@hot-updater/react-native';
import { isPrerelease, resolveOtaId, type PrereleaseGate } from './ota.rules';

export interface ReleaseContext {
  app_channel: string;
  ota_id: string;
}

/**
 * WHY: Analytics and Crashlytics report these under the same names, so a crash and an event search alike.
 * QUIRK(hot-updater): both are the running bundle's native constants, readable before `HotUpdater.init`.
 */
export function releaseContext(): ReleaseContext {
  return {
    app_channel: __DEV__ ? 'dev' : HotUpdater.getChannel(),
    ota_id: resolveOtaId(HotUpdater.getManifest().bundleId, HotUpdater.getMinBundleId()),
  };
}

/**
 * WHY: only developer tooling reads this directly; a product feature reads `isGateOpen`, which names it.
 * QUIRK(hot-updater): the channel is a synchronous native constant, so module scope is safe.
 */
export function isPrereleaseBuild(): boolean {
  return isPrerelease(__DEV__, HotUpdater.getChannel());
}

/** WHY: one rule for every gate, read under the gate's name so each site is one grep for it. */
export function isGateOpen(_gate: PrereleaseGate): boolean {
  return isPrereleaseBuild();
}

export function checkForUpdate() {
  return HotUpdater.checkForUpdate({ updateStrategy: 'appVersion' });
}

export function reload() {
  return HotUpdater.reload();
}

export interface StageableUpdate {
  readonly transitionKind?: ReleaseTransitionKind;
  updateBundle: () => Promise<boolean>;
}

/**
 * QUIRK(hot-updater): `updateBundle()` resolves true for an `ADOPT_RELEASE` (rc.31 `checkForUpdate.ts`
 * 322-372), which downloads nothing and only records the selection. Reloading on it alone restarts the
 * JS for nothing, so only a real update staged in this runtime makes a reload worth it.
 */
export function createUpdateStager(): (update: StageableUpdate) => Promise<boolean> {
  let stagedThisRuntime = false;
  return async (update) => {
    if (!(await update.updateBundle())) return false;
    if (update.transitionKind !== 'ADOPT_RELEASE') stagedThisRuntime = true;
    return stagedThisRuntime;
  };
}

/** WHY: one stager per JS runtime; a reload re-evaluates the bundle, which resets its flag. */
export const stageUpdate = createUpdateStager();
