// CONTRACT(skkuverse): skkuverse/docs/decisions/0009-notice-list-rows.md; every string is finished server text, because the app never reads
// `facts` or computes a relative word.

export type SketchDay = 'today' | 'yesterday' | 'thisWeek' | 'earlier';

// WHY: the server picks one status token by precedence cancelled > today > deadline tomorrow > closed > stopped > postponed > extended > changed; only deadlines take the urgency colour.
export type SketchTokenTone = 'urgent' | 'today' | 'cancelled' | 'postponed' | 'closed' | 'stopped' | 'extended' | 'changed' | 'plain';

export interface SketchRow {
  id: string;
  day: SketchDay;
  token?: { text: string; tone: SketchTokenTone };
  title: string;
  when: string;
  urgent?: boolean;
  // CONTRACT(skkuverse): skkuverse/docs/decisions/0009-notice-list-rows.md D4; `abstain` means the date could not be read, and `when` sends the
  // reader to the original.
  dateMark?: 'warning' | 'abstain';
  qualifier?: string;
  board?: string;
  // CONTRACT(skkuverse): skkuverse/docs/decisions/0009-notice-list-rows.md D3; a suspended notice is not dimmed, since a suspension is temporary.
  dimmed?: boolean;
  englishOnly?: boolean;
}

// WHY: no calendar action; the owner dropped calendar add.
export type SketchLineAction = 'map' | 'call' | 'email';

export interface SketchLine {
  text: string;
  sub?: string;
  fromPoster?: boolean;
  actions?: SketchLineAction[];
  quote: string;
}

export interface SketchBlock {
  label: string;
  lines: SketchLine[];
  numbered?: boolean;
  foldedCount?: number;
  footerLink?: string;
}

export type SketchStatusTone = 'open' | 'soon' | 'closed' | 'stopped' | 'neutral';

export interface SketchDetail {
  id: string;
  originalTitle: string;
  board: string;
  firstSeen: string;
  // CONTRACT(skkuverse): skkuverse/docs/decisions/0009-notice-list-rows.md D11; a change the server detected between extractions, while one the
  // notice states goes in its own block.
  change?: { what: string; before: string; after: string };
  status?: { word: string; detail?: string; tone: SketchStatusTone };
  posterOnly?: boolean;
  staffOnly?: boolean;
  englishOnly?: boolean;
  collapsed?: 'closed' | 'cancelled';
  blocks: SketchBlock[];
  original: {
    posters: number;
    attachments: { role: string; name: string }[];
    links: { role: string; domain: string }[];
    body: string;
  };
  // CONTRACT(skkuverse): skkuverse/docs/decisions/0009-notice-list-rows.md D14; set only when exactly one action is open now.
  action?: { label: string; kind: 'link' | 'email' };
}
