import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { FeaturedRecipes } from './FeaturedRecipes';
import { renderWithProviders, createMockRecipe, setupLocalStorage } from '../test/utils';
import * as featuredService from '../services/featured';

describe('FeaturedRecipes', () => {
    beforeEach(() => {
        setupLocalStorage();
        localStorage.clear();
        vi.clearAllMocks();
    });

    it('renders nothing when there are no featured ids', async () => {
        vi.spyOn(featuredService, 'getFeaturedIds').mockResolvedValueOnce([]);
        const recipes = [createMockRecipe({ id: 'r1', title: 'Apple Pie' })];
        const { container } = renderWithProviders(
            <FeaturedRecipes recipes={recipes} onSelect={vi.fn()} />
        );
        // Wait for effect to resolve.
        await waitFor(() => {
            expect(container.querySelector('[data-testid="featured-recipes"]')).toBeNull();
        });
    });

    it('renders featured recipes when ids match', async () => {
        vi.spyOn(featuredService, 'getFeaturedIds').mockResolvedValueOnce(['r1', 'r2']);
        const recipes = [
            createMockRecipe({ id: 'r1', title: 'Apple Pie' }),
            createMockRecipe({ id: 'r2', title: 'Banana Bread' }),
            createMockRecipe({ id: 'r3', title: 'Carrot Cake' }),
        ];
        renderWithProviders(<FeaturedRecipes recipes={recipes} onSelect={vi.fn()} />);

        await screen.findByText('Apple Pie');
        expect(screen.getByText('Banana Bread')).toBeInTheDocument();
        expect(screen.queryByText('Carrot Cake')).not.toBeInTheDocument();
        expect(screen.getByTestId('featured-recipes')).toBeInTheDocument();
    });

    it('skips featured ids that do not resolve to known recipes', async () => {
        vi.spyOn(featuredService, 'getFeaturedIds').mockResolvedValueOnce(['missing', 'r1']);
        const recipes = [createMockRecipe({ id: 'r1', title: 'Apple Pie' })];
        renderWithProviders(<FeaturedRecipes recipes={recipes} onSelect={vi.fn()} />);

        await screen.findByText('Apple Pie');
        // Only one button should be rendered.
        expect(screen.getAllByRole('button').length).toBe(1);
    });

    it('renders nothing when featured ids all miss', async () => {
        vi.spyOn(featuredService, 'getFeaturedIds').mockResolvedValueOnce(['missing1', 'missing2']);
        const recipes = [createMockRecipe({ id: 'r1', title: 'Apple Pie' })];
        const { container } = renderWithProviders(
            <FeaturedRecipes recipes={recipes} onSelect={vi.fn()} />
        );
        await waitFor(() => {
            expect(container.querySelector('[data-testid="featured-recipes"]')).toBeNull();
        });
    });

    it('calls onSelect when a featured recipe is clicked', async () => {
        vi.spyOn(featuredService, 'getFeaturedIds').mockResolvedValueOnce(['r1']);
        const recipe = createMockRecipe({ id: 'r1', title: 'Apple Pie' });
        const onSelect = vi.fn();
        renderWithProviders(<FeaturedRecipes recipes={[recipe]} onSelect={onSelect} />);

        const btn = await screen.findByRole('button', { name: /View featured recipe: Apple Pie/i });
        fireEvent.click(btn);
        expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }));
    });
});
