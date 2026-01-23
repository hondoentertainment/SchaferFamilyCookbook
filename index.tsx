
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from '@google/genai';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

// --- Firebase Imports (Fix: Using ESM.sh URLs to ensure modular SDK exports are available in browser environment) ---
import { initializeApp, getApps, getApp } from 'https://esm.sh/firebase@10.8.1/app';
import { getFirestore, collection, getDocs, setDoc, doc, deleteDoc, query, orderBy, onSnapshot } from 'https://esm.sh/firebase@10.8.1/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'https://esm.sh/firebase@10.8.1/storage';

// --- Data Types ---
interface Recipe {
  id: string;
  title: string;
  contributor: string;
  category: 'Breakfast' | 'Main' | 'Dessert' | 'Side' | 'Appetizer' | 'Bread' | 'Dip/Sauce' | 'Snack';
  ingredients: string[];
  instructions: string[];
  notes?: string;
  image: string;
  prepTime?: string;
  cookTime?: string;
  created_at?: string;
}

interface GalleryItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  caption: string;
  contributor: string;
  created_at?: string;
}

interface Trivia {
  id: string;
  question: string;
  options: string[];
  answer: string;
  explanation?: string;
  contributor: string;
  created_at?: string;
}

interface UserProfile {
  id: string;
  name: string;
  picture: string;
}

interface DBStats {
  recipeCount: number;
  galleryCount: number;
  triviaCount: number;
  isCloudActive: boolean;
  activeProvider: 'local' | 'supabase' | 'firebase';
}

// --- Database Service (Local + Firebase) ---
const CloudArchive = {
  _firebaseApp: null as any | null,
  _firestore: null as any | null,
  _storage: null as any | null,

  getProvider(): 'local' | 'supabase' | 'firebase' {
    return (localStorage.getItem('schafer_active_provider') as any) || 'local';
  },

  getFirebase() {
    if (this._firebaseApp) return { app: this._firebaseApp, db: this._firestore, storage: this._storage };
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
    if (!fb) return () => {};
    const q = query(collection(fb.db, "recipes"), orderBy("created_at", "desc"));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as Recipe));
    });
  },

  subscribeTrivia(callback: (trivia: Trivia[]) => void) {
    const fb = this.getFirebase();
    if (!fb) return () => {};
    const q = query(collection(fb.db, "trivia"), orderBy("created_at", "desc"));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as Trivia));
    });
  },

  subscribeGallery(callback: (items: GalleryItem[]) => void) {
    const fb = this.getFirebase();
    if (!fb) return () => {};
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
    return data ? JSON.parse(data) : [];
  },
  async getTrivia(): Promise<Trivia[]> {
    const data = localStorage.getItem('schafer_db_trivia');
    return data ? JSON.parse(data) : [];
  },
  async getGallery(): Promise<GalleryItem[]> {
    const data = localStorage.getItem('schafer_db_gallery');
    return data ? JSON.parse(data) : [];
  }
};

