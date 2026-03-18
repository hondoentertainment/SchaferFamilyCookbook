import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RecipeCard } from './RecipeCard';
import { Recipe } from '../types';

describe('RecipeCard', () => {
    const mockRecipe: Recipe = {
        id: '1',
        title: 'Test Recipe',
        contributor: 'Test Chef',
        category: 'Main',
        ingredients: [],
        instructions: [],
        image: 'https://example.com/image.jpg',
    };

    const mockOnClick = vi.fn();
    const mockAvatar = 'https://example.com/avatar.jpg';

    it('renders recipe details correctly', () => {
        render(
            <RecipeCard
                recipe={mockRecipe}
                onClick={mockOnClick}
                contributorAvatar={mockAvatar}
            />
        );

        expect(screen.getByText('Test Recipe')).toBeInTheDocument();
        expect(screen.getByText(/Test Chef/)).toBeInTheDocument();
        expect(screen.getByText('Main')).toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'Test Recipe' })).toHaveAttribute('src', 'https://example.com/image.jpg');
    });

    it('calls onClick when clicked', () => {
        render(
            <RecipeCard
                recipe={mockRecipe}
                onClick={mockOnClick}
                contributorAvatar={mockAvatar}
            />
        );

        fireEvent.click(screen.getByText('Test Recipe'));
        expect(mockOnClick).toHaveBeenCalledWith(mockRecipe);
    });
});
