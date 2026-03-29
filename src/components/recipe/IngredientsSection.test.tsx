import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { IngredientsSection } from './IngredientsSection';
import { renderWithProviders } from '../../test/utils';

describe('IngredientsSection', () => {
    const defaultProps = {
        ingredients: ['1 cup flour', '2 eggs', '1/2 cup sugar'],
        baseServings: 4,
        scaleTo: 4,
        onScaleChange: vi.fn(),
        scaleFlash: false,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders ingredient list', () => {
        renderWithProviders(<IngredientsSection {...defaultProps} />);

        expect(screen.getByText('1 cup flour')).toBeInTheDocument();
        expect(screen.getByText('2 eggs')).toBeInTheDocument();
        expect(screen.getByText('1/2 cup sugar')).toBeInTheDocument();
    });

    it('renders Ingredients heading', () => {
        renderWithProviders(<IngredientsSection {...defaultProps} />);

        expect(screen.getByText('Ingredients')).toBeInTheDocument();
    });

    it('shows serving scaler when baseServings > 0', () => {
        renderWithProviders(<IngredientsSection {...defaultProps} />);

        const scaler = screen.getByLabelText(/scale ingredients by serving size/i);
        expect(scaler).toBeInTheDocument();
    });

    it('does not show serving scaler when baseServings is 0', () => {
        renderWithProviders(
            <IngredientsSection {...defaultProps} baseServings={0} />
        );

        expect(screen.queryByLabelText(/scale ingredients by serving size/i)).not.toBeInTheDocument();
    });

    it('has copy button present', () => {
        renderWithProviders(<IngredientsSection {...defaultProps} />);

        expect(screen.getByRole('button', { name: /copy ingredients/i })).toBeInTheDocument();
    });

    it('renders all ingredient items as list items', () => {
        renderWithProviders(<IngredientsSection {...defaultProps} />);

        const items = screen.getAllByRole('listitem');
        expect(items).toHaveLength(3);
    });

    it('applies flash ring when scaleFlash is true', () => {
        const { container } = renderWithProviders(
            <IngredientsSection {...defaultProps} scaleFlash={true} />
        );

        const flashEl = container.querySelector('.ring-2');
        expect(flashEl).toBeInTheDocument();
    });
});
