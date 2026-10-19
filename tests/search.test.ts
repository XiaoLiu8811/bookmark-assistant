import { describe, expect, it } from 'vitest';
import { buildIndex, flattenTree, MAX_RESULTS, search } from '../src/search';
import { sampleTree } from './fixtures/bookmarks';

const index = buildIndex(flattenTree(sampleTree()));
const titles = (query: string) => search(index, query).map((m) => m.title);

describe('flattenTree', () => {
  it('keeps the folder path but drops Chrome’s built-in folders', () => {
    const flexbox = flattenTree(sampleTree()).find((b) => b.title.includes('Flexbox'));
    expect(flexbox?.folders).toEqual(['Dev', 'CSS', 'Layout']);
  });
});

describe('search', () => {
  it('finds a bookmark by its title', () => {
    expect(titles('flexbox guide')[0]).toBe('A Complete Guide to Flexbox');
  });

  it('finds a bookmark by its folder name when the title says nothing', () => {
    expect(titles('recipes')).toEqual(['Grandma’s Sunday dinner']);
  });

  it('finds a bookmark by a word in its URL', () => {
    expect(titles('kyoto itinerary')[0]).toBe('Kyoto in three days');
  });

  it('ranks a plain-language question’s answer in the top 3', () => {
    expect(titles('how to center a div')).toContain('Centering in CSS: A Complete Guide');
  });

  it('tolerates a typo', () => {
    expect(titles('flexbx')).toContain('A Complete Guide to Flexbox');
  });

  it('returns nothing for an unrelated search, so no panel shows', () => {
    expect(titles('weather tomorrow')).toEqual([]);
  });

  it('returns nothing when the query is only common words', () => {
    expect(titles('how to do it')).toEqual([]);
  });

  it('does not match on one shared word out of several', () => {
    expect(titles('complete history of rome')).toEqual([]);
  });

  it(`returns at most ${MAX_RESULTS} results`, () => {
    expect(titles('css').length).toBeLessThanOrEqual(MAX_RESULTS);
    expect(titles('example').length).toBe(MAX_RESULTS);
  });

  it('indexes and searches 5,000 bookmarks well within 200 ms', () => {
    const many = Array.from({ length: 5000 }, (_, i) => ({
      id: String(i),
      title: `Saved page ${i} about topic${i % 300}`,
      url: `https://site${i % 700}.example.com/post/${i}`,
      folders: [`Folder${i % 40}`, `Sub${i % 9}`],
    }));
    const t0 = performance.now();
    const big = buildIndex(many);
    search(big, 'topic42 folder7');
    expect(performance.now() - t0).toBeLessThan(200);
  });
});
