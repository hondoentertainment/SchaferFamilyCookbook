/** Deterministic portrait-style SVG for contributors without a stored profile photo. */
const DICEBEAR_NOTIONISTS = 'https://api.dicebear.com/7.x/notionists/svg';

export function contributorAvatarUrlForName(name: string): string {
    return `${DICEBEAR_NOTIONISTS}?seed=${encodeURIComponent(name.trim())}&backgroundColor=e7e5e4`;
}
