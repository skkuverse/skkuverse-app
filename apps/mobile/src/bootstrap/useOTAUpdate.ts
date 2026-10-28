import { useCallback, useRef, useState } from 'react';
import { checkForUpdate, reload, stageUpdate } from '@/platform/ota';

interface OTAUpdateState {
  isChecking: boolean;
  isDownloading: boolean;
  isReadyToReload: boolean;
  error: Error | null;
  checkAndDownload: () => Promise<boolean>;
  applyUpdate: () => Promise<void>;
}

// WHY: errors are swallowed, since an OTA must never block the app; the caller decides when to reload.
export function useOTAUpdate(): OTAUpdateState {
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isReadyToReload, setIsReadyToReload] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const inProgress = useRef(false);

  const checkAndDownload = useCallback(async (): Promise<boolean> => {
    if (__DEV__ || inProgress.current) return false;
    inProgress.current = true;
    setError(null);

    try {
      setIsChecking(true);
      const update = await checkForUpdate();
      setIsChecking(false);

      if (!update) {
        inProgress.current = false;
        return false;
      }

      setIsDownloading(true);
      const staged = await stageUpdate(update);
      setIsDownloading(false);
      setIsReadyToReload(staged);
      inProgress.current = false;
      return staged;
    } catch (e) {
      setIsChecking(false);
      setIsDownloading(false);
      setError(e instanceof Error ? e : new Error(String(e)));
      inProgress.current = false;
      return false;
    }
  }, []);

  const applyUpdate = useCallback(async () => {
    if (__DEV__) return;
    try {
      await reload();
    } catch {
      // QUIRK(hot-updater): reload throws when nothing is staged.
    }
  }, []);

  return {
    isChecking,
    isDownloading,
    isReadyToReload,
    error,
    checkAndDownload,
    applyUpdate,
  };
}
