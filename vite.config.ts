import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer';
import { sentryVitePlugin } from '@sentry/vite-plugin';

/**
 * Build-time injector for the FCM service worker.
 *
 * Vite copies `public/firebase-messaging-sw.js` (the template) into the build
 * output during `writeBundle` (post-order, after vite-plugin-pwa). This plugin
 * then rewrites the copied file with the substituted config from
 * `VITE_FIREBASE_*` env vars (see scripts/sync-firebase-sw-config.mjs).
 *
 * Only runs for `vite build` — dev/preview keeps the placeholder so the SW
 * still loads without crashing when FCM isn't configured.
 *
 * The plugin is always lenient: missing env vars only produce a build-log
 * warning, never an error. The SW's runtime guard then disables FCM. Strict
 * enforcement is opt-in by running scripts/sync-firebase-sw-config.mjs as a
 * CI gate (it exits 1 when `NODE_ENV === 'production'` and env vars are
 * missing).
 */
function injectFirebaseMessagingSwConfig(env: Record<string, string>): Plugin {
  let outDir = 'dist';
  return {
    name: 'schafer:inject-firebase-messaging-sw-config',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    // Run after Vite copies public/ and vite-plugin-pwa finishes so our
    // substitution is not overwritten (closeBundle runs in reverse plugin order).
    writeBundle: {
      order: 'post',
      async handler() {
        const mod = await import('./scripts/sync-firebase-sw-config.mjs');
        // Merge Vite-loaded env (loadEnv) with process.env so CI-injected values
        // win when both are set, but `.env*` files still work locally.
        const merged: Record<string, string | undefined> = { ...env, ...process.env };
        try {
          await mod.syncFirebaseSwConfig({
            outDir: path.resolve(outDir),
            env: merged,
            isProduction: false,
          });
        } catch (err) {
          // The helper is invoked with isProduction:false above, so it never
          // throws on missing env vars. This catch handles unexpected I/O
          // failures (e.g. permission denied writing into dist/).
          // eslint-disable-next-line no-console
          console.warn(
            '[schafer:inject-firebase-messaging-sw-config] ' +
              (err instanceof Error ? err.message : String(err)),
          );
        }
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const base = process.env.BASE_PATH || '/';

  const release =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.CF_PAGES_COMMIT_SHA ||
    '';
  const sentryEnv =
    process.env.VERCEL_ENV || (mode === 'production' ? 'production' : mode);

  const sentryAuthOk =
    !!(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT);

  return {
    base,
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      tailwindcss(),
      react(),
      ViteImageOptimizer({
        test: /\.(jpe?g|png|gif|tiff|webp|svg|avif)$/i,
        exclude: undefined,
        include: undefined,
        includePublic: true,
        logStats: true,
        ansiColors: true,
        svg: {
          multipass: true,
          plugins: [
            {
              name: 'preset-default',
              params: {
                overrides: {
                  cleanupNumericValues: false,
                },
                cleanupIds: {
                  minify: false,
                  remove: false,
                },
              },
            },
            {
              name: 'removeViewBox',
              active: false,
            },
            'sortAttrs',
            {
              name: 'addAttributesToSVGElement',
              params: {
                attributes: [{ xmlns: 'http://www.w3.org/2000/svg' }],
              },
            },
          ],
        },
        png: {
          quality: 80,
        },
        jpeg: {
          quality: 75,
        },
        jpg: {
          quality: 75,
        },
        webp: {
          lossless: false,
        },
        avif: {
          lossless: false,
        },
      }),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'recipe-images/*'],
        manifest: {
          name: 'Schafer Family Cookbook',
          short_name: 'Schafer Cookbook',
          description: 'A digital archive of heirloom recipes, family photos, and culinary history.',
          theme_color: '#2D4635',
          background_color: '#FDFBF7',
          display: 'standalone',
          start_url: '/',
          icons: [
            {
              src: '/icons/icon-192.svg',
              sizes: '192x192',
              type: 'image/svg+xml',
              purpose: 'any maskable',
            },
            {
              src: '/icons/icon-512.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webp,jpg,jpeg}'],
          // The FCM service worker is owned by Firebase and registered
          // separately. Excluding it from precache also prevents a hash
          // mismatch when our post writeBundle hook rewrites it after the PWA
          // plugin has already produced its precache manifest.
          globIgnores: ['firebase-messaging-sw.js', 'firebase-messaging-sw.js.map'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /\/recipe-images\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'recipe-images-cache',
                expiration: { maxEntries: 250, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /^https:\/\/image\.pollinations\.ai\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'pollinations-images-cache',
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /^https:\/\/api\.dicebear\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'avatar-images-cache',
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 90 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
      ...(sentryAuthOk
        ? [
            sentryVitePlugin({
              org: process.env.SENTRY_ORG!,
              project: process.env.SENTRY_PROJECT!,
              authToken: process.env.SENTRY_AUTH_TOKEN!,
              telemetry: false,
            }),
          ]
        : []),
      injectFirebaseMessagingSwConfig(env),
    ],
    build: {
      target: 'es2022',
      minify: 'esbuild',
      sourcemap: sentryAuthOk ? 'hidden' : false,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-firebase': ['firebase/app', 'firebase/firestore', 'firebase/storage'],
            'vendor-firebase-auth': ['firebase/auth'],
          },
        },
      },
      chunkSizeWarningLimit: 500,
    },
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY),
      'process.env.VITE_GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY),
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY),
      'import.meta.env.VITE_SENTRY_RELEASE': JSON.stringify(release || env.VITE_SENTRY_RELEASE || ''),
      'import.meta.env.VITE_SENTRY_ENVIRONMENT': JSON.stringify(env.VITE_SENTRY_ENVIRONMENT || sentryEnv || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
