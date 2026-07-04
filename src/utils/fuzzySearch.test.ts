import { describe, it, expect } from 'vitest';
import { fuzzyMatch, fuzzyMatchAny, levenshtein, normalizeText } from './fuzzySearch';

describe('normalizeText', () => {
  it('lowercases, trims, and collapses whitespace', () => {
    expect(normalizeText('  Hello   World  ')).toBe('hello world');
  });

  it('strips diacritics', () => {
    expect(normalizeText('Crème Brûlée')).toBe('creme brulee');
  });
});

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('soup', 'soup')).toBe(0);
  });

  it('counts single-character edits', () => {
    expect(levenshtein('soup', 'soap')).toBe(1);
    expect(levenshtein('chicken', 'chickn')).toBe(1);
  });

  it('respects the early-exit ceiling', () => {
    expect(levenshtein('abcdef', 'uvwxyz', 2)).toBeGreaterThan(2);
  });
});

describe('fuzzyMatch', () => {
  it('matches exact substrings', () => {
    expect(fuzzyMatch('Grandma Chicken Soup', 'chicken')).toBe(true);
  });

  it('matches regardless of word order', () => {
    expect(fuzzyMatch('Chicken Noodle Soup', 'soup chicken')).toBe(true);
  });

  it('tolerates small typos in longer words', () => {
    expect(fuzzyMatch('Cinnamon Rolls', 'cinnamn')).toBe(true);
    expect(fuzzyMatch('Spaghetti Bolognese', 'spagetti')).toBe(true);
  });

  it('matches run-together queries via subsequence', () => {
    expect(fuzzyMatch('Chicken Soup', 'chicknsoup')).toBe(true);
  });

  it('does not match unrelated text', () => {
    expect(fuzzyMatch('Apple Pie', 'lasagna')).toBe(false);
  });

  it('treats an empty query as a match', () => {
    expect(fuzzyMatch('anything', '   ')).toBe(true);
  });

  it('requires every token to match', () => {
    expect(fuzzyMatch('Chicken Soup', 'chicken lasagna')).toBe(false);
  });
});

describe('fuzzyMatchAny', () => {
  it('matches when any field contains the query', () => {
    expect(
      fuzzyMatchAny(['Beef Stew', 'beef, carrots, potatoes', 'Aunt May'], 'carrots'),
    ).toBe(true);
  });

  it('matches a contributor name', () => {
    expect(fuzzyMatchAny(['Beef Stew', 'beef', 'Aunt May'], 'aunt')).toBe(true);
  });

  it('returns false when nothing matches', () => {
    expect(fuzzyMatchAny(['Beef Stew', 'beef'], 'chocolate')).toBe(false);
  });
});
