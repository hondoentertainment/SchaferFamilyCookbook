import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CollectionsView } from './CollectionsView';
import { renderWithProviders, createMockRecipe } from '../test/utils';
import type { RecipeCollection } from '../types';

// ---------------------------------------------------------------------------
// Mock the collections utility module so tests control state in isolation.
// ---------------------------------------------------------------------------
vi.mock('../utils/collections', () => ({
    getAllCollections: vi.fn(() => [] as RecipeCollection[]),
    createCollection: vi.fn(),
    deleteCollection: vi.fn(),
    removeFromCollection: vi.fn(),
}));

// Mock haptics so the Vibration API absence doesn't throw in jsdom.
vi.mock('../utils/haptics', () => ({ hapticLight: vi.fn() }));

vi.mock('../utils/groceryList', () => ({
    addRecipeIngredientsToGrocery: vi.fn(() => ({ added: 2, skipped: 0 })),
}));

import {
    getAllCollections,
    createCollection,
    deleteCollection,
    removeFromCollection,
} from '../utils/collections';
import { addRecipeIngredientsToGrocery } from '../utils/groceryList';

// Typed mock handles for convenience.
const mockGetAll = getAllCollections as ReturnType<typeof vi.fn>;
const mockCreate = createCollection as ReturnType<typeof vi.fn>;
const mockDelete = deleteCollection as ReturnType<typeof vi.fn>;
const mockRemove = removeFromCollection as ReturnType<typeof vi.fn>;
const mockAddGrocery = addRecipeIngredientsToGrocery as ReturnType<typeof vi.fn>;

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
    recipes: [] as ReturnType<typeof createMockRecipe>[],
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
    it('renders empty state with starter templates and create-your-own button when no collections exist', () => {
        renderWithProviders(<CollectionsView {...defaultProps} />);

        expect(
            screen.getByRole('button', { name: /create your own/i }),
        ).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /weeknight rotation/i })).toBeInTheDocument();
        expect(screen.getByText(/organize recipes into custom collections/i)).toBeInTheDocument();
    });

    // -----------------------------------------------------------------------
    // Create form visibility
    // -----------------------------------------------------------------------
    it('shows the create-collection form when "+ New Collection" is clicked', () => {
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

        // The same toggle button now reads "Cancel"
        fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

        await waitFor(() =>
            expect(screen.queryByPlaceholderText(/collection name/i)).not.toBeInTheDocument(),
        );
    });

    // -----------------------------------------------------------------------
    // Create button disabled while name is empty
    // -----------------------------------------------------------------------
    it('disables the Create button while the name field is empty', () => {
        renderWithProviders(<CollectionsView {...defaultProps} />);

        fireEvent.click(screen.getByRole('button', { name: /\+ new collection/i }));

        expect(screen.getByRole('button', { name: /^create$/i })).toBeDisabled();
    });

    // -----------------------------------------------------------------------
    // Submitting creates a collection and shows it in the list
    // -----------------------------------------------------------------------
    it('calls createCollection and refreshes the list when a name is submitted', async () => {
        const user = userEvent.setup();
        const newCollection = buildCollection({ name: 'Holiday Baking' });

        // The component calls getAllCollections() once on mount and once after create.
        mockGetAll
            .mockReturnValueOnce([])              // initial render
            .mockReturnValueOnce([newCollection]); // after handleCreate

        renderWithProviders(<CollectionsView {...defaultProps} />);

        fireEvent.click(screen.getByRole('button', { name: /\+ new collection/i }));
        await user.type(screen.getByPlaceholderText(/collection name/i), 'Holiday Baking');
        fireEvent.click(screen.getByRole('button', { name: /^create$/i }));

        expect(mockCreate).toHaveBeenCalledWith('Holiday Baking', 'Alice', '');
        expect(await screen.findByText('Holiday Baking')).toBeInTheDocument();
        // Form is hidden after a successful create
        expect(screen.queryByPlaceholderText(/collection name/i)).not.toBeInTheDocument();
    });

    // -----------------------------------------------------------------------
    // Expanding a collection shows its recipes
    // -----------------------------------------------------------------------
    it('expands a collection to show its recipes when the header is clicked', async () => {
        const recipe = createMockRecipe({ id: 'r1', title: 'Grandma Pie' });
        const col = buildCollection({ recipeIds: ['r1'] });

        mockGetAll.mockReturnValue([col]);

        renderWithProviders(<CollectionsView {...defaultProps} recipes={[recipe]} />);

        // The header button has aria-expanded and its accessible name includes the collection name.
        fireEvent.click(screen.getByRole('button', { name: /favourites/i }));

        expect(await screen.findByText('Grandma Pie')).toBeInTheDocument();
    });

    // -----------------------------------------------------------------------
    // Clicking a recipe calls onViewRecipe
    // -----------------------------------------------------------------------
    it('calls onViewRecipe when a recipe inside an expanded collection is clicked', async () => {
        const recipe = createMockRecipe({ id: 'r1', title: 'Grandma Pie' });
        const col = buildCollection({ recipeIds: ['r1'] });

        mockGetAll.mockReturnValue([col]);

        renderWithProviders(<CollectionsView {...defaultProps} recipes={[recipe]} />);

        // Expand the collection first
        fireEvent.click(screen.getByRole('button', { name: /favourites/i }));

        // Click the recipe button that becomes visible — find by text content since
        // happy-dom's accessible name computation may not match the button text.
        const recipeBtn = await screen.findByText('Grandma Pie');
        fireEvent.click(recipeBtn);

        expect(defaultProps.onViewRecipe).toHaveBeenCalledWith(recipe);
    });

    // -----------------------------------------------------------------------
    // Remove recipe from collection
    // -----------------------------------------------------------------------
    it('calls removeFromCollection when the remove button is clicked and updates the list', async () => {
        const recipe = createMockRecipe({ id: 'r1', title: 'Grandma Pie' });
        const col = buildCollection({ id: 'col-1', recipeIds: ['r1'] });
        const colAfterRemove = buildCollection({ id: 'col-1', recipeIds: [] });

        mockGetAll
            .mockReturnValueOnce([col])           // initial render
            .mockReturnValueOnce([colAfterRemove]); // after removeFromCollection

        renderWithProviders(<CollectionsView {...defaultProps} recipes={[recipe]} />);

        fireEvent.click(screen.getByRole('button', { name: /favourites/i }));

        const removeBtn = await screen.findByRole('button', {
            name: /remove grandma pie from favourites/i,
        });
        fireEvent.click(removeBtn);

        expect(mockRemove).toHaveBeenCalledWith('col-1', 'r1');
        // Recipe is gone from the expanded list
        await waitFor(() =>
            expect(screen.queryByRole('button', { name: /grandma pie/i })).not.toBeInTheDocument(),
        );
    });

    // -----------------------------------------------------------------------
    // Delete collection
    // -----------------------------------------------------------------------
    it('calls deleteCollection when "Delete Collection" is clicked and removes it from the list', async () => {
        const col = buildCollection({ id: 'col-1' });

        mockGetAll
            .mockReturnValueOnce([col]) // initial render
            .mockReturnValueOnce([]);   // after deleteCollection

        renderWithProviders(<CollectionsView {...defaultProps} />);

        // Expand to reveal the Delete Collection button
        fireEvent.click(screen.getByRole('button', { name: /favourites/i }));

        const deleteBtn = await screen.findByRole('button', { name: /delete collection/i });
        fireEvent.click(deleteBtn);

        expect(mockDelete).toHaveBeenCalledWith('col-1');
        await waitFor(() =>
            expect(screen.queryByText('Favourites')).not.toBeInTheDocument(),
        );
    });

    it('adds collection recipes to the grocery list when the action is clicked', async () => {
        const recipe = createMockRecipe({ id: 'r1', title: 'Grandma Pie', ingredients: ['2 apples'] });
        const col = buildCollection({ recipeIds: ['r1'] });
        mockGetAll.mockReturnValue([col]);
        const onOpenGroceryList = vi.fn();

        renderWithProviders(
            <CollectionsView
                {...defaultProps}
                recipes={[recipe]}
                onOpenGroceryList={onOpenGroceryList}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: /favourites/i }));
        fireEvent.click(await screen.findByRole('button', { name: /add to grocery list/i }));

        expect(mockAddGrocery).toHaveBeenCalledWith([recipe]);
    });
});
