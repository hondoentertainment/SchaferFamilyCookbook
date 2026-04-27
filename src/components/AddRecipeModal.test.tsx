import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { AddRecipeModal } from './AddRecipeModal';
import { renderWithProviders, createMockContributor } from '../test/utils';

// Mock geminiProxy so AI calls never hit the network
vi.mock('../services/geminiProxy', () => ({
    magicImport: vi.fn(),
    generateImage: vi.fn(),
    generateContent: vi.fn(),
}));

import * as geminiProxy from '../services/geminiProxy';

const defaultProps = {
    onAddRecipe: vi.fn(),
    onClose: vi.fn(),
    contributors: [createMockContributor({ name: 'Alice' }), createMockContributor({ id: 'c2', name: 'Bob' })],
    currentUser: {
        id: 'u1',
        name: 'Test User',
        picture: '',
        role: 'user' as const,
        email: 'test@example.com',
    },
};

describe('AddRecipeModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('URL', {
            createObjectURL: vi.fn(() => 'blob:mock-url'),
            revokeObjectURL: vi.fn(),
        });
    });

    // --- Rendering ---

    it('renders the modal title', () => {
        renderWithProviders(<AddRecipeModal {...defaultProps} />);
        expect(screen.getByText('Add New Recipe')).toBeInTheDocument();
    });

    it('renders title input with label', () => {
        renderWithProviders(<AddRecipeModal {...defaultProps} />);
        expect(screen.getByLabelText(/recipe title/i)).toBeInTheDocument();
    });

    it('renders category select with label', () => {
        renderWithProviders(<AddRecipeModal {...defaultProps} />);
        expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
    });

    it('renders ingredients textarea with label', () => {
        renderWithProviders(<AddRecipeModal {...defaultProps} />);
        expect(screen.getByLabelText(/ingredients/i)).toBeInTheDocument();
    });

    it('renders instructions textarea with label', () => {
        renderWithProviders(<AddRecipeModal {...defaultProps} />);
        expect(screen.getByLabelText(/instructions/i)).toBeInTheDocument();
    });

    it('renders the AI magic import textarea and button', () => {
        renderWithProviders(<AddRecipeModal {...defaultProps} />);
        expect(screen.getByLabelText(/paste recipe text for ai/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /organize with ai/i })).toBeInTheDocument();
    });

    it('renders Cancel and Add Recipe buttons', () => {
        renderWithProviders(<AddRecipeModal {...defaultProps} />);
        expect(screen.getByRole('button', { name: /add recipe/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    // --- Submit button state ---

    it('AI Organize button is disabled when magic import textarea is empty', () => {
        renderWithProviders(<AddRecipeModal {...defaultProps} />);
        const aiBtn = screen.getByRole('button', { name: /organize with ai/i });
        expect(aiBtn).toBeDisabled();
    });

    it('AI Organize button becomes enabled after typing in the magic import textarea', () => {
        renderWithProviders(<AddRecipeModal {...defaultProps} />);
        const textarea = screen.getByLabelText(/paste recipe text for ai/i);
        fireEvent.change(textarea, { target: { value: 'Some recipe text' } });
        expect(screen.getByRole('button', { name: /organize with ai/i })).toBeEnabled();
    });

    // --- onClose callbacks ---

    it('calls onClose when the close (✕) button is clicked', () => {
        const onClose = vi.fn();
        renderWithProviders(<AddRecipeModal {...defaultProps} onClose={onClose} />);
        fireEvent.click(screen.getByRole('button', { name: /close/i }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when the Cancel button is clicked', () => {
        const onClose = vi.fn();
        renderWithProviders(<AddRecipeModal {...defaultProps} onClose={onClose} />);
        fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Escape key is pressed', () => {
        const onClose = vi.fn();
        renderWithProviders(<AddRecipeModal {...defaultProps} onClose={onClose} />);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    // --- Form submit with required fields ---

    it('calls onAddRecipe with correct data when form is filled and submitted', async () => {
        const onAddRecipe = vi.fn().mockResolvedValue(undefined);
        const onClose = vi.fn();
        renderWithProviders(<AddRecipeModal {...defaultProps} onAddRecipe={onAddRecipe} onClose={onClose} />);

        fireEvent.change(screen.getByLabelText(/recipe title/i), { target: { value: 'Grandma Pie' } });
        fireEvent.change(screen.getByLabelText(/ingredients/i), { target: { value: 'Apples\nSugar' } });
        fireEvent.change(screen.getByLabelText(/instructions/i), { target: { value: 'Mix and bake' } });

        fireEvent.submit(screen.getByRole('button', { name: /add recipe/i }).closest('form')!);

        await waitFor(() => {
            expect(onAddRecipe).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Grandma Pie',
                    ingredients: ['Apples', 'Sugar'],
                    instructions: ['Mix and bake'],
                }),
                undefined
            );
        });
    });

    it('calls onClose after successful submit', async () => {
        const onAddRecipe = vi.fn().mockResolvedValue(undefined);
        const onClose = vi.fn();
        renderWithProviders(<AddRecipeModal {...defaultProps} onAddRecipe={onAddRecipe} onClose={onClose} />);

        fireEvent.change(screen.getByLabelText(/recipe title/i), { target: { value: 'Grandma Pie' } });
        fireEvent.change(screen.getByLabelText(/ingredients/i), { target: { value: 'Apples' } });
        fireEvent.change(screen.getByLabelText(/instructions/i), { target: { value: 'Bake it' } });

        fireEvent.submit(screen.getByRole('button', { name: /add recipe/i }).closest('form')!);

        await waitFor(() => {
            expect(onClose).toHaveBeenCalled();
        });
    });

    it('does not call onAddRecipe when title is missing', async () => {
        const onAddRecipe = vi.fn();
        renderWithProviders(<AddRecipeModal {...defaultProps} onAddRecipe={onAddRecipe} />);

        fireEvent.change(screen.getByLabelText(/ingredients/i), { target: { value: 'Apples' } });
        fireEvent.change(screen.getByLabelText(/instructions/i), { target: { value: 'Bake it' } });

        fireEvent.submit(screen.getByRole('button', { name: /add recipe/i }).closest('form')!);

        await waitFor(() => {
            expect(onAddRecipe).not.toHaveBeenCalled();
        });
    });

    it('does not call onAddRecipe when ingredients are missing', async () => {
        const onAddRecipe = vi.fn();
        renderWithProviders(<AddRecipeModal {...defaultProps} onAddRecipe={onAddRecipe} />);

        fireEvent.change(screen.getByLabelText(/recipe title/i), { target: { value: 'Grandma Pie' } });
        fireEvent.change(screen.getByLabelText(/instructions/i), { target: { value: 'Bake it' } });

        fireEvent.submit(screen.getByRole('button', { name: /add recipe/i }).closest('form')!);

        await waitFor(() => {
            expect(onAddRecipe).not.toHaveBeenCalled();
        });
    });

    it('does not call onAddRecipe when instructions are missing', async () => {
        const onAddRecipe = vi.fn();
        renderWithProviders(<AddRecipeModal {...defaultProps} onAddRecipe={onAddRecipe} />);

        fireEvent.change(screen.getByLabelText(/recipe title/i), { target: { value: 'Grandma Pie' } });
        fireEvent.change(screen.getByLabelText(/ingredients/i), { target: { value: 'Apples' } });

        fireEvent.submit(screen.getByRole('button', { name: /add recipe/i }).closest('form')!);

        await waitFor(() => {
            expect(onAddRecipe).not.toHaveBeenCalled();
        });
    });

    // --- Category selection ---

    it('category select defaults to Main', () => {
        renderWithProviders(<AddRecipeModal {...defaultProps} />);
        const select = screen.getByLabelText(/category/i) as HTMLSelectElement;
        expect(select.value).toBe('Main');
    });

    it('can change category', () => {
        renderWithProviders(<AddRecipeModal {...defaultProps} />);
        const select = screen.getByLabelText(/category/i) as HTMLSelectElement;
        fireEvent.change(select, { target: { value: 'Dessert' } });
        expect(select.value).toBe('Dessert');
    });

    // --- AI Magic Import ---

    it('shows loading state (Analyzing...) while magic import is pending', async () => {
        let resolve!: (v: Record<string, unknown>) => void;
        (geminiProxy.magicImport as ReturnType<typeof vi.fn>).mockReturnValueOnce(
            new Promise<Record<string, unknown>>((r) => { resolve = r; })
        );

        renderWithProviders(<AddRecipeModal {...defaultProps} />);

        fireEvent.change(screen.getByLabelText(/paste recipe text for ai/i), { target: { value: 'Lasagna recipe' } });
        fireEvent.click(screen.getByRole('button', { name: /organize with ai/i }));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /analyzing/i })).toBeInTheDocument();
        });

        // Clean up by resolving the promise
        resolve({ title: 'Lasagna' });
    });

    it('populates form fields after successful magic import', async () => {
        (geminiProxy.magicImport as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            title: 'Magic Lasagna',
            ingredients: ['noodles', 'cheese'],
            instructions: ['Boil', 'Layer', 'Bake'],
        });

        renderWithProviders(<AddRecipeModal {...defaultProps} />);

        fireEvent.change(screen.getByLabelText(/paste recipe text for ai/i), { target: { value: 'Lasagna recipe text' } });
        fireEvent.click(screen.getByRole('button', { name: /organize with ai/i }));

        await waitFor(() => {
            const titleInput = screen.getByLabelText(/recipe title/i) as HTMLInputElement;
            expect(titleInput.value).toBe('Magic Lasagna');
        });
    });

    it('shows an error when magic import rejects with a network error', async () => {
        (geminiProxy.magicImport as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
            new Error('fetch failed: network error')
        );

        renderWithProviders(<AddRecipeModal {...defaultProps} />);

        fireEvent.change(screen.getByLabelText(/paste recipe text for ai/i), { target: { value: 'Some text' } });
        fireEvent.click(screen.getByRole('button', { name: /organize with ai/i }));

        await waitFor(() => {
            expect(screen.getByTestId('toast-stack')).toBeInTheDocument();
        });
    });

    it('disables AI button during cooldown after a quota error', async () => {
        (geminiProxy.magicImport as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
            new Error('429 quota exceeded')
        );

        renderWithProviders(<AddRecipeModal {...defaultProps} />);

        fireEvent.change(screen.getByLabelText(/paste recipe text for ai/i), { target: { value: 'Some text' } });
        fireEvent.click(screen.getByRole('button', { name: /organize with ai/i }));

        // Two buttons show cooldown (Generate Photo + Organize with AI); both should be disabled
        await waitFor(() => {
            const cooldownBtns = screen.getAllByRole('button', { name: /cooldown/i });
            expect(cooldownBtns.length).toBeGreaterThanOrEqual(1);
            cooldownBtns.forEach((btn) => expect(btn).toBeDisabled());
        });
    });

    // --- Accessibility ---

    it('all primary inputs have associated labels', () => {
        renderWithProviders(<AddRecipeModal {...defaultProps} />);

        expect(screen.getByLabelText(/recipe title/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/ingredients/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/instructions/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/paste recipe text for ai/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/contributed by/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/heirloom notes/i)).toBeInTheDocument();
    });

    it('modal has role="dialog" with aria-modal and a labelled title', () => {
        renderWithProviders(<AddRecipeModal {...defaultProps} />);
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog).toHaveAttribute('aria-labelledby', 'add-recipe-modal-title');
    });
});
