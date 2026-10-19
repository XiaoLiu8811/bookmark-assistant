import { describe, expect, it } from 'vitest';
import { extractDescription, MAX_DESCRIPTION } from '../src/describe';

describe('extractDescription', () => {
  it('reads the standard description tag', () => {
    expect(extractDescription('<head><meta name="description" content="Everything about flexbox."></head>')).toBe(
      'Everything about flexbox.',
    );
  });

  it('prefers the link-preview (og) summary, in any attribute order and quoting', () => {
    const html = `<meta content='Short.' name=description><meta content="The preview text." property="og:description">`;
    expect(extractDescription(html)).toBe('The preview text.');
  });

  it('decodes entities and tidies whitespace', () => {
    expect(extractDescription('<meta name="description" content="Tips &amp; tricks\n   for &quot;CSS&quot; &#8212; fast">')).toBe(
      'Tips & tricks for "CSS" — fast',
    );
  });

  it('returns nothing when the page has no summary', () => {
    expect(extractDescription('<html><head><title>Hi</title><meta charset="utf-8"></head></html>')).toBe('');
    expect(extractDescription('<meta name="description" content="   ">')).toBe('');
  });

  it(`shortens anything over ${MAX_DESCRIPTION} characters`, () => {
    const text = extractDescription(`<meta name="description" content="${'word '.repeat(100)}">`);
    expect(text.length).toBeLessThanOrEqual(MAX_DESCRIPTION);
    expect(text.endsWith('…')).toBe(true);
  });
});
