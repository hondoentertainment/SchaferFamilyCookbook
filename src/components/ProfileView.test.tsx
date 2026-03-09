import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { ProfileView } from './ProfileView';
import { renderWithProviders, createMockRecipe, createMockHistoryEntry, createMockContributor } from '../test/utils';

describe('ProfileView', () => {
    const mockOnUpdateProfile = vi.fn();
    const mockOnEditRecipe = vi.fn();
    const mockUser = createMockContributor({ name: 'Test User', role: 'user' });
    const adminContributor = createMockContributor({ id: 'admin-1', name: 'Admin User', role: 'admin' });

    const defaultProps = {
        currentUser: {
            id: mockUser.id,
            name: mockUser.name,
            picture: mockUser.avatar,
            role: mockUser.role,
            email: mockUser.email,
        },
        userRecipes: [],
        userHistory: [],
        favoriteRecipes: [] as ReturnType<typeof createMockRecipe>[],
        recentRecipes: [] as ReturnType<typeof createMockRecipe>[],
        onViewRecipe: vi.fn(),
        onUpdateProfile: mockOnUpdateProfile,
        onEditRecipe: mockOnEditRecipe,
    };

    const createAdminSectionProps = (overrides = {}) => ({
        editingRecipe: null,
        clearEditing: vi.fn(),
        recipes: [],
        trivia: [],
        contributors: [adminContributor],
        dbStats: {
            recipeCount: 0,
            galleryCount: 0,
            triviaCount: 0,
            isCloudActive: false,
            activeProvider: 'local' as const,
        },
        onAddRecipe: vi.fn().mockResolvedValue(undefined),
        onAddGallery: vi.fn().mockResolvedValue(undefined),
        onAddTrivia: vi.fn().mockResolvedValue(undefined),
        onDeleteTrivia: vi.fn(),
        onDeleteRecipe: vi.fn(),
        onUpdateContributor: vi.fn().mockResolvedValue(undefined),
        onUpdateArchivePhone: vi.fn(),
        onEditRecipe: vi.fn(),
        defaultRecipeIds: [],
        ...overrides,
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render user profile with name and avatar', () => {
        renderWithProviders(<ProfileView {...defaultProps} />);
        expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
        expect(screen.getByAltText('Test User')).toBeInTheDocument();
    });

    it('should show Family Member status for non-admin', () => {
        renderWithProviders(<ProfileView {...defaultProps} />);
        expect(screen.getByText(/Family Member/)).toBeInTheDocument();
    });

    it('should show Legacy Custodian status for admin', () => {
        renderWithProviders(
            <ProfileView {...defaultProps} currentUser={{ ...defaultProps.currentUser, role: 'admin' }} />
        );
        expect(screen.getByText(/Legacy Custodian/)).toBeInTheDocument();
    });

    it('should render admin tools inline for admin users', () => {
        renderWithProviders(
            <ProfileView
                {...defaultProps}
                currentUser={{ ...defaultProps.currentUser, role: 'admin' }}
                adminSectionProps={createAdminSectionProps()}
            />
        );

        expect(screen.getByText('Archive control room')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /open admin tools/i })).toBeInTheDocument();
    });

    it('should scroll to admin tools when an admin edit session is active', async () => {
        const scrollIntoView = vi.fn();
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
            configurable: true,
            value: scrollIntoView,
        });

        renderWithProviders(
            <ProfileView
                {...defaultProps}
                currentUser={{ ...defaultProps.currentUser, role: 'admin' }}
                adminSectionProps={createAdminSectionProps({
                    editingRecipe: createMockRecipe({ title: 'Editing Target' }),
                })}
            />
        );

        await waitFor(() => {
            expect(scrollIntoView).toHaveBeenCalled();
        });
        expect(screen.getAllByText(/Editing: Editing Target/).length).toBeGreaterThan(0);
    });

    it('should display user recipes', () => {
        const recipes = [
            createMockRecipe({ title: 'My Recipe', contributor: 'Test User' }),
        ];
        renderWithProviders(<ProfileView {...defaultProps} userRecipes={recipes} />);
        expect(screen.getByText('My Recipe')).toBeInTheDocument();
    });

    it('should call onEditRecipe when edit button is clicked (admin only)', () => {
        const recipe = createMockRecipe({ title: 'Editable', contributor: 'Test User' });
        const adminProps = { ...defaultProps, currentUser: { ...defaultProps.currentUser, role: 'admin' as const } };
        renderWithProviders(<ProfileView {...adminProps} userRecipes={[recipe]} />);
        fireEvent.click(screen.getByRole('button', { name: /edit recipe/i }));
        expect(mockOnEditRecipe).toHaveBeenCalledWith(recipe);
    });

    it('should show View only for non-admin recipes (no edit button)', () => {
        const recipe = createMockRecipe({ title: 'Editable', contributor: 'Test User' });
        renderWithProviders(<ProfileView {...defaultProps} userRecipes={[recipe]} />);
        expect(screen.getByText('View only')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /edit recipe/i })).not.toBeInTheDocument();
    });

    it('should show empty state for no recipes', () => {
        renderWithProviders(<ProfileView {...defaultProps} />);
        expect(screen.getByText('When you contribute a recipe, it will be added to your family shelf here.')).toBeInTheDocument();
    });

    it('should display history entries', () => {
        const history = [
            createMockHistoryEntry({ itemName: 'Added Recipe', action: 'added', type: 'recipe' }),
        ];
        renderWithProviders(<ProfileView {...defaultProps} userHistory={history} />);
        expect(screen.getByText(/Added recipe/i)).toBeInTheDocument();
        expect(screen.getByText(/"Added Recipe"/)).toBeInTheDocument();
    });

    it('should call onUpdateProfile when Save Profile is clicked', async () => {
        mockOnUpdateProfile.mockResolvedValue(undefined);
        renderWithProviders(<ProfileView {...defaultProps} />);
        const saveBtn = screen.getByText('Save Profile');
        fireEvent.click(saveBtn);
        await waitFor(() => {
            expect(mockOnUpdateProfile).toHaveBeenCalled();
        });
    });
});
