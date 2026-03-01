import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { AdminView } from './AdminView';
import {
    renderWithProviders,
    createMockRecipe,
    createMockTrivia,
    createMockContributor,
} from '../test/utils';

describe('AdminView', () => {
    const mockOnAddRecipe = vi.fn();
    const mockOnAddGallery = vi.fn();
    const mockOnAddTrivia = vi.fn();
    const mockOnDeleteTrivia = vi.fn();
    const mockOnDeleteRecipe = vi.fn();
    const mockOnUpdateContributor = vi.fn();
    const mockOnUpdateArchivePhone = vi.fn();
    const mockOnEditRecipe = vi.fn();
    const mockClearEditing = vi.fn();

    const defaultProps = {
        editingRecipe: null,
        clearEditing: mockClearEditing,
        recipes: [createMockRecipe({ id: 'r1', title: 'Apple Pie' }), createMockRecipe({ id: 'r2', title: 'Banana Bread' })],
        trivia: [createMockTrivia({ id: 't1', question: 'Test?' })],
        contributors: [createMockContributor({ name: 'Alice' })],
        currentUser: {
            id: 'u1',
            name: 'Admin User',
            picture: 'https://example.com/avatar.jpg',
            role: 'admin' as const,
            email: 'admin@test.com',
        },
        dbStats: {
            recipeCount: 2,
            galleryCount: 0,
            triviaCount: 1,
            isCloudActive: false,
            activeProvider: 'local' as const,
            archivePhone: '',
        },
        onAddRecipe: mockOnAddRecipe,
        onAddGallery: mockOnAddGallery,
        onAddTrivia: mockOnAddTrivia,
        onDeleteTrivia: mockOnDeleteTrivia,
        onDeleteRecipe: mockOnDeleteRecipe,
        onUpdateContributor: mockOnUpdateContributor,
        onUpdateArchivePhone: mockOnUpdateArchivePhone,
        onEditRecipe: mockOnEditRecipe,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('alert', vi.fn());
        vi.stubGlobal('confirm', vi.fn(() => true));
        vi.stubGlobal('URL', {
            createObjectURL: vi.fn(() => 'blob:mock'),
            revokeObjectURL: vi.fn(),
        });
    });

    it('should render Records tab by default with Manage Recipes', () => {
        renderWithProviders(<AdminView {...defaultProps} />);
        expect(screen.getAllByText('Manage Recipes').length).toBeGreaterThan(0);
        expect(screen.getByText('Manage Recipes (2)')).toBeInTheDocument();
    });

    it('should render subtabs for Recipes, Gallery, Trivia, Directory', () => {
        renderWithProviders(<AdminView {...defaultProps} />);
        expect(screen.getByText('📖 Recipes')).toBeInTheDocument();
        expect(screen.getByText('🖼️ Gallery')).toBeInTheDocument();
        expect(screen.getByText('💡 Trivia')).toBeInTheDocument();
        expect(screen.getByText('👥 Directory')).toBeInTheDocument();
    });

    it('should filter recipes by search', () => {
        renderWithProviders(<AdminView {...defaultProps} />);
        const searchInput = screen.getByPlaceholderText('Search recipes...');
        fireEvent.change(searchInput, { target: { value: 'Apple' } });
        expect(screen.getByText('Apple Pie')).toBeInTheDocument();
        expect(screen.queryByText('Banana Bread')).not.toBeInTheDocument();
        expect(screen.getByText(/Manage Recipes \(1 of 2\)/)).toBeInTheDocument();
    });

    it('should show empty state when search has no matches', () => {
        renderWithProviders(<AdminView {...defaultProps} />);
        fireEvent.change(screen.getByPlaceholderText('Search recipes...'), { target: { value: 'xyz' } });
        expect(screen.getByText(/No recipes match "xyz"/)).toBeInTheDocument();
    });

    it('should switch to Gallery tab', () => {
        renderWithProviders(<AdminView {...defaultProps} />);
        fireEvent.click(screen.getByText('🖼️ Gallery'));
        expect(screen.getAllByText('Family Archive').length).toBeGreaterThan(0);
    });

    it('should switch to Trivia tab', () => {
        renderWithProviders(<AdminView {...defaultProps} />);
        fireEvent.click(screen.getByText('💡 Trivia'));
        expect(screen.getAllByText('Family Trivia').length).toBeGreaterThan(0);
    });

    it('should switch to Directory tab', () => {
        renderWithProviders(<AdminView {...defaultProps} />);
        fireEvent.click(screen.getByText('👥 Directory'));
        expect(screen.getByText('Family Directory & Avatars')).toBeInTheDocument();
    });

    it('should show recipe form with title and ingredients inputs when editing', () => {
        const editingRecipe = createMockRecipe({ id: 'r1', title: 'Apple Pie' });
        renderWithProviders(<AdminView {...defaultProps} editingRecipe={editingRecipe} />);
        expect(screen.getByPlaceholderText('Recipe Title')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Ingredients (one per line)')).toBeInTheDocument();
    });

    it('should call onEditRecipe when Edit is clicked on a recipe', () => {
        renderWithProviders(<AdminView {...defaultProps} />);
        const editButtons = screen.getAllByText('Edit');
        fireEvent.click(editButtons[0]);
        expect(mockOnEditRecipe).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'Apple Pie' })
        );
    });

    it('should show editing banner when editingRecipe is set', () => {
        const editingRecipe = createMockRecipe({ id: 'r1', title: 'Apple Pie' });
        renderWithProviders(<AdminView {...defaultProps} editingRecipe={editingRecipe} />);
        expect(screen.getByText('Editing: Apple Pie')).toBeInTheDocument();
        expect(screen.getByText('Cancel Edit')).toBeInTheDocument();
    });

    it('should call clearEditing when Cancel Edit is clicked', () => {
        const editingRecipe = createMockRecipe({ id: 'r1', title: 'Apple Pie' });
        renderWithProviders(<AdminView {...defaultProps} editingRecipe={editingRecipe} />);
        fireEvent.click(screen.getByText('Cancel Edit'));
        expect(mockClearEditing).toHaveBeenCalled();
    });

    it('should show bulk image buttons', () => {
        renderWithProviders(<AdminView {...defaultProps} />);
        expect(screen.getByText('🖼️ Fill Missing (Imagen)')).toBeInTheDocument();
        expect(screen.getByText('🔄 Regenerate All (Imagen)')).toBeInTheDocument();
    });
});
