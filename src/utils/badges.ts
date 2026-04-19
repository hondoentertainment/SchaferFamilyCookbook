/**
 * Pure derivation of contribution / engagement badges from caller-supplied
 * counts. No persistence — feed in totals and get back a stable badge list
 * with `earned` flags. Locked badges include a `hint` to surface progress.
 */

import type { UserProfile } from '../types';

export interface Badge {
    id: string;
    label: string;
    emoji: string;
    earned: boolean;
    hint?: string;
}

export interface BadgeInputs {
    recipesContributed: number;
    galleryUploaded: number;
    triviaCompletions: number;
    longestStreak: number;
    currentUser?: UserProfile | null;
}

interface BadgeRule {
    id: string;
    label: string;
    emoji: string;
    /** Returns true if the badge has been earned given the inputs. */
    earned: (i: BadgeInputs) => boolean;
    /** Hint shown while still locked (progress nudge). */
    hint: (i: BadgeInputs) => string;
}

const RULES: BadgeRule[] = [
    {
        id: 'first_recipe',
        label: 'First Recipe',
        emoji: '📖',
        earned: (i) => i.recipesContributed >= 1,
        hint: () => 'Share your first recipe to earn this badge.',
    },
    {
        id: 'five_recipes',
        label: 'Five Recipes',
        emoji: '🥄',
        earned: (i) => i.recipesContributed >= 5,
        hint: (i) => `Share ${Math.max(0, 5 - i.recipesContributed)} more recipe(s) to unlock.`,
    },
    {
        id: 'ten_recipes',
        label: 'Ten Recipes',
        emoji: '🏅',
        earned: (i) => i.recipesContributed >= 10,
        hint: (i) => `Share ${Math.max(0, 10 - i.recipesContributed)} more recipe(s) to unlock.`,
    },
    {
        id: 'gallery_curator',
        label: 'Gallery Curator',
        emoji: '🖼️',
        earned: (i) => i.galleryUploaded >= 5,
        hint: (i) => `Upload ${Math.max(0, 5 - i.galleryUploaded)} more memory(ies) to unlock.`,
    },
    {
        id: 'trivia_starter',
        label: 'Trivia Starter',
        emoji: '🎓',
        earned: (i) => i.triviaCompletions >= 1,
        hint: () => 'Complete a quiz to earn this badge.',
    },
    {
        id: 'trivia_dedicated',
        label: 'Trivia Dedicated',
        emoji: '🧠',
        earned: (i) => i.triviaCompletions >= 10,
        hint: (i) => `Complete ${Math.max(0, 10 - i.triviaCompletions)} more quiz(zes) to unlock.`,
    },
    {
        id: 'streak_3',
        label: '3-Day Streak',
        emoji: '🔥',
        earned: (i) => i.longestStreak >= 3,
        hint: (i) => `Reach a ${3}-day quiz streak (best so far: ${i.longestStreak}).`,
    },
    {
        id: 'streak_7',
        label: '7-Day Streak',
        emoji: '🔥',
        earned: (i) => i.longestStreak >= 7,
        hint: (i) => `Reach a ${7}-day quiz streak (best so far: ${i.longestStreak}).`,
    },
    {
        id: 'streak_30',
        label: '30-Day Streak',
        emoji: '🏆',
        earned: (i) => i.longestStreak >= 30,
        hint: (i) => `Reach a ${30}-day quiz streak (best so far: ${i.longestStreak}).`,
    },
];

function sanitize(inputs: BadgeInputs): BadgeInputs {
    return {
        recipesContributed: Math.max(0, Math.floor(inputs.recipesContributed || 0)),
        galleryUploaded: Math.max(0, Math.floor(inputs.galleryUploaded || 0)),
        triviaCompletions: Math.max(0, Math.floor(inputs.triviaCompletions || 0)),
        longestStreak: Math.max(0, Math.floor(inputs.longestStreak || 0)),
        currentUser: inputs.currentUser ?? null,
    };
}

/**
 * Compute the full ordered badge list for the given user inputs.
 * Returned in fixed order so UIs can render deterministically.
 */
export function computeBadges(inputs: BadgeInputs): Badge[] {
    const safe = sanitize(inputs);
    return RULES.map((rule) => {
        const earned = rule.earned(safe);
        const badge: Badge = {
            id: rule.id,
            label: rule.label,
            emoji: rule.emoji,
            earned,
        };
        if (!earned) {
            badge.hint = rule.hint(safe);
        }
        return badge;
    });
}

/** Convenience: only the badges the user has earned. */
export function earnedBadges(inputs: BadgeInputs): Badge[] {
    return computeBadges(inputs).filter((b) => b.earned);
}
