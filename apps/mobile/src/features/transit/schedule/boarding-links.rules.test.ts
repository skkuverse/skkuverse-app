/**
 * NAVER Map links for a boarding stop.
 */

import { describe, expect, it } from 'vitest';
import { naverWebMapUrl, nmapPlaceUrl } from './boarding-links.rules';

const STOP = { lat: 37.365499, lng: 127.107906, name: '정자역 3번 출구' };

describe('nmapPlaceUrl', () => {
  it('names the coordinates, the stop and the calling app', () => {
    const url = new URL(nmapPlaceUrl(STOP, 'com.example.skkumap'));
    expect(url.protocol).toBe('nmap:');
    expect(url.host).toBe('place');
    expect(url.searchParams.get('lat')).toBe('37.365499');
    expect(url.searchParams.get('lng')).toBe('127.107906');
    expect(url.searchParams.get('name')).toBe('정자역 3번 출구');
    expect(url.searchParams.get('appname')).toBe('com.example.skkumap');
  });

  it('encodes a name that would otherwise end the query', () => {
    const url = new URL(nmapPlaceUrl({ ...STOP, name: 'A&B=C' }, 'x'));
    expect(url.searchParams.get('name')).toBe('A&B=C');
  });

  it('writes a space as %20, not +', () => {
    expect(nmapPlaceUrl(STOP, 'x').includes('name=%EC%A0%95%EC%9E%90%EC%97%AD%203')).toBeTruthy();
  });
});

describe('naverWebMapUrl', () => {
  it('pins the stop on the mobile web map', () => {
    const url = new URL(naverWebMapUrl(STOP));
    expect(url.origin).toBe('https://m.map.naver.com');
    expect(url.searchParams.get('pinTitle')).toBe('정자역 3번 출구');
    expect(url.searchParams.get('pinType')).toBe('SITE');
    expect(url.searchParams.get('lat')).toBe('37.365499');
  });
});
