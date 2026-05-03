/**
 * Lighthouse CI — used by `.github/workflows/lighthouse-ci.yml`.
 * Override URL: `LHCI_URL=https://example.com/ npx @lhci/cli autorun`
 */
const url = (process.env.LHCI_URL || 'https://schafer-family-cookbook.vercel.app/').trim();

module.exports = {
  ci: {
    collect: {
      url: [url],
      numberOfRuns: 1,
      settings: {
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
  },
};
