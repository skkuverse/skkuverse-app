import { expect, test } from 'vitest';
import { handsOffToOs, instagramDestination, isInstagramUrl } from '../instagram-url.rules';

test('recognises https Instagram addresses on every Instagram host', () => {
  expect(isInstagramUrl('https://www.instagram.com/p/AbCd_12/')).toBe(true);
  expect(isInstagramUrl('https://instagram.com/skkuverse.app')).toBe(true);
  expect(isInstagramUrl('https://m.instagram.com/reel/AbCd_12/')).toBe(true);
  expect(isInstagramUrl('https://WWW.INSTAGRAM.COM/skkuverse.app')).toBe(true);
});

test('leaves other addresses to the caller', () => {
  expect(isInstagramUrl('http://www.instagram.com/p/AbCd_12/')).toBe(false);
  expect(isInstagramUrl('instagram://p/AbCd_12')).toBe(false);
  expect(isInstagramUrl('https://instagram.com.example.com/p/AbCd_12/')).toBe(false);
  expect(isInstagramUrl('https://www.skkuverse.com/')).toBe(false);
  expect(isInstagramUrl('not a url')).toBe(false);
});

test('hands a top-frame Instagram load to the OS', () => {
  expect(handsOffToOs({ url: 'https://www.instagram.com/p/AbCd_12/', isTopFrame: true })).toBe(true);
  // Android reports top frames only and leaves the flag unset.
  expect(handsOffToOs({ url: 'https://www.instagram.com/p/AbCd_12/' })).toBe(true);
});

test('keeps an Instagram embed loading in its iframe', () => {
  expect(handsOffToOs({ url: 'https://www.instagram.com/p/AbCd_12/embed/', isTopFrame: false })).toBe(false);
});

test('lets every other load through', () => {
  expect(handsOffToOs({ url: 'https://eskara.miniapp.skkuverse.com/', isTopFrame: true })).toBe(false);
  expect(handsOffToOs({ url: 'about:blank' })).toBe(false);
});

test('opens a valid post or reel', () => {
  expect(instagramDestination('https://www.instagram.com/skkuverse.app/', 'https://www.instagram.com/p/AbCd_12/')).toBe('https://www.instagram.com/p/AbCd_12/');
  expect(instagramDestination('https://www.instagram.com/skkuverse.app/', 'https://www.instagram.com/reel/AbCd_12/')).toBe('https://www.instagram.com/reel/AbCd_12/');
});

test('opens the profile when no post is supplied', () => {
  expect(instagramDestination('https://instagram.com/skkuverse.app/', null)).toBe('https://instagram.com/skkuverse.app/');
});

test('falls back from an invalid post to a valid profile', () => {
  expect(instagramDestination('https://www.instagram.com/skkuverse.app/', 'https://example.com/p/not-instagram/')).toBe('https://www.instagram.com/skkuverse.app/');
});

test('opens nothing for a malformed profile', () => {
  expect(instagramDestination('https://example.com/skkuverse.app/', null)).toBe(null);
  expect(instagramDestination('https://www.instagram.com/explore/', null)).toBe(null);
});
