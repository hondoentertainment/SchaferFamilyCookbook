import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { ContributorSpotlight } from './ContributorSpotlight';
import { renderWithProviders, createMockRecipe, createMockContributor } from '../test/utils';
import type { RecipeNote } from '../types';

vi.mock('../utils/ratings', () => ({
    getAverageRating: vi.fn(() => 0),
    getNotesForRecipe: vi.fn(() => [] as RecipeNote[]),
}));

import * as ratings from '../utils/ratings';

const contributor = createMockContributor({ name: 'Grandma Rose' });
const recipes = [
    createMockRecipe({ id: 'r1', title: 'Sunday Rolls', contributor: 'Grandma Rose' }),
    createMockRecipe({ id: 'r2', title: 'Peach Pie', contributor: 'Grandma Rose', category: 'Dessert' }),
    createMockRecipe({ id: 'r3', title: 'Someone Else Soup', contributor: 'Uncle Joe' }),
];

const makeNote = (overrides: Partial<RecipeNote> = {}): RecipeNote => ({
    id: 'n1',
    recipeId: 'r1',
    userName: 'Alice',
    text: 'She always doubled the butter.',
    timestamp: '2026-07-01T00:00:00.000Z',
    ...overrides,
});

describe('ContributorSpotlight', () => {
    const onViewRecipe = vi.fn();
    const onClose = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (ratings.getAverageRating as ReturnType<typeof vi.fn>).mockReturnValue(0);
        (ratings.getNotesForRecipe as ReturnType<typeof vi.fn>).mockReturnValue([]);
    });

    it("renders the contributor's name, avatar, and only their recipes", () => {
        renderWithProviders(
            <ContributorSpotlight contributor={contributor} recipes={recipes} onViewRecipe={onViewRecipe} onClose={onClose} />
        );
        expect(screen.getByTestId('contributor-spotlight')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Grandma Rose' })).toBeInTheDocument();
        expect(screen.getByText('2 recipes')).toBeInTheDocument();
        expect(screen.getByText('Sunday Rolls')).toBeInTheDocument();
        expect(screen.getByText('Peach Pie')).toBeInTheDocument();
        expect(screen.queryByText('Someone Else Soup')).not.toBeInTheDocument();
    });

    it('opens a recipe when clicked', () => {
        renderWithProviders(
            <ContributorSpotlight contributor={contributor} recipes={recipes} onViewRecipe={onViewRecipe} onClose={onClose} />
        );
        fireEvent.click(screen.getByText('Sunday Rolls'));
        expect(onViewRecipe).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }));
    });

    it('shows family memories from notes on their recipes, newest first, capped at 4', () => {
        (ratings.getNotesForRecipe as ReturnType<typeof vi.fn>).mockImplementation((recipeId: string) =>
            recipeId === 'r1'
                ? [
                      makeNote({ id: 'old', text: 'Old memory', timestamp: '2026-01-01T00:00:00.000Z' }),
                      makeNote({ id: 'new', text: 'New memory', timestamp: '2026-07-01T00:00:00.000Z' }),
                      makeNote({ id: 'm3', text: 'Memory three', timestamp: '2026-03-01T00:00:00.000Z' }),
                      makeNote({ id: 'm4', text: 'Memory four', timestamp: '2026-04-01T00:00:00.000Z' }),
                      makeNote({ id: 'm5', text: 'Memory five', timestamp: '2026-05-01T00:00:00.000Z' }),
                  ]
                : []
        );

        renderWithProviders(
            <ContributorSpotlight
                contributor={contributor}
                recipes={recipes}
                currentUserName="Harriet"
                onViewRecipe={onViewRecipe}
                onClose={onClose}
            />
        );
        const memories = screen.getByTestId('contributor-spotlight-memories');
        expect(memories).toHaveTextContent('Family Memories');
        expect(memories).toHaveTextContent('New memory');
        // 5 notes exist; the oldest is dropped by the cap of 4.
        expect(memories).not.toHaveTextContent('Old memory');
        expect(memories).toHaveTextContent('Alice · on Sunday Rolls');
        expect(ratings.getNotesForRecipe).toHaveBeenCalledWith('r1', 'Harriet');
        expect(ratings.getNotesForRecipe).toHaveBeenCalledWith('r2', 'Harriet');
    });

    it('hides the memories section when there are no notes', () => {
        renderWithProviders(
            <ContributorSpotlight contributor={contributor} recipes={recipes} onViewRecipe={onViewRecipe} onClose={onClose} />
        );
        expect(screen.queryByTestId('contributor-spotlight-memories')).not.toBeInTheDocument();
    });

    it('clicking a memory opens its recipe', () => {
        (ratings.getNotesForRecipe as ReturnType<typeof vi.fn>).mockImplementation((recipeId: string) =>
            recipeId === 'r2' ? [makeNote({ id: 'pie', recipeId: 'r2', text: 'Best pie ever' })] : []
        );
        renderWithProviders(
            <ContributorSpotlight contributor={contributor} recipes={recipes} onViewRecipe={onViewRecipe} onClose={onClose} />
        );
        fireEvent.click(screen.getByText(/Best pie ever/));
        expect(onViewRecipe).toHaveBeenCalledWith(expect.objectContaining({ id: 'r2' }));
    });

    it('calls onClose from the close button', () => {
        renderWithProviders(
            <ContributorSpotlight contributor={contributor} recipes={recipes} onViewRecipe={onViewRecipe} onClose={onClose} />
        );
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(onClose).toHaveBeenCalled();
    });
});
