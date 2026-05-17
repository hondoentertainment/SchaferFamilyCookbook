import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { MealPlanView } from './MealPlanView';
import { renderWithProviders, createMockRecipe } from '../test/utils';

vi.mock('../utils/haptics', () => ({ hapticLight: vi.fn() }));

const recipes = [
  createMockRecipe({ id: 'r1', title: 'Apple Pie', ingredients: ['2 apples', '1 cup flour'] }),
  createMockRecipe({ id: 'r2', title: 'Banana Bread', ingredients: ['3 bananas'] }),
];

const defaultProps = {
  recipes,
  onViewRecipe: vi.fn(),
  onBrowseRecipes: vi.fn(),
  onOpenGroceryList: vi.fn(),
};

describe('MealPlanView', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => store.clear(),
      length: 0,
      key: () => null,
    });
    defaultProps.onViewRecipe = vi.fn();
    defaultProps.onBrowseRecipes = vi.fn();
    defaultProps.onOpenGroceryList = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders a seven-day week with an add control per day', () => {
    renderWithProviders(<MealPlanView {...defaultProps} />);
    expect(screen.getAllByTestId('meal-plan-add-recipe')).toHaveLength(7);
  });

  it('shows the empty-week hint and disables the grocery action when nothing is planned', () => {
    renderWithProviders(<MealPlanView {...defaultProps} />);
    expect(screen.getByText(/no recipes planned for this week yet/i)).toBeInTheDocument();
    expect(screen.getByTestId('meal-plan-generate-groceries')).toBeDisabled();
  });

  it('opens a recipe picker when "+ Add recipe" is clicked', () => {
    renderWithProviders(<MealPlanView {...defaultProps} />);
    fireEvent.click(screen.getAllByTestId('meal-plan-add-recipe')[0]);
    expect(screen.getByLabelText(/search recipes to add to the meal plan/i)).toBeInTheDocument();
    expect(screen.getAllByTestId('meal-plan-picker-option').length).toBeGreaterThan(0);
  });

  it('assigns a recipe to a day and enables the grocery action', async () => {
    renderWithProviders(<MealPlanView {...defaultProps} />);
    fireEvent.click(screen.getAllByTestId('meal-plan-add-recipe')[0]);
    const option = screen
      .getAllByTestId('meal-plan-picker-option')
      .find((el) => el.textContent?.includes('Apple Pie'))!;
    fireEvent.click(option);

    expect(await screen.findByTestId('meal-plan-entry')).toHaveTextContent('Apple Pie');
    await waitFor(() =>
      expect(screen.getByTestId('meal-plan-generate-groceries')).not.toBeDisabled(),
    );
  });

  it('calls onViewRecipe when an assigned recipe is clicked', async () => {
    renderWithProviders(<MealPlanView {...defaultProps} />);
    fireEvent.click(screen.getAllByTestId('meal-plan-add-recipe')[0]);
    const option = screen
      .getAllByTestId('meal-plan-picker-option')
      .find((el) => el.textContent?.includes('Banana Bread'))!;
    fireEvent.click(option);

    const entry = await screen.findByTestId('meal-plan-entry');
    fireEvent.click(entry.querySelector('button')!);
    expect(defaultProps.onViewRecipe).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'r2' }),
    );
  });

  it('calls onBrowseRecipes from the empty-week hint', () => {
    renderWithProviders(<MealPlanView {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /browse recipes/i }));
    expect(defaultProps.onBrowseRecipes).toHaveBeenCalled();
  });
});
