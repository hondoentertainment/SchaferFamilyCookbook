import React, { useState, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { Recipe, GalleryItem, Trivia, UserProfile, DBStats, ContributorProfile } from '../types';

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

interface AdminViewProps {
    editingRecipe: Recipe | null;
    clearEditing: () => void;
    recipes: Recipe[];
    trivia: Trivia[];
    contributors: ContributorProfile[];
    currentUser: UserProfile | null;
    dbStats: DBStats;
    onAddRecipe: (r: Recipe, file?: File) => Promise<void>;
    onAddGallery: (g: GalleryItem, file?: File) => Promise<void>;
    onAddTrivia: (t: Trivia) => Promise<void>;
    onDeleteTrivia: (id: string) => void;
    onUpdateContributor: (c: ContributorProfile) => Promise<void>;
}

export const AdminView: React.FC<AdminViewProps> = (props) => {
    const { editingRecipe, clearEditing, recipes, trivia, contributors, currentUser, dbStats, onAddRecipe, onAddGallery, onAddTrivia, onDeleteTrivia, onUpdateContributor } = props;
    const [recipeForm, setRecipeForm] = useState<Partial<Recipe>>({ title: '', category: 'Main', ingredients: [], instructions: [] });
    const [galleryForm, setGalleryForm] = useState<Partial<GalleryItem>>({ caption: '' });
    const [triviaForm, setTriviaForm] = useState<Partial<Trivia>>({ question: '', options: ['', '', '', ''], answer: '' });
    const [recipeFile, setRecipeFile] = useState<File | null>(null);
    const [galleryFile, setGalleryFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showConfig, setShowConfig] = useState(false);
    const [rawText, setRawText] = useState('');
    const [isMagicLoading, setIsMagicLoading] = useState(false);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [newAdminName, setNewAdminName] = useState('');

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
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) throw new Error("Missing Gemini API Key");

            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({
                model: 'gemini-1.5-flash',
                contents: [{ role: 'user', parts: [{ text: `Recipe text: ${rawText}` }] }],
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

            const responseText = (response as any).text;
            const parsed = JSON.parse(responseText || '{}');
            setRecipeForm(prev => ({ ...prev, ...parsed }));
            setRawText('');
            alert("Magic Import Successful!");
        } catch (e: any) {
            console.error(e);
            alert(`AI Analysis failed: ${e.message}`);
        } finally { setIsMagicLoading(false); }
    };

    const handleGenerateImage = async () => {
        if (!recipeForm.title) return;
        setIsGeneratingImage(true);
        try {
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) throw new Error("Missing Gemini API Key");
            const ai = new GoogleGenAI({ apiKey });
            const response: any = await (ai.models as any).generateImage({
                model: 'imagen-3.0-generate-001',
                prompt: `A delicious photography shot of ${recipeForm.title}, ${recipeForm.category} dish.`,
                config: { numberOfImages: 1 }
            });
            const b64 = response.image?.image64;
            if (b64) {
                setRecipeForm(prev => ({ ...prev, image: `data:image/png;base64,${b64}` }));
                setRecipeFile(null);
            }
        } catch (e: any) {
            console.error(e);
        } finally { setIsGeneratingImage(false); }
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
                type: 'image', url: '',
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
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="max-w-7xl mx-auto px-6 py-12 space-y-20">
                {/* Permissions & Admin Management */}
                <section className="bg-white rounded-[3rem] p-10 md:p-16 border border-stone-100 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-orange-50 rounded-full -mr-32 -mt-32 blur-3xl opacity-50" />
                    <div className="relative z-10">
                        <h3 className="text-3xl font-serif italic text-[#2D4635] mb-8 flex items-center gap-4">
                            <span className="w-12 h-12 rounded-full bg-[#2D4635]/5 flex items-center justify-center not-italic text-2xl">🔐</span>
                            Admin & Permissions
                        </h3>
                        <div className="grid md:grid-cols-2 gap-12">
                            <div className="space-y-6">
                                <p className="text-stone-500 text-sm leading-relaxed">Promote family members to admin status by their legacy name.</p>
                                <div className="flex gap-4">
                                    <input type="text" placeholder="Enter name (e.g. Aunt Mary)" className="flex-1 px-6 py-4 bg-stone-50 border border-stone-100 rounded-2xl text-sm font-serif outline-none focus:ring-2 focus:ring-[#2D4635]/10" value={newAdminName} onChange={e => setNewAdminName(e.target.value)} />
                                    <button onClick={() => {
                                        if (!newAdminName.trim()) return;
                                        const name = newAdminName.trim();
                                        const profile = props.contributors.find(c => c.name.toLowerCase() === name.toLowerCase());
                                        onUpdateContributor({
                                            id: profile?.id || 'c_' + Date.now(),
                                            name: profile?.name || name,
                                            avatar: profile?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
                                            role: 'admin'
                                        });
                                        setNewAdminName('');
                                        alert(`${name} has been promoted.`);
                                    }} className="px-8 py-4 bg-[#2D4635] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg">Grant Access</button>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-[#A0522D]">Current Administrators</h4>
                                <div className="flex flex-wrap gap-3">
                                    {props.contributors.filter(c => c.role === 'admin').map(admin => (
                                        <div key={admin.id} className="flex items-center gap-2 px-3 py-2 bg-stone-50 rounded-full border border-stone-100 group">
                                            <img src={admin.avatar} className="w-6 h-6 rounded-full border border-white" alt={admin.name} />
                                            <span className="text-xs font-bold text-stone-600">{admin.name}</span>
                                            {admin.name.toLowerCase() !== 'admin' && (
                                                <button onClick={() => { if (confirm(`Revoke admin access for ${admin.name}?`)) onUpdateContributor({ ...admin, role: 'user' }); }} className="w-4 h-4 rounded-full bg-stone-200 text-stone-500 flex items-center justify-center text-[8px] hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100">✕</button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="bg-white rounded-[3rem] p-8 md:p-12 border border-stone-100 shadow-xl overflow-hidden relative">
                    <div className="flex justify-between items-center mb-12">
                        <h2 className="text-3xl font-serif italic text-[#2D4635]">Archive Command</h2>
                        <button onClick={() => setShowConfig(!showConfig)} className="text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-[#2D4635] flex items-center gap-2">
                            {showConfig ? '✕ Close Setup' : '⚙️ Cloud Setup'}
                        </button>
                    </div>

                    {showConfig && (
                        <div className="mb-12 p-10 bg-stone-50/50 rounded-[3rem] border border-stone-100">
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
                                            <input type="password" value={fbConfig.apiKey} onChange={e => setFbConfig({ ...fbConfig, apiKey: e.target.value })} className="w-full p-4 border border-stone-200 rounded-2xl text-xs bg-white" placeholder="AIzaSy..." />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-stone-400">Project ID</label>
                                            <input value={fbConfig.projectId} onChange={e => setFbConfig({ ...fbConfig, projectId: e.target.value })} className="w-full p-4 border border-stone-200 rounded-2xl text-xs bg-white" placeholder="schafer-archive-..." />
                                        </div>
                                    </div>
                                )}
                                <button onClick={saveConfig} className="w-full py-4 bg-[#A0522D] text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">Update Cloud Settings</button>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                        <section className="space-y-8">
                            <h3 className="text-xl font-serif italic text-[#A0522D] flex items-center gap-3">
                                <span className="w-10 h-10 rounded-full bg-[#A0522D]/5 flex items-center justify-center not-italic">📖</span>
                                {editingRecipe ? 'Edit Archival Entry' : 'New Heritage Record'}
                            </h3>
                            {!editingRecipe && (
                                <div className="space-y-4">
                                    <textarea placeholder="Paste raw recipe text here..." className="w-full h-32 p-5 border border-stone-100 rounded-3xl text-sm bg-stone-50 outline-none" value={rawText} onChange={(e) => setRawText(e.target.value)} />
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
                                        <div className="w-full p-4 border-2 border-dashed border-stone-200 rounded-3xl flex items-center justify-center gap-3 text-stone-400 group-hover:border-[#2D4635] transition-all">
                                            <span className="text-lg">📷</span>
                                            <span className="text-[10px] font-black uppercase tracking-widest">{recipeFile ? recipeFile.name : recipeForm.image?.startsWith('data:') ? 'AI Image Generated' : 'Upload Heritage Photo'}</span>
                                        </div>
                                    </div>
                                    <button type="button" onClick={handleGenerateImage} disabled={isGeneratingImage || !recipeForm.title} className="w-full py-3 bg-[#A0522D]/10 text-[#A0522D] rounded-2xl text-[10px] font-black uppercase tracking-widest border border-[#A0522D]/20 mt-2">
                                        {isGeneratingImage ? 'Generating Deliciousness...' : '✨ Generate Photo with AI'}
                                    </button>
                                </div>
                                <input placeholder="Recipe Title" className="w-full p-4 border border-stone-200 rounded-2xl text-sm outline-none" value={recipeForm.title} onChange={e => setRecipeForm({ ...recipeForm, title: e.target.value })} required />
                                <div className="grid grid-cols-2 gap-4">
                                    <select className="p-4 border border-stone-200 rounded-2xl text-sm bg-white" value={recipeForm.category} onChange={e => setRecipeForm({ ...recipeForm, category: e.target.value as any })}>
                                        {['Breakfast', 'Main', 'Dessert', 'Side', 'Appetizer', 'Bread', 'Dip/Sauce', 'Snack'].map(c => <option key={c}>{c}</option>)}
                                    </select>
                                    <input placeholder="Prep Time" className="p-4 border border-stone-200 rounded-2xl text-sm" value={recipeForm.prepTime || ''} onChange={e => setRecipeForm({ ...recipeForm, prepTime: e.target.value })} />
                                </div>
                                <textarea placeholder="Ingredients (one per line)" className="w-full h-32 p-4 border border-stone-200 rounded-2xl text-sm bg-stone-50" value={recipeForm.ingredients?.join('\n')} onChange={e => setRecipeForm({ ...recipeForm, ingredients: e.target.value.split('\n') })} required />
                                <textarea placeholder="Instructions (one per line)" className="w-full h-48 p-4 border border-stone-200 rounded-2xl text-sm bg-stone-50" value={recipeForm.instructions?.join('\n')} onChange={e => setRecipeForm({ ...recipeForm, instructions: e.target.value.split('\n') })} required />
                                <div className="flex gap-4">
                                    <button type="submit" disabled={isSubmitting} className="flex-1 py-4 bg-[#2D4635] text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl">
                                        {isSubmitting ? 'Archiving...' : editingRecipe ? 'Update Record' : 'Commit to Archive'}
                                    </button>
                                    {editingRecipe && <button type="button" onClick={clearEditing} className="flex-1 py-4 border border-stone-200 rounded-full text-[10px] font-black uppercase text-stone-400">Cancel</button>}
                                </div>
                            </form>
                        </section>
                        <div className="space-y-16">
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
                                    <input placeholder="Short caption..." className="w-full p-4 border border-stone-200 rounded-2xl text-sm outline-none" value={galleryForm.caption} onChange={e => setGalleryForm({ ...galleryForm, caption: e.target.value })} />
                                    <button type="submit" disabled={!galleryFile || isSubmitting} className="w-full py-4 bg-[#A0522D] text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
                                        {isSubmitting ? 'Uploading...' : 'Upload Memory'}
                                    </button>
                                </form>
                            </section>
                            <section className="space-y-6">
                                <h3 className="text-xl font-serif italic text-[#A0522D] flex items-center gap-3">
                                    <span className="w-10 h-10 rounded-full bg-[#A0522D]/5 flex items-center justify-center not-italic">💡</span>
                                    Family Trivia
                                </h3>
                                <form onSubmit={async (e) => { e.preventDefault(); if (!triviaForm.question) return; await onAddTrivia(triviaForm as Trivia); setTriviaForm({ question: '', options: ['', '', '', ''], answer: '' }) }} className="space-y-4">
                                    <input placeholder="The Question" className="w-full p-4 border border-stone-200 rounded-2xl text-sm outline-none" value={triviaForm.question} onChange={e => setTriviaForm({ ...triviaForm, question: e.target.value })} />
                                    <div className="grid grid-cols-2 gap-3">
                                        {triviaForm.options?.map((opt, i) => (
                                            <input key={i} placeholder={`Opt ${i + 1}`} className="p-3 border border-stone-200 rounded-xl text-xs" value={opt} onChange={e => { const n = [...(triviaForm.options || [])]; n[i] = e.target.value; setTriviaForm({ ...triviaForm, options: n }) }} />
                                        ))}
                                    </div>
                                    <input placeholder="Correct Answer" className="w-full p-4 border border-stone-200 rounded-2xl text-sm font-bold bg-stone-50" value={triviaForm.answer} onChange={e => setTriviaForm({ ...triviaForm, answer: e.target.value })} />
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

                <section className="mt-16 pt-16 border-t border-stone-100">
                    <h3 className="text-3xl font-serif italic text-[#2D4635] mb-8 flex items-center gap-4">
                        <span className="w-12 h-12 rounded-full bg-[#2D4635]/5 flex items-center justify-center not-italic text-2xl">👥</span>
                        Family Directory & Avatars
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                        {Array.from(new Set([
                            ...(props.recipes || []).map(r => r.contributor),
                            ...(props.trivia || []).map(t => t.contributor),
                            ...(props.contributors || []).map(c => c.name)
                        ].filter(Boolean))).sort().map(name => {
                            const profile = contributors.find(c => c.name === name);
                            const avatar = profile?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;
                            const role = profile?.role || 'user';
                            return (
                                <div key={name} className="flex flex-col items-center gap-3 p-4 bg-stone-50 rounded-3xl border border-stone-100 hover:shadow-lg transition-all cursor-pointer group relative">
                                    <img src={avatar} className="w-20 h-20 rounded-full bg-white shadow-sm object-cover" alt={name} />
                                    <span className="text-xs font-bold text-stone-600 text-center">{name}</span>
                                    <div className="flex gap-2">
                                        <span onClick={(e) => { e.stopPropagation(); const url = prompt(`Enter new avatar URL for ${name}:`, avatar); if (url) onUpdateContributor({ id: profile?.id || 'c_' + Date.now(), name, avatar: url, role }); }} className="text-[9px] uppercase tracking-widest text-[#2D4635] hover:font-bold">Avatar</span>
                                        <span onClick={(e) => { e.stopPropagation(); const newRole = role === 'admin' ? 'user' : 'admin'; onUpdateContributor({ id: profile?.id || 'c_' + Date.now(), name, avatar, role: newRole }); }} className={`text-[9px] uppercase tracking-widest ${role === 'admin' ? 'text-orange-500 font-bold' : 'text-stone-400'} hover:font-bold`}>{role}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            </div>
        </div>
    );
};
