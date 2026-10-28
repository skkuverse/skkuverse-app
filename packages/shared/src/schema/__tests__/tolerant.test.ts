/**
 * The tolerant schema helpers (ADR 0020 D6, spec data/server-response-parsing):
 * an installed build, an old OTA bundle included, keeps working when the server
 * adds a field, adds an enum member or sends one malformed item, and a response
 * that cannot be used fails so the caller's fallback applies.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  finiteNumber,
  openEnum,
  openUnionArray,
  opt,
  optionalText,
  parsedBy,
  parseOrThrow,
  setDropReporter,
  text,
  tolerantArray,
} from '../tolerant';

const item = z.object({ id: z.string(), n: z.number() });

afterEach(() => {
  setDropReporter(() => {});
});

describe('unknown fields', () => {
  it('parse to the same result as without them', () => {
    // Arrange
    const schema = z.object({ id: z.string() });

    // Act
    const result = schema.parse({ id: 'a', newServerField: 1 });

    // Assert
    expect(result).toEqual({ id: 'a' });
  });
});

describe('tolerantArray', () => {
  it('drops one bad item and keeps the rest in order', () => {
    // Arrange
    const raw = [
      { id: 'a', n: 1 },
      { id: 'b', n: 2 },
      { id: 'c', n: 'three' },
      { id: 'd', n: 4 },
      { id: 'e', n: 5 },
    ];

    // Act
    const result = tolerantArray(item, 'items').parse(raw);

    // Assert
    expect(result.map((x) => x.id)).toEqual(['a', 'b', 'd', 'e']);
  });

  it('drops a null entry without throwing', () => {
    // Act
    const result = tolerantArray(item, 'items').parse([{ id: 'a', n: 1 }, null]);

    // Assert
    expect(result).toEqual([{ id: 'a', n: 1 }]);
  });

  it('reports each dropped item with where it was and its index', () => {
    // Arrange
    const dropped: string[] = [];
    setDropReporter((where, index) => dropped.push(`${where}[${index}]`));

    // Act
    tolerantArray(item, 'sections').parse([{ id: 'a', n: 1 }, { id: 'b' }]);

    // Assert
    expect(dropped).toEqual(['sections[1]']);
  });

  it('fails the whole parse when the value is not a list', () => {
    // Act
    const result = tolerantArray(item, 'items').safeParse({ id: 'a', n: 1 });

    // Assert
    expect(result.success).toBe(false);
  });
});

describe('openUnionArray', () => {
  const sections = openUnionArray(
    'kind',
    {
      grid: z.object({ kind: z.literal('grid'), id: z.string() }),
      banner: z.object({ kind: z.literal('banner'), id: z.string(), url: z.string() }),
    },
    'sections',
  );

  it('skips an unknown kind and keeps every known one', () => {
    // Arrange
    const raw = [
      { kind: 'grid', id: 'g' },
      { kind: 'carousel3d', id: 'x' },
      { kind: 'banner', id: 'b', url: 'https://x' },
    ];

    // Act
    const result = sections.parse(raw);

    // Assert
    expect(result.map((s) => s.id)).toEqual(['g', 'b']);
  });

  it('skips an unknown kind silently but reports a malformed known one', () => {
    // Arrange
    const dropped: string[] = [];
    setDropReporter((where, index) => dropped.push(`${where}[${index}]`));

    // Act
    sections.parse([{ kind: 'carousel3d', id: 'x' }, { kind: 'banner', id: 'b' }, null]);

    // Assert
    expect(dropped).toEqual(['sections[1]', 'sections[2]']);
  });
});

describe('openEnum', () => {
  it('maps an unknown value to its fallback and keeps a known one', () => {
    // Arrange
    const style = openEnum(['filled', 'outline'] as const, 'filled');

    // Act
    const results = ['outline', 'glass', undefined].map((v) => style.parse(v));

    // Assert
    expect(results).toEqual(['outline', 'filled', 'filled']);
  });

  it('reads a key the server left out as its fallback', () => {
    // Arrange
    const banner = z.object({ id: z.string(), style: openEnum(['filled', 'outline'] as const, 'filled') });

    // Act
    const result = banner.safeParse({ id: 'b' });

    // Assert
    expect(result).toEqual({ success: true, data: { id: 'b', style: 'filled' } });
  });

  it('maps an unknown value to undefined when no fallback is given', () => {
    // Act
    const result = openEnum(['a', 'b'] as const).parse('c');

    // Assert
    expect(result).toBeUndefined();
  });
});

describe('opt', () => {
  it('reads a server null, and a missing key, as absent', () => {
    // Arrange
    const schema = z.object({ title: opt(z.string()) });

    // Act
    const results = [schema.parse({ title: null }), schema.parse({}), schema.parse({ title: 'x' })];

    // Assert
    expect(results).toEqual([{ title: undefined }, {}, { title: 'x' }]);
  });
});

describe('text and optionalText', () => {
  it('text accepts a non-empty string and nothing else', () => {
    // Act
    const results = ['a', '', undefined, null, 3].map((v) => text.safeParse(v).success);

    // Assert
    expect(results).toEqual([true, false, false, false, false]);
  });

  it('optionalText reads an empty, missing or non-string value as absent', () => {
    // Arrange
    const schema = z.object({ title: optionalText });

    // Act
    const results = [{ title: 'x' }, { title: '' }, {}, { title: null }, { title: 4 }].map((v) => schema.parse(v).title);

    // Assert
    expect(results).toEqual(['x', undefined, undefined, undefined, undefined]);
  });
});

describe('parsedBy', () => {
  const half = (raw: unknown) => (typeof raw === 'number' ? raw / 2 : null);

  it('reads a field through a hand parser, and a null result fails the parse', () => {
    // Arrange
    const schema = z.object({ n: parsedBy(half) });

    // Act
    const results = [schema.safeParse({ n: 4 }), schema.safeParse({ n: 'x' })].map((r) => r.success && r.data.n);

    // Assert
    expect(results).toEqual([2, false]);
  });

  it('hands a key the server left out to the parser as undefined', () => {
    // Arrange
    const schema = z.object({ n: parsedBy((raw) => (raw === undefined ? 'absent' : 'present')) });

    // Act
    const result = schema.parse({});

    // Assert
    expect(result).toEqual({ n: 'absent' });
  });
});

describe('finiteNumber', () => {
  it('reads a number or a non-blank numeric string', () => {
    // Act
    const results = [12, '12', ' 3.5 ', '-4'].map((v) => finiteNumber.parse(v));

    // Assert
    expect(results).toEqual([12, 12, 3.5, -4]);
  });

  it('never reads null, an empty string or a boolean as zero', () => {
    // Act
    const results = [null, '', ' ', true, false, Infinity, Number.NaN, 'abc'].map(
      (v) => finiteNumber.safeParse(v).success,
    );

    // Assert
    expect(results).toEqual([false, false, false, false, false, false, false, false]);
  });
});

describe('parseOrThrow', () => {
  const layout = z.object({ sections: tolerantArray(item, 'sections') });

  it('returns the data of a usable response', () => {
    // Act
    const result = parseOrThrow(layout, { sections: [{ id: 'a', n: 1 }] }, 'GET /ui/home');

    // Assert
    expect(result).toEqual({ sections: [{ id: 'a', n: 1 }] });
  });

  it('throws, naming where, when the top-level list is missing', () => {
    // Act & Assert
    expect(() => parseOrThrow(layout, { version: 1 }, 'GET /ui/home')).toThrow(/GET \/ui\/home/);
  });
});
