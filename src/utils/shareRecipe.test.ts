import { describe, it, expect } from 'vitest';
import { createMockRecipe } from '../test/utils';
import {
    buildFamilyInviteBody,
    buildFamilyInviteSubject,
    buildFamilyMailtoHref,
    buildFamilySmsHref,
    getRecipeShareUrl,
} from './shareRecipe';

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

describe('family invite copy', () => {
    it('includes title, contributor context, URL, and sign-off', () => {
        const recipe = createMockRecipe({ title: 'Apple Pie', contributor: 'Ada' });
        const url = 'https://example.com/share/recipe/apple';
        const body = buildFamilyInviteBody(recipe, url);
        expect(body).toContain('Apple Pie');
        expect(body).toContain("From Ada's corner of the archive.");
        expect(body).toContain(url);
        expect(body).toContain('Thought you\'d love this heirloom recipe');
        expect(body).toContain('Schafer Family Cookbook');
    });

    it('omits contributor line when the name is blank', () => {
        const recipe = createMockRecipe({ title: 'Rolls', contributor: '' });
        const body = buildFamilyInviteBody(recipe, 'https://example.com/share/recipe/rolls');
        expect(body).toContain('Rolls');
        expect(body).not.toContain("corner of the archive");
    });

    it('builds a warm email subject', () => {
        const recipe = createMockRecipe({ title: 'Noodle Kugel' });
        expect(buildFamilyInviteSubject(recipe)).toBe('Noodle Kugel — Schafer Family Cookbook');
    });
});

describe('family invite hrefs', () => {
    const recipe = createMockRecipe({ id: 'pie-1', title: 'Pie', contributor: 'Grandma' });
    const shareUrl = 'https://schafer-family-cookbook.vercel.app/share/recipe/pie-1';

    it('builds an SMS compose link with heirloom copy and the share URL', () => {
        const href = buildFamilySmsHref(recipe, shareUrl, 'Mozilla/5.0 (Linux; Android 14)');
        expect(href).toMatch(/^sms:\?body=/);
        expect(href.startsWith('sms:')).toBe(true);
        const body = decodeURIComponent(href.replace(/^sms:\?body=/, ''));
        expect(body).toContain('heirloom recipe');
        expect(body).toContain(shareUrl);
        expect(body).toContain('From Grandma\'s corner of the archive.');
    });

    it('uses the iOS sms:&body= form so older iPhone composers receive the text', () => {
        const href = buildFamilySmsHref(recipe, shareUrl, 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)');
        expect(href).toMatch(/^sms:&body=/);
        expect(href).not.toMatch(/^sms:\?&/);
    });

    it('builds a mailto invite with subject and OG-rich share URL', () => {
        const href = buildFamilyMailtoHref(recipe, shareUrl);
        expect(href).toMatch(/^mailto:\?subject=/);
        const parsed = new URL(href);
        expect(parsed.searchParams.get('subject')).toBe('Pie — Schafer Family Cookbook');
        const body = parsed.searchParams.get('body') ?? '';
        expect(body).toContain(shareUrl);
        expect(body).toContain('Tap the link for the full recipe card');
    });
});
