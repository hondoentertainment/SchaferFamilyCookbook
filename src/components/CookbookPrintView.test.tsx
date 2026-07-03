import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { CookbookPrintView } from './CookbookPrintView';
import { createMockRecipe, renderWithProviders } from '../test/utils';

describe('CookbookPrintView', () => {
    const recipes = [
        createMockRecipe({ id: 'r1', title: 'Beef Stew', category: 'Main', contributor: 'Dawn' }),
        createMockRecipe({ id: 'r2', title: 'Apple Pie', category: 'Dessert', contributor: 'Harriet' }),
        createMockRecipe({ id: 'r3', title: 'Zesty Salad', category: 'Main', contributor: 'Wren' }),
    ];
    const onClose = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders a cover with the recipe and contributor counts', () => {
        renderWithProviders(<CookbookPrintView recipes={recipes} onClose={onClose} />);
        expect(screen.getByText(/3 recipes from 3 family cooks/i)).toBeInTheDocument();
    });

    it('lists every recipe in the table of contents with its contributor', () => {
        renderWithProviders(<CookbookPrintView recipes={recipes} onClose={onClose} />);
        const toc = screen.getByRole('region', { name: /table of contents/i });
        expect(within(toc).getByText('Beef Stew')).toBeInTheDocument();
        expect(within(toc).getByText('Apple Pie')).toBeInTheDocument();
        expect(within(toc).getByText('Harriet')).toBeInTheDocument();
    });

    it('groups recipes into category chapters, alphabetized within a chapter', () => {
        renderWithProviders(<CookbookPrintView recipes={recipes} onClose={onClose} />);
        const mainChapter = screen.getByRole('region', { name: 'Main chapter' });
        const titles = within(mainChapter)
            .getAllByRole('heading', { level: 3 })
            .map((h) => h.textContent);
        expect(titles).toEqual(['Beef Stew', 'Zesty Salad']);
        expect(screen.getByRole('region', { name: 'Dessert chapter' })).toBeInTheDocument();
    });

    it('renders ingredients and instructions for each recipe', () => {
        renderWithProviders(<CookbookPrintView recipes={[recipes[0]!]} onClose={onClose} />);
        expect(screen.getByText('1 cup flour')).toBeInTheDocument();
        expect(screen.getByText('Mix ingredients')).toBeInTheDocument();
    });

    it('calls window.print when the print button is clicked', () => {
        const printSpy = vi.fn();
        vi.stubGlobal('print', printSpy);
        try {
            renderWithProviders(<CookbookPrintView recipes={recipes} onClose={onClose} />);
            fireEvent.click(screen.getByTestId('cookbook-print-button'));
            expect(printSpy).toHaveBeenCalledTimes(1);
        } finally {
            vi.unstubAllGlobals();
        }
    });

    it('closes via the close button and Escape', () => {
        renderWithProviders(<CookbookPrintView recipes={recipes} onClose={onClose} />);
        fireEvent.click(screen.getByTestId('cookbook-close-button'));
        expect(onClose).toHaveBeenCalledTimes(1);
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(2);
    });
});
