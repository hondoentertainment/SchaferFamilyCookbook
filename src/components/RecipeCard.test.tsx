import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RecipeCard } from './RecipeCard';
import { Recipe } from '../types';

const mockRecipe: Recipe = {
    id: '1',
    title: 'Test Recipe',
    contributor: 'Test Contributor',
    category: 'Main',
    ingredients: [],
    instructions: [],
    image: 'test-image.jpg',
};

describe('RecipeCard', () => {
    it('renders recipe title and contributor', () => {
        render(
            <RecipeCard
                recipe={mockRecipe}
                onClick={() => {}}
                avatarUrl="avatar.jpg"
            />
        );
        expect(screen.getByText('Test Recipe')).toBeInTheDocument();
        expect(screen.getByText(/Test Contributor/)).toBeInTheDocument();
        expect(screen.getByText('Main')).toBeInTheDocument();
    });

    it('calls onClick when clicked', () => {
        const handleClick = vi.fn();
        render(
            <RecipeCard
                recipe={mockRecipe}
                onClick={handleClick}
                avatarUrl="avatar.jpg"
            />
        );
        fireEvent.click(screen.getByText('Test Recipe').closest('div.group')!);
        expect(handleClick).toHaveBeenCalledWith(mockRecipe);
    });
});
