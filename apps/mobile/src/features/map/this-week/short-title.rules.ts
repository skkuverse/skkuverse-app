/** WHY: stands in for the server's `summaryShortTitle` until the feed's wire ships one, then goes. */

const LEADING_TAG = /^\s*(?:\[[^\]]*\]|\([^)]*\)|<[^>]*>|【[^】]*】)\s*/;

const LEADING_TERM = /^\s*\d{4}(?:학년도|년)?(?:\s*(?:\d학기|[상하]반기)|-\d)?\s+/;

const LEADING_EDITION = /^\s*제\s*\d+\s*회\s*/;

const LEADING_HOST = /^\s*\S+(?:센터|사업단|팀|연구소)\s+/;

/** WHY: longest first, so a longer ending goes whole before a shorter one inside it. */
const TRAILING = ['참가 신청 안내', '모집 안내', '참가 신청', '참가자 모집', '참여자 모집', '참가 모집', '안내', '개최', '참석'];

const DATE_INSIDE = /\d+\/\d+|\d+\s*월|~/;

const NOTE_INSIDE = /지급|부여|연장|선착순/;

const QUOTED = /<([^>]+)>|"([^"]+)"|“([^”]+)”|「([^」]+)」/;

/** WHY: the name keeps the event's kind when the name alone would not say it. */
const TYPE_WORDS = ['워크숍', '특강', '세미나', '설명회', '콜로키움', '서포터즈', '캠프', '공모전'];

function withoutGroups(title: string, drops: RegExp): string {
  let out = '';
  let i = 0;
  while (i < title.length) {
    if (title[i] !== '(') {
      out += title[i];
      i += 1;
      continue;
    }
    let depth = 0;
    let j = i;
    for (; j < title.length; j += 1) {
      if (title[j] === '(') depth += 1;
      if (title[j] === ')') depth -= 1;
      if (depth === 0) break;
    }
    const group = title.slice(i, j + 1);
    if (j < title.length && drops.test(group)) out = out.trimEnd();
    else out += group;
    i = j + 1;
  }
  return out;
}

function untilStable(s: string, step: (s: string) => string): string {
  for (let prev = ''; prev !== s; ) {
    prev = s;
    s = step(s);
  }
  return s;
}

/** WHY: a name that is a sentence (a talk's title) needs no kind after it to read as one. */
function quotedName(title: string): string | null {
  const match = title.match(QUOTED);
  if (!match) return null;
  const inner = (match[1] ?? match[2] ?? match[3] ?? match[4] ?? '').replace(/\s*(?:\([^)]*\)|\[[^\]]*\])/g, '').trim();
  if (inner.length === 0) return null;
  if (inner.endsWith('다')) return inner;
  const outside = title.replace(match[0], ' ');
  const kind = TYPE_WORDS.find((word) => outside.includes(word) && !inner.includes(word));
  return kind ? `${inner} ${kind}` : inner;
}

export function toShortTitle(title: string): string {
  let s = untilStable(title.trim(), (t) =>
    t.replace(LEADING_TAG, '').replace(LEADING_HOST, '').replace(LEADING_TERM, '').replace(LEADING_EDITION, ''),
  );
  s = withoutGroups(withoutGroups(s, DATE_INSIDE), NOTE_INSIDE).trim();
  s = quotedName(s) ?? s;
  s = untilStable(s, (t) => {
    for (const ending of TRAILING) {
      if (t.endsWith(ending) && t.length > ending.length) return t.slice(0, -ending.length).trim();
    }
    return t;
  });
  return s.length > 0 ? s : title.trim();
}

/** WHY: umbrella ADR 0009 D3 sets a row title's limit in full-width characters. */
export const TITLE_LIMIT = 20;

export const TOKEN_TITLE_LIMIT = 14;

const WIDE = /[\u1100-\u11ff\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/;

export function toTitleWidth(title: string): number {
  let width = 0;
  for (const ch of title) width += WIDE.test(ch) ? 1 : 0.5;
  return width;
}

/** WHY: a first word longer than the limit is cut, since a row cannot show it whole. */
export function toRowTitle(title: string, limit: number = TITLE_LIMIT): string {
  const whole = title.replace(/\s+/g, ' ').trim();
  if (toTitleWidth(whole) <= limit) return whole;
  let cut = '';
  for (const word of whole.split(' ')) {
    const next = cut === '' ? word : `${cut} ${word}`;
    if (toTitleWidth(next) > limit - 1) break;
    cut = next;
  }
  if (cut === '') {
    for (const ch of whole) {
      if (toTitleWidth(cut + ch) > limit - 1) break;
      cut += ch;
    }
  }
  return `${cut}…`;
}
