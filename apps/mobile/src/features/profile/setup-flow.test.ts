import { describe, expect, test } from 'vitest';
import { initialSetup, setupReducer, answersOf, canAdvance } from './profile.rules';

const start = (steps: ('campus' | 'nickname')[], nickname: string | null = null) => initialSetup(steps, { nickname });

describe('setupFlow', () => {
  test('walks the given steps in order and finishes after the last', () => {
    let s = start(['campus', 'nickname']);
    expect(s.current).toBe('campus');
    s = setupReducer(s, { type: 'SET_CAMPUS', campus: 'nsc' });
    s = setupReducer(s, { type: 'NEXT' });
    expect(s.current).toBe('nickname');
    s = setupReducer(s, { type: 'SET_NICKNAME', nickname: ' 파도왕 ' });
    s = setupReducer(s, { type: 'NEXT' });
    expect(s.current).toBe('done');
    expect(answersOf(s)).toStrictEqual({ campus: 'nsc', nickname: '파도왕' });
  });

  test('the campus is required', () => {
    let s = start(['campus']);
    expect(canAdvance(s)).toBe(false);
    s = setupReducer(s, { type: 'NEXT' });
    expect(s.current).toBe('campus');
    s = setupReducer(s, { type: 'SET_CAMPUS', campus: 'hssc' });
    s = setupReducer(s, { type: 'NEXT' });
    expect(s.current).toBe('done');
    expect(answersOf(s)).toStrictEqual({ campus: 'hssc' });
  });

  test('the nickname advances only when valid', () => {
    let s = start(['nickname'], 'ab');
    expect(s.nickname, 'prefilled').toBe('ab');
    s = setupReducer(s, { type: 'SET_NICKNAME', nickname: '파' });
    expect(canAdvance(s)).toBe(false);
    s = setupReducer(s, { type: 'NEXT' });
    expect(s.current).toBe('nickname');
    s = setupReducer(s, { type: 'SET_NICKNAME', nickname: '파도' });
    s = setupReducer(s, { type: 'NEXT' });
    expect(s.current).toBe('done');
    expect(answersOf(s)).toStrictEqual({ nickname: '파도' });
  });

  test('a device suggestion preselects the campus, still asked', () => {
    let s = initialSetup(['campus'], { nickname: null, prefill: { campus: 'nsc' } });
    expect(s.current).toBe('campus');
    expect(canAdvance(s)).toBe(true);
    s = setupReducer(s, { type: 'NEXT' });
    expect(answersOf(s)).toStrictEqual({ campus: 'nsc' });
  });

  test('the nickname is saved composed (NFC)', () => {
    let s = start(['nickname']);
    s = setupReducer(s, { type: 'SET_NICKNAME', nickname: '파도'.normalize('NFD') });
    s = setupReducer(s, { type: 'NEXT' });
    expect(answersOf(s).nickname).toBe('파도');
  });

  test('PREV never goes before the first step; nothing to ask is done at once', () => {
    let s = start(['campus', 'nickname']);
    s = setupReducer(s, { type: 'PREV' });
    expect(s.current).toBe('campus');
    s = setupReducer(s, { type: 'SET_CAMPUS', campus: 'hssc' });
    s = setupReducer(s, { type: 'NEXT' });
    s = setupReducer(s, { type: 'PREV' });
    expect(s.current).toBe('campus');
    expect(start([]).current).toBe('done');
    expect(answersOf(start([]))).toStrictEqual({});
  });
});
