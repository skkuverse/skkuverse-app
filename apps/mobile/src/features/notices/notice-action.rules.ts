import { parseMapPlaceRef } from '@skkuverse/shared';
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
