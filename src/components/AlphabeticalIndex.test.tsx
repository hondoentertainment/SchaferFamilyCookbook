import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { AlphabeticalIndex } from './AlphabeticalIndex';
import { renderWithProviders, createMockRecipe } from '../test/utils';

describe('AlphabeticalIndex', () => {
    const mockOnSelect = vi.fn();

    it('should render empty state when no recipes', () => {
        renderWithProviders(<AlphabeticalIndex recipes={[]} onSelect={mockOnSelect} />);
        expect(screen.getByText('Index is empty.')).toBeInTheDocument();
    });

    it('should group recipes alphabetically by first letter', () => {
        const recipes = [
            createMockRecipe({ id: '1', title: 'Apple Pie' }),
            createMockRecipe({ id: '2', title: 'Banana Bread' }),
            createMockRecipe({ id: '3', title: 'Apple Cobbler' }),
        ];
        renderWithProviders(<AlphabeticalIndex recipes={recipes} onSelect={mockOnSelect} />);
        expect(screen.getByText('Apple Pie')).toBeInTheDocument();
        expect(screen.getByText('Apple Cobbler')).toBeInTheDocument();
        expect(screen.getByText('Banana Bread')).toBeInTheDocument();
    });

    it('should call onSelect when recipe is clicked', () => {
        const recipe = createMockRecipe({ id: 'r1', title: 'Zucchini Bread' });
        renderWithProviders(<AlphabeticalIndex recipes={[recipe]} onSelect={mockOnSelect} />);
        fireEvent.click(screen.getByText('Zucchini Bread'));
        expect(mockOnSelect).toHaveBeenCalledWith(recipe);
    });

    it('should handle recipes starting with numbers in # group', () => {
        const recipes = [
            createMockRecipe({ id: '1', title: '123 Recipe' }),
            createMockRecipe({ id: '2', title: '7-Up Cake' }),
        ];
        renderWithProviders(<AlphabeticalIndex recipes={recipes} onSelect={mockOnSelect} />);
        expect(screen.getByText('123 Recipe')).toBeInTheDocument();
        expect(screen.getByText('7-Up Cake')).toBeInTheDocument();
    });

    it('should display contributor and category for each recipe', () => {
        const recipe = createMockRecipe({ title: 'Test Dish', contributor: 'Jane', category: 'Dessert' });
        renderWithProviders(<AlphabeticalIndex recipes={[recipe]} onSelect={mockOnSelect} />);
        expect(screen.getByText(/By Jane/)).toBeInTheDocument();
        expect(screen.getByText(/Dessert/)).toBeInTheDocument();
    });
});
