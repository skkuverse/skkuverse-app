import type { WebToAppMessage } from './types';

const VALID_TYPES = new Set([
  'web:ready',
  'web:navigate',
  'web:analytics',
  'web:haptic',
  'web:open-url',
  'web:map-select',
  'web:action',
]);

const HAPTIC_STYLES = new Set(['light', 'medium', 'heavy']);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value !== '';

/**
 * WHY: a field a handler acts on is checked so a malformed message drops instead of crashing it;
 * every other type is cast after the `type` check alone.
 */
function hasValidPayload(parsed: Record<string, unknown>): boolean {
  switch (parsed.type) {
    case 'web:action':
      return isNonEmptyString(parsed.actionType) && isNonEmptyString(parsed.actionValue);
    case 'web:open-url':
      return isNonEmptyString(parsed.url) && (parsed.appUrl === undefined || isNonEmptyString(parsed.appUrl));
    case 'web:haptic':
      return typeof parsed.style === 'string' && HAPTIC_STYLES.has(parsed.style);
    default:
      return true;
  }
}

export function parseWebMessage(raw: string): WebToAppMessage | null {
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.type === 'string' &&
      VALID_TYPES.has(parsed.type) &&
      hasValidPayload(parsed)
    ) {
      return parsed as WebToAppMessage;
    }
    return null;
  } catch {
    return null;
  }
}
