import { describe, it, expect, beforeEach } from 'vitest';
import {
    loadRecipeCookSession,
    saveRecipeCookSession,
    parseDurationMinutes,
    formatTotalDuration,
} from './recipeCookSession';

describe('recipeCookSession', () => {
    beforeEach(() => {
        sessionStorage.clear();
    });

    it('persists ingredient and step checkmarks per recipe', () => {
        saveRecipeCookSession('r1', { ingredients: [0, 2], steps: [1] });
        expect(loadRecipeCookSession('r1')).toEqual({ ingredients: [0, 2], steps: [1] });
        expect(loadRecipeCookSession('r2')).toEqual({ ingredients: [], steps: [] });
    });

    it('parses common duration strings', () => {
        expect(parseDurationMinutes('15 min')).toBe(15);
        expect(parseDurationMinutes('1 hr 30 min')).toBe(90);
        expect(parseDurationMinutes('2 hours')).toBe(120);
        expect(parseDurationMinutes('')).toBeNull();
    });

    it('formats total duration for display', () => {
        expect(formatTotalDuration(45)).toBe('45 min');
        expect(formatTotalDuration(90)).toBe('1 hr 30 min');
    });
});
