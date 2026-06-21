/**
 * Lightweight, dependency-free fuzzy matching for recipe/ingredient search.
 *
 * The goal is forgiving search that tolerates small typos and word-order
 * differences without pulling in a search library. Matching is token based:
 * the query is split into words and every query token must match the target
 * (as a substring, a short-distance typo, or an in-order subsequence).
 */

/** Lowercase, strip accents, and collapse whitespace for stable comparisons. */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Classic Levenshtein edit distance with an early-exit ceiling. */
export function levenshtein(a: string, b: string, max = Infinity): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** True when every character of `needle` appears in order within `haystack`. */
function isSubsequence(haystack: string, needle: string): boolean {
  if (!needle) return true;
  let i = 0;
  for (let j = 0; j < haystack.length && i < needle.length; j++) {
    if (haystack[j] === needle[i]) i++;
  }
  return i === needle.length;
}

/** Typo tolerance scales with token length: longer words allow more edits. */
function allowedDistance(len: number): number {
  if (len <= 3) return 0;
  if (len <= 5) return 1;
  if (len <= 8) return 2;
  return 3;
}

/** Does a single query token fuzzily match anywhere in the target text? */
function tokenMatches(haystack: string, haystackWords: string[], token: string): boolean {
  if (!token) return true;
  if (haystack.includes(token)) return true;

  const max = allowedDistance(token.length);
  if (max > 0) {
    for (const word of haystackWords) {
      // Compare against whole words and same-length prefixes so a typo in a
      // long ingredient line ("cinnamn" → "cinnamon") still matches.
      if (levenshtein(word, token, max) <= max) return true;
      if (word.length > token.length && levenshtein(word.slice(0, token.length), token, max) <= max) {
        return true;
      }
    }
  }

  // Fall back to subsequence matching for run-together queries ("chicknsoup").
  return token.length >= 4 && isSubsequence(haystack, token);
}

/**
 * True when `query` fuzzily matches `target`. Every whitespace-separated query
 * token must match; an empty query always matches.
 */
export function fuzzyMatch(target: string, query: string): boolean {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return true;
  const haystack = normalizeText(target);
  if (!haystack) return false;

  const haystackWords = haystack.split(' ');
  const tokens = normalizedQuery.split(' ');
  return tokens.every((token) => tokenMatches(haystack, haystackWords, token));
}

/** Convenience matcher across several fields (title, ingredients, etc.). */
export function fuzzyMatchAny(targets: Array<string | undefined | null>, query: string): boolean {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return true;
  const combined = targets.filter(Boolean).join(' \n ');
  return fuzzyMatch(combined, query);
}
