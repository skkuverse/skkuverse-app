import { expect, test } from 'vitest';
import { faviconUrl } from './favicon.rules';

test('faviconUrl builds a faviconV2 URL from the page origin (path stripped)', () => {
  const url = faviconUrl('https://student.skku.edu/student/notice2.do');
  expect(url?.startsWith('https://t1.gstatic.com/faviconV2?')).toBeTruthy();
  expect(url?.includes(encodeURIComponent('https://student.skku.edu'))).toBeTruthy();
  expect(url?.includes('size=128')).toBeTruthy();
  // WHY: the path and query are not part of the origin.
  expect(!url?.includes('notice2')).toBeTruthy();
});

test('faviconUrl honors a custom size', () => {
  expect(faviconUrl('https://x.test/a', 64)?.endsWith('size=64')).toBeTruthy();
});

test('faviconUrl returns null for non-http(s) / opaque-origin / malformed URLs', () => {
  expect(faviconUrl('about:blank')).toBe(null); // WHY: its origin is the string 'null'
  expect(faviconUrl('data:text/html,x')).toBe(null);
  expect(faviconUrl('')).toBe(null);
  expect(faviconUrl('not a url')).toBe(null);
});
