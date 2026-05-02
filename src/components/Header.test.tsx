import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { Header } from './Header';
import { renderWithProviders, createMockContributor } from '../test/utils';
import { siteConfig } from '../config/site';

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
        activeTab: 'Home',
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
        window.HTMLElement.prototype.scrollIntoView = vi.fn();
    });

    it('should render logo and the five primary navigation tabs', () => {
        renderWithProviders(<Header {...defaultProps} />);

        expect(screen.getByRole('button', { name: `${siteConfig.siteName} \u2014 go to home` })).toBeInTheDocument();
        expect(screen.getByText('Schafer Cookbook')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^Home$/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^Recipes$/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^Family$/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^Groceries$/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^Me$/ })).toBeInTheDocument();
    });

    it('should NOT render the legacy More menu', () => {
        renderWithProviders(<Header {...defaultProps} />);
        expect(screen.queryByRole('button', { name: 'More sections' })).not.toBeInTheDocument();
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('should call setTab when a navigation button is clicked', () => {
        renderWithProviders(<Header {...defaultProps} />);

        fireEvent.click(screen.getByRole('button', { name: /^Family$/ }));
        expect(mockSetTab).toHaveBeenCalledWith('Gallery');
    });

    it('should highlight the active tab', () => {
        renderWithProviders(<Header {...defaultProps} activeTab="Gallery" />);

        const galleryButton = screen.getByRole('button', { name: /^Family$/ });
        expect(galleryButton).toHaveClass('bg-[#2D4635]');
        expect(galleryButton).toHaveClass('text-white');
    });

    it('should show signed-in user identity when logged in', () => {
        renderWithProviders(<Header {...defaultProps} />);

        expect(screen.getByLabelText(new RegExp(`${mockUser.name}.*signed in`, 'i'))).toBeInTheDocument();
    });

    it('should switch to Profile tab when user clicks Me', () => {
        renderWithProviders(<Header {...defaultProps} />);

        fireEvent.click(screen.getByTestId('nav-profile'));
        expect(mockSetTab).toHaveBeenCalledWith('Profile');
    });

    it('should call onLogout when Log out is clicked', () => {
        renderWithProviders(<Header {...defaultProps} />);

        fireEvent.click(screen.getByText('Log out'));
        expect(mockOnLogout).toHaveBeenCalled();
    });

    it('should call setTab("Home") when brand logo receives Enter/Space keydown', () => {
        renderWithProviders(<Header {...defaultProps} />);
        const logoBtn = screen.getByRole('button', { name: `${siteConfig.siteName} \u2014 go to home` });

        fireEvent.keyDown(logoBtn, { key: 'Enter' });
        expect(mockSetTab).toHaveBeenCalledWith('Home');

        mockSetTab.mockClear();

        fireEvent.keyDown(logoBtn, { key: ' ' });
        expect(mockSetTab).toHaveBeenCalledWith('Home');
    });

    it('should call setTab("Profile") when Me receives Enter/Space keydown', () => {
        renderWithProviders(<Header {...defaultProps} />);
        const profileBtn = screen.getByTestId('nav-profile');

        fireEvent.keyDown(profileBtn, { key: 'Enter' });
        expect(mockSetTab).toHaveBeenCalledWith('Profile');

        fireEvent.keyDown(profileBtn, { key: ' ' });
    });
});
