import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BottomNav } from './BottomNav';

describe('BottomNav', () => {
    const user = {
        id: 'u1',
        name: 'Alice',
        picture: 'https://example.com/a.jpg',
        role: 'user' as const,
    };

    it('pads the five-tab bar for the iOS/Android home indicator', () => {
        render(<BottomNav activeTab="Home" setTab={() => undefined} currentUser={user} />);
        const nav = screen.getByTestId('bottom-nav');
        expect(nav.className).toMatch(/pb-\[env\(safe-area-inset-bottom/);
        expect(nav.className).toMatch(/pl-\[env\(safe-area-inset-left/);
        expect(screen.getByTestId('bottom-nav-home')).toHaveClass('min-h-11');
        expect(screen.getByTestId('bottom-nav-recipes')).toHaveClass('min-h-11');
        expect(screen.getByTestId('bottom-nav-family')).toHaveClass('min-h-11');
        expect(screen.getByTestId('bottom-nav-grocery')).toHaveClass('min-h-11');
        expect(screen.getByTestId('bottom-nav-profile')).toHaveClass('min-h-11');
    });
});
