import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { Header } from './Header';
import { renderWithProviders, createMockContributor } from '../test/utils';

describe('Header', () => {
    const mockSetTab = vi.fn();
    const mockOnLogout = vi.fn();
    const mockUser = createMockContributor();
    const mockStats = {
        recipeCount: 10,
        galleryCount: 5,
        triviaCount: 3,
        isCloudActive: false,
        activeProvider: 'local' as const
    };

    const defaultProps = {
        activeTab: 'Recipes',
        setTab: mockSetTab,
        currentUser: {
            id: mockUser.id,
            name: mockUser.name,
            picture: mockUser.avatar,
            role: mockUser.role,
            email: mockUser.email
        },
        dbStats: mockStats,
        onLogout: mockOnLogout,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Mock scrollIntoView
        window.HTMLElement.prototype.scrollIntoView = vi.fn();
    });

    it('should render logical logo and navigation', () => {
        renderWithProviders(<Header {...defaultProps} />);

        expect(screen.getByRole('button', { name: 'Go to Recipes' })).toBeInTheDocument();
        expect(screen.getByText('Archive')).toBeInTheDocument();
        expect(screen.getByText('Recipes')).toBeInTheDocument();
        expect(screen.getByText('A–Z')).toBeInTheDocument();
        expect(screen.getByText('Family Story')).toBeInTheDocument();
    });

    it('should call setTab when a navigation button is clicked', () => {
        renderWithProviders(<Header {...defaultProps} />);

        fireEvent.click(screen.getByText('Gallery'));
        expect(mockSetTab).toHaveBeenCalledWith('Gallery');
    });

    it('should highlight the active tab', () => {
        renderWithProviders(<Header {...defaultProps} activeTab="Gallery" />);

        const galleryButton = screen.getByText('Gallery');
        expect(galleryButton).toHaveClass('bg-[#2D4635]');
        expect(galleryButton).toHaveClass('text-white');
    });

    it('should show user profile when logged in', () => {
        renderWithProviders(<Header {...defaultProps} />);

        const profileBtn = screen.getByRole('button', { name: new RegExp(`${mockUser.name}.*view profile`, 'i') });
        expect(profileBtn).toBeInTheDocument();
        expect(profileBtn.querySelector('img')).toBeInTheDocument();
    });

    it('should switch to Profile tab when user clicks their profile', () => {
        renderWithProviders(<Header {...defaultProps} />);

        fireEvent.click(screen.getByRole('button', { name: /view profile/i }));
        expect(mockSetTab).toHaveBeenCalledWith('Profile');
    });

    it('should call onLogout when Log out is clicked', () => {
        renderWithProviders(<Header {...defaultProps} />);

        fireEvent.click(screen.getByText('Log out'));
        expect(mockOnLogout).toHaveBeenCalled();
    });
});
