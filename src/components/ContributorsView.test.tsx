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

    it('shows a Spotlight button when onOpenSpotlight is provided and fires it with the name', () => {
        const onOpenSpotlight = vi.fn();
        const recipes = [createMockRecipe({ contributor: 'Carol' })];
        renderWithProviders(
            <ContributorsView
                recipes={recipes}
                gallery={[]}
                trivia={[]}
                contributors={[]}
                onSelectContributor={mockOnSelect}
                onOpenSpotlight={onOpenSpotlight}
            />
        );
        fireEvent.click(screen.getByTestId('open-contributor-spotlight'));
        expect(onOpenSpotlight).toHaveBeenCalledWith('Carol');
    });

    it('hides the Spotlight button when onOpenSpotlight is not provided', () => {
        const recipes = [createMockRecipe({ contributor: 'Carol' })];
        renderWithProviders(
            <ContributorsView recipes={recipes} gallery={[]} trivia={[]} contributors={[]} onSelectContributor={mockOnSelect} />
        );
        expect(screen.queryByTestId('open-contributor-spotlight')).not.toBeInTheDocument();
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

    it('should show Browse recipes button when onGoToRecipes is provided and there are no contributors', () => {
        const mockOnGoToRecipes = vi.fn();
        renderWithProviders(
            <ContributorsView
                recipes={[]}
                gallery={[]}
                trivia={[]}
                contributors={[]}
                onSelectContributor={mockOnSelect}
                onGoToRecipes={mockOnGoToRecipes}
            />
        );
        expect(screen.getByText('No contributors yet.')).toBeInTheDocument();
        const browseBtn = screen.getByRole('button', { name: 'Browse recipes' });
        expect(browseBtn).toBeInTheDocument();
        fireEvent.click(browseBtn);
        expect(mockOnGoToRecipes).toHaveBeenCalled();
    });

    it('should call onViewGallery when View photos is clicked', () => {
        const mockOnViewGallery = vi.fn();
        const gallery = [{ id: 'g1', type: 'image' as const, url: 'x', caption: 'x', contributor: 'Alice' }];
        renderWithProviders(
            <ContributorsView
                recipes={[]}
                gallery={gallery}
                trivia={[]}
                contributors={[]}
                onSelectContributor={mockOnSelect}
                onViewGallery={mockOnViewGallery}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /View 1 photo from Alice/i }));
        expect(mockOnViewGallery).toHaveBeenCalledWith('Alice');
    });

    it('should not count pending gallery items toward contributor photo totals', () => {
        const gallery = [
            { id: 'g1', type: 'image' as const, url: 'x', caption: 'x', contributor: 'Alice' },
            { id: 'g2', type: 'image' as const, url: 'y', caption: 'y', contributor: 'Alice', status: 'pending' as const },
        ];
        renderWithProviders(
            <ContributorsView recipes={[]} gallery={gallery} trivia={[]} contributors={[]} onSelectContributor={mockOnSelect} />
        );
        expect(screen.getByText(/1 memory/i)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /View photos/i })).not.toBeInTheDocument();
    });
});
