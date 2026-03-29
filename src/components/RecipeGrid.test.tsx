import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { RecipeGrid } from './RecipeGrid';
import { renderWithProviders, createMockRecipe } from '../test/utils';
import { UserProfile, Recipe } from '../types';

vi.mock('../utils/avatarFallback', () => ({
    avatarOnError: vi.fn(),
}));

vi.mock('../utils/haptics', () => ({
    hapticLight: vi.fn(),
}));

vi.mock('../utils/imageErrorToast', () => ({
    shouldToastImageError: () => false,
}));

vi.mock('../utils/recentlyViewed', () => ({
    getRecentRecipeIds: () => [],
    getRecentlyViewedEntries: () => [],
}));

describe('RecipeGrid', () => {
    const currentUser: UserProfile = {
        id: 'u1',
        name: 'Test User',
        picture: 'https://example.com/pic.jpg',
        role: 'user',
    };

    const recipes: Recipe[] = [
        createMockRecipe({ id: 'r1', title: 'Apple Pie', category: 'Dessert', contributor: 'Grandma' }),
        createMockRecipe({ id: 'r2', title: 'Bacon Burger', category: 'Main', contributor: 'Uncle Bob' }),
        createMockRecipe({ id: 'r3', title: 'Caesar Salad', category: 'Side', contributor: 'Grandma' }),
    ];

    const defaultProps = {
        recipes,
        currentUser,
        onOpenRecipe: vi.fn(),
        isFavorite: vi.fn(() => false),
        onToggleFavorite: vi.fn(),
        isDataLoading: false,
        getAvatar: vi.fn(() => 'https://example.com/avatar.jpg'),
        recipeCount: 3,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders recipe cards', () => {
        renderWithProviders(<RecipeGrid {...defaultProps} />);

        expect(screen.getByText('Apple Pie')).toBeInTheDocument();
        expect(screen.getByText('Bacon Burger')).toBeInTheDocument();
        expect(screen.getByText('Caesar Salad')).toBeInTheDocument();
    });

    it('filters by search term', () => {
        renderWithProviders(<RecipeGrid {...defaultProps} />);

        const searchInput = screen.getByPlaceholderText(/search by title/i);
        fireEvent.change(searchInput, { target: { value: 'Apple' } });

        expect(screen.getByText('Apple Pie')).toBeInTheDocument();
        expect(screen.queryByText('Bacon Burger')).not.toBeInTheDocument();
        expect(screen.queryByText('Caesar Salad')).not.toBeInTheDocument();
    });

    it('filters by category', () => {
        renderWithProviders(<RecipeGrid {...defaultProps} />);

        const categorySelect = screen.getByLabelText(/filter by category/i);
        fireEvent.change(categorySelect, { target: { value: 'Dessert' } });

        expect(screen.getByText('Apple Pie')).toBeInTheDocument();
        expect(screen.queryByText('Bacon Burger')).not.toBeInTheDocument();
    });

    it('shows empty state for no results when filters active', () => {
        renderWithProviders(<RecipeGrid {...defaultProps} />);

        const searchInput = screen.getByPlaceholderText(/search by title/i);
        fireEvent.change(searchInput, { target: { value: 'ZZZNOTFOUND' } });

        expect(screen.getByText(/no recipes match your current filters/i)).toBeInTheDocument();
    });

    it('shows empty state when no recipes exist', () => {
        renderWithProviders(<RecipeGrid {...defaultProps} recipes={[]} recipeCount={0} />);

        expect(screen.getByText(/no recipes found in the archive/i)).toBeInTheDocument();
    });

    it('calls onOpenRecipe when card clicked', () => {
        renderWithProviders(<RecipeGrid {...defaultProps} />);

        const card = screen.getByRole('button', { name: /view recipe: apple pie/i });
        fireEvent.click(card);

        expect(defaultProps.onOpenRecipe).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'r1', title: 'Apple Pie' })
        );
    });

    it('shows loading skeleton when isDataLoading', () => {
        renderWithProviders(<RecipeGrid {...defaultProps} isDataLoading={true} />);

        const pulsingElements = document.querySelectorAll('.animate-pulse');
        expect(pulsingElements.length).toBeGreaterThan(0);
        // Recipe titles should not be in the document
        expect(screen.queryByText('Apple Pie')).not.toBeInTheDocument();
    });

    it('shows recipe count in hero banner', () => {
        renderWithProviders(<RecipeGrid {...defaultProps} recipeCount={42} />);

        expect(screen.getByText(/42 recipes archived/i)).toBeInTheDocument();
    });
});
