import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '../constants/storage';
import { setupLocalStorage } from '../test/utils';
import { bootstrapFirebaseFromEnv, readFirebaseConfigFromEnv } from './bootstrapFirebaseFromEnv';

describe('bootstrapFirebaseFromEnv', () => {
    beforeEach(() => {
        setupLocalStorage();
        localStorage.clear();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('returns null when env vars are missing', () => {
        vi.stubEnv('VITE_FIREBASE_API_KEY', '');
        vi.stubEnv('VITE_FIREBASE_PROJECT_ID', '');
        expect(readFirebaseConfigFromEnv()).toBeNull();
    });

    it('builds config with derived authDomain and storageBucket', () => {
        vi.stubEnv('VITE_FIREBASE_API_KEY', 'test-key');
        vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'demo-proj');
        expect(readFirebaseConfigFromEnv()).toEqual({
            apiKey: 'test-key',
            projectId: 'demo-proj',
            authDomain: 'demo-proj.firebaseapp.com',
            storageBucket: 'demo-proj.firebasestorage.app',
        });
    });

    it('seeds localStorage when env is set and no prior config exists', () => {
        vi.stubEnv('VITE_FIREBASE_API_KEY', 'test-key');
        vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'demo-proj');
        bootstrapFirebaseFromEnv();

        expect(localStorage.getItem(STORAGE_KEYS.activeProvider)).toBe('firebase');
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.firebaseConfig) ?? '{}');
        expect(saved.apiKey).toBe('test-key');
        expect(saved.projectId).toBe('demo-proj');
    });

    it('does not overwrite existing firebase config', () => {
        vi.stubEnv('VITE_FIREBASE_API_KEY', 'new-key');
        vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'new-proj');
        localStorage.setItem(STORAGE_KEYS.activeProvider, 'firebase');
        localStorage.setItem(
            STORAGE_KEYS.firebaseConfig,
            JSON.stringify({ apiKey: 'keep', projectId: 'keep-proj' }),
        );

        bootstrapFirebaseFromEnv();

        const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.firebaseConfig) ?? '{}');
        expect(saved.apiKey).toBe('keep');
        expect(saved.projectId).toBe('keep-proj');
    });
});
