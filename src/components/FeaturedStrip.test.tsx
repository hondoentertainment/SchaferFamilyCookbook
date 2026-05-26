import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FeaturedStrip } from './FeaturedStrip';
import { createMockRecipe } from '../test/utils';

describe('FeaturedStrip', () => {
    it('renders nothing when no recipes are featured', () => {
        const onSelect = vi.fn();
        const { container } = render(
            <FeaturedStrip
                recipes={[
                    createMockRecipe({ id: 'a', title: 'Apple' }),
                    createMockRecipe({ id: 'b', title: 'Banana', featured: false }),
                ]}
                onSelect={onSelect}
            />,
        );
        expect(container.firstChild).toBeNull();
        expect(screen.queryByTestId('featured-strip')).not.toBeInTheDocument();
    });

    it('renders the strip when at least one recipe is featured', () => {
        const onSelect = vi.fn();
        render(
            <FeaturedStrip
                recipes={[
                    createMockRecipe({ id: 'a', title: 'Apple Pie', featured: true }),
                    createMockRecipe({ id: 'b', title: 'Banana Bread' }),
                ]}
                onSelect={onSelect}
            />,
        );
        expect(screen.getByTestId('featured-strip')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Open featured recipe: Apple Pie/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Open featured recipe: Banana Bread/i })).not.toBeInTheDocument();
    });

    it('calls onSelect with the recipe when a featured card is clicked', () => {
        const onSelect = vi.fn();
        const recipe = createMockRecipe({ id: 'feat-1', title: 'Featured Cake', featured: true });
        render(<FeaturedStrip recipes={[recipe]} onSelect={onSelect} />);

        fireEvent.click(screen.getByRole('button', { name: /Open featured recipe: Featured Cake/i }));

        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'feat-1', title: 'Featured Cake' }));
    });

    it('renders up to MAX_FEATURED_RECIPES (6) recipes', () => {
        const recipes = Array.from({ length: 10 }, (_, i) =>
            createMockRecipe({
                id: `r${i}`,
                title: `Featured ${i}`,
                featured: true,
                created_at: `2024-0${(i % 9) + 1}-01T00:00:00Z`,
            }),
        );
        render(<FeaturedStrip recipes={recipes} onSelect={vi.fn()} />);
        const cards = screen.getAllByTestId('featured-strip-card');
        expect(cards).toHaveLength(6);
    });

    it('shows the recipe contributor when present', () => {
        render(
            <FeaturedStrip
                recipes={[
                    createMockRecipe({
                        id: 'a',
                        title: 'Grandma\'s Bread',
                        contributor: 'Grandma Schafer',
                        featured: true,
                    }),
                ]}
                onSelect={vi.fn()}
            />,
        );
        expect(screen.getByText(/By Grandma Schafer/i)).toBeInTheDocument();
    });

    it('has an accessible label of "Featured recipes"', () => {
        render(
            <FeaturedStrip
                recipes={[createMockRecipe({ featured: true })]}
                onSelect={vi.fn()}
            />,
        );
        expect(screen.getByRole('region', { name: /Featured recipes/i })).toBeInTheDocument();
    });
});
