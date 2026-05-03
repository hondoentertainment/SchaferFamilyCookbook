import { defineConfig } from 'vitest/config';

/** Firestore security rules suite — runs under `firebase emulators:exec` (Node env, no DOM). */
export default defineConfig({
    test: {
        environment: 'node',
        include: ['firebase/**/*.rules.test.ts'],
        testTimeout: 120_000,
        hookTimeout: 120_000,
        globals: true,
        setupFiles: [],
    },
});
