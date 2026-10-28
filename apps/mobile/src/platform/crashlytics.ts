import {
  getCrashlytics,
  log,
  recordError as fbRecordError,
  setAttributes,
  setUserId,
} from '@react-native-firebase/crashlytics';
import { releaseContext } from './ota';

/**
 * QUIRK(react-native-firebase): the global JS handler installs on the module's first use, so `index.ts`
 * calls this first; an extra `ErrorUtils` handler would double every report. Off in a dev build: with
 * handler chaining off (`firebase.json`) it would end the app instead of showing the red screen.
 */
export function initCrashlytics() {
  if (__DEV__) return;
  try {
    setAttributes(getCrashlytics(), { ...releaseContext() }).catch(() => {});
  } catch {
    // WHY: never throw from the entry point.
  }
}

export function recordError(error: Error, componentStack?: string | null) {
  if (__DEV__) return;
  if (componentStack) {
    log(getCrashlytics(), componentStack);
  }
  fbRecordError(getCrashlytics(), error, 'ReactErrorBoundary');
}

export function setCrashlyticsUserId(uid: string) {
  if (__DEV__) return;
  setUserId(getCrashlytics(), uid).catch(() => {});
}

export function logHandledError(label: string, error: unknown) {
  if (__DEV__) {
    console.warn(`[crashlytics] ${label}:`, error);
    return;
  }
  try {
    log(getCrashlytics(), label);
    const err = error instanceof Error ? error : new Error(String(error));
    fbRecordError(getCrashlytics(), err, label);
  } catch {
    // WHY: never throw from logging.
  }
}

export function logBreadcrumb(line: string) {
  if (__DEV__) return;
  try {
    log(getCrashlytics(), line);
  } catch {
    // WHY: never throw from logging.
  }
}

const BREADCRUMB_DETAIL_MAX = 300;
const droppedLists = new Set<string>();

/**
 * WHY: a breadcrumb once per list per process, not a report of its own: a server change can drop the
 * same item on every fetch from every device.
 */
export function logSchemaDrop(where: string, index: number, error: unknown) {
  if (__DEV__) {
    console.warn(`[schema] dropped ${where}[${index}]`, error);
    return;
  }
  if (droppedLists.has(where)) return;
  droppedLists.add(where);
  const detail = (error instanceof Error ? error.message : String(error)).replace(/\s+/g, ' ');
  try {
    log(getCrashlytics(), `schema/drop ${where}[${index}]: ${detail.slice(0, BREADCRUMB_DETAIL_MAX)}`);
  } catch {
    // WHY: never throw from logging.
  }
}
