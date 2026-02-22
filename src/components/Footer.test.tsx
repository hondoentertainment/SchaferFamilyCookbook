import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { Footer } from './Footer';
import { renderWithProviders, createMockContributor } from '../test/utils';

describe('Footer', () => {
    const mockSetTab = vi.fn();
    const mockUser = createMockContributor();

    const defaultProps = {
        activeTab: 'Recipes' as const,
        setTab: mockSetTab,
        currentUser: {
            id: mockUser.id,
            name: mockUser.name,
            picture: mockUser.avatar,
            role: mockUser.role,
            email: mockUser.email
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should not render when currentUser is null', () => {
        renderWithProviders(<Footer {...defaultProps} currentUser={null} />);
        expect(screen.queryByRole('button', { name: 'Admin tools' })).not.toBeInTheDocument();
    });

    it('should show Admin button when logged in', () => {
        renderWithProviders(<Footer {...defaultProps} />);
        expect(screen.getByRole('button', { name: 'Admin tools' })).toBeInTheDocument();
    });

    it('should show lock on Admin when user is not admin', () => {
        renderWithProviders(<Footer {...defaultProps} currentUser={{ ...defaultProps.currentUser!, role: 'user' }} />);
        expect(screen.getByText('🔒 Admin')).toBeInTheDocument();
    });

    it('should show Admin without lock when user is admin', () => {
        renderWithProviders(<Footer {...defaultProps} currentUser={{ ...defaultProps.currentUser!, role: 'admin' }} />);
        expect(screen.getByText('Admin')).toBeInTheDocument();
        expect(screen.queryByText('🔒 Admin')).not.toBeInTheDocument();
    });

    it('should call setTab with Admin when clicked', () => {
        renderWithProviders(<Footer {...defaultProps} />);
        fireEvent.click(screen.getByRole('button', { name: 'Admin tools' }));
        expect(mockSetTab).toHaveBeenCalledWith('Admin');
    });

    it('should show profile button with avatar when logged in', () => {
        renderWithProviders(<Footer {...defaultProps} />);
        const profileBtn = screen.getByRole('button', { name: /view profile/i });
        expect(profileBtn).toBeInTheDocument();
        expect(profileBtn.querySelector('img')).toBeInTheDocument();
    });

    it('should call setTab with Profile when profile button clicked', () => {
        renderWithProviders(<Footer {...defaultProps} />);
        fireEvent.click(screen.getByRole('button', { name: /view profile/i }));
        expect(mockSetTab).toHaveBeenCalledWith('Profile');
    });
});
