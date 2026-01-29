import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { RecipeCard } from './RecipeCard';
import { createMockRecipe, renderWithProviders } from '../test/utils';

describe('RecipeCard', () => {
    const mockOnClick = vi.fn();
    const mockRecipe = createMockRecipe();
    const mockAvatarUrl = 'https://example.com/avatar.jpg';

    const defaultProps = {
        recipe: mockRecipe,
        onClick: mockOnClick,
        avatarUrl: mockAvatarUrl,
    };

    it('should render recipe title and contributor', () => {
        renderWithProviders(<RecipeCard {...defaultProps} />);

        expect(screen.getByText(mockRecipe.title)).toBeInTheDocument();
        expect(screen.getByText(mockRecipe.category)).toBeInTheDocument();
        expect(screen.getByText(new RegExp(mockRecipe.contributor, 'i'))).toBeInTheDocument();
    });

    it('should render image with correct src', () => {
        renderWithProviders(<RecipeCard {...defaultProps} />);
        const img = screen.getByAltText(mockRecipe.title);
        expect(img).toHaveAttribute('src', mockRecipe.image);
    });

    it('should call onClick when clicked', () => {
        renderWithProviders(<RecipeCard {...defaultProps} />);

        const card = screen.getByRole('button');
        fireEvent.click(card);

        expect(mockOnClick).toHaveBeenCalledWith(mockRecipe);
    });

    it('should trigger onClick on Enter key press', () => {
        renderWithProviders(<RecipeCard {...defaultProps} />);
        const card = screen.getByRole('button');
        fireEvent.keyDown(card, { key: 'Enter', code: 'Enter' });
        expect(mockOnClick).toHaveBeenCalledWith(mockRecipe);
    });
});
