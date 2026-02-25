export const CATEGORY_IMAGES: Record<string, string> = {
    Breakfast: "https://images.unsplash.com/photo-1493770348161-369560ae357d?auto=format&fit=crop&q=80&w=800",
    Main: "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&q=80&w=800",
    Dessert: "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&q=80&w=800",
    Side: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=800",
    Appetizer: "https://images.unsplash.com/photo-1541529086526-db283c563270?auto=format&fit=crop&q=80&w=800",
    Bread: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=800",
    'Dip/Sauce': "https://images.unsplash.com/photo-1541414779316-956a5084c0d4?auto=format&fit=crop&q=80&w=800",
    Snack: "https://images.unsplash.com/photo-1629115916087-7e8c114a24ed?auto=format&fit=crop&q=80&w=800",
    Generic: "https://images.unsplash.com/photo-1495195129352-aec325a55b65?auto=format&fit=crop&q=80&w=800"
};

/** Lifelike portrait avatars from randomuser.me (99 men + 99 women = 198). Used in Admin avatar picker. */
export const HERITAGE_AVATARS: string[] = (() => {
    const base = 'https://randomuser.me/api/portraits';
    const avatars: string[] = [];
    for (let i = 1; i <= 99; i++) {
        avatars.push(`${base}/men/${i}.jpg`);
        avatars.push(`${base}/women/${i}.jpg`);
    }
    return avatars;
})();

/** Neutral silhouette used when a user has no avatar assigned (e.g. on sign-in). */
export const PLACEHOLDER_AVATAR = `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#d6d3d1"/><circle cx="50" cy="38" r="18" fill="#a8a29e"/><path d="M20 92c0-16 13-30 30-30s30 14 30 30z" fill="#a8a29e"/></svg>'
)}`;
