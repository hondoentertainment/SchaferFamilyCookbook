import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
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

    it('shows no error toast when navigator.share is rejected with AbortError (user cancels)', async () => {
        const abortError = new DOMException('Share cancelled', 'AbortError');
        vi.stubGlobal('navigator', {
            ...navigator,
            share: vi.fn().mockRejectedValueOnce(abortError),
            clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
        });

        const recipe = createMockRecipe({ id: 'abc123', title: 'Test Dish' });
        renderWithProviders(<ShareRecipe recipe={recipe} />);

        fireEvent.click(screen.getByRole('button', { name: /share via system/i }));

        // Wait a tick for the async handler to settle
        await waitFor(() => {
            // The share button should still be present (no crash)
            expect(screen.getByRole('button', { name: /share via system/i })).toBeInTheDocument();
        });

        // The toast container is always mounted; verify it has no visible message text
        // (an AbortError / user cancellation must be silent — no "Share failed" text)
        expect(screen.queryByText(/share failed/i)).not.toBeInTheDocument();
        // The status container should be empty (no child toast items)
        expect(screen.getByRole('status')).toBeEmptyDOMElement();
    });

    it('shows an error toast when navigator.clipboard.writeText fails', async () => {
        vi.stubGlobal('navigator', {
            ...navigator,
            share: undefined,
            clipboard: {
                writeText: vi.fn().mockRejectedValueOnce(new Error('clipboard blocked')),
            },
        });

        const recipe = createMockRecipe({ id: 'abc123', title: 'Test Dish' });
        renderWithProviders(<ShareRecipe recipe={recipe} />);

        fireEvent.click(screen.getByRole('button', { name: /copy share link/i }));

        await waitFor(() => {
            expect(screen.getByRole('status')).toHaveTextContent(/Could not copy link/i);
        });
    });

    it('falls back to clipboard copy when navigator.share is not available', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('navigator', {
            ...navigator,
            share: undefined,
            clipboard: { writeText },
        });

        const recipe = createMockRecipe({ id: 'abc123', title: 'Test Dish' });
        renderWithProviders(<ShareRecipe recipe={recipe} />);

        fireEvent.click(screen.getByRole('button', { name: /share via system/i }));

        // Without navigator.share the handler falls back to handleCopyText which
        // calls clipboard.writeText with the full recipe text
        await waitFor(() => {
            expect(writeText).toHaveBeenCalledTimes(1);
        });

        // A success toast should appear confirming the copy
        await waitFor(() => {
            expect(screen.getByRole('status')).toHaveTextContent(/copied to clipboard/i);
        });
    });
});
