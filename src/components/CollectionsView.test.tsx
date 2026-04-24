import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CollectionsView } from './CollectionsView';
import { renderWithProviders, createMockRecipe } from '../test/utils';
import type { RecipeCollection } from '../types';

// ---------------------------------------------------------------------------
// Mock the collections utility module
// ---------------------------------------------------------------------------
vi.mock('../utils/collections', () => ({
    getAllCollections: vi.fn(() => []),
    createCollection: vi.fn(),
    deleteCollection: vi.fn(),
    removeFromCollection: vi.fn(),
}));

// Also mock haptics so it doesn't throw in jsdom
vi.mock('../utils/haptics', () => ({ hapticLight: vi.fn() }));

import {
    getAllCollections,
    createCollection,
    deleteCollection,
    removeFromCollection,
} from '../utils/collections';

// Typed handles for convenience
const mockGetAll = getAllCollections as ReturnType<typeof vi.fn>;
const mockCreate = createCollection as ReturnType<typeof vi.fn>;
const mockDelete = deleteCollection as ReturnType<typeof vi.fn>;
const mockRemove = removeFromCollection as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const buildCollection = (overrides: Partial<RecipeCollection> = {}): RecipeCollection => ({
    id: 'col-1',
    name: 'Favourites',
    description: '',
    recipeIds: [],
    createdBy: 'Alice',
    icon: '📚',
    timestamp: new Date().toISOString(),
    ...overrides,
});

