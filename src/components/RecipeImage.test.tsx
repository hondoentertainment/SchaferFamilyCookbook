import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecipeImage } from './RecipeImage';
import type { Recipe } from '../types';

const recipe: Recipe = {
    id: 'test-1',
    title: 'Test Recipe',
    contributor: 'Alice',
    category: 'Main',
    image: '/recipe-images/749d8765.webp',
    ingredients: ['flour'],
    instructions: ['mix'],
};

describe('RecipeImage', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('shows the photo when the image is already cached (complete before onLoad)', () => {
        vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
        vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(800);

        render(
            <div className="relative aspect-[4/3]">
                <RecipeImage recipe={recipe} />
            </div>,
        );

        const img = screen.getByRole('img', { name: recipe.title });
        expect(img).toHaveClass('opacity-100');
    });

    it('renders category fallback when image URL is invalid', () => {
        render(
            <div className="relative aspect-[4/3]">
                <RecipeImage recipe={{ ...recipe, image: '' }} />
            </div>,
        );

        expect(screen.queryByRole('img', { name: recipe.title })).not.toBeInTheDocument();
        expect(screen.getByText('Image unavailable')).toBeInTheDocument();
    });
});
