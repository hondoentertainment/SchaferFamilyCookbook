import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, render } from '@testing-library/react';
import { RecipeCard } from './RecipeCard';
import { createMockRecipe } from '../test/utils';

describe('RecipeCard', () => {
    const mockOnClick = vi.fn();
    const defaultProps = {
        recipe: createMockRecipe({
            title: 'Test Card Recipe',
            category: 'Main',
            contributor: 'Chef Bolt',
            image: 'https://example.com/tasty.jpg'
        }),
        onClick: mockOnClick,
        avatarUrl: 'https://example.com/avatar.jpg'
    };

    it('should render recipe details correctly', () => {
        render(<RecipeCard {...defaultProps} />);

        expect(screen.getByText('Test Card Recipe')).toBeInTheDocument();
        expect(screen.getByText('Main')).toBeInTheDocument();
        expect(screen.getByText(/By/)).toBeInTheDocument();
        expect(screen.getByText(/Chef Bolt/)).toBeInTheDocument();
    });

    it('should render the image with correct src', () => {
        render(<RecipeCard {...defaultProps} />);

        const img = screen.getByAltText('Test Card Recipe');
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute('src', 'https://example.com/tasty.jpg');
    });

    it('should render avatar with correct src', () => {
        const { container } = render(<RecipeCard {...defaultProps} />);

        // Find image by src attribute using querySelector since it has empty alt text (decorative)
        const avatar = container.querySelector('img[src="https://example.com/avatar.jpg"]');
        expect(avatar).toBeInTheDocument();
    });

    it('should call onClick with recipe when clicked', () => {
        render(<RecipeCard {...defaultProps} />);

        // The whole card is clickable.
        // We can find the card div. Since it has no role or text itself (it's a container),
        // we can click the title or just the first child of the render.
        const title = screen.getByText('Test Card Recipe');
        fireEvent.click(title);

        expect(mockOnClick).toHaveBeenCalledWith(defaultProps.recipe);
    });
});
