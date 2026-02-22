import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { ContributorsView } from './ContributorsView';
import { renderWithProviders, createMockRecipe, createMockContributor } from '../test/utils';

describe('ContributorsView', () => {
    const mockOnSelect = vi.fn();

    it('should render empty state when no contributors', () => {
        renderWithProviders(
            <ContributorsView recipes={[]} gallery={[]} trivia={[]} contributors={[]} onSelectContributor={mockOnSelect} />
        );
        expect(screen.getByText('No contributors yet.')).toBeInTheDocument();
    });

    it('should show contributors with recipe counts', () => {
        const recipes = [
            createMockRecipe({ contributor: 'Alice' }),
            createMockRecipe({ contributor: 'Alice' }),
            createMockRecipe({ contributor: 'Bob' }),
        ];
        const contributors = [
            createMockContributor({ name: 'Alice' }),
            createMockContributor({ name: 'Bob' }),
        ];
        renderWithProviders(
            <ContributorsView recipes={recipes} contributors={contributors} onSelectContributor={mockOnSelect} />
        );
        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('Bob')).toBeInTheDocument();
        expect(screen.getByText('Explore Collection (2)')).toBeInTheDocument();
        expect(screen.getByText('Explore Collection (1)')).toBeInTheDocument();
    });

    it('should call onSelectContributor when Explore is clicked', () => {
        const recipes = [createMockRecipe({ contributor: 'Carol' })];
        renderWithProviders(
            <ContributorsView recipes={recipes} gallery={[]} trivia={[]} contributors={[]} onSelectContributor={mockOnSelect} />
        );
        fireEvent.click(screen.getByText('Explore Collection (1)'));
        expect(mockOnSelect).toHaveBeenCalledWith('Carol');
    });

    it('should include gallery and trivia contributions in totals', () => {
        const recipes = [createMockRecipe({ contributor: 'Alice' })];
        const gallery = [{ id: 'g1', type: 'image' as const, url: 'x', caption: 'x', contributor: 'Alice' }];
        const trivia = [{ id: 't1', question: 'Q', options: ['A'], answer: 'A', contributor: 'Alice' }];
        renderWithProviders(
            <ContributorsView recipes={recipes} gallery={gallery} trivia={trivia} contributors={[]} onSelectContributor={mockOnSelect} />
        );
        expect(screen.getByText('Explore Collection (3)')).toBeInTheDocument();
    });

    it('should filter contributors by search', () => {
        const recipes = [
            createMockRecipe({ contributor: 'Alice' }),
            createMockRecipe({ contributor: 'Bob' }),
        ];
        renderWithProviders(
            <ContributorsView recipes={recipes} gallery={[]} trivia={[]} contributors={[]} onSelectContributor={mockOnSelect} />
        );
        fireEvent.change(screen.getByPlaceholderText('Search contributors…'), { target: { value: 'alice' } });
        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.queryByText('Bob')).not.toBeInTheDocument();
    });
});
