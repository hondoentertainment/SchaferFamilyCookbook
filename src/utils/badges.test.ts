import { describe, it, expect } from 'vitest';
import { computeBadges, earnedBadges, type BadgeInputs } from './badges';

const ZERO: BadgeInputs = {
    recipesContributed: 0,
    galleryUploaded: 0,
    triviaCompletions: 0,
    longestStreak: 0,
};

function findBadge(badges: ReturnType<typeof computeBadges>, id: string) {
    const b = badges.find((x) => x.id === id);
    if (!b) throw new Error(`Badge "${id}" not found`);
    return b;
}

describe('computeBadges', () => {
    it('returns the full ordered list with zero inputs (all locked)', () => {
        const badges = computeBadges(ZERO);
        const ids = badges.map((b) => b.id);
        expect(ids).toEqual([
            'first_recipe',
            'five_recipes',
            'ten_recipes',
            'gallery_curator',
            'trivia_starter',
            'trivia_dedicated',
            'streak_3',
            'streak_7',
            'streak_30',
        ]);
        expect(badges.every((b) => !b.earned)).toBe(true);
        expect(badges.every((b) => typeof b.hint === 'string' && b.hint.length > 0)).toBe(true);
    });

    it('does not attach a hint to earned badges', () => {
        const badges = computeBadges({ ...ZERO, recipesContributed: 1 });
        const first = findBadge(badges, 'first_recipe');
        expect(first.earned).toBe(true);
        expect(first.hint).toBeUndefined();
    });

    describe('recipe badges', () => {
        it('earns first_recipe at 1 contribution', () => {
            expect(findBadge(computeBadges({ ...ZERO, recipesContributed: 0 }), 'first_recipe').earned).toBe(false);
            expect(findBadge(computeBadges({ ...ZERO, recipesContributed: 1 }), 'first_recipe').earned).toBe(true);
        });

        it('earns five_recipes at 5 contributions', () => {
            expect(findBadge(computeBadges({ ...ZERO, recipesContributed: 4 }), 'five_recipes').earned).toBe(false);
            expect(findBadge(computeBadges({ ...ZERO, recipesContributed: 5 }), 'five_recipes').earned).toBe(true);
        });

        it('earns ten_recipes at 10 contributions', () => {
            expect(findBadge(computeBadges({ ...ZERO, recipesContributed: 9 }), 'ten_recipes').earned).toBe(false);
            expect(findBadge(computeBadges({ ...ZERO, recipesContributed: 10 }), 'ten_recipes').earned).toBe(true);
        });
    });

    describe('gallery badges', () => {
        it('earns gallery_curator at 5 uploads', () => {
            expect(findBadge(computeBadges({ ...ZERO, galleryUploaded: 4 }), 'gallery_curator').earned).toBe(false);
            expect(findBadge(computeBadges({ ...ZERO, galleryUploaded: 5 }), 'gallery_curator').earned).toBe(true);
        });
    });

    describe('trivia badges', () => {
        it('earns trivia_starter at 1 completion', () => {
            expect(findBadge(computeBadges({ ...ZERO, triviaCompletions: 0 }), 'trivia_starter').earned).toBe(false);
            expect(findBadge(computeBadges({ ...ZERO, triviaCompletions: 1 }), 'trivia_starter').earned).toBe(true);
        });

        it('earns trivia_dedicated at 10 completions', () => {
            expect(findBadge(computeBadges({ ...ZERO, triviaCompletions: 9 }), 'trivia_dedicated').earned).toBe(false);
            expect(findBadge(computeBadges({ ...ZERO, triviaCompletions: 10 }), 'trivia_dedicated').earned).toBe(true);
        });
    });

    describe('streak badges', () => {
        it('earns streak_3 at longestStreak 3', () => {
            expect(findBadge(computeBadges({ ...ZERO, longestStreak: 2 }), 'streak_3').earned).toBe(false);
            expect(findBadge(computeBadges({ ...ZERO, longestStreak: 3 }), 'streak_3').earned).toBe(true);
        });

        it('earns streak_7 at longestStreak 7', () => {
            expect(findBadge(computeBadges({ ...ZERO, longestStreak: 6 }), 'streak_7').earned).toBe(false);
            expect(findBadge(computeBadges({ ...ZERO, longestStreak: 7 }), 'streak_7').earned).toBe(true);
        });

        it('earns streak_30 at longestStreak 30', () => {
            expect(findBadge(computeBadges({ ...ZERO, longestStreak: 29 }), 'streak_30').earned).toBe(false);
            expect(findBadge(computeBadges({ ...ZERO, longestStreak: 30 }), 'streak_30').earned).toBe(true);
        });

        it('hint surfaces current best streak', () => {
            const b = findBadge(computeBadges({ ...ZERO, longestStreak: 2 }), 'streak_7');
            expect(b.hint).toContain('2');
            expect(b.hint).toContain('7');
        });
    });

    it('treats negative or fractional inputs as zero / floors them', () => {
        const badges = computeBadges({
            recipesContributed: -3,
            galleryUploaded: 4.9,
            triviaCompletions: 1.2,
            longestStreak: -10,
        });
        expect(findBadge(badges, 'first_recipe').earned).toBe(false);
        expect(findBadge(badges, 'gallery_curator').earned).toBe(false); // 4.9 floors to 4
        expect(findBadge(badges, 'trivia_starter').earned).toBe(true); // 1.2 floors to 1
        expect(findBadge(badges, 'streak_3').earned).toBe(false);
    });

    it('all badges earned when thresholds are far exceeded', () => {
        const badges = computeBadges({
            recipesContributed: 100,
            galleryUploaded: 100,
            triviaCompletions: 100,
            longestStreak: 100,
        });
        expect(badges.every((b) => b.earned)).toBe(true);
    });
});

describe('earnedBadges', () => {
    it('returns only the earned ones', () => {
        const earned = earnedBadges({ ...ZERO, recipesContributed: 1, triviaCompletions: 1 });
        const ids = earned.map((b) => b.id).sort();
        expect(ids).toEqual(['first_recipe', 'trivia_starter']);
    });

    it('returns an empty array when nothing is earned', () => {
        expect(earnedBadges(ZERO)).toEqual([]);
    });
});
