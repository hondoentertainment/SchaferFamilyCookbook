import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { ShareRecipe, getRecipeShareUrl } from './ShareRecipe';
import { renderWithProviders, createMockRecipe } from '../test/utils';

describe('getRecipeShareUrl', () => {
    it('uses VITE_SHARE_BASE when provided', () => {
        const url = getRecipeShareUrl('abc123', 'https://cookbook.vercel.app');
        expect(url).toBe('https://cookbook.vercel.app/share/recipe/abc123');
    });

    it('strips trailing slashes from the share base', () => {
        const url = getRecipeShareUrl('abc123', 'https://cookbook.vercel.app///');
        expect(url).toBe('https://cookbook.vercel.app/share/recipe/abc123');
    });

    it('encodes recipe ids with special characters', () => {
        const url = getRecipeShareUrl('a b/c', 'https://cookbook.vercel.app');
        expect(url).toBe('https://cookbook.vercel.app/share/recipe/a%20b%2Fc');
    });

    it('falls back to the hash route on window.location.origin when base is unset', () => {
        const url = getRecipeShareUrl('abc123', undefined, 'https://example.github.io');
        expect(url).toBe('https://example.github.io/#recipe/abc123');
    });

    it('returns a hash-only URL if no origin is available', () => {
        const url = getRecipeShareUrl('abc123', undefined, '');
        expect(url).toBe('/#recipe/abc123');
    });
});

describe('ShareRecipe component', () => {
    it('renders the share buttons', () => {
        const recipe = createMockRecipe({ id: 'abc123', title: 'Test Dish' });
        renderWithProviders(<ShareRecipe recipe={recipe} />);
        expect(screen.getByRole('button', { name: /share via system/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /copy share link/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /copy recipe as text/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /text recipe/i })).toBeInTheDocument();
    });

    it('exposes the computed share URL on the Copy Link button (fallback origin)', () => {
        const recipe = createMockRecipe({ id: 'abc123' });
        renderWithProviders(<ShareRecipe recipe={recipe} />);
        const btn = screen.getByTestId('share-copy-link');
        const url = btn.getAttribute('data-share-url');
        // In the test env, VITE_SHARE_BASE is unset, so we expect the hash fallback.
        expect(url).toContain('#recipe/abc123');
    });

    it('uses the Vercel share base URL when VITE_SHARE_BASE is configured', () => {
        const originalEnv = import.meta.env.VITE_SHARE_BASE;
        (import.meta.env as Record<string, string | undefined>).VITE_SHARE_BASE =
            'https://cookbook.vercel.app';
        try {
            const recipe = createMockRecipe({ id: 'abc123' });
            renderWithProviders(<ShareRecipe recipe={recipe} />);
            const btn = screen.getByTestId('share-copy-link');
            expect(btn.getAttribute('data-share-url')).toBe(
                'https://cookbook.vercel.app/share/recipe/abc123'
            );
        } finally {
            (import.meta.env as Record<string, string | undefined>).VITE_SHARE_BASE = originalEnv;
        }
    });
});
