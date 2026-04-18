import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GroceryListView } from './GroceryListView';
import { renderWithProviders } from '../test/utils';
import { addItems } from '../utils/groceryList';

describe('GroceryListView', () => {
    beforeEach(() => {
        const store = new Map<string, string>();
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => store.get(key) ?? null,
            setItem: (key: string, value: string) => {
                store.set(key, value);
            },
            removeItem: (key: string) => {
                store.delete(key);
            },
            clear: () => store.clear(),
            length: 0,
            key: () => null,
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('renders the empty state when there are no items', () => {
        renderWithProviders(<GroceryListView />);
        expect(
            screen.getByText(/Your grocery list is empty\. Add ingredients from a recipe\./i),
        ).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /grocery list/i, level: 2 })).toBeInTheDocument();
    });

    it('renders items grouped by recipe title, with a separate "Other" group for manual adds', () => {
        addItems([
            { text: '1 cup flour', recipeId: 'r1', recipeTitle: 'Pancakes' },
            { text: '2 eggs', recipeId: 'r1', recipeTitle: 'Pancakes' },
            { text: '1 lb beef', recipeId: 'r2', recipeTitle: 'Chili' },
            { text: 'Milk' }, // manual add -> "Other"
        ]);
        renderWithProviders(<GroceryListView />);

        expect(screen.getByRole('heading', { name: 'Pancakes', level: 3 })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Chili', level: 3 })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Other', level: 3 })).toBeInTheDocument();

        expect(screen.getByText('1 cup flour')).toBeInTheDocument();
        expect(screen.getByText('2 eggs')).toBeInTheDocument();
        expect(screen.getByText('1 lb beef')).toBeInTheDocument();
        expect(screen.getByText('Milk')).toBeInTheDocument();
    });

    it('toggles an item as checked when the checkbox is clicked', async () => {
        addItems([{ text: 'salt', recipeId: 'r1', recipeTitle: 'Soup' }]);
        renderWithProviders(<GroceryListView />);

        const checkbox = screen.getByRole('checkbox', { name: /mark "salt" as bought/i });
        expect(checkbox).not.toBeChecked();
        fireEvent.click(checkbox);
        await waitFor(() =>
            expect(screen.getByRole('checkbox', { name: /mark "salt" as not bought/i })).toBeChecked(),
        );
        // Checked item gets the strike-through class
        expect(screen.getByText('salt').className).toMatch(/line-through/);
    });

    it('adds a manual item through the input form', async () => {
        const user = userEvent.setup();
        renderWithProviders(<GroceryListView />);

        await user.type(screen.getByLabelText(/add an item to your grocery list/i), 'bananas');
        await user.click(screen.getByRole('button', { name: /^add$/i }));

        expect(await screen.findByText('bananas')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Other', level: 3 })).toBeInTheDocument();
    });

    it('removes a single item when the remove button is clicked', async () => {
        addItems([{ text: 'oats', recipeId: 'r1', recipeTitle: 'Granola' }]);
        renderWithProviders(<GroceryListView />);

        const removeBtn = screen.getByRole('button', { name: /remove oats/i });
        fireEvent.click(removeBtn);

        await waitFor(() => expect(screen.queryByText('oats')).not.toBeInTheDocument());
        expect(
            screen.getByText(/Your grocery list is empty\. Add ingredients from a recipe\./i),
        ).toBeInTheDocument();
    });

    it('"Clear checked" removes only checked items', async () => {
        addItems([
            { text: 'a', recipeId: 'r1', recipeTitle: 'A' },
            { text: 'b', recipeId: 'r1', recipeTitle: 'A' },
        ]);
        renderWithProviders(<GroceryListView />);

        fireEvent.click(screen.getByRole('checkbox', { name: /mark "a" as bought/i }));
        const clearCheckedBtn = await screen.findByRole('button', { name: /clear checked/i });
        fireEvent.click(clearCheckedBtn);

        await waitFor(() => expect(screen.queryByText('a')).not.toBeInTheDocument());
        expect(screen.getByText('b')).toBeInTheDocument();
    });

    it('"Clear all" opens a confirm dialog and only clears when confirmed', async () => {
        addItems([
            { text: 'a', recipeId: 'r1', recipeTitle: 'Pancakes' },
            { text: 'b', recipeId: 'r1', recipeTitle: 'Pancakes' },
        ]);
        const { container } = renderWithProviders(<GroceryListView />);

        // Find the in-page "Clear all" button (not in a dialog)
        const pageClearAll = screen
            .getAllByRole('button', { name: /clear all/i })
            .find((b) => !b.closest('[role="dialog"]'))!;
        fireEvent.click(pageClearAll);

        // Confirm dialog is shown
        const dialog = await screen.findByRole('dialog');
        expect(dialog).toBeInTheDocument();
        expect(screen.getByText(/clear grocery list\?/i)).toBeInTheDocument();

        // Cancel first: list should stay intact
        fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(screen.getByText('a')).toBeInTheDocument();
        expect(screen.getByText('b')).toBeInTheDocument();

        // Re-open and confirm
        const pageClearAllAgain = screen
            .getAllByRole('button', { name: /clear all/i })
            .find((b) => !b.closest('[role="dialog"]'))!;
        fireEvent.click(pageClearAllAgain);
        const reopenedDialog = await screen.findByRole('dialog');
        const dialogConfirm = reopenedDialog.querySelector(
            'button.bg-red-600, button.bg-\\[\\#2D4635\\]',
        ) as HTMLButtonElement | null;
        // Fall back: grab the "Clear all" button that's inside the dialog
        const confirmBtn =
            dialogConfirm ??
            (Array.from(reopenedDialog.querySelectorAll('button')).find((b) =>
                /clear all/i.test(b.textContent ?? ''),
            ) as HTMLButtonElement);
        fireEvent.click(confirmBtn);

        await waitFor(() =>
            expect(
                screen.getByText(/Your grocery list is empty\. Add ingredients from a recipe\./i),
            ).toBeInTheDocument(),
        );
        // Reference container to satisfy lint
        expect(container).toBeTruthy();
    });
});
