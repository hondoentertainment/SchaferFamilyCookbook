export function contributorAvatarUrlForName(name: string): string {
    const label = (name.trim() || 'Family')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('') || 'F';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    }
    const hue = hash % 360;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="hsl(${hue} 32% 86%)"/><circle cx="48" cy="38" r="18" fill="hsl(${hue} 28% 58%)"/><path d="M18 88c4-20 20-34 30-34s26 14 30 34" fill="hsl(${hue} 28% 58%)"/><text x="48" y="86" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#2D4635">${label}</text></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
