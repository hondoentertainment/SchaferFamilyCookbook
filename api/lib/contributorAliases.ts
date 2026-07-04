/** Mirror of src/constants/taxonomy.ts contributor aliases for server-side matching. */
const ALIASES: Record<string, string> = {
    'dawn schafer tessmer': 'Dawn',
    'dawn (schafer) tessmer': 'Dawn',
    dawn: 'Dawn',
    'harriet oehler schafer': 'Harriet',
    'harriet (oehler) schafer': 'Harriet',
    harriet: 'Harriet',
    'jana schafer': 'Jana',
    'robin henderson': 'Robin',
    wren: 'Wren',
    'wren feyereisen': 'Wren',
};

export function normalizeContributorKey(value?: string): string {
    const name = value?.trim() || '';
    const key = name.toLowerCase().replace(/\s+/g, ' ');
    return (ALIASES[key] ?? name).toLowerCase().replace(/\s+/g, ' ');
}

/** Returns true when token userName matches any of the requested keys (alias-aware). */
export function contributorNameMatches(tokenUserName: string, requestedKeys: Set<string>): boolean {
    if (requestedKeys.size === 0) return true;
    const tokenKey = normalizeContributorKey(tokenUserName);
    if (requestedKeys.has(tokenKey)) return true;
    for (const key of requestedKeys) {
        if (normalizeContributorKey(key) === tokenKey) return true;
    }
    return false;
}

export function normalizeContributorName(value?: string): string {
    const name = value?.trim() || 'Family';
    const key = name.toLowerCase().replace(/\s+/g, ' ');
    return ALIASES[key] ?? name;
}
