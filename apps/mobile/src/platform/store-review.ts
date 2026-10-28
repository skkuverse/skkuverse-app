import * as StoreReview from 'expo-store-review';
import { logHandledError } from './crashlytics';
import { logReviewNativeCalled } from './analytics';
import { markHandoff } from './handoff';

/**
 * QUIRK(ios): the OS shows at most 3 prompts per 365 days and skips the rest with no JS signal, so the
 * event means "asked the OS to show it", never "the user saw it".
 */
export async function requestNativeReview(reason: string): Promise<void> {
  try {
    const available = await StoreReview.isAvailableAsync();
    if (!available) {
      // WHY: no fallback to a web rating page, which adds friction; the event still records the
      // drop-off (an Android device without Play Services) apart from the iOS quota's silence.
      logReviewNativeCalled({ reason, available: false });
      return;
    }
    logReviewNativeCalled({ reason, available: true });
    markHandoff('review');
    await StoreReview.requestReview();
  } catch (e) {
    logHandledError('store-review/request-failed', e);
  }
}
