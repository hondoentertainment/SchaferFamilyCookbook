import { describe, expect, it } from 'vitest';
import type { StorySection } from '../types';
import { storySectionsDiffer } from './storySections';

const section = (heading: string, body: string, order = 0): StorySection => ({
    id: `s-${order}`,
    heading,
    body,
    order,
});

describe('storySectionsDiffer', () => {
    it('returns false for identical sections', () => {
        const a = [section('Intro', 'Hello', 0), section('Part 2', 'More', 1)];
        const b = [section('Intro', 'Hello', 0), section('Part 2', 'More', 1)];
        expect(storySectionsDiffer(a, b)).toBe(false);
    });

    it('returns true when body text changes', () => {
        const published = [section('Intro', 'Hello', 0)];
        const draft = [section('Intro', 'Hello world', 0)];
        expect(storySectionsDiffer(draft, published)).toBe(true);
    });

    it('ignores whitespace-only differences', () => {
        const published = [section('Intro', 'Hello', 0)];
        const draft = [section(' Intro ', ' Hello ', 0)];
        expect(storySectionsDiffer(draft, published)).toBe(false);
    });
});
