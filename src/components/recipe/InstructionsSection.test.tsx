import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { InstructionsSection } from './InstructionsSection';
import { renderWithProviders } from '../../test/utils';

describe('InstructionsSection', () => {
    it('renders numbered steps', () => {
        const instructions = ['Preheat oven', 'Mix ingredients', 'Bake'];

        renderWithProviders(<InstructionsSection instructions={instructions} />);

        expect(screen.getByText('Preheat oven')).toBeInTheDocument();
        expect(screen.getByText('Mix ingredients')).toBeInTheDocument();
        expect(screen.getByText('Bake')).toBeInTheDocument();

        // Step numbers (zero-padded)
        expect(screen.getByText('01')).toBeInTheDocument();
        expect(screen.getByText('02')).toBeInTheDocument();
        expect(screen.getByText('03')).toBeInTheDocument();
    });

    it('renders Instructions heading', () => {
        renderWithProviders(<InstructionsSection instructions={['Step one']} />);

        expect(screen.getByText('Instructions')).toBeInTheDocument();
    });

    it('does not show jump buttons when fewer than 5 steps', () => {
        const instructions = ['Step 1', 'Step 2', 'Step 3'];

        renderWithProviders(<InstructionsSection instructions={instructions} />);

        expect(screen.queryByText(/jump to/i)).not.toBeInTheDocument();
    });

    it('shows jump buttons when 5 or more steps', () => {
        const instructions = [
            'Step one',
            'Step two',
            'Step three',
            'Step four',
            'Step five',
        ];

        renderWithProviders(<InstructionsSection instructions={instructions} />);

        expect(screen.getByText(/jump to/i)).toBeInTheDocument();
        // Should have jump buttons labeled "Go to step N"
        expect(screen.getByRole('button', { name: /go to step 1/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /go to step 5/i })).toBeInTheDocument();
    });

    it('shows jump buttons with correct count for 6 steps', () => {
        const instructions = Array.from({ length: 6 }, (_, i) => `Do thing ${i + 1}`);

        renderWithProviders(<InstructionsSection instructions={instructions} />);

        const jumpButtons = screen.getAllByRole('button', { name: /go to step/i });
        expect(jumpButtons).toHaveLength(6);
    });

    it('renders step IDs for scroll targeting', () => {
        const instructions = ['First step', 'Second step'];

        renderWithProviders(<InstructionsSection instructions={instructions} />);

        expect(document.getElementById('recipe-step-0')).toBeInTheDocument();
        expect(document.getElementById('recipe-step-1')).toBeInTheDocument();
    });
});
