import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { SectionSubNav } from './SectionSubNav';
import { RECIPES_SECONDARY_NAV } from '../config/navConfig';
import { renderWithProviders } from '../test/utils';

describe('SectionSubNav', () => {
    it('shows the hub label and marks the active page', () => {
        const onSelect = vi.fn();
        renderWithProviders(
            <SectionSubNav
                ariaLabel="Recipe browsing navigation"
                items={RECIPES_SECONDARY_NAV}
                activeTab="Index"
                onSelect={onSelect}
            />,
        );

        expect(screen.getByTestId('section-subnav-hub')).toHaveTextContent(/Browse/i);
        const az = screen.getByRole('button', { name: /A–Z/i });
        expect(az).toHaveAttribute('aria-current', 'page');
        fireEvent.click(screen.getByRole('button', { name: /Collections/i }));
        expect(onSelect).toHaveBeenCalledWith('Collections');
    });
});
