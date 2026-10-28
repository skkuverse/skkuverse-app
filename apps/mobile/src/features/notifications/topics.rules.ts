/**
 * WHY: a picker tab key (`dept`, `library`, `dorm`, `general`) is its topic prefix, which the Cloud
 * Function's derive relies on. The client writes intent and never subscribes to a topic itself.
 */

export const TopicPrefix = {
  CATEGORY: 'category',
  DEPT: 'dept',
  LIBRARY: 'library',
} as const;

export type TopicPrefixValue = (typeof TopicPrefix)[keyof typeof TopicPrefix];

export function buildTopic(prefix: string, id: string): string {
  return `${prefix}:${id}`;
}

export function parseTopic(topic: string): { prefix: string; id: string } {
  const colonIndex = topic.indexOf(':');
  if (colonIndex === -1) return { prefix: '', id: topic };
  return {
    prefix: topic.substring(0, colonIndex),
    id: topic.substring(colonIndex + 1),
  };
}