const defaultProps = {
    recipes: [],
    currentUserName: 'Alice',
    onViewRecipe: vi.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('CollectionsView', () => {
    beforeEach(() => {
        mockGetAll.mockReturnValue([]);
        mockCreate.mockReset();
        mockDelete.mockReset();
        mockRemove.mockReset();
        defaultProps.onViewRecipe = vi.fn();
    });

    // -----------------------------------------------------------------------
    // Empty state
    // -----------------------------------------------------------------------
    it('renders empty state with "Create Your First Collection" button when no collections exist', () => {
        renderWithProviders(<CollectionsView {...defaultProps} />);

        expect(screen.getByRole('button', { name: /create your first collection/i })).toBeInTheDocument();
        expect(screen.getByText(/organize recipes into custom collections/i)).toBeInTheDocument();
    });

    // -----------------------------------------------------------------------
    // Create form visibility
    // -----------------------------------------------------------------------
    it('shows create-collection form when "+ New Collection" is clicked', () => {
        renderWithProviders(<CollectionsView {...defaultProps} />);

        fireEvent.click(screen.getByRole('button', { name: /\+ new collection/i }));

        expect(screen.getByPlaceholderText(/collection name/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/description \(optional\)/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^create$/i })).toBeInTheDocument();
    });

    // -----------------------------------------------------------------------
    // Cancel hides the form
    // -----------------------------------------------------------------------
    it('hides the create form when Cancel is clicked', async () => {
        renderWithProviders(<CollectionsView {...defaultProps} />);

        fireEvent.click(screen.getByRole('button', { name: /\+ new collection/i }));
        expect(screen.getByPlaceholderText(/collection name/i)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

        await waitFor(() =>
            expect(screen.queryByPlaceholderText(/collection name/i)).not.toBeInTheDocument(),
        );
    });

    // -----------------------------------------------------------------------
    // Create button disabled while name is empty
    // -----------------------------------------------------------------------
    it('disables Create button while the name field is empty', () => {
        renderWithProviders(<CollectionsView {...defaultProps} />);

        fireEvent.click(screen.getByRole('button', { name: /\+ new collection/i }));

        expect(screen.getByRole('button', { name: /^create$/i })).toBeDisabled();
    });

    // -----------------------------------------------------------------------
    // Submitting creates a collection
    // -----------------------------------------------------------------------
    it('calls createCollection and refreshes the list when a name is submitted', async () => {
        const user = userEvent.setup();
        const newCollection = buildCollection({ name: 'Holiday Baking' });

        // After creation the component re-reads collections
        mockGetAll
            .mockReturnValueOnce([]) // initial render
            .mockReturnValueOnce([newCollection]); // after create

        renderWithProviders(<CollectionsView {...defaultProps} />);

        fireEvent.click(screen.getByRole('button', { name: /\+ new collection/i }));

        await user.type(screen.getByPlaceholderText(/collection name/i), 'Holiday Baking');
        fireEvent.click(screen.getByRole('button', { name: /^create$/i }));

        expect(mockCreate).toHaveBeenCalledWith('Holiday Baking', 'Alice', '');
        expect(await screen.findByText('Holiday Baking')).toBeInTheDocument();
    });

    // -----------------------------------------------------------------------
    // Expanding a collection shows its recipes
    // -----------------------------------------------------------------------
    it('expands a collection and shows its recipes when the header button is clicked', async () => {
        const recipe = createMockRecipe({ id: 'r1', title: 'Grandma Pie' });
        const col = buildCollection({ recipeIds: ['r1'] });

        mockGetAll.mockReturnValue([col]);

        renderWithProviders(
            <CollectionsView {...defaultProps} recipes={[recipe]} />,
        );

        // Expand
        fireEvent.click(screen.getByRole('button', { name: '', exact: false }));
        expect(await screen.findByText('Grandma Pie')).toBeInTheDocument();
    });

    // -----------------------------------------------------------------------
    // Clicking a recipe calls onViewRecipe
    // -----------------------------------------------------------------------
    it('calls onViewRecipe when a recipe inside a collection is clicked', async () => {
        const recipe = createMockRecipe({ id: 'r1', title: 'Grandma Pie' });
        const col = buildCollection({ recipeIds: ['r1'] });

        mockGetAll.mockReturnValue([col]);

        renderWithProviders(
            <CollectionsView {...defaultProps} recipes={[recipe]} />,
        );

        // Expand the collection first
        fireEvent.click(screen.getByRole('button', { aria: false, name: '' } as never));
        // Use aria-expanded toggle button text
        const expandBtn = screen.getByRole('button', { name: /favourites/i });
        fireEvent.click(expandBtn);

        const recipeBtn = await screen.findByRole('button', { name: /grandma pie/i });
        fireEvent.click(recipeBtn);

        expect(defaultProps.onViewRecipe).toHaveBeenCalledWith(recipe);
    });

    // -----------------------------------------------------------------------
    // Remove recipe from collection
    // -----------------------------------------------------------------------
    it('calls removeFromCollection when the remove button is clicked', async () => {
        const recipe = createMockRecipe({ id: 'r1', title: 'Grandma Pie' });
        const col = buildCollection({ id: 'col-1', recipeIds: ['r1'] });

        // Before remove: collection has the recipe; after remove: it doesn't
        const colAfterRemove = buildCollection({ id: 'col-1', recipeIds: [] });
        mockGetAll
            .mockReturnValueOnce([col])  // initial render
            .mockReturnValueOnce([colAfterRemove]); // after remove

        renderWithProviders(
            <CollectionsView {...defaultProps} recipes={[recipe]} />,
        );

        // Expand the collection
        fireEvent.click(screen.getByRole('button', { name: /favourites/i }));

        const removeBtn = await screen.findByRole('button', { name: /remove grandma pie from favourites/i });
        fireEvent.click(removeBtn);

        expect(mockRemove).toHaveBeenCalledWith('col-1', 'r1');
    });

    // -----------------------------------------------------------------------
    // Delete collection
    // -----------------------------------------------------------------------
    it('calls deleteCollection when "Delete Collection" is clicked and removes it from the list', async () => {
        const col = buildCollection({ id: 'col-1' });
        const colWithRecipe = buildCollection({ id: 'col-1', recipeIds: [] });

        mockGetAll
            .mockReturnValueOnce([colWithRecipe]) // initial
            .mockReturnValueOnce([]);             // after delete

        renderWithProviders(<CollectionsView {...defaultProps} />);

        // Expand to reveal Delete Collection button
        fireEvent.click(screen.getByRole('button', { name: /favourites/i }));

        const deleteBtn = await screen.findByRole('button', { name: /delete collection/i });
        fireEvent.click(deleteBtn);

        expect(mockDelete).toHaveBeenCalledWith(col.id);
        await waitFor(() =>
            expect(screen.queryByText('Favourites')).not.toBeInTheDocument(),
        );
    });
});
