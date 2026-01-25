import React, { useState, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { Recipe, GalleryItem, Trivia, UserProfile, DBStats, ContributorProfile } from '../types';
import { CATEGORY_IMAGES } from '../constants';
import { AvatarPicker } from './AvatarPicker';

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
    onUpdateArchivePhone: (p: string) => void;
}

export const AdminView: React.FC<AdminViewProps> = (props) => {
    const { editingRecipe, clearEditing, recipes, trivia, contributors, currentUser, dbStats, onAddRecipe, onAddGallery, onAddTrivia, onDeleteTrivia, onUpdateContributor, onUpdateArchivePhone } = props;
    const [recipeForm, setRecipeForm] = useState<Partial<Recipe>>({ title: '', category: 'Main', ingredients: [], instructions: [] });
    const [galleryForm, setGalleryForm] = useState<Partial<GalleryItem>>({ caption: '' });
    const [triviaForm, setTriviaForm] = useState<Partial<Trivia>>({ question: '', options: ['', '', '', ''], answer: '' });
    const [recipeFile, setRecipeFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [galleryFile, setGalleryFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showConfig, setShowConfig] = useState(false);
    const [rawText, setRawText] = useState('');
    const [isMagicLoading, setIsMagicLoading] = useState(false);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [newAdminName, setNewAdminName] = useState('');
    const [pickerTarget, setPickerTarget] = useState<{ name: string, avatar: string, id: string, role: 'admin' | 'user' } | null>(null);
    const [activeSubtab, setActiveSubtab] = useState<'permissions' | 'records' | 'gallery' | 'trivia' | 'directory'>('records');
    const [editingTrivia, setEditingTrivia] = useState<Trivia | null>(null);

    const isSuperAdmin = currentUser?.name.toLowerCase() === 'kyle' || currentUser?.email === 'hondo4185@gmail.com';

    // Cloud Config state
    const [provider, setProvider] = useState<'local' | 'firebase'>(dbStats.activeProvider === 'firebase' ? 'firebase' : 'local');
    const [fbConfig, setFbConfig] = useState(() => JSON.parse(localStorage.getItem('schafer_firebase_config') || '{"apiKey":"","projectId":""}'));

    useEffect(() => {
        if (editingRecipe) {
            setRecipeForm(editingRecipe);
            setPreviewUrl(editingRecipe.image || CATEGORY_IMAGES[editingRecipe.category] || CATEGORY_IMAGES.Generic);
        } else {
            setRecipeForm({ title: '', category: 'Main', ingredients: [], instructions: [] });
            setPreviewUrl(null);
        }
        setRecipeFile(null);
    }, [editingRecipe]);

    useEffect(() => {
        if (!recipeFile) {
            if (!editingRecipe) setPreviewUrl(null);
            return;
        }
        const url = URL.createObjectURL(recipeFile);
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [recipeFile, editingRecipe]);

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
                    systemInstruction: "Analyze this recipe and extract structured JSON data. Fields: title, category (Breakfast|Main|Dessert|Side|Appetizer|Bread|Dip/Sauce|Snack), ingredients (list), instructions (list), prepTime, cookTime, calories (number - estimated total).",
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
                            calories: { type: Type.NUMBER },
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

    const handleVisualSourcing = async () => {
        if (!recipeForm.title) return;
        setIsGeneratingImage(true);
        try {
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) throw new Error("Missing Gemini API Key");
            const ai = new GoogleGenAI({ apiKey });

            const response = await ai.models.generateContent({
                model: 'gemini-1.5-flash',
                contents: [{
                    role: 'user',
                    parts: [{
                        text: `You are a heritage food photography curator. Based on the recipe: "${recipeForm.title}" (${recipeForm.category}), find a high-quality Unsplash Image ID that best represents this dish in a vintage 'family archive' aesthetic. Return ONLY the ID (e.g. 1547592166-23ac45744acd).`
                    }]
                }],
            });

            const photoId = response.text.trim().replace(/['"]/g, '');

            if (photoId.length > 5) {
                const url = `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&q=80&w=1200`;
                setRecipeForm(prev => ({ ...prev, image: url }));
                setPreviewUrl(url);
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
            const isVideo = galleryFile.type.startsWith('video/');
            await onAddGallery({
                id: 'g' + Date.now(),
                type: isVideo ? 'video' : 'image',
                url: '',
                caption: galleryForm.caption || (isVideo ? 'Family Video' : 'Family Memory'),
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
            <div className="max-w-7xl mx-auto px-6 py-12 space-y-12">
                {/* Sub-navigation bar */}
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-2 mb-8 bg-stone-50/50 rounded-full px-2">
                    {[
                        { id: 'records', label: '📖 Record' },
                        { id: 'gallery', label: '🖼️ Gallery' },
                        { id: 'trivia', label: '💡 Trivia' },
                        { id: 'directory', label: '👥 Directory' },
                        { id: 'permissions', label: '🔐 Admins', restricted: true },
                    ].map(tab => (
                        (!tab.restricted || isSuperAdmin) && (
                            <button
                                key={tab.id}
                                onClick={() => setActiveSubtab(tab.id as any)}
                                className={`px-4 py-2 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeSubtab === tab.id ? 'bg-[#2D4635] text-white shadow-lg' : 'text-stone-400 hover:bg-white'}`}
                            >
                                {tab.label}
                            </button>
                        )
                    ))}
                </div>

                {/* Permissions & Admin Management */}
                {activeSubtab === 'permissions' && isSuperAdmin && (
                    <section className="bg-white rounded-[2.5rem] md:rounded-[3rem] p-6 md:p-16 border border-stone-100 shadow-xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-50 rounded-full -mr-32 -mt-32 blur-3xl opacity-50" />
                        <div className="relative z-10">
                            <h2 className="text-3xl font-serif italic text-[#2D4635] mb-8 flex items-center gap-4">
                                <span className="w-12 h-12 rounded-full bg-[#2D4635]/5 flex items-center justify-center not-italic text-2xl">🔐</span>
                                Admin & Permissions
                            </h2>
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
                )}

                {(activeSubtab === 'records' || activeSubtab === 'gallery' || activeSubtab === 'trivia') && (
                    <div className="bg-white rounded-[2.5rem] md:rounded-[3rem] p-6 md:p-12 border border-stone-100 shadow-xl overflow-hidden relative animate-in fade-in slide-in-from-bottom-4">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
                            <h2 className="text-3xl font-serif italic text-[#2D4635]">
                                {activeSubtab === 'records' ? 'New Heritage Record' : activeSubtab === 'gallery' ? 'Family Archive' : 'Family Trivia'}
                            </h2>
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

                        <div className="grid grid-cols-1 gap-16">
                            {activeSubtab === 'records' && (
                                <section className="space-y-8 animate-in fade-in">
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

                                            {previewUrl && (
                                                <div className="relative w-full h-48 rounded-[2rem] overflow-hidden mb-4 border border-stone-100 shadow-inner group">
                                                    <img
                                                        src={previewUrl}
                                                        className="w-full h-full object-cover"
                                                        alt="Preview"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).src = CATEGORY_IMAGES[recipeForm.category || 'Main'] || CATEGORY_IMAGES.Generic;
                                                        }}
                                                    />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-white">Current Heritage Photo</p>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="relative group">
                                                <input type="file" accept="image/*" onChange={e => setRecipeFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                                                <div className="w-full p-4 border-2 border-dashed border-stone-200 rounded-3xl flex items-center justify-center gap-3 text-stone-400 group-hover:border-[#2D4635] transition-all bg-stone-50/30">
                                                    <span className="text-lg">📁</span>
                                                    <span className="text-[10px] font-black uppercase tracking-widest">
                                                        {recipeFile ? recipeFile.name : editingRecipe ? 'Change Heritage Photo' : 'Upload Heritage Photo'}
                                                    </span>
                                                </div>
                                            </div>
                                            <button type="button" onClick={handleVisualSourcing} disabled={isGeneratingImage || !recipeForm.title} className="w-full py-3 bg-[#A0522D]/10 text-[#A0522D] rounded-2xl text-[10px] font-black uppercase tracking-widest border border-[#A0522D]/20 mt-2 hover:bg-[#A0522D]/20 transition-all">
                                                {isGeneratingImage ? 'Sourcing Legacy Visual...' : '✨ Find Heritage Photo with AI'}
                                            </button>
                                        </div>
                                        <input placeholder="Recipe Title" className="w-full p-4 border border-stone-200 rounded-2xl text-sm outline-none" value={recipeForm.title} onChange={e => setRecipeForm({ ...recipeForm, title: e.target.value })} required />
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                            <select className="p-4 border border-stone-200 rounded-2xl text-sm bg-white" value={recipeForm.category} onChange={e => setRecipeForm({ ...recipeForm, category: e.target.value as any })}>
                                                {['Breakfast', 'Main', 'Dessert', 'Side', 'Appetizer', 'Bread', 'Dip/Sauce', 'Snack'].map(c => <option key={c}>{c}</option>)}
                                            </select>
                                            <input placeholder="Prep Time" className="p-4 border border-stone-200 rounded-2xl text-sm" value={recipeForm.prepTime || ''} onChange={e => setRecipeForm({ ...recipeForm, prepTime: e.target.value })} />
                                            <input type="number" placeholder="Est. Calories" className="p-4 border border-stone-200 rounded-2xl text-sm" value={recipeForm.calories || ''} onChange={e => setRecipeForm({ ...recipeForm, calories: parseInt(e.target.value) || 0 })} />
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
                            )}

                            {activeSubtab === 'gallery' && (
                                <section className="space-y-6 animate-in fade-in">
                                    <h3 className="text-xl font-serif italic text-[#A0522D] flex items-center gap-3">
                                        <span className="w-10 h-10 rounded-full bg-[#A0522D]/5 flex items-center justify-center not-italic">🖼️</span>
                                        Family Archive
                                    </h3>
                                    <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100 flex items-start gap-4 mb-4">
                                        <span className="text-2xl mt-1">📱</span>
                                        <div>
                                            <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-800">Archive by Text</h4>
                                            <p className="text-xs text-emerald-700 font-serif italic mt-1 leading-relaxed">
                                                Family members can text photos or videos to the archive. Text to: <br />
                                                <span className="font-bold not-italic">{dbStats.archivePhone || 'Not Configured'}</span>
                                            </p>
                                        </div>
                                    </div>

                                    <div className="p-6 bg-stone-50 rounded-3xl border border-stone-100 mb-8">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4">Twilio Configuration</h4>
                                        <div className="flex gap-4">
                                            <input
                                                placeholder="designate archive number..."
                                                className="flex-1 p-3 border border-stone-200 rounded-xl text-xs bg-white"
                                                value={dbStats.archivePhone || ''}
                                                onChange={e => onUpdateArchivePhone(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <form onSubmit={handleGallerySubmit} className="space-y-4">
                                        <div className="relative group">
                                            <input type="file" accept="image/*,video/*" onChange={e => setGalleryFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                                            <div className="w-full h-32 border-2 border-dashed border-stone-200 rounded-[2rem] flex flex-col items-center justify-center gap-2 text-stone-300 group-hover:border-[#A0522D] group-hover:text-[#A0522D] transition-all">
                                                <span className="text-3xl">🏞️</span>
                                                <span className="text-[9px] font-black uppercase tracking-widest">{galleryFile ? galleryFile.name : 'Choose Family Photo or Video'}</span>
                                            </div>
                                        </div>
                                        <input placeholder="Short caption..." className="w-full p-4 border border-stone-200 rounded-2xl text-sm outline-none" value={galleryForm.caption} onChange={e => setGalleryForm({ ...galleryForm, caption: e.target.value })} />
                                        <button type="submit" disabled={!galleryFile || isSubmitting} className="w-full py-4 bg-[#A0522D] text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
                                            {isSubmitting ? 'Uploading...' : 'Upload Memory'}
                                        </button>
                                    </form>
                                </section>
                            )}

                            {activeSubtab === 'trivia' && (
                                <section className="space-y-6 animate-in fade-in">
                                    <h3 className="text-xl font-serif italic text-[#A0522D] flex items-center gap-3">
                                        <span className="w-10 h-10 rounded-full bg-[#A0522D]/5 flex items-center justify-center not-italic">💡</span>
                                        Family Trivia
                                    </h3>
                                    <form onSubmit={async (e) => {
                                        e.preventDefault();
                                        if (!triviaForm.question) return;
                                        await onAddTrivia({
                                            ...(triviaForm as Trivia),
                                            id: editingTrivia?.id || 't_' + Date.now(),
                                            contributor: editingTrivia?.contributor || currentUser?.name || 'Unknown'
                                        });
                                        setTriviaForm({ question: '', options: ['', '', '', ''], answer: '' });
                                        setEditingTrivia(null);
                                    }} className="space-y-4">
                                        <input placeholder="The Question" className="w-full p-4 border border-stone-200 rounded-2xl text-sm outline-none" value={triviaForm.question} onChange={e => setTriviaForm({ ...triviaForm, question: e.target.value })} />
                                        <div className="grid grid-cols-2 gap-3">
                                            {triviaForm.options?.map((opt, i) => (
                                                <input key={i} placeholder={`Opt ${i + 1}`} className="p-3 border border-stone-200 rounded-xl text-xs" value={opt} onChange={e => { const n = [...(triviaForm.options || [])]; n[i] = e.target.value; setTriviaForm({ ...triviaForm, options: n }) }} />
                                            ))}
                                        </div>
                                        <input placeholder="Correct Answer" className="w-full p-4 border border-stone-200 rounded-2xl text-sm font-bold bg-stone-50" value={triviaForm.answer} onChange={e => setTriviaForm({ ...triviaForm, answer: e.target.value })} />
                                        <div className="flex gap-4">
                                            <button type="submit" className="flex-1 py-4 bg-[#2D4635] text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-md">
                                                {editingTrivia ? 'Update Question' : 'Add Question'}
                                            </button>
                                            {editingTrivia && <button type="button" onClick={() => { setEditingTrivia(null); setTriviaForm({ question: '', options: ['', '', '', ''], answer: '' }); }} className="flex-1 py-4 border border-stone-200 rounded-full text-[10px] font-black uppercase text-stone-400">Cancel</button>}
                                        </div>
                                    </form>
                                    <div className="pt-8 border-t border-stone-100 max-h-96 overflow-y-auto custom-scrollbar">
                                        <h4 className="text-[10px] font-black uppercase text-stone-400 mb-4">Current Questions</h4>
                                        {trivia.map(t => (
                                            <div key={t.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-xl mb-2 group">
                                                <div className="flex flex-col truncate flex-1 cursor-pointer" onClick={() => { setEditingTrivia(t); setTriviaForm(t); }}>
                                                    <span className="text-xs truncate font-bold text-[#2D4635]">{t.question}</span>
                                                    <span className="text-[9px] uppercase tracking-widest text-stone-400">Click to edit</span>
                                                </div>
                                                <button onClick={() => onDeleteTrivia(t.id)} className="text-stone-300 hover:text-red-500 transition-all ml-4">✕</button>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}
                        </div>
                    </div>
                )}

                {activeSubtab === 'directory' && (
                    <section className="bg-white rounded-[3rem] p-10 md:p-16 border border-stone-100 shadow-xl animate-in fade-in slide-in-from-bottom-4">
                        <h2 className="text-3xl font-serif italic text-[#2D4635] mb-8 flex items-center gap-4">
                            <span className="w-12 h-12 rounded-full bg-[#2D4635]/5 flex items-center justify-center not-italic text-2xl">👥</span>
                            Family Directory & Avatars
                        </h2>
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
                                            <span onClick={(e) => {
                                                e.stopPropagation();
                                                const phone = prompt(`Enter phone number for ${name} (e.g. +1234567890):`, profile?.phone || '');
                                                if (phone !== null) {
                                                    const updatedProfile = profile ? { ...profile, phone } : { id: 'c_' + Date.now(), name, avatar, role: 'user', phone };
                                                    onUpdateContributor(updatedProfile as any);
                                                }
                                            }} className="text-[9px] uppercase tracking-widest text-[#2D4635] hover:font-bold">Phone</span>
                                            <span onClick={(e) => {
                                                e.stopPropagation();
                                                if (isSuperAdmin) {
                                                    setPickerTarget({ name, avatar, id: profile?.id || 'c_' + Date.now(), role });
                                                } else {
                                                    const url = prompt(`Enter new avatar URL for ${name}:`, avatar);
                                                    if (url) onUpdateContributor({ id: profile?.id || 'c_' + Date.now(), name, avatar: url, role });
                                                }
                                            }} className="text-[9px] uppercase tracking-widest text-[#2D4635] hover:font-bold">Avatar</span>
                                            {role === 'admin' ? (
                                                <span onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (!isSuperAdmin) { alert("Only Super Admins (Kyle) can modify roles."); return; }
                                                    if (confirm(`Revoke admin access for ${name}?`)) onUpdateContributor({ id: profile?.id || 'c_' + Date.now(), name, avatar, role: 'user' });
                                                }} className="text-[9px] uppercase tracking-widest text-orange-500 font-bold hover:text-orange-600">Admin ✓</span>
                                            ) : (
                                                <span onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (!isSuperAdmin) { alert("Only Super Admins (Kyle) can modify roles."); return; }
                                                    if (confirm(`Promote ${name} to Administrator?`)) onUpdateContributor({ id: profile?.id || 'c_' + Date.now(), name, avatar, role: 'admin' });
                                                }} className="text-[9px] uppercase tracking-widest text-stone-400 hover:text-[#2D4635] hover:font-bold">Grant Admin</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {pickerTarget && isSuperAdmin && (
                    <AvatarPicker
                        currentAvatar={pickerTarget.avatar}
                        onSelect={(url) => {
                            onUpdateContributor({
                                ...pickerTarget,
                                avatar: url
                            });
                        }}
                        onClose={() => setPickerTarget(null)}
                    />
                )}
            </div>
        </div>
    );
};
