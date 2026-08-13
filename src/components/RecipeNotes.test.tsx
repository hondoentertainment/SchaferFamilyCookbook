import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { RecipeNotes } from './RecipeNotes';
import { renderWithProviders, setupLocalStorage } from '../test/utils';

// Mock modules that touch external state so tests stay isolated
vi.mock('../utils/haptics', () => ({
    hapticLight: vi.fn(),
}));

vi.mock('../services/userPrefsSync', () => ({
    notifyPrefsChanged: vi.fn(),
    deriveUserId: (displayName?: string | null) => {
        if (!displayName) return null;
        const slug = displayName
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        return slug || null;
    },
}));

const defaultProps = {
    recipeId: 'recipe-123',
    recipeTitle: 'Apple Pie',
    currentUserName: 'Test User',
};

describe('RecipeNotes', () => {
    beforeEach(() => {
        setupLocalStorage();
        vi.clearAllMocks();
    });

    // --- Empty state ---

    it('shows empty-state message when there are no notes', () => {
        renderWithProviders(<RecipeNotes {...defaultProps} />);
        expect(screen.getByText(/no notes yet/i)).toBeInTheDocument();
    });

    it('renders the section heading', () => {
        renderWithProviders(<RecipeNotes {...defaultProps} />);
        expect(screen.getByText(/family notes/i)).toBeInTheDocument();
    });

    it('renders the note input field with a label', () => {
        renderWithProviders(<RecipeNotes {...defaultProps} />);
        expect(screen.getByLabelText(/write a note/i)).toBeInTheDocument();
    });

    it('renders the Post button', () => {
        renderWithProviders(<RecipeNotes {...defaultProps} />);
        expect(screen.getByRole('button', { name: /post note/i })).toBeInTheDocument();
    });

    // --- Post button disabled state ---

    it('Post button is disabled when the input is empty', () => {
        renderWithProviders(<RecipeNotes {...defaultProps} />);
        expect(screen.getByRole('button', { name: /post note/i })).toBeDisabled();
    });

    it('Post button becomes enabled after typing in the input', () => {
        renderWithProviders(<RecipeNotes {...defaultProps} />);
        fireEvent.change(screen.getByLabelText(/write a note/i), { target: { value: 'Great recipe!' } });
        expect(screen.getByRole('button', { name: /post note/i })).toBeEnabled();
    });

    // --- Adding a note ---

    it('displays the note after clicking Post', () => {
        renderWithProviders(<RecipeNotes {...defaultProps} />);

        fireEvent.change(screen.getByLabelText(/write a note/i), { target: { value: 'This is delicious!' } });
        fireEvent.click(screen.getByRole('button', { name: /post note/i }));

        expect(screen.getByText('This is delicious!')).toBeInTheDocument();
    });

    it('clears the input after posting a note', () => {
        renderWithProviders(<RecipeNotes {...defaultProps} />);

        const input = screen.getByLabelText(/write a note/i) as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'A note to post' } });
        fireEvent.click(screen.getByRole('button', { name: /post note/i }));

        expect(input.value).toBe('');
    });

    it('shows the note author name', () => {
        renderWithProviders(<RecipeNotes {...defaultProps} />);

        fireEvent.change(screen.getByLabelText(/write a note/i), { target: { value: 'My tip' } });
        fireEvent.click(screen.getByRole('button', { name: /post note/i }));

        expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    it('updates the note count in the heading after posting', () => {
        renderWithProviders(<RecipeNotes {...defaultProps} />);

        fireEvent.change(screen.getByLabelText(/write a note/i), { target: { value: 'Note one' } });
        fireEvent.click(screen.getByRole('button', { name: /post note/i }));

        expect(screen.getByText(/family notes \(1\)/i)).toBeInTheDocument();
    });

    // --- Adding via Enter key ---

    it('posts a note when Enter is pressed in the input', () => {
        renderWithProviders(<RecipeNotes {...defaultProps} />);

        fireEvent.change(screen.getByLabelText(/write a note/i), { target: { value: 'Enter key note' } });
        fireEvent.keyDown(screen.getByLabelText(/write a note/i), { key: 'Enter' });

        expect(screen.getByText('Enter key note')).toBeInTheDocument();
    });

    it('does not post when Enter is pressed with an empty input', () => {
        renderWithProviders(<RecipeNotes {...defaultProps} />);

        fireEvent.keyDown(screen.getByLabelText(/write a note/i), { key: 'Enter' });

        expect(screen.getByText(/no notes yet/i)).toBeInTheDocument();
    });

    // --- Delete a note ---

    it('shows a Delete button only for notes belonging to the current user', () => {
        renderWithProviders(<RecipeNotes {...defaultProps} />);

        fireEvent.change(screen.getByLabelText(/write a note/i), { target: { value: 'My own note' } });
        fireEvent.click(screen.getByRole('button', { name: /post note/i }));

        expect(screen.getByRole('button', { name: /delete note/i })).toBeInTheDocument();
    });

    it('removes the note after clicking Delete', () => {
        renderWithProviders(<RecipeNotes {...defaultProps} />);

        fireEvent.change(screen.getByLabelText(/write a note/i), { target: { value: 'Delete me' } });
        fireEvent.click(screen.getByRole('button', { name: /post note/i }));

        expect(screen.getByText('Delete me')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /delete note/i }));

        expect(screen.queryByText('Delete me')).not.toBeInTheDocument();
        expect(screen.getByText(/no notes yet/i)).toBeInTheDocument();
    });

    it('does not show a Delete button for notes from another user', () => {
        // Pre-seed a note from a different user in localStorage
        const otherNote = JSON.stringify([{
            id: 'n-other',
            recipeId: defaultProps.recipeId,
            userName: 'Other Person',
            text: 'Someone else note',
            timestamp: new Date().toISOString(),
        }]);
        localStorage.setItem('schafer_notes', otherNote);

        renderWithProviders(<RecipeNotes {...defaultProps} />);

        expect(screen.getByText('Someone else note')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /delete note/i })).not.toBeInTheDocument();
    });

    // --- Existing notes in localStorage ---

    it('renders pre-existing notes from localStorage on mount', () => {
        const existing = JSON.stringify([{
            id: 'n-existing',
            recipeId: defaultProps.recipeId,
            userName: 'Test User',
            text: 'Pre-existing tip',
            timestamp: new Date().toISOString(),
        }]);
        localStorage.setItem('schafer_notes', existing);

        renderWithProviders(<RecipeNotes {...defaultProps} />);

        expect(screen.getByText('Pre-existing tip')).toBeInTheDocument();
    });

    it('only shows notes for the matching recipeId', () => {
        const notes = JSON.stringify([
            {
                id: 'n1',
                recipeId: defaultProps.recipeId,
                userName: 'Test User',
                text: 'Right recipe note',
                timestamp: new Date().toISOString(),
            },
            {
                id: 'n2',
                recipeId: 'other-recipe',
                userName: 'Test User',
                text: 'Wrong recipe note',
                timestamp: new Date().toISOString(),
            },
        ]);
        localStorage.setItem('schafer_notes', notes);

        renderWithProviders(<RecipeNotes {...defaultProps} />);

        expect(screen.getByText('Right recipe note')).toBeInTheDocument();
        expect(screen.queryByText('Wrong recipe note')).not.toBeInTheDocument();
    });

    // --- Accessibility ---

    it('section has aria-label "Family notes"', () => {
        renderWithProviders(<RecipeNotes {...defaultProps} />);
        expect(screen.getByRole('region', { name: /family notes/i })).toBeInTheDocument();
    });
});
