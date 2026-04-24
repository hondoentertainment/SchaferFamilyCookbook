import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getTriviaScores, addTriviaScore } from './triviaScoreboard';
import type { TriviaScore } from '../types';

const STORAGE_KEY = 'schafer_trivia_scores';
const MAX_ENTRIES = 25;

describe('triviaScoreboard utility', () => {
    beforeEach(() => {
        const store = new Map<string, string>();
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => store.get(key) ?? null,
            setItem: (key: string, value: string) => { store.set(key, value); },
            removeItem: (key: string) => { store.delete(key); },
            clear: () => store.clear(),
            length: 0,
            key: () => null,
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    // -------------------------------------------------------------------------
    describe('getTriviaScores', () => {
        it('returns an empty array when nothing is stored', () => {
            expect(getTriviaScores()).toEqual([]);
        });

        it('parses and returns stored scores', () => {
            const scores: TriviaScore[] = [
                { id: 's1', playerName: 'Alice', score: 8, totalQuestions: 10, percentage: 80, timestamp: new Date().toISOString() },
                { id: 's2', playerName: 'Bob', score: 6, totalQuestions: 10, percentage: 60, timestamp: new Date().toISOString() },
            ];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
            const result = getTriviaScores();
            expect(result).toHaveLength(2);
            expect(result[0].playerName).toBe('Alice');
            expect(result[1].playerName).toBe('Bob');
        });

        it('returns an empty array for malformed JSON', () => {
            localStorage.setItem(STORAGE_KEY, 'not-valid-json{{{');
            expect(getTriviaScores()).toEqual([]);
        });

        it('returns an empty array when stored value is an empty JSON array', () => {
            localStorage.setItem(STORAGE_KEY, '[]');
            expect(getTriviaScores()).toEqual([]);
        });

        it('returns an empty array when stored value is not an array', () => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ playerName: 'Alice' }));
            expect(getTriviaScores()).toEqual([]);
        });
    });

    // -------------------------------------------------------------------------
    describe('addTriviaScore', () => {
        it('adds a new score entry and returns it with the scores list', () => {
            const entry = { playerName: 'Alice', score: 7, totalQuestions: 10, percentage: 70, timestamp: new Date().toISOString() };
            const { scores, newId } = addTriviaScore(entry);
            expect(scores).toHaveLength(1);
            expect(scores[0].playerName).toBe('Alice');
            expect(scores[0].score).toBe(7);
            expect(newId).toBeTruthy();
            expect(typeof newId).toBe('string');
        });

        it('assigns a unique id to each entry', () => {
            const entry = { playerName: 'Alice', score: 5, totalQuestions: 10, percentage: 50, timestamp: new Date().toISOString() };
            const { newId: id1 } = addTriviaScore(entry);
            const { newId: id2 } = addTriviaScore(entry);
            expect(id1).not.toBe(id2);
        });

        it('persists scores to localStorage', () => {
            const entry = { playerName: 'Bob', score: 9, totalQuestions: 10, percentage: 90, timestamp: new Date().toISOString() };
            addTriviaScore(entry);
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
            expect(stored).toHaveLength(1);
            expect(stored[0].playerName).toBe('Bob');
        });

        it('accumulates multiple entries', () => {
            addTriviaScore({ playerName: 'Alice', score: 7, totalQuestions: 10, percentage: 70, timestamp: new Date().toISOString() });
            const { scores } = addTriviaScore({ playerName: 'Bob', score: 8, totalQuestions: 10, percentage: 80, timestamp: new Date().toISOString() });
            expect(scores).toHaveLength(2);
        });

        it('sorts scores by percentage descending', () => {
            addTriviaScore({ playerName: 'Alice', score: 5, totalQuestions: 10, percentage: 50, timestamp: new Date().toISOString() });
            addTriviaScore({ playerName: 'Bob', score: 9, totalQuestions: 10, percentage: 90, timestamp: new Date().toISOString() });
            const { scores } = addTriviaScore({ playerName: 'Carol', score: 7, totalQuestions: 10, percentage: 70, timestamp: new Date().toISOString() });

            expect(scores[0].playerName).toBe('Bob');
            expect(scores[0].percentage).toBe(90);
            expect(scores[1].playerName).toBe('Carol');
            expect(scores[1].percentage).toBe(70);
            expect(scores[2].playerName).toBe('Alice');
            expect(scores[2].percentage).toBe(50);
        });

        it('breaks percentage ties by most recent timestamp first', () => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2026-01-01T10:00:00.000Z'));
            addTriviaScore({ playerName: 'Alice', score: 8, totalQuestions: 10, percentage: 80, timestamp: new Date().toISOString() });

            vi.setSystemTime(new Date('2026-01-02T10:00:00.000Z'));
            const { scores } = addTriviaScore({ playerName: 'Bob', score: 8, totalQuestions: 10, percentage: 80, timestamp: new Date().toISOString() });

            // Bob's entry is newer so it should appear first among the tied entries
            expect(scores[0].playerName).toBe('Bob');
            expect(scores[1].playerName).toBe('Alice');
        });

        it('caps the stored list at MAX_ENTRIES (25)', () => {
            for (let i = 0; i < MAX_ENTRIES; i++) {
                addTriviaScore({
                    playerName: `Player${i}`,
                    score: i % 10,
                    totalQuestions: 10,
                    percentage: (i % 10) * 10,
                    timestamp: new Date().toISOString(),
                });
            }
            // Add one more to exceed the cap
            const { scores } = addTriviaScore({
                playerName: 'OverflowPlayer',
                score: 0,
                totalQuestions: 10,
                percentage: 0,
                timestamp: new Date().toISOString(),
            });
            expect(scores).toHaveLength(MAX_ENTRIES);

            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
            expect(stored).toHaveLength(MAX_ENTRIES);
        });

        it('the returned newId corresponds to the entry in scores', () => {
            const entry = { playerName: 'Dave', score: 10, totalQuestions: 10, percentage: 100, timestamp: new Date().toISOString() };
            const { scores, newId } = addTriviaScore(entry);
            const found = scores.find((s) => s.id === newId);
            expect(found).toBeDefined();
            expect(found?.playerName).toBe('Dave');
        });

        it('handles a perfect score (100%)', () => {
            const { scores } = addTriviaScore({ playerName: 'Perfect', score: 10, totalQuestions: 10, percentage: 100, timestamp: new Date().toISOString() });
            expect(scores[0].percentage).toBe(100);
        });

        it('handles a zero score (0%)', () => {
            const { scores } = addTriviaScore({ playerName: 'Zero', score: 0, totalQuestions: 10, percentage: 0, timestamp: new Date().toISOString() });
            expect(scores[0].percentage).toBe(0);
        });

        it('preserves all fields from the entry', () => {
            const ts = '2026-04-01T12:00:00.000Z';
            const { scores, newId } = addTriviaScore({ playerName: 'Alice', score: 7, totalQuestions: 10, percentage: 70, timestamp: ts });
            const entry = scores.find((s) => s.id === newId)!;
            expect(entry.playerName).toBe('Alice');
            expect(entry.score).toBe(7);
            expect(entry.totalQuestions).toBe(10);
            expect(entry.percentage).toBe(70);
            expect(entry.timestamp).toBe(ts);
        });

        it('when cap is reached, the lowest-scoring entry is dropped', () => {
            // Fill with 25 entries all at 80%
            for (let i = 0; i < MAX_ENTRIES; i++) {
                addTriviaScore({
                    playerName: `Mid${i}`,
                    score: 8,
                    totalQuestions: 10,
                    percentage: 80,
                    timestamp: new Date().toISOString(),
                });
            }
            // Now add a 0% entry — it should get trimmed off the end
            const { scores } = addTriviaScore({
                playerName: 'LastPlace',
                score: 0,
                totalQuestions: 10,
                percentage: 0,
                timestamp: new Date().toISOString(),
            });
            expect(scores).toHaveLength(MAX_ENTRIES);
            expect(scores.some((s) => s.playerName === 'LastPlace')).toBe(false);
        });
    });
});
