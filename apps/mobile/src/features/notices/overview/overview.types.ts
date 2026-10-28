/**
 * CONTRACT(skkuverse-server): skkuverse-server/src/notices/overview/notices-overview.wire.ts, with client
 * guidance in skkuverse-server/docs/reference/notices-api.md
 */

export interface OverviewSentence {
  text: string;
  cites: number[];
}

export interface OverviewSource {
  n: number;
  sourceId: string;
  /** QUIRK(skkuverse-server): numeric on the wire, as on list items, though the server's TS type says string. */
  articleNo: number;
  title: string;
  date: string;
  contentMissing: boolean;
}

export interface OverviewDto {
  /** WHY: null when the model answered only partly; never promote a point into it. */
  lead: OverviewSentence | null;
  points: OverviewSentence[];
  sources: OverviewSource[];
  lang: 'ko' | 'en';
  generatedAt: string;
}

export type OverviewReason = 'no_results' | 'no_answer' | 'unavailable';

export interface NoticeOverviewResult {
  overview: OverviewDto | null;
  cached: boolean;
  reason: OverviewReason | null;
}
