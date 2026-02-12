import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, render } from '@testing-library/react';
import { AvatarPicker } from './AvatarPicker';

describe('AvatarPicker', () => {
    const mockOnSelect = vi.fn();
    const mockOnClose = vi.fn();

    it('should render header and avatar grid', () => {
        render(
            <AvatarPicker
                currentAvatar="https://example.com/avatar1.jpg"
                onSelect={mockOnSelect}
                onClose={mockOnClose}
            />
        );
        expect(screen.getByText('Heritage Identity Library')).toBeInTheDocument();
        expect(screen.getByText('Select a legacy representative')).toBeInTheDocument();
        expect(screen.getByText('Save Identity')).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should call onClose when Cancel is clicked', () => {
        render(
            <AvatarPicker
                currentAvatar="https://example.com/avatar1.jpg"
                onSelect={mockOnSelect}
                onClose={mockOnClose}
            />
        );
        fireEvent.click(screen.getByText('Cancel'));
        expect(mockOnClose).toHaveBeenCalled();
    });

    it('should call onSelect and onClose when Save Identity is clicked', () => {
        render(
            <AvatarPicker
                currentAvatar="https://example.com/avatar1.jpg"
                onSelect={mockOnSelect}
                onClose={mockOnClose}
            />
        );
        fireEvent.click(screen.getByText('Save Identity'));
        expect(mockOnSelect).toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalled();
    });
});

