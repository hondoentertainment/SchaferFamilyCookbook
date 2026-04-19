import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { MealPlanView } from './MealPlanView';
import { renderWithProviders, createMockRecipe } from '../test/utils';

describe('MealPlanView', () => {
    beforeEach(() => {
        const store = new Map<string, string>();
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => store.get(key) ?? null,
            setItem: (key: string, value: string) => store.set(key, value),
            removeItem: (key: string) => store.delete(key),
            clear: () => store.clear(),
            length: 0,
            key: () => null,
        });
        // Pin "today" so the visible week is deterministic.
        // Sunday April 19, 2026 → week of Apr 19–25, 2026.
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 3, 19, 12, 0, 0));
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    const recipes = [
        createMockRecipe({ id: 'r1', title: 'Apple Pie' }),
        createMockRecipe({ id: 'r2', title: 'Banana Bread' }),
        createMockRecipe({ id: 'r3', title: 'Chicken Soup' }),
    ];

    it('renders an empty current week with the correct header range', () => {
        renderWithProviders(<MealPlanView recipes={recipes} />);

        // Header: April 19, 2026 is a Sunday → week range Apr 19–25, 2026.
        expect(screen.getByTestId('meal-plan-week-range')).toHaveTextContent(
            'Apr 19–25, 2026',
        );

        // 7 day cells, each with an "Add recipe" button.
        for (let i = 0; i < 7; i++) {
            expect(screen.getByTestId(`meal-plan-day-${i}`)).toBeInTheDocument();
            expect(screen.getByTestId(`meal-plan-add-${i}`)).toBeInTheDocument();
        }

        // Empty state copy
        expect(screen.getAllByText('Nothing planned.').length).toBeGreaterThanOrEqual(7);
    });

    it('opens the picker, filters by query, and adds a recipe to the selected day', () => {
        renderWithProviders(<MealPlanView recipes={recipes} />);

        // Open picker for Monday (day 1)
        fireEvent.click(screen.getByTestId('meal-plan-add-1'));

        // Picker dialog appears
        const dialog = screen.getByRole('dialog', { name: /Add a recipe to Monday/i });
        expect(dialog).toBeInTheDocument();

        // Type a search query and pick the matching recipe
        const search = within(dialog).getByLabelText('Search recipes');
        fireEvent.change(search, { target: { value: 'apple' } });

        const option = within(dialog).getByRole('option', { name: /Apple Pie/ });
        fireEvent.click(option);

        // Picker closes and the recipe shows up in Monday's cell
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        const monday = screen.getByTestId('meal-plan-day-1');
        expect(within(monday).getByText('Apple Pie')).toBeInTheDocument();
    });

    it('removes an entry via the × button', () => {
        renderWithProviders(<MealPlanView recipes={recipes} />);

        // Add to Tuesday (day 2)
        fireEvent.click(screen.getByTestId('meal-plan-add-2'));
        const dialog = screen.getByRole('dialog');
        fireEvent.click(within(dialog).getByRole('option', { name: /Banana Bread/ }));

        const tuesday = screen.getByTestId('meal-plan-day-2');
        expect(within(tuesday).getByText('Banana Bread')).toBeInTheDocument();

        // Remove
        const removeBtn = within(tuesday).getByLabelText(/Remove Banana Bread from Tuesday/i);
        fireEvent.click(removeBtn);

        expect(within(tuesday).queryByText('Banana Bread')).not.toBeInTheDocument();
    });

    it('navigates to previous and next weeks and back to "This Week"', () => {
        renderWithProviders(<MealPlanView recipes={recipes} />);

        const range = screen.getByTestId('meal-plan-week-range');
        expect(range).toHaveTextContent('Apr 19–25, 2026');

        // Prev → Apr 12–18, 2026
        fireEvent.click(screen.getByLabelText('Previous week'));
        expect(range).toHaveTextContent('Apr 12–18, 2026');

        // Next twice → Apr 26 – May 2, 2026 (month-spanning format)
        fireEvent.click(screen.getByLabelText('Next week'));
        fireEvent.click(screen.getByLabelText('Next week'));
        expect(range).toHaveTextContent('Apr 26 – May 2, 2026');

        // Back to current week
        fireEvent.click(screen.getByLabelText('Jump to this week'));
        expect(range).toHaveTextContent('Apr 19–25, 2026');
    });

    it('keeps each week independent (entries from one week do not appear in another)', () => {
        renderWithProviders(<MealPlanView recipes={recipes} />);

        // Add Chicken Soup on Wednesday (day 3) of the current week
        fireEvent.click(screen.getByTestId('meal-plan-add-3'));
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('option', { name: /Chicken Soup/ }));

        // Navigate to next week — Chicken Soup should NOT be visible
        fireEvent.click(screen.getByLabelText('Next week'));
        expect(screen.queryByText('Chicken Soup')).not.toBeInTheDocument();

        // Back to this week — Chicken Soup is back
        fireEvent.click(screen.getByLabelText('Jump to this week'));
        expect(screen.getByText('Chicken Soup')).toBeInTheDocument();
    });
});
