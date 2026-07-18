/**
 * Lighthouse CI — used by `.github/workflows/lighthouse-ci.yml`.
 * Override URL: `LHCI_URL=https://example.com/ npx @lhci/cli autorun`
 */
const url = (process.env.LHCI_URL || 'https://schafer-family-cookbook.vercel.app/').trim();

const chromeFlags = '--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage';
const blockedUrlPatterns = [
  'firestore.googleapis.com',
  'firebaseio.com',
  'fcm.googleapis.com',
];

module.exports = {
  ci: {
    collect: {
      url: [url],
      numberOfRuns: 1,
      // Top-level flags are required for Chrome launch on GitHub Actions runners.
      chromePath: process.env.CHROME_PATH || undefined,
      settings: {
        chromeFlags,
        blockedUrlPatterns,
        maxWaitForLoad: 45000,
        preset: 'desktop',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.45 }],
        'categories:accessibility': ['warn', { minScore: 0.85 }],
        'categories:best-practices': ['warn', { minScore: 0.8 }],
        'categories:seo': ['warn', { minScore: 0.85 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: './.lighthouseci',
    },
  },
};
