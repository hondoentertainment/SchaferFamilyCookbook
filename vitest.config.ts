import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'happy-dom',
        setupFiles: [path.resolve(__dirname, 'src/test/setup.ts')],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'text-summary', 'json', 'json-summary', 'html'],
            // Reports against actual code only, not test/setup boilerplate.
            include: ['src/**/*.{ts,tsx}', 'api/**/*.ts', 'scripts/**/*.{mjs,ts}'],
            exclude: [
                'node_modules/',
                'src/test/',
                'src/index.tsx',
                'src/vite-env.d.ts',
                'src/data/recipes.json',
                'api/recipes.seed.generated.ts',
                'scripts/sync-recipes-for-api.mjs',
                'scripts/backup-recipes-json.mjs',
                'scripts/smoke-prod.mjs',
                'scripts/merge-contributors*.{js,mjs}',
                'scripts/generate-*.mjs',
                'scripts/download-*.mjs',
                'scripts/rebuild-*.mjs',
                'scripts/verify-*.mjs',
                'scripts/normalize-*.mjs',
                'scripts/bulk-*.mjs',
                'scripts/deploy-*.mjs',
                // Manual, credential-gated ops CLIs (Vercel/Firebase env
                // configuration): exercised against live services, not
                // testable in CI — same class as deploy-*/verify-* above.
                'scripts/configure-*.mjs',
                'scripts/productionize.mjs',
                'scripts/finalize-launch.mjs',
                'scripts/bootstrap-credentials.mjs',
                'scripts/custodian-runbook.mjs',
                'scripts/run-next-steps.mjs',
                'scripts/load-local-env.mjs',
                'scripts/set-archive-phone.mjs',
                'scripts/lib/**',
                'scripts/set-admin-claim.mjs',
                'api/lib/recipeImagePrompts.ts',
                'scripts/sync-firebase-sw-config.test.mjs',
                '**/*.test.{ts,tsx,mjs}',
                '**/*.spec.{ts,tsx,mjs}',
                '**/*.d.ts',
                '**/*.config.*',
                '**/mockData',
                'dist/',
            ],
            // Thresholds set just under current measured coverage so that any
            // regression fails CI but day-to-day churn does not. Bump these
            // upward as coverage improves; never lower them silently.
            thresholds: {
                lines: 61,
                statements: 59,
                branches: 55,
                functions: 58,
            },
        },
        include: [
            'src/**/*.{test,spec}.{ts,tsx}',
            'api/**/*.{test,spec}.{ts,tsx}',
            'scripts/**/*.{test,spec}.{ts,mjs}',
        ],
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
