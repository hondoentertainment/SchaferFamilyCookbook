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
        expect(screen.getByText('Privacy')).toBeInTheDocument();
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

    it('should call setTab("Recipes") when Archive logo receives Enter/Space keydown', () => {
        renderWithProviders(<Header {...defaultProps} />);
        const logoBtn = screen.getByRole('button', { name: 'Go to Recipes' });

        fireEvent.keyDown(logoBtn, { key: 'Enter' });
        expect(mockSetTab).toHaveBeenCalledWith('Recipes');

        mockSetTab.mockClear();

        fireEvent.keyDown(logoBtn, { key: ' ' });
        expect(mockSetTab).toHaveBeenCalledWith('Recipes');
    });

    it('should call setTab("Profile") when Profile button receives Enter/Space keydown', () => {
        renderWithProviders(<Header {...defaultProps} />);
        const profileBtn = screen.getByTestId('nav-profile');

        fireEvent.keyDown(profileBtn, { key: 'Enter' });
        expect(mockSetTab).toHaveBeenCalledWith('Profile');

        fireEvent.keyDown(profileBtn, { key: ' ' });
    });

    it('should toggle More menu and handle mobile extra tabs', () => {
        renderWithProviders(<Header {...defaultProps} />);

        const moreBtn = screen.getByRole('button', { name: 'More sections' });

        // Open
        fireEvent.click(moreBtn);
        expect(screen.getByRole('menu')).toBeInTheDocument();

        const familyStoryMenuBtn = screen.getByRole('menuitem', { name: 'Family Story' });
        fireEvent.click(familyStoryMenuBtn);
        expect(mockSetTab).toHaveBeenCalledWith('Family Story');

        // Menu should be closed after clicking an item
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('should close More menu when clicking outside', () => {
        renderWithProviders(<Header {...defaultProps} />);
        const moreBtn = screen.getByRole('button', { name: 'More sections' });

        fireEvent.click(moreBtn);
        expect(screen.getByRole('menu')).toBeInTheDocument();

        fireEvent.click(document.body);
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('should close More menu on Escape key press', () => {
        renderWithProviders(<Header {...defaultProps} />);
        const moreBtn = screen.getByRole('button', { name: 'More sections' });

        fireEvent.click(moreBtn);
        expect(screen.getByRole('menu')).toBeInTheDocument();

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
});
