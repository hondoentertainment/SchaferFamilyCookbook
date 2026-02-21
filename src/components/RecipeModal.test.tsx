import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { RecipeModal } from './RecipeModal';
import { createMockRecipe, renderWithProviders } from '../test/utils';

describe('RecipeModal', () => {
    const mockOnClose = vi.fn();
    const defaultProps = {
        recipe: createMockRecipe(),
        onClose: mockOnClose,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render recipe details correctly', () => {
        renderWithProviders(<RecipeModal {...defaultProps} />);

        expect(screen.getByText('Test Recipe')).toBeInTheDocument();
        expect(screen.getAllByText('Main').length).toBeGreaterThan(0);
        expect(screen.getByText(/By Test User/i)).toBeInTheDocument();
    });

    it('should display ingredients', () => {
        renderWithProviders(<RecipeModal {...defaultProps} />);

        expect(screen.getByText('Ingredients')).toBeInTheDocument();
        expect(screen.getByText('1 cup flour')).toBeInTheDocument();
        expect(screen.getByText('2 eggs')).toBeInTheDocument();
    });

    it('should display instructions', () => {
        renderWithProviders(<RecipeModal {...defaultProps} />);

        expect(screen.getByText('Instructions')).toBeInTheDocument();
        expect(screen.getByText('Mix ingredients')).toBeInTheDocument();
        expect(screen.getByText('Bake at 350°F')).toBeInTheDocument();
    });

    it('should display prep time, cook time, and calories', () => {
        renderWithProviders(<RecipeModal {...defaultProps} />);

        expect(screen.getByText(/Prep: 15 min/i)).toBeInTheDocument();
        expect(screen.getByText(/Cook: 30 min/i)).toBeInTheDocument();
        expect(screen.getByText(/~250 kcal/i)).toBeInTheDocument();
    });

    it('should display notes when available', () => {
        renderWithProviders(<RecipeModal {...defaultProps} />);

        expect(screen.getByText('Heirloom Notes')).toBeInTheDocument();
        expect(screen.getByText('Test notes')).toBeInTheDocument();
    });

    it('should not display notes section when notes are undefined', () => {
        const recipeWithoutNotes = createMockRecipe({ notes: undefined });
        renderWithProviders(
            <RecipeModal {...defaultProps} recipe={recipeWithoutNotes} />
        );

        expect(screen.queryByText('Heirloom Notes')).not.toBeInTheDocument();
    });

    it('should call onClose when close button is clicked', () => {
        renderWithProviders(<RecipeModal {...defaultProps} />);

        const closeButton = screen.getByRole('button', { name: /close recipe/i });
        fireEvent.click(closeButton);

        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when backdrop is clicked', () => {
        renderWithProviders(<RecipeModal {...defaultProps} />);

        const backdrop = document.querySelector('.bg-stone-900\\/60');
        if (backdrop) {
            fireEvent.click(backdrop);
            expect(mockOnClose).toHaveBeenCalledTimes(1);
        }
    });

    it('should render recipe image with correct src and alt', () => {
        const recipeWithLocalImage = createMockRecipe({ image: '/recipe-images/test-recipe.jpg' });
        renderWithProviders(<RecipeModal {...defaultProps} recipe={recipeWithLocalImage} />);

        const image = screen.getByAltText('Test Recipe');
        expect(image).toBeInTheDocument();
        expect(image).toHaveAttribute('src', '/recipe-images/test-recipe.jpg');
    });

    it('should return null when recipe is null', () => {
        renderWithProviders(
            <RecipeModal {...defaultProps} recipe={null as any} />
        );

        expect(screen.queryByText('Test Recipe')).not.toBeInTheDocument();
    });

    it('should display category badge', () => {
        renderWithProviders(<RecipeModal {...defaultProps} />);

        const categoryBadges = screen.getAllByText('Main');
        const badge = categoryBadges.find(el => el.classList.contains('uppercase'));
        expect(badge).toBeInTheDocument();
    });

    it('should number instructions correctly', () => {
        renderWithProviders(<RecipeModal {...defaultProps} />);

        // Instructions should be numbered 01, 02, etc.
        const container = screen.getByText('Mix ingredients').closest('.flex');
        expect(container?.textContent).toContain('01');
    });

    it('should open lightbox when image is clicked', () => {
        const recipeWithLocalImage = createMockRecipe({ image: '/recipe-images/test-recipe.jpg' });
        renderWithProviders(<RecipeModal {...defaultProps} recipe={recipeWithLocalImage} />);
        const image = screen.getByAltText('Test Recipe');
        fireEvent.click(image);
        expect(screen.getByText('Click anywhere to close')).toBeInTheDocument();
    });

    it('should close lightbox when close button is clicked', () => {
        const recipeWithLocalImage = createMockRecipe({ image: '/recipe-images/test-recipe.jpg' });
        renderWithProviders(<RecipeModal {...defaultProps} recipe={recipeWithLocalImage} />);
        fireEvent.click(screen.getByAltText('Test Recipe'));
        expect(screen.getByText('Click anywhere to close')).toBeInTheDocument();
        const lightboxClose = screen.getByRole('button', { name: /close enlarged image/i });
        fireEvent.click(lightboxClose);
        expect(screen.queryByText('Click anywhere to close')).not.toBeInTheDocument();
    });
});
