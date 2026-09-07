import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import { HomeView } from './HomeView';
import { renderWithProviders, createMockRecipe, createMockContributor } from '../test/utils';
import { addToMealPlan, toDateKey } from '../utils/mealPlan';

vi.mock('../utils/haptics', () => ({ hapticLight: vi.fn() }));

describe('HomeView meal-plan refresh', () => {
    const contributor = createMockContributor({ name: 'Alice' });
    const recipe = createMockRecipe({ id: 'tonight-1', title: 'Tonight Stew' });

    const defaultProps = {
        currentUser: {
            id: contributor.id,
            name: contributor.name,
            picture: contributor.avatar,
            role: contributor.role,
        },
        recipes: [recipe],
        favoriteRecipes: [],
        recentlyViewedRecipes: [],
        contributors: [contributor],
        onSelectRecipe: vi.fn(),
        onStartCook: vi.fn(),
        onSetTab: vi.fn(),
        onSelectCategory: vi.fn(),
        onSelectContributor: vi.fn(),
        onOpenMealPlan: vi.fn(),
        isFavorite: () => false,
        onToggleFavorite: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        const store = new Map<string, string>();
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => store.get(key) ?? null,
            setItem: (key: string, value: string) => {
                store.set(key, value);
            },
            removeItem: (key: string) => {
                store.delete(key);
            },
            clear: () => store.clear(),
            length: 0,
            key: () => null,
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('replaces the tonight-empty card after a meal-plan write while Home stays mounted', async () => {
        renderWithProviders(<HomeView {...defaultProps} />);

        expect(await screen.findByTestId('home-tonight-empty')).toBeInTheDocument();
        expect(screen.queryByTestId('home-tonight-plan')).not.toBeInTheDocument();

        act(() => {
            addToMealPlan(toDateKey(new Date()), recipe.id);
        });

        await waitFor(() => {
            expect(screen.queryByTestId('home-tonight-empty')).not.toBeInTheDocument();
            expect(screen.getByTestId('home-tonight-plan')).toBeInTheDocument();
        });
        expect(screen.getByTestId('home-tonight-plan')).toHaveTextContent('Tonight Stew');
    });
});