// --- Shared Assets ---
const LOGO_URL = "https://images.unsplash.com/photo-1500076656116-558758c991c1?auto=format&fit=crop&q=80&w=1000";
const CATEGORY_IMAGES: Record<string, string> = {
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

// --- UI Components ---
const Header: React.FC<{
  activeTab: string;
  setTab: (t: string) => void;
  currentUser: UserProfile | null;
  dbStats: DBStats;
}> = ({ activeTab, setTab, currentUser, dbStats }) => {
  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-stone-100">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setTab('Recipes')}>
            <img src={LOGO_URL} className="w-8 h-8 rounded-full object-cover" alt="Schafer Logo" />
            <span className="font-serif italic text-xl text-[#2D4635] hidden md:block">The Schafer Archive</span>
          </div>
          <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {['Recipes', 'Index', 'Gallery', 'Trivia', 'Contributors', 'Admin'].map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 md:px-4 py-2 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  activeTab === t ? 'bg-[#2D4635] text-white shadow-lg' : 'text-stone-400 hover:bg-stone-50'
                }`}
              >
                {t}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-stone-50 rounded-full border border-stone-200">
            <div className={`w-1.5 h-1.5 rounded-full ${dbStats.activeProvider === 'local' ? 'bg-emerald-400' : 'bg-orange-400'}`} />
            <span className="text-[7px] font-bold uppercase text-stone-500 tracking-tighter">
              {dbStats.activeProvider.toUpperCase()} {dbStats.isCloudActive ? 'LIVE' : 'MODE'}
            </span>
          </div>
          {currentUser && (
            <img src={currentUser.picture} className="w-8 h-8 rounded-full border border-stone-100 shadow-sm" alt={currentUser.name} title={currentUser.name} />
          )}
        </div>
      </div>
    </header>
  );
};

const RecipeModal: React.FC<{ recipe: Recipe; onClose: () => void; onEdit: (r: Recipe) => void; onDelete: (id: string) => void }> = ({ recipe, onClose, onEdit, onDelete }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-[#FDFBF7] w-full max-w-4xl max-h-[90vh] rounded-[3rem] overflow-hidden shadow-2xl relative animate-in fade-in zoom-in-95 duration-300 flex flex-col md:flex-row">
        <div className="absolute top-6 right-6 z-10 flex gap-2">
           <button onClick={() => { if(confirm("Discard this record forever?")) onDelete(recipe.id); }} className="w-10 h-10 bg-white border border-stone-100 rounded-full shadow-lg flex items-center justify-center text-stone-300 hover:text-red-500 transition-colors" title="Delete">✕</button>
           <button onClick={() => onEdit(recipe)} className="w-10 h-10 bg-[#2D4635] rounded-full shadow-lg flex items-center justify-center text-white hover:bg-[#1e3023] transition-colors" title="Edit">✎</button>
           <button onClick={onClose} className="w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-stone-400 hover:text-stone-900 transition-colors" title="Close">✕</button>
        </div>
        
        <div className="w-full md:w-1/2 h-64 md:h-auto relative">
          <img src={recipe.image} className="w-full h-full object-cover" alt={recipe.title} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent md:hidden" />
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 md:p-12 space-y-8">
          <div>
            <span className="text-[10px] font-black uppercase text-[#A0522D] tracking-widest">{recipe.category}</span>
            <h2 className="text-4xl font-serif italic text-[#2D4635] mt-2 leading-tight">{recipe.title}</h2>
            <div className="flex gap-4 mt-4 text-[10px] font-black uppercase text-stone-400 tracking-widest">
              <span>By {recipe.contributor}</span>
              {(recipe.prepTime || recipe.cookTime) && (
                <span className="flex gap-2 text-[#A0522D]">
                  {recipe.prepTime && <span>Prep: {recipe.prepTime}</span>}
                  {recipe.cookTime && <span>Cook: {recipe.cookTime}</span>}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-serif italic text-[#2D4635] border-b border-stone-100 pb-2">Ingredients</h3>
            <ul className="space-y-2">
              {recipe.ingredients.map((ing, i) => (
                <li key={i} className="text-sm text-stone-600 flex items-start gap-3">
                  <span className="text-[#A0522D] mt-1.5 w-1.5 h-1.5 rounded-full bg-[#A0522D]/20 shrink-0" />
                  {ing}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-serif italic text-[#2D4635] border-b border-stone-100 pb-2">Instructions</h3>
            <div className="space-y-6">
              {recipe.instructions.map((step, i) => (
                <div key={i} className="flex gap-4">
                  <span className="text-2xl font-serif italic text-[#A0522D]/20 shrink-0 tabular-nums">{(i + 1).toString().padStart(2, '0')}</span>
                  <p className="text-sm text-stone-700 leading-relaxed">{step}</p>
                </div>
              ))}
            </div>
          </div>

          {recipe.notes && (
            <div className="bg-[#2D4635]/5 p-6 rounded-3xl border border-[#2D4635]/10 italic text-stone-600 text-sm">
              <span className="font-serif block mb-1 text-[#2D4635]">Heirloom Notes</span>
              {recipe.notes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const AdminView: React.FC<{
  editingRecipe: Recipe | null;
  clearEditing: () => void;
  recipes: Recipe[];
  trivia: Trivia[];
  currentUser: UserProfile | null;
  dbStats: DBStats;
  onAddRecipe: (r: Recipe, file?: File) => Promise<void>;
  onAddGallery: (g: GalleryItem, file?: File) => Promise<void>;
  onAddTrivia: (t: Trivia) => Promise<void>;
  onDeleteTrivia: (id: string) => void;
}> = ({ editingRecipe, clearEditing, trivia, currentUser, dbStats, onAddRecipe, onAddGallery, onAddTrivia, onDeleteTrivia }) => {
  const [recipeForm, setRecipeForm] = useState<Partial<Recipe>>({ title: '', category: 'Main', ingredients: [], instructions: [] });
  const [galleryForm, setGalleryForm] = useState<Partial<GalleryItem>>({ caption: '' });
  const [triviaForm, setTriviaForm] = useState<Partial<Trivia>>({ question: '', options: ['', '', '', ''], answer: '' });
  const [recipeFile, setRecipeFile] = useState<File | null>(null);
  const [galleryFile, setGalleryFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [rawText, setRawText] = useState('');
  const [isMagicLoading, setIsMagicLoading] = useState(false);

  // Cloud Config state
  const [provider, setProvider] = useState<'local' | 'firebase'>(dbStats.activeProvider === 'firebase' ? 'firebase' : 'local');
  const [fbConfig, setFbConfig] = useState(() => JSON.parse(localStorage.getItem('schafer_firebase_config') || '{"apiKey":"","projectId":""}'));

  useEffect(() => {
    if (editingRecipe) setRecipeForm(editingRecipe);
    else setRecipeForm({ title: '', category: 'Main', ingredients: [], instructions: [] });
  }, [editingRecipe]);

  const handleMagicImport = async () => {
    if (!rawText.trim()) return;
    setIsMagicLoading(true);
    try {
      // Fix: Follow @google/genai guidelines for initializing client and querying content
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Recipe text: ${rawText}`,
        config: {
          systemInstruction: "Analyze this recipe and extract structured JSON data. Fields: title, category (Breakfast|Main|Dessert|Side|Appetizer|Bread|Dip/Sauce|Snack), ingredients (list), instructions (list), prepTime, cookTime.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              category: { type: Type.STRING },
              ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
              instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
              prepTime: { type: Type.STRING },
              cookTime: { type: Type.STRING },
            }
          }
        }
      });
      // Fix: Use the .text property directly as per latest SDK property definition
      const parsed = JSON.parse(response.text);
      setRecipeForm(prev => ({ ...prev, ...parsed }));
      setRawText('');
    } catch (e) {
      alert("AI Analysis failed. Please enter manually.");
    } finally {
      setIsMagicLoading(false);
    }
  };

  const handleRecipeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeForm.title || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onAddRecipe({
        ...recipeForm as Recipe,
        id: recipeForm.id || 'r' + Date.now(),
        contributor: recipeForm.contributor || currentUser?.name || 'Family',
        image: recipeForm.image || CATEGORY_IMAGES[recipeForm.category || 'Main'] || CATEGORY_IMAGES.Generic
      }, recipeFile || undefined);
      setRecipeForm({ title: '', category: 'Main', ingredients: [], instructions: [] });
      setRecipeFile(null);
      if (editingRecipe) clearEditing();
    } finally { setIsSubmitting(false); }
  };

  const handleGallerySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!galleryFile || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onAddGallery({
        id: 'g' + Date.now(),
        type: 'image',
        url: '',
        caption: galleryForm.caption || 'Family Memory',
        contributor: currentUser?.name || 'Family'
      }, galleryFile);
      setGalleryForm({ caption: '' });
      setGalleryFile(null);
    } finally { setIsSubmitting(false); }
  };

  const saveConfig = () => {
    localStorage.setItem('schafer_active_provider', provider);
    localStorage.setItem('schafer_firebase_config', JSON.stringify(fbConfig));
    alert("Archives re-initialized. Refreshing...");
    window.location.reload();
  };

  return (
    <div className="max-w-6xl mx-auto py-12 px-6 space-y-12 pb-32">
      <div className="bg-white rounded-[3rem] p-8 md:p-12 border border-stone-100 shadow-xl overflow-hidden relative">
        <div className="flex justify-between items-center mb-12">
           <h2 className="text-3xl font-serif italic text-[#2D4635]">Archive Command</h2>
           <button onClick={() => setShowConfig(!showConfig)} className="text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-[#2D4635] flex items-center gap-2">
             {showConfig ? '✕ Close Setup' : '⚙️ Cloud Setup'}
           </button>
        </div>

        {showConfig && (
          <div className="mb-12 p-10 bg-stone-50/50 rounded-[3rem] border border-stone-100 animate-in fade-in slide-in-from-top-4">
            <h3 className="text-xl font-serif italic text-[#2D4635] mb-6">Database Vault Configuration</h3>
            <div className="space-y-6">
              <div className="flex gap-4 p-1 bg-white rounded-2xl border border-stone-100">
                {['local', 'firebase'].map((p: any) => (
                  <button key={p} onClick={() => setProvider(p)} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${provider === p ? 'bg-[#2D4635] text-white shadow-md' : 'text-stone-400'}`}>
                    {p}
                  </button>
                ))}
              </div>
              {provider === 'firebase' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400">Firebase API Key</label>
                    <input type="password" value={fbConfig.apiKey} onChange={e => setFbConfig({...fbConfig, apiKey: e.target.value})} className="w-full p-4 border border-stone-200 rounded-2xl text-xs bg-white" placeholder="AIzaSy..." />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400">Project ID</label>
                    <input value={fbConfig.projectId} onChange={e => setFbConfig({...fbConfig, projectId: e.target.value})} className="w-full p-4 border border-stone-200 rounded-2xl text-xs bg-white" placeholder="schafer-archive-..." />
                  </div>
                </div>
              )}
              <button onClick={saveConfig} className="w-full py-4 bg-[#A0522D] text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">Update Cloud Settings</button>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Recipe Section */}
          <section className="space-y-8">
            <h3 className="text-xl font-serif italic text-[#A0522D] flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-[#A0522D]/5 flex items-center justify-center not-italic">📖</span>
              {editingRecipe ? 'Edit Archival Entry' : 'New Heritage Record'}
            </h3>
            
            {!editingRecipe && (
              <div className="space-y-4">
                <textarea 
                  placeholder="Paste raw recipe text here... AI will organize it." 
                  className="w-full h-32 p-5 border border-stone-100 rounded-3xl text-sm bg-stone-50 outline-none focus:ring-1 focus:ring-[#2D4635]"
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                />
                <button onClick={handleMagicImport} disabled={isMagicLoading} className="w-full py-4 bg-[#2D4635] text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-md disabled:opacity-50">
                  {isMagicLoading ? 'Analyzing...' : '✨ Organize with AI'}
                </button>
              </div>
            )}

            <form onSubmit={handleRecipeSubmit} className="space-y-6 pt-8 border-t border-stone-50">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2">Archival Image</label>
                <div className="relative group">
                  <input type="file" accept="image/*" onChange={e => setRecipeFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                  <div className="w-full p-4 border-2 border-dashed border-stone-200 rounded-3xl flex items-center justify-center gap-3 text-stone-400 group-hover:border-[#2D4635] group-hover:text-[#2D4635] transition-all">
                    <span className="text-lg">📷</span>
                    <span className="text-[10px] font-black uppercase tracking-widest">{recipeFile ? recipeFile.name : 'Upload Heritage Photo'}</span>
                  </div>
                </div>
              </div>

              <input placeholder="Recipe Title" className="w-full p-4 border border-stone-200 rounded-2xl text-sm outline-none focus:ring-1 focus:ring-[#2D4635]" value={recipeForm.title} onChange={e => setRecipeForm({...recipeForm, title: e.target.value})} required />
              
              <div className="grid grid-cols-2 gap-4">
                <select className="p-4 border border-stone-200 rounded-2xl text-sm bg-white" value={recipeForm.category} onChange={e => setRecipeForm({...recipeForm, category: e.target.value as any})}>
                  {['Breakfast', 'Main', 'Dessert', 'Side', 'Appetizer', 'Bread', 'Dip/Sauce', 'Snack'].map(c => <option key={c}>{c}</option>)}
                </select>
                <input placeholder="Prep Time" className="p-4 border border-stone-200 rounded-2xl text-sm" value={recipeForm.prepTime || ''} onChange={e => setRecipeForm({...recipeForm, prepTime: e.target.value})} />
              </div>
              
              <textarea placeholder="Ingredients (one per line)" className="w-full h-32 p-4 border border-stone-200 rounded-2xl text-sm bg-stone-50" value={recipeForm.ingredients?.join('\n')} onChange={e => setRecipeForm({...recipeForm, ingredients: e.target.value.split('\n')})} required />
              <textarea placeholder="Instructions (one per line)" className="w-full h-48 p-4 border border-stone-200 rounded-2xl text-sm bg-stone-50" value={recipeForm.instructions?.join('\n')} onChange={e => setRecipeForm({...recipeForm, instructions: e.target.value.split('\n')})} required />

              <div className="flex gap-4">
                <button type="submit" disabled={isSubmitting} className="flex-1 py-4 bg-[#2D4635] text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-[#1e3023] transition-all">
                  {isSubmitting ? 'Archiving...' : editingRecipe ? 'Update Record' : 'Commit to Archive'}
                </button>
                {editingRecipe && <button type="button" onClick={clearEditing} className="flex-1 py-4 border border-stone-200 rounded-full text-[10px] font-black uppercase text-stone-400">Cancel</button>}
              </div>
            </form>
          </section>

          {/* Right Column: Gallery & Trivia */}
          <div className="space-y-16">
             {/* Gallery Upload */}
             <section className="space-y-6">
                <h3 className="text-xl font-serif italic text-[#A0522D] flex items-center gap-3">
                  <span className="w-10 h-10 rounded-full bg-[#A0522D]/5 flex items-center justify-center not-italic">🖼️</span>
                  Family Gallery
                </h3>
                <form onSubmit={handleGallerySubmit} className="space-y-4">
                  <div className="relative group">
                    <input type="file" accept="image/*" onChange={e => setGalleryFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                    <div className="w-full h-32 border-2 border-dashed border-stone-200 rounded-[2rem] flex flex-col items-center justify-center gap-2 text-stone-300 group-hover:border-[#A0522D] group-hover:text-[#A0522D] transition-all">
                      <span className="text-3xl">🏞️</span>
                      <span className="text-[9px] font-black uppercase tracking-widest">{galleryFile ? galleryFile.name : 'Choose Family Photo'}</span>
                    </div>
                  </div>
                  <input placeholder="Short caption..." className="w-full p-4 border border-stone-200 rounded-2xl text-sm outline-none" value={galleryForm.caption} onChange={e => setGalleryForm({...galleryForm, caption: e.target.value})} />
                  <button type="submit" disabled={!galleryFile || isSubmitting} className="w-full py-4 bg-[#A0522D] text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg disabled:opacity-30">
                    {isSubmitting ? 'Uploading...' : 'Upload Memory'}
                  </button>
                </form>
             </section>

             {/* Trivia Form */}
             <section className="space-y-6">
                <h3 className="text-xl font-serif italic text-[#A0522D] flex items-center gap-3">
                  <span className="w-10 h-10 rounded-full bg-[#A0522D]/5 flex items-center justify-center not-italic">💡</span>
                  Family Trivia
                </h3>
                <form onSubmit={async (e) => { e.preventDefault(); if(!triviaForm.question) return; await onAddTrivia(triviaForm as Trivia); setTriviaForm({question:'', options:['','','',''], answer:''}) }} className="space-y-4">
                  <input placeholder="The Question" className="w-full p-4 border border-stone-200 rounded-2xl text-sm outline-none" value={triviaForm.question} onChange={e => setTriviaForm({...triviaForm, question: e.target.value})} />
                  <div className="grid grid-cols-2 gap-3">
                    {triviaForm.options?.map((opt, i) => (
                      <input key={i} placeholder={`Opt ${i+1}`} className="p-3 border border-stone-200 rounded-xl text-xs" value={opt} onChange={e => { const n = [...(triviaForm.options||[])]; n[i] = e.target.value; setTriviaForm({...triviaForm, options: n}) }} />
                    ))}
                  </div>
                  <input placeholder="Correct Answer" className="w-full p-4 border border-stone-200 rounded-2xl text-sm font-bold bg-stone-50" value={triviaForm.answer} onChange={e => setTriviaForm({...triviaForm, answer: e.target.value})} />
                  <button type="submit" className="w-full py-4 bg-[#2D4635] text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-md">Add Question</button>
                </form>
                
                <div className="pt-8 border-t border-stone-100 max-h-60 overflow-y-auto custom-scrollbar">
                  <h4 className="text-[10px] font-black uppercase text-stone-400 mb-4">Current Questions</h4>
                  {trivia.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-xl mb-2 group">
                      <span className="text-xs truncate">{t.question}</span>
                      <button onClick={() => onDeleteTrivia(t.id)} className="text-stone-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">✕</button>
                    </div>
                  ))}
                </div>
             </section>
          </div>
        </div>
      </div>
    </div>
  );
};

const AlphabeticalIndex: React.FC<{ recipes: Recipe[]; onSelect: (r: Recipe) => void }> = ({ recipes, onSelect }) => {
  const grouped = useMemo(() => {
    const groups: Record<string, Recipe[]> = {};
    [...recipes]
      .sort((a, b) => a.title.localeCompare(b.title))
      .forEach(r => {
        const first = r.title[0].toUpperCase();
        if (!groups[first]) groups[first] = [];
        groups[first].push(r);
      });
    return groups;
  }, [recipes]);

  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const activeLetters = Object.keys(grouped);

  return (
    <div className="max-w-5xl mx-auto py-12 px-6 flex flex-col md:flex-row gap-16">
      <div className="hidden md:block w-20 sticky top-32 self-start">
        <div className="flex flex-col gap-1.5 items-center">
          {letters.map(l => (
            <button
              key={l}
              onClick={() => { const el = document.getElementById(`idx-${l}`); if(el) window.scrollTo({ top: el.offsetTop - 120, behavior: 'smooth' }); }}
              disabled={!activeLetters.includes(l)}
              className={`text-[11px] font-black w-9 h-9 rounded-full flex items-center justify-center transition-all ${activeLetters.includes(l) ? 'text-[#2D4635] hover:bg-[#2D4635] hover:text-white' : 'text-stone-200'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-20">
        <h2 className="text-4xl font-serif italic text-[#2D4635] mb-12">Archival Index</h2>
        {activeLetters.length === 0 && <div className="text-center py-32 bg-stone-50 rounded-[3rem] border border-stone-100"><p className="text-stone-400 font-serif">Index is empty.</p></div>}
        {letters.filter(l => activeLetters.includes(l)).map(l => (
          <div key={l} id={`idx-${l}`} className="space-y-8 animate-in fade-in">
            <h3 className="text-6xl font-serif italic text-[#A0522D]/10 border-b border-stone-100 pb-4 flex items-center gap-6">{l}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {grouped[l].map(r => (
                <button key={r.id} onClick={() => onSelect(r)} className="group flex items-center justify-between p-6 bg-white rounded-[2rem] border border-stone-100 hover:shadow-xl transition-all text-left">
                  <div className="overflow-hidden">
                    <p className="text-xl font-serif italic text-[#2D4635] mb-1 truncate">{r.title}</p>
                    <p className="text-[9px] uppercase tracking-widest text-stone-400">By {r.contributor} • {r.category}</p>
                  </div>
                  <span className="text-[9px] font-black uppercase text-stone-300 group-hover:text-[#2D4635] ml-4 shrink-0 transition-all">Open →</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ContributorsView: React.FC<{ recipes: Recipe[]; onSelectContributor: (name: string) => void }> = ({ recipes, onSelectContributor }) => {
  const stats = useMemo(() => {
    const s: Record<string, { count: number; cats: Set<string> }> = {};
    recipes.forEach(r => {
      if (!s[r.contributor]) s[r.contributor] = { count: 0, cats: new Set() };
      s[r.contributor].count++;
      s[r.contributor].cats.add(r.category);
    });
    return Object.entries(s).sort((a, b) => b[1].count - a[1].count);
  }, [recipes]);

  return (
    <div className="max-w-7xl mx-auto py-12 px-6">
      <h2 className="text-4xl font-serif italic text-[#2D4635] mb-12">The Contributors</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
        {stats.map(([name, stat]) => (
          <div key={name} className="bg-white rounded-[3rem] p-10 border border-stone-100 shadow-sm hover:shadow-2xl transition-all group relative overflow-hidden text-center">
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`} className="w-28 h-28 rounded-full bg-stone-50 border-8 border-white shadow-xl mx-auto mb-8 group-hover:rotate-6 transition-all" />
            <h3 className="text-3xl font-serif italic text-[#2D4635]">{name}</h3>
            <p className="text-[10px] uppercase tracking-widest text-stone-400 mt-2 mb-6">Archive Contributor</p>
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {Array.from(stat.cats).slice(0, 3).map(cat => <span key={cat} className="text-[8px] font-black uppercase bg-stone-50 text-stone-500 px-3 py-1 rounded-full">{cat}</span>)}
            </div>
            <button onClick={() => onSelectContributor(name)} className="w-full py-4 bg-stone-50 text-[#2D4635] rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-[#2D4635] hover:text-white transition-all">Explore Collection ({stat.count})</button>
          </div>
        ))}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [tab, setTab] = useState('Recipes');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [trivia, setTrivia] = useState<Trivia[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const s = localStorage.getItem('schafer_user');
    return s ? JSON.parse(s) : null;
  });
  
  const [dbStats, setDbStats] = useState<DBStats>({ 
    recipeCount: 0, galleryCount: 0, triviaCount: 0, 
    isCloudActive: CloudArchive.getProvider() !== 'local',
    activeProvider: CloudArchive.getProvider()
  });

  const [loginName, setLoginName] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [contributor, setContributor] = useState('All');
  const [showFilters, setShowFilters] = useState(false);

  // Sync Listeners
  useEffect(() => {
    const provider = CloudArchive.getProvider();
    if (provider !== 'firebase' || !CloudArchive.getFirebase()) {
       CloudArchive.getRecipes().then(setRecipes);
       CloudArchive.getTrivia().then(setTrivia);
       CloudArchive.getGallery().then(setGallery);
       return;
    }

    const unsubR = CloudArchive.subscribeRecipes(setRecipes);
    const unsubT = CloudArchive.subscribeTrivia(setTrivia);
    const unsubG = CloudArchive.subscribeGallery(setGallery);
    return () => { unsubR(); unsubT(); unsubG(); };
  }, []);

  useEffect(() => {
    setDbStats(prev => ({ ...prev, recipeCount: recipes.length, triviaCount: trivia.length, galleryCount: gallery.length }));
  }, [recipes, trivia, gallery]);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginName.trim()) return;
    const u: UserProfile = { 
      id: 'u' + Date.now(),
      name: loginName, 
      picture: `https://api.dicebear.com/7.x/avataaars/svg?seed=${loginName}` 
    };
    localStorage.setItem('schafer_user', JSON.stringify(u));
    setCurrentUser(u);
  };

  const filteredRecipes = useMemo(() => {
    return recipes.filter(r => {
      const matchS = r.title.toLowerCase().includes(search.toLowerCase());
      const matchC = category === 'All' || r.category === category;
      const matchA = contributor === 'All' || r.contributor === contributor;
      return matchS && matchC && matchA;
    });
  }, [recipes, search, category, contributor]);

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#2D4635] p-6">
        <div className="bg-white rounded-[4rem] p-10 md:p-16 w-full max-w-xl shadow-2xl relative overflow-hidden text-center animate-in zoom-in duration-700">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-800 via-orange-300 to-emerald-800" />
          
          <div className="relative mb-12">
            <div className="w-24 h-24 bg-stone-100 rounded-full mx-auto relative overflow-hidden border-4 border-white shadow-2xl group transition-all">
              {loginName ? (
                <img 
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${loginName}`} 
                  className="w-full h-full object-cover animate-in fade-in zoom-in" 
                  alt="Identity"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-300 text-3xl font-serif">?</div>
              )}
            </div>
            <div className="mt-8">
              <h1 className="text-4xl font-serif italic text-[#2D4635] mb-2">Identify Yourself</h1>
              <p className="text-stone-400 italic font-serif text-sm">Welcome to the Schafer Family Archive.</p>
            </div>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-8 relative z-10">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[#A0522D] ml-2">Legacy Contributor Name</label>
              <input 
                autoFocus
                type="text"
                placeholder="e.g. Grandma Joan" 
                className="w-full p-6 bg-stone-50 border border-stone-100 rounded-3xl text-center text-xl font-serif outline-none focus:ring-2 focus:ring-[#2D4635]/10 focus:bg-white transition-all shadow-inner" 
                value={loginName}
                onChange={e => setLoginName(e.target.value)}
              />
            </div>
            
            <button 
              type="submit"
              disabled={!loginName.trim()}
              className="w-full py-6 bg-[#2D4635] text-white rounded-full font-black uppercase tracking-[0.5em] text-[11px] shadow-2xl disabled:opacity-30 disabled:translate-y-0 transition-all active:scale-95 hover:bg-[#1e3023] hover:-translate-y-1"
            >
              Enter the Vault
            </button>
            
            <div className="pt-4">
              <p className="text-[9px] uppercase tracking-widest text-stone-300 font-bold">Provenance & Legacy • Established 1954</p>
            </div>
          </form>

          {/* Decorative Corner Elements */}
          <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-stone-50 rounded-full opacity-50" />
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-stone-50 rounded-full opacity-50" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FDFBF7]">
      <Header activeTab={tab} setTab={t => { setTab(t); if(t !== 'Admin') setEditingRecipe(null); }} currentUser={currentUser} dbStats={dbStats} />
      
      <main className="flex-1">
        {selectedRecipe && <RecipeModal recipe={selectedRecipe} onClose={() => setSelectedRecipe(null)} onEdit={r => { setEditingRecipe(r); setTab('Admin'); setSelectedRecipe(null); }} onDelete={async id => { await CloudArchive.deleteRecipe(id); setSelectedRecipe(null); }} />}

        {tab === 'Recipes' && (
          <div className="max-w-7xl mx-auto py-16 px-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-8">
              <div>
                <h2 className="text-5xl font-serif italic text-[#2D4635]">Heritage Recipes</h2>
                <p className="text-stone-400 mt-4 italic font-serif text-lg">Taste the story of the Schafer family.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <input type="text" placeholder="Search archive..." value={search} onChange={e => setSearch(e.target.value)} className="w-full sm:w-72 py-4 px-6 bg-white border border-stone-100 rounded-full text-sm outline-none shadow-sm" />
                <button onClick={() => setShowFilters(!showFilters)} className={`px-8 py-4 rounded-full text-[10px] font-black uppercase tracking-widest border ${showFilters ? 'bg-[#2D4635] text-white' : 'bg-white text-stone-600 border-stone-100'}`}>{showFilters ? 'Hide Filters' : 'Filter'}</button>
              </div>
            </div>

            {showFilters && (
              <div className="mb-16 p-10 bg-white rounded-[3rem] border border-stone-100 shadow-xl grid grid-cols-1 sm:grid-cols-3 gap-10 animate-in slide-in-from-top-4">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#A0522D]">Category</label>
                  <select value={category} onChange={e => setCategory(e.target.value)} className="w-full p-4 bg-stone-50 border border-stone-100 rounded-2xl text-sm outline-none">
                    <option>All</option>
                    {['Breakfast', 'Main', 'Dessert', 'Side', 'Appetizer', 'Bread', 'Dip/Sauce', 'Snack'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#A0522D]">Contributor</label>
                  <select value={contributor} onChange={e => setContributor(e.target.value)} className="w-full p-4 bg-stone-50 border border-stone-100 rounded-2xl text-sm outline-none">
                    <option>All</option>
                    {Array.from(new Set(recipes.map(r => r.contributor))).map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex items-end"><button onClick={() => { setCategory('All'); setContributor('All'); setSearch(''); }} className="w-full py-4 text-[10px] font-black uppercase text-stone-400 border border-dashed border-stone-200 rounded-2xl">Reset</button></div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
              {filteredRecipes.map(r => (
                <div key={r.id} onClick={() => setSelectedRecipe(r)} className="bg-white rounded-[3rem] border border-stone-100 shadow-sm overflow-hidden hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 cursor-pointer group">
                  <div className="aspect-[4/3] relative overflow-hidden">
                    <img src={r.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" alt={r.title} />
                    <div className="absolute top-6 left-6"><span className="px-4 py-1.5 bg-white/95 backdrop-blur rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg">{r.category}</span></div>
                  </div>
                  <div className="p-10">
                    <h3 className="text-3xl font-serif italic text-[#2D4635] mb-4 group-hover:text-[#A0522D] transition-colors">{r.title}</h3>
                    <div className="flex justify-between items-center pt-6 border-t border-stone-50">
                      <p className="text-[10px] text-stone-400 uppercase tracking-widest">By {r.contributor}</p>
                      <p className="text-[9px] font-black uppercase tracking-tighter text-[#A0522D] bg-[#A0522D]/5 px-3 py-1 rounded-full">{r.prepTime && `Prep: ${r.prepTime}`}</p>
                    </div>
                  </div>
                </div>
              ))}
              {filteredRecipes.length === 0 && <div className="col-span-full py-40 text-center bg-stone-50/50 rounded-[4rem] border border-dashed border-stone-200"><p className="text-stone-300 italic font-serif text-2xl">The collection yields no matches.</p></div>}
            </div>
          </div>
        )}

        {tab === 'Index' && <AlphabeticalIndex recipes={recipes} onSelect={setSelectedRecipe} />}
        {tab === 'Contributors' && <ContributorsView recipes={recipes} onSelectContributor={c => { setContributor(c); setTab('Recipes'); setShowFilters(true); }} />}
        
        {tab === 'Trivia' && (
          <div className="max-w-4xl mx-auto py-24 px-6 text-center">
            <h2 className="text-5xl font-serif italic text-[#2D4635] mb-20">Family Chronicle Quiz</h2>
            <div className="space-y-16">
              {trivia.map((t, i) => (
                <div key={t.id} className="bg-white rounded-[4rem] p-16 border border-stone-100 shadow-xl space-y-10 animate-in slide-in-from-bottom-6">
                  <span className="text-[11px] font-black uppercase text-[#A0522D] tracking-[0.4em]">Query {i+1}</span>
                  <p className="text-3xl md:text-4xl font-serif italic text-[#2D4635] leading-snug">{t.question}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {t.options.map((opt, idx) => (
                      <button key={idx} onClick={() => alert(opt === t.answer ? "Archive confirmed! 🌟" : "Incorrect lore entry. 🌿")} className="py-6 border border-stone-100 rounded-[2.5rem] hover:border-[#2D4635] hover:scale-105 transition-all text-sm font-medium shadow-sm bg-stone-50/30">{opt}</button>
                    ))}
                  </div>
                </div>
              ))}
              {trivia.length === 0 && <div className="py-40 bg-white rounded-[4rem] border border-stone-100"><p className="text-stone-300 italic font-serif text-2xl">The chronicle is empty.</p></div>}
            </div>
          </div>
        )}

        {tab === 'Gallery' && (
          <div className="max-w-7xl mx-auto py-16 px-6">
            <h2 className="text-5xl font-serif italic text-[#2D4635] mb-16">Family Moments</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {gallery.map(item => (
                <div key={item.id} className="bg-white rounded-[2.5rem] overflow-hidden border border-stone-100 group shadow-sm hover:shadow-2xl transition-all relative">
                   <div className="aspect-square overflow-hidden">
                     <img src={item.url} className="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-1000" alt={item.caption} />
                   </div>
                   <div className="p-6">
                     <p className="text-xs font-serif italic text-[#2D4635]">{item.caption}</p>
                     <div className="flex justify-between items-center mt-4 pt-4 border-t border-stone-50">
                       <span className="text-[8px] uppercase tracking-widest text-stone-300">Archive by {item.contributor}</span>
                       <button onClick={async () => { if(confirm("Remove from gallery?")) await CloudArchive.deleteGalleryItem(item.id); }} className="text-stone-200 hover:text-red-400 transition-colors">✕</button>
                     </div>
                   </div>
                </div>
              ))}
              {gallery.length === 0 && <div className="col-span-full py-40 text-center"><p className="text-stone-300 italic font-serif text-2xl">Visual archive is awaiting uploads.</p></div>}
            </div>
          </div>
        )}

        {tab === 'Admin' && (
          <AdminView 
            editingRecipe={editingRecipe} clearEditing={() => setEditingRecipe(null)} recipes={recipes} trivia={trivia} currentUser={currentUser} dbStats={dbStats}
            onAddRecipe={async (r, file) => { 
              if(file) { const url = await CloudArchive.uploadFile(file, 'recipes'); if(url) r.image = url; }
              await CloudArchive.upsertRecipe(r); 
            }}
            onAddGallery={async (g, file) => {
              if(file) { const url = await CloudArchive.uploadFile(file, 'gallery'); if(url) g.url = url; }
              await CloudArchive.upsertGalleryItem(g);
            }}
            onAddTrivia={async t => await CloudArchive.upsertTrivia(t)}
            onDeleteTrivia={async id => await CloudArchive.deleteTrivia(id)}
          />
        )}
      </main>
      
      <footer className="py-20 border-t border-stone-100 bg-stone-50/30">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-[10px] font-black uppercase text-stone-300 tracking-[0.8em]">The Schafer Family Archive • {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
