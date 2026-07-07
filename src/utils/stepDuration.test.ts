import { describe, it, expect } from 'vitest';
import { getStepMinutes, formatTimer } from './stepDuration';

describe('getStepMinutes', () => {
    it('parses a simple minutes duration', () => {
        expect(getStepMinutes('Bake for 30 minutes')).toBe(30);
    });

    it('parses abbreviated mins', () => {
        expect(getStepMinutes('Simmer 10 mins, stirring')).toBe(10);
    });

    it('parses singular minute', () => {
        expect(getStepMinutes('Rest 1 minute before serving')).toBe(1);
    });

    it('uses the lower bound of a hyphenated range', () => {
        expect(getStepMinutes('Roast 25-30 minutes until golden')).toBe(25);
    });

    it('uses the lower bound of an en-dash range', () => {
        expect(getStepMinutes('Roast 25–30 minutes until golden')).toBe(25);
    });

    it('uses the lower bound of a "to" range', () => {
        expect(getStepMinutes('Boil 8 to 10 minutes')).toBe(8);
    });

    it('returns null when there is no duration', () => {
        expect(getStepMinutes('Mix the dry ingredients')).toBeNull();
    });

    it('returns null for zero minutes', () => {
        expect(getStepMinutes('Wait 0 minutes')).toBeNull();
    });

    it('returns null for null/undefined/empty input', () => {
        expect(getStepMinutes(null)).toBeNull();
        expect(getStepMinutes(undefined)).toBeNull();
        expect(getStepMinutes('')).toBeNull();
    });
});

describe('formatTimer', () => {
    it('formats zero', () => {
        expect(formatTimer(0)).toBe('0:00');
    });

    it('formats under a minute', () => {
        expect(formatTimer(9)).toBe('0:09');
    });

    it('formats minutes and seconds', () => {
        expect(formatTimer(90)).toBe('1:30');
    });

    it('formats long durations', () => {
        expect(formatTimer(3600)).toBe('60:00');
    });
});
