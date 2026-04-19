import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const base = process.env.BASE_PATH || '/';
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
                  removeViewBox: false,
                },
                cleanupIds: {
                  minify: false,
                  remove: false,
                },
              },
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
        // 'autoUpdate' silently takes control and reloads once new assets are
        // precached. We intentionally do NOT surface a "Refresh" toast —
        // vite-plugin-pwa auto-handles the reload, and custom prompts caused
        // race conditions with in-flight autoUpdate flows in prior tests.
        // Switch to 'prompt' + `useRegisterSW({ onNeedRefresh })` if we ever
        // want an explicit "Updated content available" toast.
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
              src: 'https://images.unsplash.com/photo-1500076656116-558758c991c1?auto=format&fit=crop&q=80&w=192',
              sizes: '192x192',
              type: 'image/jpeg',
              purpose: 'any maskable',
            },
            {
              src: 'https://images.unsplash.com/photo-1500076656116-558758c991c1?auto=format&fit=crop&q=80&w=512',
              sizes: '512x512',
              type: 'image/jpeg',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          // App shell (`/`, `/index.html`) and hashed JS/CSS stay precached via globPatterns.
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          globIgnores: ['**/recipe-images/**'],
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
            // Recipe images on local /recipe-images/** — offline-friendly.
            {
              urlPattern: /\/recipe-images\/.*\.(?:jpg|jpeg|png|webp)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'recipe-images',
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            // Broader fallback for any other /recipe-images/* asset (svg, avif, etc.).
            {
              urlPattern: /\/recipe-images\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'recipe-images-cache',
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            // Recipes JSON (recipes.json or /data/recipes*.json) — NetworkFirst so
            // freshly published recipes win when online, cache fallback offline.
            {
              urlPattern: /\/(?:data\/)?recipes.*\.json$/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'recipes-json',
                networkTimeoutSeconds: 3,
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 7 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            // Short-TTL NetworkFirst for OG/share API routes.
            {
              urlPattern: /\/api\/(?:og|share)(?:\/.*)?$/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-og-share',
                networkTimeoutSeconds: 3,
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
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
    ],
    build: {
      target: 'es2022',
      minify: 'esbuild',
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-firebase': ['firebase/app', 'firebase/firestore', 'firebase/storage'],
          },
        },
      },
      chunkSizeWarningLimit: 500,
    },
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY),
      'process.env.VITE_GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY),
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
