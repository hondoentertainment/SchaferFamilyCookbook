import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, collection, setDoc, doc, getDoc, deleteDoc, updateDoc, query, orderBy, limit, getDocs, onSnapshot, Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, FirebaseStorage, connectStorageEmulator } from 'firebase/storage';
import { Recipe, GalleryItem, Trivia, ContributorProfile, HistoryEntry, StorySection, RecipeVersion } from '../types';
import defaultRecipes from '../data/recipes.json';
import { normalizeRecipe, normalizeRecipes } from '../constants/taxonomy';

async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxAttempts = 3,
    initialDelayMs = 1000
): Promise<T> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (err) {
            if (attempt === maxAttempts - 1) throw err;
            await new Promise(r => setTimeout(r, initialDelayMs * Math.pow(2, attempt)));
        }
    }
    throw new Error('Retry exhausted');
}

function validateRecipe(data: unknown): data is Recipe {
    if (typeof data !== 'object' || data === null) return false;
    const record = data as Record<string, unknown>;
    const requiredStringFields: (keyof Recipe)[] = ['id', 'title', 'contributor', 'category', 'image'];
    for (const field of requiredStringFields) {
        if (typeof record[field] !== 'string') {
            console.warn(`validateRecipe: missing or invalid string field "${field}"`, record);
            return false;
        }
    }
    const requiredArrayFields: (keyof Recipe)[] = ['ingredients', 'instructions'];
    for (const field of requiredArrayFields) {
        if (!Array.isArray(record[field])) {
            console.warn(`validateRecipe: missing or invalid array field "${field}"`, record);
            return false;
        }
    }
    return true;
}

function safeParseArray<T>(raw: string | null): T[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed as T[] : [];
    } catch (e) {
        console.warn('safeParseArray: failed to parse JSON', e);
        return [];
    }
}

const generatedDefaultImagesById = new Map(
    (defaultRecipes as Recipe[])
        .filter(recipe => recipe.imageSource === 'nano-banana' && recipe.image?.startsWith('/recipe-images/'))
        .map(recipe => [recipe.id, {
            image: recipe.image,
            imageSource: recipe.imageSource,
            generatedImageFallback: recipe.generatedImageFallback,
            generatedImagePrompt: recipe.generatedImagePrompt,
        }])
);

const generatedDefaultImagesByTitle = new Map(
    (defaultRecipes as Recipe[])
        .filter(recipe => recipe.imageSource === 'nano-banana' && recipe.image?.startsWith('/recipe-images/'))
        .map(recipe => [recipe.title.trim().toLowerCase(), {
            image: recipe.image,
            imageSource: recipe.imageSource,
            generatedImageFallback: recipe.generatedImageFallback,
            generatedImagePrompt: recipe.generatedImagePrompt,
        }])
);

function isUploadedImageSource(source?: Recipe['imageSource']): boolean {
    return source === 'upload';
}

function findGeneratedDefaultImage(recipe: Recipe) {
    return generatedDefaultImagesById.get(recipe.id) || generatedDefaultImagesByTitle.get(recipe.title.trim().toLowerCase());
}

function shouldUseGeneratedDefaultImage(recipe: Recipe): boolean {
    if (isUploadedImageSource(recipe.imageSource)) return false;
    const generatedDefault = findGeneratedDefaultImage(recipe);
    if (!generatedDefault) return false;
    if (recipe.image !== generatedDefault.image) return true;
    return recipe.imageSource !== generatedDefault.imageSource
        || recipe.generatedImageFallback !== generatedDefault.generatedImageFallback
        || recipe.generatedImagePrompt !== generatedDefault.generatedImagePrompt;
}

function normalizeRecipeImages(recipes: Recipe[]): Recipe[] {
    return recipes.map((recipe) => {
        const normalizedRecipe = normalizeRecipe(recipe);
        if (!shouldUseGeneratedDefaultImage(normalizedRecipe)) {
            return normalizedRecipe;
        }
        const generatedDefault = findGeneratedDefaultImage(normalizedRecipe);
        if (!generatedDefault) return normalizedRecipe;
        return {
            ...normalizedRecipe,
            image: generatedDefault.image,
            imageSource: generatedDefault.imageSource,
            generatedImageFallback: generatedDefault.generatedImageFallback,
            generatedImagePrompt: generatedDefault.generatedImagePrompt,
        };
    });
}

