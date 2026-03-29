/** Centralized theme constants – import instead of hardcoding hex values */
export const COLORS = {
  primary: '#2D4635',
  accent: '#A0522D',
  background: '#FDFBF7',
} as const;

export const Z_INDEX = {
  dropdown: 50,
  header: 50,
  bottomNav: 40,
  modal: 100,
  lightbox: 150,
  confirmDialog: 200,
  toast: 300,
  skipLink: 9999,
} as const;

export const TIMING = {
  toastDurationMs: 4000,
  aiCooldownMs: 5 * 60 * 1000,
  feedbackDelayMs: 1500,
  scrollThreshold: 200,
} as const;
