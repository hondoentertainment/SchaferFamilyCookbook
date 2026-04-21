import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { AddRecipeModal } from './AddRecipeModal';
import { renderWithProviders, createMockContributor } from '../test/utils';

describe('AddRecipeModal', () => {
    const defaultProps = {
        onAddRecipe: vi.fn().mockResolvedValue(true),
        onClose: vi.fn(),
        contributors: [createMockContributor({ name: 'Kyle' })],
        currentUser: {
            id: 'user-1',
            name: 'Kyle',
            picture: 'https://example.com/avatar.jpg',
            role: 'admin' as const,
            email: 'kyle@example.com',
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('autofocuses the recipe title input when opened', async () => {
        renderWithProviders(<AddRecipeModal {...defaultProps} />);

        await waitFor(() => {
            expect(screen.getByLabelText('Recipe Title')).toHaveFocus();
        });
    });

    it('closes when the backdrop is clicked', () => {
        renderWithProviders(<AddRecipeModal {...defaultProps} />);

        fireEvent.click(screen.getByRole('dialog', { name: 'Add New Recipe' }));

        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('closes when Escape is pressed', () => {
        renderWithProviders(<AddRecipeModal {...defaultProps} />);

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('submits parsed recipe fields to onAddRecipe', async () => {
        renderWithProviders(<AddRecipeModal {...defaultProps} />);

        fireEvent.change(screen.getByLabelText('Recipe Title'), { target: { value: 'Sunday Roast' } });
        fireEvent.change(screen.getByPlaceholderText('Ingredients (one per line)'), { target: { value: 'Potatoes\nBeef' } });
        fireEvent.change(screen.getByPlaceholderText('Instructions (one per line)'), { target: { value: 'Prep\nRoast' } });

        fireEvent.click(screen.getByRole('button', { name: 'Add Recipe' }));

        await waitFor(() => {
            expect(defaultProps.onAddRecipe).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Sunday Roast',
                    contributor: 'Kyle',
                    ingredients: ['Potatoes', 'Beef'],
                    instructions: ['Prep', 'Roast'],
                }),
                undefined
            );
        });
    });
});
