import { parseMapPlaceRef, type MapPlaceRef } from '@skkuverse/shared';
import type { NoticesContentType } from '@/platform/analytics.types';
import type { NoticeAction, NoticeActionKind } from './notice-facts.types';

export interface NoticeActionFields {
  target: string;
  space?: string;
  subject?: string;
}

const PHONE = /^\+?\d[\d -]*\d$/;
const MIN_PHONE_DIGITS = 7;
const MAX_PHONE_DIGITS = 15;
const ADDRESS = /^[\w.+-]+@[\w-]+(?:\.[\w-]+)+$/;
const HTTP_URL = /^https?:\/\/\S+$/i;

function isPhoneNumber(target: string): boolean {
  const digitCount = target.replace(/\D/g, '').length;
  return PHONE.test(target) && digitCount >= MIN_PHONE_DIGITS && digitCount <= MAX_PHONE_DIGITS;
}

/**
 * WHY: an allowlist per kind, since a target becomes a URL the OS opens; a target this build cannot open
 * (a map place outside the campus map) drops its action alone.
 */
export function toNoticeAction(kind: NoticeActionKind, { target, space, subject }: NoticeActionFields): NoticeAction | null {
  switch (kind) {
    case 'map': {
      const place = parseMapPlaceRef(target);
      return place?.kind === 'skku_building' ? { kind, place, space: space ?? null } : null;
    }
    case 'search': {
      const query = target.trim();
      return query === '' ? null : { kind, query };
    }
    case 'call':
      return isPhoneNumber(target) ? { kind, number: target } : null;
    case 'email':
      return ADDRESS.test(target) ? { kind, address: target, subject: subject ?? null } : null;
    case 'link':
      return HTTP_URL.test(target) ? { kind, url: target } : null;
  }
}

export type NoticeActionHandoff =
  | { via: 'map'; place: MapPlaceRef; space: string | null }
  | { via: 'url'; url: string; copyOnFailure: string | null };

/** WHY: a URL no app on the phone takes (a simulator's tel:) copies what it held, so the tap still gives it. */
export function toActionHandoff(action: NoticeAction, os: 'ios' | 'android'): NoticeActionHandoff {
  switch (action.kind) {
    case 'map':
      return { via: 'map', place: action.place, space: action.space };
    case 'search': {
      const query = encodeURIComponent(action.query);
      return { via: 'url', url: os === 'ios' ? `maps://?q=${query}` : `geo:0,0?q=${query}`, copyOnFailure: action.query };
    }
    case 'call':
      return { via: 'url', url: `tel:${action.number.replace(/[^\d+]/g, '')}`, copyOnFailure: action.number };
    case 'email': {
      const subject = action.subject === null ? '' : `?subject=${encodeURIComponent(action.subject)}`;
      return { via: 'url', url: `mailto:${action.address}${subject}`, copyOnFailure: action.address };
    }
    case 'link':
      return { via: 'url', url: action.url, copyOnFailure: null };
  }
}

export const NOTICE_ACTION_CONTENT_TYPE: Readonly<Record<NoticeActionKind, NoticesContentType>> = {
  map: 'detail_line_map',
  search: 'detail_line_search',
  call: 'detail_line_call',
  email: 'detail_line_email',
  link: 'detail_line_link',
};
