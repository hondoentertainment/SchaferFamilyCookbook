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
        // Bars set as warnings — ratchet up over time toward 0.9+ once content
        // sprint and image pipeline land.
        'categories:performance': ['warn', { minScore: 0.8 }],
        'categories:accessibility': ['warn', { minScore: 0.95 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.95 }],
      },
    },
  },
};
