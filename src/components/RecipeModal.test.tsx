import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { RecipeModal } from './RecipeModal';
import { createMockRecipe, renderWithProviders } from '../test/utils';

describe('RecipeModal', () => {
    const mockOnClose = vi.fn();
    const mockOnEdit = vi.fn();
    const mockOnDelete = vi.fn();

    const defaultProps = {
        recipe: createMockRecipe(),
        onClose: mockOnClose,
        onEdit: mockOnEdit,
        onDelete: mockOnDelete,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Mock window.confirm
        global.confirm = vi.fn(() => true);
    });

    it('should render recipe details correctly', () => {
        renderWithProviders(<RecipeModal {...defaultProps} />);

        expect(screen.getByText('Test Recipe')).toBeInTheDocument();
        expect(screen.getByText('Main')).toBeInTheDocument();
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

        const closeButtons = screen.getAllByTitle('Close');
        fireEvent.click(closeButtons[0]);

        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onEdit with recipe when edit button is clicked', () => {
        renderWithProviders(<RecipeModal {...defaultProps} />);

        const editButton = screen.getByTitle('Edit');
        fireEvent.click(editButton);

        expect(mockOnEdit).toHaveBeenCalledWith(defaultProps.recipe);
    });

    it('should call onDelete when delete button is clicked and confirmed', () => {
        global.confirm = vi.fn(() => true);
        renderWithProviders(<RecipeModal {...defaultProps} />);

        const deleteButton = screen.getByTitle('Delete');
        fireEvent.click(deleteButton);

        expect(global.confirm).toHaveBeenCalledWith('Discard this record forever?');
        expect(mockOnDelete).toHaveBeenCalledWith(defaultProps.recipe.id);
    });

    it('should not call onDelete when delete is cancelled', () => {
        global.confirm = vi.fn(() => false);
        renderWithProviders(<RecipeModal {...defaultProps} />);

        const deleteButton = screen.getByTitle('Delete');
        fireEvent.click(deleteButton);

        expect(global.confirm).toHaveBeenCalledWith('Discard this record forever?');
        expect(mockOnDelete).not.toHaveBeenCalled();
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
        renderWithProviders(<RecipeModal {...defaultProps} />);

        const image = screen.getByAltText('Test Recipe');
        expect(image).toBeInTheDocument();
        expect(image).toHaveAttribute('src', 'https://example.com/recipe.jpg');
    });

    it('should return null when recipe is null', () => {
        const { container } = renderWithProviders(
            <RecipeModal {...defaultProps} recipe={null as any} />
        );

        expect(container.firstChild).toBeNull();
    });

    it('should display category badge', () => {
        renderWithProviders(<RecipeModal {...defaultProps} />);

        const categoryBadge = screen.getByText('Main');
        expect(categoryBadge).toHaveClass('uppercase');
    });

    it('should number instructions correctly', () => {
        renderWithProviders(<RecipeModal {...defaultProps} />);

        // Instructions should be numbered 01, 02, etc.
        const container = screen.getByText('Mix ingredients').closest('.flex');
        expect(container?.textContent).toContain('01');
    });
});
