/**
 * What the link preview reads out of a page's HTML: its meta tags and its
 * title. The HTML comes from whatever host a notice links to, so it is
 * untrusted, and reading it must stay linear in its length.
 */
import { describe, expect, it } from 'vitest';
import { readMetaTags, readTitle } from './link-preview.rules';

describe('readMetaTags', () => {
  it('reads a property or a name whichever order its content comes in', () => {
    // Arrange
    const html = [
      '<head>',
      '<meta property="og:title" content="Forward">',
      "<meta content='Backward' name='og:site_name' />",
      '<META NAME="twitter:image" CONTENT="/a.png">',
      '</head>',
    ].join('\n');

    // Act
    const meta = readMetaTags(html);

    // Assert
    expect(meta.get('og:title')).toBe('Forward');
    expect(meta.get('og:site_name')).toBe('Backward');
    expect(meta.get('twitter:image')).toBe('/a.png');
  });

  it('keeps the first non-empty content and decodes its entities', () => {
    // Arrange
    const html = [
      '<meta property="og:title" content="">',
      '<meta property="og:title" content=" Tom &amp; Jerry&#39;s &quot;Day&quot; ">',
      '<meta property="og:title" content="Later">',
    ].join('');

    // Act
    const title = readMetaTags(html).get('og:title');

    // Assert
    expect(title).toBe('Tom & Jerry\'s "Day"');
  });

  it('skips an unterminated tag', () => {
    // Act
    const meta = readMetaTags('<meta property="og:title" content="Cut');

    // Assert
    expect(meta.size).toBe(0);
  });

  it('reads a hostile page of unterminated meta tags in linear time', () => {
    // Arrange: the shape that made the old pattern backtrack for minutes.
    const html = "<meta name='og:title' ".repeat(5_500);

    // Act
    const started = performance.now();
    const meta = readMetaTags(html);
    const elapsed = performance.now() - started;

    // Assert
    expect(meta.size).toBe(0);
    expect(elapsed).toBeLessThan(500);
  });

  it('reads a hostile page of long attribute names in linear time', () => {
    // Arrange: closed tags at the length cap, each one name with no `=`.
    const html = `<meta ${'a'.repeat(2_000)}>`.repeat(60);

    // Act
    const started = performance.now();
    const meta = readMetaTags(html);
    const elapsed = performance.now() - started;

    // Assert
    expect(meta.size).toBe(0);
    expect(elapsed).toBeLessThan(500);
  });
});

describe('readTitle', () => {
  it('reads the first title, decoded', () => {
    // Act
    const title = readTitle('<head><TITLE lang="ko">A &lt;B&gt;</TITLE><title>Second</title></head>');

    // Assert
    expect(title).toBe('A <B>');
  });

  it('returns null without a closed title', () => {
    // Act
    const title = readTitle('<title>Never closed');

    // Assert
    expect(title).toBeNull();
  });

  it('reads a hostile page of unclosed titles in linear time', () => {
    // Arrange
    const html = '<title>'.repeat(17_000);

    // Act
    const started = performance.now();
    const title = readTitle(html);
    const elapsed = performance.now() - started;

    // Assert
    expect(title).toBeNull();
    expect(elapsed).toBeLessThan(500);
  });
});
