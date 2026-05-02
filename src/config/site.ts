import { RECIPE_CATEGORIES } from '../constants/taxonomy';
import { COLORS } from '../constants/theme';

/**
 * Site configuration for multi-tenant / forkable recipe platforms.
 * Customize this file to rebrand the app for your family or organization.
 */
export interface SiteConfig {
  /** Site name shown in header, title, login */
  siteName: string;
  /** Short tagline, e.g. "The Schafer Collection" */
  tagline?: string;
  /** Site description for meta tags and SEO */
  description: string;
  /** Base URL for canonical links and share URLs (no trailing slash) */
  baseUrl: string;
  /** Logo URL (square recommended for PWA) */
  logoUrl: string;
  /** Favicon URL */
  faviconUrl?: string;

  /** Primary brand color (hex) */
  primary: string;
  /** Accent color (hex) */
  accent: string;
  /** Background color (hex) */
  background: string;

  /** Year or "Est. YYYY" for hero badge */
  establishedYear?: string;

  /** Copy for login screen */
  loginCopy?: {
    title: string;
    subtitle: string;
    placeholder: string;
    cta: string;
    helpText: string;
    /** Short trust bullets shown under the sign-in card */
    trustStrip?: string[];
  };

  /** Copy for gallery section */
  galleryCopy?: {
    title: string;
    subtitle: string;
    textPromptTitle: string;
    textPromptHint: string;
    noPhoneHint: string;
  };

  /** Super-admin emails/names (always get admin role) */
  superAdminIdentifiers: string[];

  /** Categories (used in filter dropdown; must match Recipe.category type) */
  categories: readonly string[];
}

const defaultConfig: SiteConfig = {
  siteName: 'Schafer Family Cookbook',
  tagline: 'The Schafer Collection',
  description: 'A digital archive of heirloom recipes, family photos, and culinary history.',
  baseUrl: 'https://schafer-family-cookbook.vercel.app',
  logoUrl: '/icons/icon-512.svg',
  primary: COLORS.primary,
  accent: COLORS.accent,
  background: COLORS.background,
  establishedYear: 'Est. 2024',
  superAdminIdentifiers: ['kyle', 'hondo4185@gmail.com'],
  categories: RECIPE_CATEGORIES,
  loginCopy: {
    title: "Who's cooking?",
    subtitle:
      'Choose your name to personalize favorites, notes, and the recipes you return to in the family archive.',
    placeholder: 'Your name or nickname',
    cta: 'Continue',
    helpText: 'Need access? Contact a cookbook custodian.',
    trustStrip: [
      'No password — pick the name your family knows you by.',
      'Favorites and notes stay on this device; cloud sync depends on family setup.',
      'Custodians manage the shared recipe directory.',
    ],
  },
  galleryCopy: {
    title: 'Family Gallery',
    subtitle: 'Captured moments across the generations.',
    textPromptTitle: 'Text your memories',
    textPromptHint: 'Photo/Video to:',
    noPhoneHint: 'Admins can enable text-to-archive in Profile → Admin Tools → Gallery. Or ask an administrator to add your memories.',
  },
};

export const siteConfig: SiteConfig = defaultConfig;

/** Check if a name/email is a super admin */
export function isSuperAdmin(identifier: string | undefined): boolean {
  if (!identifier) return false;
  const lower = identifier.toLowerCase().trim();
  return siteConfig.superAdminIdentifiers.some(
    (id) => id.toLowerCase() === lower
  );
}
