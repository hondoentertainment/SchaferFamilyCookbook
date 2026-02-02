import { render, screen, fireEvent } from '@testing-library/react';
import { RecipeCard } from './RecipeCard';
import { Recipe } from '../types';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';

const mockRecipe: Recipe = {
    id: '1',
    title: 'Test Recipe',
    category: 'Main',
    contributor: 'Test User',
    ingredients: [],
    instructions: [],
    image: 'test.jpg'
};

describe('RecipeCard', () => {
    it('renders recipe title and contributor', () => {
        render(<RecipeCard recipe={mockRecipe} onClick={() => {}} contributorAvatar="avatar.png" />);
        expect(screen.getByText('Test Recipe')).toBeInTheDocument();
        expect(screen.getByText('Main')).toBeInTheDocument();
        expect(screen.getByText(/Test User/)).toBeInTheDocument();
    });

    it('calls onClick when clicked', () => {
        const handleClick = vi.fn();
        render(<RecipeCard recipe={mockRecipe} onClick={handleClick} contributorAvatar="avatar.png" />);
        fireEvent.click(screen.getByText('Test Recipe'));
        expect(handleClick).toHaveBeenCalledWith(mockRecipe);
    });
});
