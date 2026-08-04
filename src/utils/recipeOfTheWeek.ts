import type { Recipe } from '../types';
import {
    isoWeekKey as isoWeekKeyShared,
    recipeOfTheWeek as recipeOfTheWeekShared,
} from '../../shared/recipeOfTheWeek.mjs';

/**
 * Typed front for the shared implementation in shared/recipeOfTheWeek.mjs,
 * which the weekly-push cron (api/recipe-of-the-week.ts) also uses — keeping
 * the Home card and the push notification on the same pick.
 */
export function isoWeekKey(date: Date): string {
    return isoWeekKeyShared(date);
}

export function recipeOfTheWeek(recipes: Recipe[], date: Date = new Date()): Recipe | null {
    return (recipeOfTheWeekShared(recipes, date) as Recipe | null) ?? null;
}