export const CloudArchive = {
    _firebaseApp: null as FirebaseApp | null,
    _firestore: null as Firestore | null,
    _storage: null as FirebaseStorage | null,

    getProvider(): 'local' | 'firebase' {
        const provider = localStorage.getItem('schafer_active_provider');
        return provider === 'firebase' ? 'firebase' : 'local';
    },

    getFirebase() {
        if (this._firebaseApp) return { app: this._firebaseApp, db: this._firestore!, storage: this._storage! };
        const saved = localStorage.getItem('schafer_firebase_config');
        if (!saved) return null;
        try {
            const config = JSON.parse(saved);
            if (!config.apiKey || !config.projectId) return null;
            // Initialize with more standard config if needed, but these are the core requirements
            const fbConfig = {
                apiKey: config.apiKey,
                projectId: config.projectId,
                authDomain: `${config.projectId}.firebaseapp.com`,
                storageBucket: `${config.projectId}.firebasestorage.app`,
            };
            const isNew = getApps().length === 0;
            this._firebaseApp = isNew ? initializeApp(fbConfig) : getApp();
            this._firestore = getFirestore(this._firebaseApp);
            this._storage = getStorage(this._firebaseApp);
            if (isNew && import.meta.env.VITE_FIREBASE_USE_EMULATOR === 'true') {
                connectFirestoreEmulator(this._firestore, 'localhost', 8080);
                connectStorageEmulator(this._storage, 'localhost', 9199);
            }
            return { app: this._firebaseApp, db: this._firestore, storage: this._storage };
        } catch (e) {
            console.error('Firebase connection failed:', e);
            return null;
        }
    },

    // Real-time Subscriptions
    subscribeRecipes(callback: (recipes: Recipe[]) => void, onError?: (error: Error) => void) {
        const fb = this.getFirebase();
        if (!fb) return () => { };
        const q = query(collection(fb.db, 'recipes'), orderBy('created_at', 'desc'));
        return onSnapshot(q, (snapshot) => {
            const recipes = snapshot.docs
                .map(doc => doc.data())
                .filter(validateRecipe);
            const normalizedList = normalizeRecipes(recipes);
            callback(normalizeRecipeImages(normalizedList));
        }, (error) => {
            if (onError) onError(error);
            else console.error('subscribeRecipes error:', error);
        });
    },

    subscribeTrivia(callback: (trivia: Trivia[]) => void, onError?: (error: Error) => void) {
        const fb = this.getFirebase();
        if (!fb) return () => { };
        const q = query(collection(fb.db, 'trivia'), orderBy('created_at', 'desc'));
        return onSnapshot(q, (snapshot) => {
            callback(snapshot.docs.map(doc => doc.data() as Trivia));
        }, (error) => {
            if (onError) onError(error);
            else console.error('subscribeTrivia error:', error);
        });
    },

    subscribeGallery(callback: (items: GalleryItem[]) => void, onError?: (error: Error) => void) {
        const fb = this.getFirebase();
        if (!fb) return () => { };
        const q = query(collection(fb.db, 'gallery'), orderBy('created_at', 'desc'));
        return onSnapshot(q, (snapshot) => {
            callback(snapshot.docs.map(doc => doc.data() as GalleryItem));
        }, (error) => {
            if (onError) onError(error);
            else console.error('subscribeGallery error:', error);
        });
    },

    subscribeHistory(callback: (history: HistoryEntry[]) => void, onError?: (error: Error) => void) {
        const fb = this.getFirebase();
        if (!fb) return () => { };
        const q = query(collection(fb.db, 'history'), orderBy('timestamp', 'desc'));
        return onSnapshot(q, (snapshot) => {
            callback(snapshot.docs.map(doc => doc.data() as HistoryEntry));
        }, (error) => {
            if (onError) onError(error);
            else console.error('subscribeHistory error:', error);
        });
    },

    /** Archive phone for Twilio MMS - synced via Firestore when Firebase is active. */
    subscribeArchivePhone(callback: (phone: string) => void, onError?: (error: Error) => void) {
        const fb = this.getFirebase();
        if (!fb) return () => { };
        return onSnapshot(doc(fb.db, 'config', 'settings'), (snapshot) => {
            const data = snapshot.data();
            callback(data?.archivePhone || localStorage.getItem('schafer_archive_phone') || '');
        }, (error) => {
            if (onError) onError(error);
            else console.error('subscribeArchivePhone error:', error);
        });
    },

    async setArchivePhone(phone: string): Promise<void> {
        localStorage.setItem('schafer_archive_phone', phone);
        const provider = this.getProvider();
        if (provider === 'firebase') {
            const fb = this.getFirebase();
            if (fb) {
                await setDoc(doc(fb.db, 'config', 'settings'), { archivePhone: phone }, { merge: true });
            }
        }
    },

    async uploadFile(file: File, folder: string): Promise<string | null> {
        const provider = this.getProvider();

        // Local mode fallback: Convert to Data URL
        if (provider !== 'firebase') {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }

        const fb = this.getFirebase();
        if (!fb) return null;

        const fileName = `${Date.now()}_${file.name.replace(/[^a-z0-9.]/gi, '_')}`;
        const storageRef = ref(fb.storage, `${folder}/${fileName}`);
        return await retryWithBackoff(async () => {
            const snapshot = await uploadBytes(storageRef, file);
            return await getDownloadURL(snapshot.ref);
        });
    },

    // Bulk upload multiple files
    async uploadFiles(files: File[], folder: string): Promise<{ url: string; name: string; size: number }[]> {
        const _provider = this.getProvider();
        const results: { url: string; name: string; size: number }[] = [];

        for (const file of files) {
            try {
                const url = await this.uploadFile(file, folder);
                if (url) {
                    results.push({ url, name: file.name, size: file.size });
                }
            } catch (e) {
                console.error(`Failed to upload ${file.name}:`, e);
            }
        }

        return results;
    },

    async deleteRecipe(id: string): Promise<void> {
        const provider = this.getProvider();
        if (provider === 'firebase') {
            const fb = this.getFirebase();
            if (!fb) return;
            await deleteDoc(doc(fb.db, 'recipes', id));
        } else {
            const current = safeParseArray<Recipe>(localStorage.getItem('schafer_db_recipes'));
            localStorage.setItem('schafer_db_recipes', JSON.stringify(current.filter((r) => r.id !== id)));
        }
    },

    async deleteGalleryItem(id: string): Promise<void> {
        const provider = this.getProvider();
        if (provider === 'firebase') {
            const fb = this.getFirebase();
            if (!fb) return;
            await deleteDoc(doc(fb.db, 'gallery', id));
        } else {
            const current = safeParseArray<GalleryItem>(localStorage.getItem('schafer_db_gallery'));
            localStorage.setItem('schafer_db_gallery', JSON.stringify(current.filter((g) => g.id !== id)));
        }
    },

    /**
     * Update select fields on an existing gallery item.
     * - `caption` stores as-is.
     * - `date` accepts a Date; persisted as ISO string on `created_at` so sort order reflects the edit.
     */
    async updateGalleryItem(id: string, patch: { caption?: string; date?: Date }): Promise<void> {
        const payload: Record<string, unknown> = {};
        if (typeof patch.caption === 'string') payload.caption = patch.caption;
        if (patch.date instanceof Date && !isNaN(patch.date.getTime())) {
            payload.created_at = patch.date.toISOString();
        }
        if (Object.keys(payload).length === 0) return;

        const provider = this.getProvider();
        if (provider === 'firebase') {
            const fb = this.getFirebase();
            if (!fb) return;
            await updateDoc(doc(fb.db, 'gallery', id), payload);
        } else {
            const current = safeParseArray<GalleryItem>(localStorage.getItem('schafer_db_gallery'));
            const index = current.findIndex((g) => g.id === id);
            if (index > -1) {
                current[index] = { ...current[index], ...(payload as Partial<GalleryItem>) };
                localStorage.setItem('schafer_db_gallery', JSON.stringify(current));
            }
        }
    },

    async deleteTrivia(id: string): Promise<void> {
        const provider = this.getProvider();
        if (provider === 'firebase') {
            const fb = this.getFirebase();
            if (!fb) return;
            await deleteDoc(doc(fb.db, 'trivia', id));
        } else {
            const current = safeParseArray<Trivia>(localStorage.getItem('schafer_db_trivia'));
            localStorage.setItem('schafer_db_trivia', JSON.stringify(current.filter((t) => t.id !== id)));
        }
    },

    async upsertRecipe(recipe: Recipe, contributorName?: string): Promise<void> {
        const provider = this.getProvider();
        const payload = { ...normalizeRecipe(recipe), created_at: recipe.created_at || new Date().toISOString() };
        if (provider === 'firebase') {
            const fb = this.getFirebase();
            if (!fb) return;
            const isNew = !(await this.getRecipes()).find(r => r.id === recipe.id);
            await setDoc(doc(fb.db, 'recipes', recipe.id), payload);
            if (contributorName) {
                await this.addHistoryEntry({
                    id: 'h' + Date.now(),
                    contributor: contributorName,
                    action: isNew ? 'added' : 'updated',
                    type: 'recipe',
                    itemName: recipe.title,
                    timestamp: new Date().toISOString()
                });
            }
        } else {
            const current = safeParseArray<Recipe>(localStorage.getItem('schafer_db_recipes'));
            const index = current.findIndex((r) => r.id === recipe.id);
            if (index > -1) current[index] = payload;
            else current.push(payload);
            localStorage.setItem('schafer_db_recipes', JSON.stringify(current));
        }
    },

    async upsertTrivia(item: Trivia): Promise<void> {
        const provider = this.getProvider();
        const payload = { ...item, created_at: item.created_at || new Date().toISOString() };
        if (provider === 'firebase') {
            const fb = this.getFirebase();
            if (!fb) return;
            await setDoc(doc(fb.db, 'trivia', item.id), payload);
        } else {
            const current = safeParseArray<Trivia>(localStorage.getItem('schafer_db_trivia'));
            const index = current.findIndex((t) => t.id === item.id);
            if (index > -1) current[index] = payload;
            else current.push(payload);
            localStorage.setItem('schafer_db_trivia', JSON.stringify(current));
        }
    },

    async upsertGalleryItem(item: GalleryItem): Promise<void> {
        const provider = this.getProvider();
        const payload = { ...item, created_at: item.created_at || new Date().toISOString() };
        if (provider === 'firebase') {
            const fb = this.getFirebase();
            if (!fb) return;
            await setDoc(doc(fb.db, 'gallery', item.id), payload);
        } else {
            const current = safeParseArray<GalleryItem>(localStorage.getItem('schafer_db_gallery'));
            const index = current.findIndex((g) => g.id === item.id);
            if (index > -1) current[index] = payload;
            else current.push(payload);
            localStorage.setItem('schafer_db_gallery', JSON.stringify(current));
        }
    },

    async getRecipes(): Promise<Recipe[]> {
        const parsed = safeParseArray<Recipe>(localStorage.getItem('schafer_db_recipes'));
        if (parsed.length > 0) {
            const normalized = normalizeRecipeImages(parsed);
            if (JSON.stringify(normalized) !== JSON.stringify(parsed)) {
                localStorage.setItem('schafer_db_recipes', JSON.stringify(normalized));
            }
            return normalized;
        }

        // Return default seeded data
        // Also save it to localStorage so future edits are saved
        const seeded = normalizeRecipeImages(defaultRecipes as Recipe[]);
        localStorage.setItem('schafer_db_recipes', JSON.stringify(seeded));
        return seeded;
    },
    async getTrivia(): Promise<Trivia[]> {
        return safeParseArray<Trivia>(localStorage.getItem('schafer_db_trivia'));
    },
    async getGallery(): Promise<GalleryItem[]> {
        return safeParseArray<GalleryItem>(localStorage.getItem('schafer_db_gallery'));
    },

    // Contributors
    async getContributors(): Promise<ContributorProfile[]> {
        return safeParseArray<ContributorProfile>(localStorage.getItem('schafer_db_contributors'));
    },

    async upsertContributor(profile: ContributorProfile): Promise<void> {
        const provider = this.getProvider();
        if (provider === 'firebase') {
            const fb = this.getFirebase();
            if (!fb) return;
            await setDoc(doc(fb.db, 'contributors', profile.id), profile);
        } else {
            const current = safeParseArray<ContributorProfile>(localStorage.getItem('schafer_db_contributors'));
            const index = current.findIndex((c) => c.id === profile.id);
            if (index > -1) current[index] = profile;
            else current.push(profile);
            localStorage.setItem('schafer_db_contributors', JSON.stringify(current));
        }
    },

    async deleteContributor(id: string): Promise<void> {
        const provider = this.getProvider();
        if (provider === 'firebase') {
            const fb = this.getFirebase();
            if (!fb) return;
            await deleteDoc(doc(fb.db, 'contributors', id));
        } else {
            const current = safeParseArray<ContributorProfile>(localStorage.getItem('schafer_db_contributors'));
            localStorage.setItem('schafer_db_contributors', JSON.stringify(current.filter((c) => c.id !== id)));
        }
    },

    subscribeContributors(callback: (profiles: ContributorProfile[]) => void, onError?: (error: Error) => void) {
        const fb = this.getFirebase();
        if (!fb) return () => { };
        const q = query(collection(fb.db, 'contributors'));
        return onSnapshot(q, (snapshot) => {
            callback(snapshot.docs.map(doc => doc.data() as ContributorProfile));
        }, (error) => {
            if (onError) onError(error);
            else console.error('subscribeContributors error:', error);
        });
    },

    async addHistoryEntry(entry: HistoryEntry): Promise<void> {
        const provider = this.getProvider();
        if (provider === 'firebase') {
            const fb = this.getFirebase();
            if (!fb) return;
            await setDoc(doc(fb.db, 'history', entry.id), entry);
        } else {
            const current = safeParseArray<HistoryEntry>(localStorage.getItem('schafer_db_history'));
            current.unshift(entry);
            localStorage.setItem('schafer_db_history', JSON.stringify(current.slice(0, 100))); // Keep last 100
        }
    },

    async getHistory(): Promise<HistoryEntry[]> {
        return safeParseArray<HistoryEntry>(localStorage.getItem('schafer_db_history'));
    },

    // ── Family Story CMS ──────────────────────────────────────────────────────

    async getStoryContent(): Promise<StorySection[]> {
        const fb = this.getFirebase();
        if (fb) {
            try {
                const snap = await getDoc(doc(fb.db, 'config', 'story_content'));
                if (snap.exists()) {
                    const sections = snap.data()?.sections;
                    if (Array.isArray(sections)) return sections as StorySection[];
                }
            } catch (e) {
                console.warn('getStoryContent: Firestore fetch failed, returning []', e);
            }
        }
        return JSON.parse(localStorage.getItem('schafer_story_content') ?? '[]') as StorySection[];
    },

    async saveStoryContent(sections: StorySection[]): Promise<void> {
        const fb = this.getFirebase();
        if (fb) {
            await setDoc(doc(fb.db, 'config', 'story_content'), { sections }, { merge: false });
        }
        localStorage.setItem('schafer_story_content', JSON.stringify(sections));
    },

    // ── Recipe Version History ────────────────────────────────────────────────

    async saveRecipeVersion(recipe: Recipe, savedBy: string): Promise<void> {
        const version: RecipeVersion = { ...recipe, savedAt: new Date().toISOString(), savedBy };
        const fb = this.getFirebase();
        if (fb) {
            const ts = version.savedAt.replace(/[:.]/g, '-');
            await setDoc(doc(fb.db, 'recipe_versions', recipe.id, 'versions', ts), version);
        }
        const key = `schafer_recipe_versions_${recipe.id}`;
        const existing = safeParseArray<RecipeVersion>(localStorage.getItem(key));
        existing.unshift(version);
        localStorage.setItem(key, JSON.stringify(existing.slice(0, 20)));
    },

    async getRecipeVersions(recipeId: string): Promise<RecipeVersion[]> {
        const fb = this.getFirebase();
        if (fb) {
            try {
                const q = query(
                    collection(fb.db, 'recipe_versions', recipeId, 'versions'),
                    orderBy('savedAt', 'desc'),
                    limit(20)
                );
                return (await getDocs(q)).docs.map(d => d.data() as RecipeVersion);
            } catch (e) {
                console.warn('getRecipeVersions: Firestore fetch failed', e);
            }
        }
        return safeParseArray<RecipeVersion>(localStorage.getItem(`schafer_recipe_versions_${recipeId}`));
    },
};

