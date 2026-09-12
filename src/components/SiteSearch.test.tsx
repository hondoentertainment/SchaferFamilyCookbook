import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { SiteSearch } from './SiteSearch';
import { SiteSearchProvider, type SiteSearchContextValue } from '../context/SearchContext';
import { renderWithProviders } from '../test/utils';
import type { SearchHit } from '../utils/siteSearch';

const pieHit: SearchHit = {
    id: 'recipe:pie',
    kind: 'recipe',
    title: 'Apple Pie',
    subtitle: 'Dessert · Harriet',
    score: 100,
    matchField: 'title',
    recipeId: 'pie',
};

function renderSearch(overrides: Partial<SiteSearchContextValue> = {}, props: { openOn?: 'focus' | 'query' } = {}) {
    const value: SiteSearchContextValue = {
        query: '',
        setQuery: vi.fn(),
        hits: [],
        recent: [],
        clearQuery: vi.fn(),
        clearRecent: vi.fn(),
        applyRecent: vi.fn(),
        onSelectHit: vi.fn(),
        headerOpen: false,
        setHeaderOpen: vi.fn(),
        ...overrides,
    };
    renderWithProviders(
        <SiteSearchProvider value={value}>
            <SiteSearch id="test-search" openOn={props.openOn ?? 'query'} />
        </SiteSearchProvider>,
    );
    return value;
}

describe('SiteSearch', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('uses a 16px search field so iOS does not zoom', () => {
        renderSearch();
        const input = screen.getByLabelText(/search recipes, ingredients, people, or stories/i);
        expect(input).toHaveAttribute('type', 'search');
        expect(input).toHaveAttribute('inputmode', 'search');
        expect(input.className).toMatch(/text-base/);
    });

    it('shows an empty state with a next step when nothing matches', () => {
        const value = renderSearch({ query: 'xyznonexistent' });
        expect(screen.getByTestId('site-search-empty')).toHaveTextContent(/nothing matches/i);
        fireEvent.click(within(screen.getByTestId('site-search-empty')).getByRole('button', { name: /clear search/i }));
        expect(value.clearQuery).toHaveBeenCalled();
    });

    it('opens a recent search and selects a ranked hit', () => {
        const value = renderSearch({
            query: 'pie',
            hits: [pieHit],
            recent: ['soup'],
        });
        fireEvent.click(screen.getByRole('option', { name: /apple pie/i }));
        expect(value.onSelectHit).toHaveBeenCalledWith(pieHit);
    });

    it('lists recent searches when the field is empty and focused', () => {
        const value = renderSearch({ recent: ['cinnamon rolls'] }, { openOn: 'focus' });
        fireEvent.focus(screen.getByLabelText(/search recipes, ingredients, people, or stories/i));
        fireEvent.click(screen.getByRole('option', { name: /cinnamon rolls/i }));
        expect(value.applyRecent).toHaveBeenCalledWith('cinnamon rolls');
    });
});
