import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { ShareRecipe } from './ShareRecipe';
import { buildFamilyMailtoHref, buildFamilySmsHref, getRecipeShareUrl } from '../utils/shareRecipe';
import { renderWithProviders, createMockRecipe } from '../test/utils';

describe('ShareRecipe component', () => {
    it('renders the share buttons and Send to family invites', () => {
        const recipe = createMockRecipe({ id: 'abc123', title: 'Test Dish' });
        renderWithProviders(<ShareRecipe recipe={recipe} />);
        expect(screen.getByRole('button', { name: /share via system/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /copy share link/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /copy recipe as text/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /text recipe invite/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /email recipe invite/i })).toBeInTheDocument();
        expect(screen.getByTestId('send-to-family')).toHaveTextContent(/send to family/i);
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

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /share via system/i })).toBeInTheDocument();
        });

        expect(screen.queryByText(/share failed/i)).not.toBeInTheDocument();
        expect(screen.getByTestId('toast-stack')).toBeEmptyDOMElement();
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
            expect(screen.getByTestId('toast-stack')).toHaveTextContent(/Could not copy link/i);
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

        await waitFor(() => {
            expect(writeText).toHaveBeenCalledTimes(1);
        });

        await waitFor(() => {
            expect(screen.getByTestId('toast-stack')).toHaveTextContent(/copied to clipboard/i);
        });
    });

    it('points SMS and mailto links at heirloom invites with the share URL', () => {
        const recipe = createMockRecipe({ id: 'abc123', title: 'Pie', contributor: 'Grandma' });
        renderWithProviders(<ShareRecipe recipe={recipe} />);
        const shareUrl = getRecipeShareUrl(recipe.id, import.meta.env.VITE_SHARE_BASE);

        const sms = screen.getByTestId('share-text-family');
        const mail = screen.getByTestId('share-email-family');
        expect(sms).toHaveAttribute('href', buildFamilySmsHref(recipe, shareUrl));
        expect(mail).toHaveAttribute('href', buildFamilyMailtoHref(recipe, shareUrl));
        expect(sms.getAttribute('href')).toMatch(/^sms:/);
        expect(mail.getAttribute('href')).toMatch(/^mailto:/);
    });

    it('featured variant leads with Send to family and uses the OG share URL', () => {
        const originalEnv = import.meta.env.VITE_SHARE_BASE;
        (import.meta.env as Record<string, string | undefined>).VITE_SHARE_BASE =
            'https://schafer-family-cookbook.vercel.app';
        try {
            const recipe = createMockRecipe({ id: 'kugel-1', title: 'Noodle Kugel' });
            renderWithProviders(<ShareRecipe recipe={recipe} variant="featured" />);
            expect(screen.getByTestId('share-recipe-featured')).toBeInTheDocument();
            expect(screen.getByRole('heading', { name: /send to family/i })).toBeInTheDocument();
            const shareUrl = 'https://schafer-family-cookbook.vercel.app/share/recipe/kugel-1';
            expect(screen.getByTestId('share-copy-link')).toHaveAttribute('data-share-url', shareUrl);
            expect(screen.getByTestId('share-email-family').getAttribute('href')).toContain(
                encodeURIComponent(shareUrl)
            );
        } finally {
            (import.meta.env as Record<string, string | undefined>).VITE_SHARE_BASE = originalEnv;
        }
    });
});
