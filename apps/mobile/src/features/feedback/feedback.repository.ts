import { addDoc, collection, getFirestore, serverTimestamp } from '@react-native-firebase/firestore';
import { authStore } from '@skkuverse/shared';
import { logHandledError } from '@/platform/crashlytics';
import { primeAppCheck } from '@/platform/app-check';

// WHY: anonymous by design, no uid is stored; the client is gated to signed-in users but the document carries no identity.
// The `feedback` collection is shared with the account-deletion feedback that `deleteAccount` writes server-side.
export interface FeedbackSubmission {
  text: string;
  source: string;
  noticeRef?: { sourceId: string; articleNo: number };
}

// WHY: network errors are absorbed by the SDK's offline queue and surface as `true`; `false` is a permanent failure.
export async function submitNegativeFeedback(
  payload: FeedbackSubmission,
): Promise<boolean> {
  const auth = authStore.getState();
  if (auth.isAnonymous || !auth.uid) return false;

  // QUIRK(firebase): App Check tokens can go stale between writes (iOS simulator, sometimes Android), so the server answers PERMISSION_DENIED while the local cache accepts; a refresh avoids it.
  await primeAppCheck();

  try {
    await addDoc(collection(getFirestore(), 'feedback'), {
      type: 'review_prompt',
      source: payload.source,
      text: payload.text.slice(0, 2000),
      ...(payload.noticeRef && {
        sourceId: payload.noticeRef.sourceId,
        articleNo: payload.noticeRef.articleNo,
      }),
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (e) {
    logHandledError('feedback/submit-failed', e);
    return false;
  }
}
