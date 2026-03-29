import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { LoginView } from './LoginView';
import { renderWithProviders, createMockContributor } from '../test/utils';

vi.mock('../config/site', () => ({
    isSuperAdmin: () => false,
}));

vi.mock('../utils/avatarFallback', () => ({
    avatarOnError: vi.fn(),
}));

describe('LoginView', () => {
    const mockOnLogin = vi.fn();
    const contributors = [
        createMockContributor({ id: 'c1', name: 'Grandma Joan', avatar: 'https://example.com/joan.jpg', role: 'admin', email: 'joan@example.com' }),
        createMockContributor({ id: 'c2', name: 'Uncle Bob', avatar: 'https://example.com/bob.jpg', role: 'user' }),
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('renders name input and submit button', () => {
        renderWithProviders(<LoginView onLogin={mockOnLogin} contributors={contributors} />);

        expect(screen.getByLabelText(/legacy contributor name/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /enter the archive/i })).toBeInTheDocument();
    });

    it('calls onLogin with user profile when name submitted', () => {
        renderWithProviders(<LoginView onLogin={mockOnLogin} contributors={contributors} />);

        const input = screen.getByLabelText(/legacy contributor name/i);
        fireEvent.change(input, { target: { value: 'Grandma Joan' } });
        fireEvent.submit(screen.getByRole('button', { name: /enter the archive/i }));

        expect(mockOnLogin).toHaveBeenCalledTimes(1);
        const user = mockOnLogin.mock.calls[0][0];
        expect(user.name).toBe('Grandma Joan');
        expect(user.id).toBe('c1');
        expect(user.role).toBe('admin');
    });

    it('shows contributor match indicator when known name entered', () => {
        renderWithProviders(<LoginView onLogin={mockOnLogin} contributors={contributors} />);

        const input = screen.getByLabelText(/legacy contributor name/i);
        fireEvent.change(input, { target: { value: 'Grandma Joan' } });

        expect(screen.getByText(/known family profile found/i)).toBeInTheDocument();
    });

    it('shows new guest indicator for unknown name', () => {
        renderWithProviders(<LoginView onLogin={mockOnLogin} contributors={contributors} />);

        const input = screen.getByLabelText(/legacy contributor name/i);
        fireEvent.change(input, { target: { value: 'Stranger' } });

        expect(screen.getByText(/new archive guest/i)).toBeInTheDocument();
    });

    it('does not submit when name is empty', () => {
        renderWithProviders(<LoginView onLogin={mockOnLogin} contributors={contributors} />);

        fireEvent.submit(screen.getByRole('button', { name: /enter the archive/i }));

        expect(mockOnLogin).not.toHaveBeenCalled();
    });

    it('does not submit when name is only whitespace', () => {
        renderWithProviders(<LoginView onLogin={mockOnLogin} contributors={contributors} />);

        const input = screen.getByLabelText(/legacy contributor name/i);
        fireEvent.change(input, { target: { value: '   ' } });
        fireEvent.submit(screen.getByRole('button', { name: /enter the archive/i }));

        expect(mockOnLogin).not.toHaveBeenCalled();
    });

    it('shows contributor list sections (Recipes, Gallery, Trivia, Family Story)', () => {
        renderWithProviders(<LoginView onLogin={mockOnLogin} contributors={contributors} />);

        expect(screen.getByText('Recipes')).toBeInTheDocument();
        expect(screen.getByText('Gallery')).toBeInTheDocument();
        expect(screen.getByText('Trivia')).toBeInTheDocument();
        expect(screen.getByText('Family Story')).toBeInTheDocument();
    });

    it('creates new user profile for unknown contributor', () => {
        renderWithProviders(<LoginView onLogin={mockOnLogin} contributors={contributors} />);

        const input = screen.getByLabelText(/legacy contributor name/i);
        fireEvent.change(input, { target: { value: 'NewPerson' } });
        fireEvent.submit(screen.getByRole('button', { name: /enter the archive/i }));

        expect(mockOnLogin).toHaveBeenCalledTimes(1);
        const user = mockOnLogin.mock.calls[0][0];
        expect(user.name).toBe('NewPerson');
        expect(user.role).toBe('user');
    });
});
