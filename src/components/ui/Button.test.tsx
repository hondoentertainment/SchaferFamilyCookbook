import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { Button } from './Button';
import { renderWithProviders } from '../../test/utils';

vi.mock('../../utils/haptics', () => ({ hapticLight: vi.fn() }));

describe('Button', () => {
    it('renders children and fires onClick', () => {
        const onClick = vi.fn();
        renderWithProviders(<Button onClick={onClick}>Save</Button>);
        const btn = screen.getByRole('button', { name: /save/i });
        fireEvent.click(btn);
        expect(onClick).toHaveBeenCalledOnce();
    });

    it('applies the primary variant by default', () => {
        renderWithProviders(<Button>Click</Button>);
        expect(screen.getByRole('button')).toHaveClass('bg-brand');
    });

    it('applies the danger variant', () => {
        renderWithProviders(<Button variant="danger">Delete</Button>);
        const btn = screen.getByRole('button');
        expect(btn.className).toMatch(/bg-red-50/);
    });

    it('defaults to type=button so it does not submit forms accidentally', () => {
        renderWithProviders(<Button>Action</Button>);
        expect(screen.getByRole('button').getAttribute('type')).toBe('button');
    });

    it('respects an explicit type prop', () => {
        renderWithProviders(<Button type="submit">Send</Button>);
        expect(screen.getByRole('button').getAttribute('type')).toBe('submit');
    });

    it('does not call onClick when disabled', () => {
        const onClick = vi.fn();
        renderWithProviders(
            <Button onClick={onClick} disabled>
                Locked
            </Button>,
        );
        fireEvent.click(screen.getByRole('button'));
        expect(onClick).not.toHaveBeenCalled();
    });
});
