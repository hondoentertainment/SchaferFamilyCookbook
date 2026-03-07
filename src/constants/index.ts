export const CATEGORY_IMAGES: Record<string, string> = {
    Breakfast: '/recipe-images/imported_0mcur1qkv.jpg',
    Main: '/recipe-images/imported_0nxpd2143.jpg',
    Dessert: '/recipe-images/imported_13bpozmcw.jpg',
    Side: '/recipe-images/imported_1j7fp2qer.jpg',
    Appetizer: '/recipe-images/imported_1kh0ch5oi.jpg',
    Bread: '/recipe-images/imported_1nk7cfmgb.jpg',
    'Dip/Sauce': '/recipe-images/imported_2d7dp02gp.jpg',
    Snack: '/recipe-images/imported_3bdtp5u52.jpg',
    Generic: '/recipe-images/imported_3hbv3ty65.jpg'
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

