export const NotificationChannelId = {
  ACADEMIC: 'notice_academic',
  SCHOLARSHIP: 'notice_scholarship',
  CAREER: 'notice_career',
  GENERAL: 'notice_general',
  DEPARTMENT: 'notice_department',
  ESSENTIAL: 'notice_essential',
  SERVICES: 'notice_services',
  /**
   * WHY: one channel for every mini app, since channels are created at startup before the registry is held.
   * QUIRK(firebase): a device without this channel yet gets FCM's "Miscellaneous" fallback, still delivered.
   */
  MINIAPP: 'miniapp_v2',
} as const;

/**
 * WHY: the Korean keys are the crawler's board labels verbatim; anything unlisted, the empty string included, is GENERAL.
 * WHY: a Map, since an object literal would answer "constructor" with a prototype member instead of falling back.
 */
export const CATEGORY_CHANNELS: ReadonlyMap<string, string> = new Map([
  ['academic', NotificationChannelId.ACADEMIC],
  ['학사', NotificationChannelId.ACADEMIC],
  ['학사안내', NotificationChannelId.ACADEMIC],
  ['수강신청', NotificationChannelId.ACADEMIC],
  ['수강신청공지', NotificationChannelId.ACADEMIC],
  ['학부', NotificationChannelId.ACADEMIC],
  ['대학원', NotificationChannelId.ACADEMIC],
  ['논문', NotificationChannelId.ACADEMIC],
  ['입학', NotificationChannelId.ACADEMIC],
  ['Academics', NotificationChannelId.ACADEMIC],
  ['scholarship', NotificationChannelId.SCHOLARSHIP],
  ['장학', NotificationChannelId.SCHOLARSHIP],
  ['Scholarship', NotificationChannelId.SCHOLARSHIP],
  ['career', NotificationChannelId.CAREER],
  ['recruitment', NotificationChannelId.CAREER],
  ['채용/모집', NotificationChannelId.CAREER],
  ['취업', NotificationChannelId.CAREER],
  ['모집', NotificationChannelId.CAREER],
  ['essential', NotificationChannelId.ESSENTIAL],
  ['services', NotificationChannelId.SERVICES],
]);

/**
 * WHY: the server-side functions set the same `channelId` for background and quit state; if the two differ,
 * one notification lands in two channels by app state, and muting one silences only half.
 */
export function resolveNotificationChannel(
  data: Record<string, unknown> | undefined,
): string {
  if (data?.type === 'miniapp') return NotificationChannelId.MINIAPP;
  return mapCategoryToChannel(
    typeof data?.category === 'string' ? data.category : undefined,
  );
}

export function mapCategoryToChannel(category?: string): string {
  if (category === undefined) return NotificationChannelId.GENERAL;
  return CATEGORY_CHANNELS.get(category) ?? NotificationChannelId.GENERAL;
}
