import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, collection, setDoc, doc, deleteDoc, query, orderBy, onSnapshot, Firestore } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, FirebaseStorage } from 'firebase/storage';
import { Recipe, GalleryItem, Trivia, ContributorProfile } from '../types';
import defaultRecipes from '../data/recipes.json';

export const CloudArchive = {
    _firebaseApp: null as FirebaseApp | null,
    _firestore: null as Firestore | null,
    _storage: null as FirebaseStorage | null,

    getProvider(): 'local' | 'supabase' | 'firebase' {
        return (localStorage.getItem('schafer_active_provider') as any) || 'local';
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
            this._firebaseApp = getApps().length === 0 ? initializeApp(fbConfig) : getApp();
            this._firestore = getFirestore(this._firebaseApp);
            this._storage = getStorage(this._firebaseApp);
            return { app: this._firebaseApp, db: this._firestore, storage: this._storage };
        } catch (e) {
            console.error("Firebase connection failed:", e);
            return null;
        }
    },

    // Real-time Subscriptions
    subscribeRecipes(callback: (recipes: Recipe[]) => void) {
        const fb = this.getFirebase();
        if (!fb) return () => { };
        const q = query(collection(fb.db, "recipes"), orderBy("created_at", "desc"));
        return onSnapshot(q, (snapshot) => {
            callback(snapshot.docs.map(doc => doc.data() as Recipe));
        });
    },

    subscribeTrivia(callback: (trivia: Trivia[]) => void) {
        const fb = this.getFirebase();
        if (!fb) return () => { };
        const q = query(collection(fb.db, "trivia"), orderBy("created_at", "desc"));
        return onSnapshot(q, (snapshot) => {
            callback(snapshot.docs.map(doc => doc.data() as Trivia));
        });
    },

    subscribeGallery(callback: (items: GalleryItem[]) => void) {
        const fb = this.getFirebase();
        if (!fb) return () => { };
        const q = query(collection(fb.db, "gallery"), orderBy("created_at", "desc"));
        return onSnapshot(q, (snapshot) => {
            callback(snapshot.docs.map(doc => doc.data() as GalleryItem));
        });
    },

    async uploadFile(file: File, folder: string): Promise<string | null> {
        const provider = this.getProvider();
        if (provider !== 'firebase') return null;
        const fb = this.getFirebase();
        if (!fb) return null;

        const fileName = `${Date.now()}_${file.name.replace(/[^a-z0-9.]/gi, '_')}`;
        const storageRef = ref(fb.storage, `${folder}/${fileName}`);
        const snapshot = await uploadBytes(storageRef, file);
        return await getDownloadURL(snapshot.ref);
    },

    async deleteRecipe(id: string): Promise<void> {
        const provider = this.getProvider();
        if (provider === 'firebase') {
            const fb = this.getFirebase();
            if (!fb) return;
            await deleteDoc(doc(fb.db, "recipes", id));
        } else {
            const current = JSON.parse(localStorage.getItem('schafer_db_recipes') || '[]');
            localStorage.setItem('schafer_db_recipes', JSON.stringify(current.filter((r: any) => r.id !== id)));
        }
    },

    async deleteGalleryItem(id: string): Promise<void> {
        const provider = this.getProvider();
        if (provider === 'firebase') {
            const fb = this.getFirebase();
            if (!fb) return;
            await deleteDoc(doc(fb.db, "gallery", id));
        } else {
            const current = JSON.parse(localStorage.getItem('schafer_db_gallery') || '[]');
            localStorage.setItem('schafer_db_gallery', JSON.stringify(current.filter((g: any) => g.id !== id)));
        }
    },

    async deleteTrivia(id: string): Promise<void> {
        const provider = this.getProvider();
        if (provider === 'firebase') {
            const fb = this.getFirebase();
            if (!fb) return;
            await deleteDoc(doc(fb.db, "trivia", id));
        } else {
            const current = JSON.parse(localStorage.getItem('schafer_db_trivia') || '[]');
            localStorage.setItem('schafer_db_trivia', JSON.stringify(current.filter((t: any) => t.id !== id)));
        }
    },

    async upsertRecipe(recipe: Recipe): Promise<void> {
        const provider = this.getProvider();
        const payload = { ...recipe, created_at: recipe.created_at || new Date().toISOString() };
        if (provider === 'firebase') {
            const fb = this.getFirebase();
            if (!fb) return;
            await setDoc(doc(fb.db, "recipes", recipe.id), payload);
        } else {
            const current = JSON.parse(localStorage.getItem('schafer_db_recipes') || '[]');
            const index = current.findIndex((r: any) => r.id === recipe.id);
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
            await setDoc(doc(fb.db, "trivia", item.id), payload);
        } else {
            const current = JSON.parse(localStorage.getItem('schafer_db_trivia') || '[]');
            current.push(payload);
            localStorage.setItem('schafer_db_trivia', JSON.stringify(current));
        }
    },

    async upsertGalleryItem(item: GalleryItem): Promise<void> {
        const provider = this.getProvider();
        const payload = { ...item, created_at: item.created_at || new Date().toISOString() };
        if (provider === 'firebase') {
            const fb = this.getFirebase();
            if (!fb) return;
            await setDoc(doc(fb.db, "gallery", item.id), payload);
        } else {
            const current = JSON.parse(localStorage.getItem('schafer_db_gallery') || '[]');
            current.push(payload);
            localStorage.setItem('schafer_db_gallery', JSON.stringify(current));
        }
    },

    async getRecipes(): Promise<Recipe[]> {
        const data = localStorage.getItem('schafer_db_recipes');
        if (data) {
            const parsed = JSON.parse(data);
            if (parsed.length > 0) return parsed;
        }

        // Return default seeded data
        // Also save it to localStorage so future edits are saved
        localStorage.setItem('schafer_db_recipes', JSON.stringify(defaultRecipes));
        return defaultRecipes as Recipe[];
    },
    async getTrivia(): Promise<Trivia[]> {
        const data = localStorage.getItem('schafer_db_trivia');
        return data ? JSON.parse(data) : [];
    },
    async getGallery(): Promise<GalleryItem[]> {
        const data = localStorage.getItem('schafer_db_gallery');
        return data ? JSON.parse(data) : [];
    },

    // Contributors
    async getContributors(): Promise<ContributorProfile[]> {
        const data = localStorage.getItem('schafer_db_contributors');
        return data ? JSON.parse(data) : [];
    },

    async upsertContributor(profile: ContributorProfile): Promise<void> {
        const provider = this.getProvider();
        if (provider === 'firebase') {
            const fb = this.getFirebase();
            if (!fb) return;
            await setDoc(doc(fb.db, "contributors", profile.id), profile);
        } else {
            const current = JSON.parse(localStorage.getItem('schafer_db_contributors') || '[]');
            const index = current.findIndex((c: any) => c.id === profile.id);
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
            await deleteDoc(doc(fb.db, "contributors", id));
        } else {
            const current = JSON.parse(localStorage.getItem('schafer_db_contributors') || '[]');
            localStorage.setItem('schafer_db_contributors', JSON.stringify(current.filter((c: any) => c.id !== id)));
        }
    },

    subscribeContributors(callback: (profiles: ContributorProfile[]) => void) {
        const fb = this.getFirebase();
        if (!fb) return () => { };
        const q = query(collection(fb.db, "contributors"));
        return onSnapshot(q, (snapshot) => {
            callback(snapshot.docs.map(doc => doc.data() as ContributorProfile));
        });
    }
};
