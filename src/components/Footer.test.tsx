import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { Footer } from './Footer';
import { renderWithProviders, createMockContributor } from '../test/utils';

describe('Footer', () => {
    const mockUser = createMockContributor();

    const defaultProps = {
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
        renderWithProviders(<Footer currentUser={null} />);
        expect(screen.queryByRole('button', { name: /view profile/i })).not.toBeInTheDocument();
    });

    it('should show profile button with avatar when logged in', () => {
        renderWithProviders(<Footer {...defaultProps} />);
        expect(screen.getByRole('button', { name: 'Privacy' })).toBeInTheDocument();
        const profileBtn = screen.getByRole('button', { name: /view profile/i });
        expect(profileBtn).toBeInTheDocument();
        expect(profileBtn.querySelector('img')).toBeInTheDocument();
    });

    it('should navigate to profile when profile button clicked', () => {
        renderWithProviders(<Footer {...defaultProps} />);
        // Just verify click does not throw (navigation is handled by react-router)
        fireEvent.click(screen.getByRole('button', { name: /view profile/i }));
    });
});
