import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { RecipeCard } from './RecipeCard';
import { createMockRecipe, renderWithProviders } from '../test/utils';

describe('RecipeCard', () => {
    const mockOnClick = vi.fn();
    const defaultProps = {
        recipe: createMockRecipe(),
        avatarUrl: 'https://example.com/avatar.jpg',
        onClick: mockOnClick,
    };

    it('should render recipe title and category', () => {
        renderWithProviders(<RecipeCard {...defaultProps} />);
        expect(screen.getByText('Test Recipe')).toBeInTheDocument();
        expect(screen.getByText('Main')).toBeInTheDocument();
    });

    it('should call onClick with recipe when clicked', () => {
        renderWithProviders(<RecipeCard {...defaultProps} />);
        const card = screen.getByText('Test Recipe').closest('.group');
        fireEvent.click(card!);
        expect(mockOnClick).toHaveBeenCalledWith(defaultProps.recipe);
    });

    it('should display contributor avatar', () => {
        renderWithProviders(<RecipeCard {...defaultProps} />);
        // Find the avatar image. It has alt="" and is inside the contributor paragraph
        const contributorText = screen.getByText(/By/i);
        const avatar = contributorText.querySelector('img');
        expect(avatar).toBeInTheDocument();
        expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    });
});
