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
  logoUrl: 'https://images.unsplash.com/photo-1500076656116-558758c991c1?auto=format&fit=crop&q=80&w=1000',
  primary: '#2D4635',
  accent: '#A0522D',
  background: '#FDFBF7',
  establishedYear: 'Est. 2024',
  superAdminIdentifiers: ['kyle', 'hondo4185@gmail.com'],
  categories: ['Breakfast', 'Main', 'Dessert', 'Side', 'Appetizer', 'Bread', 'Dip/Sauce', 'Snack'],
  loginCopy: {
    title: 'Identify Yourself',
    subtitle: 'Welcome to the Schafer Family Archive.',
    placeholder: 'e.g. Grandma Joan',
    cta: 'Enter The Archive',
    helpText: 'Need access? Contact an administrator.',
  },
  galleryCopy: {
    title: 'Family Gallery',
    subtitle: 'Captured moments across the generations.',
    textPromptTitle: 'Text your memories',
    textPromptHint: 'Photo/Video to:',
    noPhoneHint: 'Admins can enable text-to-archive in Admin → Gallery. Or ask an administrator to add your memories.',
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
