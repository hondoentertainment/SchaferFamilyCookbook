import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { ProfileView } from './ProfileView';
import { renderWithProviders, createMockRecipe, createMockHistoryEntry, createMockContributor } from '../test/utils';

describe('ProfileView', () => {
    const mockOnUpdateProfile = vi.fn();
    const mockOnEditRecipe = vi.fn();
    const mockUser = createMockContributor({ name: 'Test User', role: 'user' });

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
        onUpdateProfile: mockOnUpdateProfile,
        onEditRecipe: mockOnEditRecipe,
    };

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
        expect(screen.getByText('No recipes shared yet.')).toBeInTheDocument();
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
