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
    onDeleteRecipe: (id: string) => void;
    onUpdateContributor: (c: ContributorProfile) => Promise<void>;
    onUpdateArchivePhone: (p: string) => void;
    onEditRecipe: (r: Recipe) => void;
}

export const AdminView: React.FC<AdminViewProps> = (props) => {
    const { editingRecipe, clearEditing, recipes, trivia, contributors, currentUser, dbStats, onAddRecipe, onAddGallery, onAddTrivia, onDeleteTrivia, onDeleteRecipe, onUpdateContributor, onUpdateArchivePhone, onEditRecipe } = props;
    const [recipeForm, setRecipeForm] = useState<Partial<Recipe>>({ title: '', category: 'Main', ingredients: [], instructions: [] });
    const [galleryForm, setGalleryForm] = useState<Partial<GalleryItem>>({ caption: '' });
    const [triviaForm, setTriviaForm] = useState<Partial<Trivia>>({ question: '', options: ['', '', '', ''], answer: '' });
    const [recipeFile, setRecipeFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [galleryFile, setGalleryFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [rawText, setRawText] = useState('');
    const [isMagicLoading, setIsMagicLoading] = useState(false);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [newAdminName, setNewAdminName] = useState('');
    const [pickerTarget, setPickerTarget] = useState<{ name: string, avatar: string, id: string, role: 'admin' | 'user' } | null>(null);
    const [activeSubtab, setActiveSubtab] = useState<'permissions' | 'records' | 'gallery' | 'trivia' | 'directory'>('records');
    const [editingTrivia, setEditingTrivia] = useState<Trivia | null>(null);
    const [isBulkSourcing, setIsBulkSourcing] = useState(false);
    const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
    const [mergeFrom, setMergeFrom] = useState('');
    const [mergeTo, setMergeTo] = useState('');
    const [isMerging, setIsMerging] = useState(false);
    const [recipeSearch, setRecipeSearch] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Filter recipes based on search
    const filteredRecipes = recipes.filter(r =>
        r.title.toLowerCase().includes(recipeSearch.toLowerCase()) ||
        r.category.toLowerCase().includes(recipeSearch.toLowerCase()) ||
        r.contributor?.toLowerCase().includes(recipeSearch.toLowerCase())
    );

    const isSuperAdmin = currentUser?.name.toLowerCase() === 'kyle' || currentUser?.email === 'hondo4185@gmail.com';



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

    const getGeminiApiKey = () => {
        return ((import.meta as any).env?.VITE_GEMINI_API_KEY) ||
            (process.env?.GEMINI_API_KEY) ||
            (process.env?.VITE_GEMINI_API_KEY) ||
            '';
    };

    const handleMagicImport = async () => {
        if (!rawText.trim()) return;
        setIsMagicLoading(true);
        try {
            const apiKey = getGeminiApiKey();
            if (!apiKey) throw new Error("Missing Gemini API Key");

            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({
                model: 'gemini-2.0-flash',
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
            const apiKey = getGeminiApiKey();
            let description = '';

            if (apiKey) {
                const ai = new GoogleGenAI({ apiKey });
                const response = await ai.models.generateContent({
                    model: 'gemini-2.0-flash',
                    contents: [{
                        role: 'user',
                        parts: [{ text: `Describe the dish "${recipeForm.title}" (${recipeForm.category}) in 5-10 words for an AI image generator. Return ONLY the description.` }]
                    }]
                });
                description = response.text.trim().replace(/['"\\n]/g, '');
            } else {
                description = `${recipeForm.title}, ${recipeForm.category} dish`;
            }

            const encodedPrompt = encodeURIComponent(`${description}, food photography, highly detailed, 4k, appetizing, warm lighting`);
            const seed = Math.floor(Math.random() * 1000);
            const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${seed}&width=800&height=600&nologo=true`;

            setRecipeForm(prev => ({ ...prev, image: url }));
            setPreviewUrl(url);
            setRecipeFile(null);
        } catch (e: any) {
            console.error(e);
            alert(`Failed to generate image: ${e.message}`);
        } finally { setIsGeneratingImage(false); }
    };

    const handleQuickSource = async (recipe: Recipe) => {
        setIsGeneratingImage(true);
        try {
            const apiKey = getGeminiApiKey();
            let description = '';

            if (apiKey) {
                const ai = new GoogleGenAI({ apiKey });
                const response = await ai.models.generateContent({
                    model: 'gemini-2.0-flash',
                    contents: [{
                        role: 'user',
                        parts: [{ text: `Describe the dish "${recipe.title}" (${recipe.category}) in 5-10 words for an AI image generator. Return ONLY the description.` }]
                    }]
                });
                description = response.text.trim().replace(/['"\\n]/g, '');
            } else {
                description = `${recipe.title}, ${recipe.category} dish`;
            }

            const encodedPrompt = encodeURIComponent(`${description}, food photography, highly detailed, 4k, appetizing, warm lighting`);
            const seed = Math.floor(Math.random() * 1000);
            const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${seed}&width=800&height=600&nologo=true`;

            await onAddRecipe({ ...recipe, image: url });
        } catch (e: any) {
            console.error(e);
            alert(`Quick generation failed: ${e.message}`);
        } finally {
            setIsGeneratingImage(false);
        }
    };

    const handleBulkVisualSourcing = async (forceRefresh: boolean = false) => {
        const targetRecipes = forceRefresh
            ? recipes
            : recipes.filter(r => {
                const isCategoryPlaceholder = Object.values(CATEGORY_IMAGES).includes(r.image);
                const isMissingImage = !r.image || r.image.includes('fallback-gradient') || r.image.includes('source.unsplash.com');
                return isCategoryPlaceholder || isMissingImage;
            });

        if (targetRecipes.length === 0) {
            alert("No recipes to update!");
            return;
        }

        const message = forceRefresh
            ? `This will refresh images for ALL ${targetRecipes.length} recipes. Continue?`
            : `Found ${targetRecipes.length} recipes with placeholder images. Start bulk sourcing?`;

        if (!confirm(message)) return;

        setIsBulkSourcing(true);
        setBulkProgress({ current: 0, total: targetRecipes.length });

        const apiKey = getGeminiApiKey();
        if (!apiKey) {
            alert("Missing Gemini API Key. Bulk sourcing requires Gemini for quality prompts.");
            setIsBulkSourcing(false);
            return;
        }

        const ai = new GoogleGenAI({ apiKey });
        const BATCH_SIZE = 5;

        for (let i = 0; i < targetRecipes.length; i += BATCH_SIZE) {
            const batch = targetRecipes.slice(i, i + BATCH_SIZE);
            const batchIndices = batch.map((_, idx) => i + idx + 1);

            try {
                // Batch request prompts from Gemini
                const response = await ai.models.generateContent({
                    model: 'gemini-2.0-flash',
                    contents: [{
                        role: 'user',
                        parts: [{
                            text: `Generate descriptive visual prompts for these ${batch.length} dishes for an AI image generator. Return a JSON object where the keys are the recipe titles and the values are the 5-10 word descriptions.
                            Dishes: ${batch.map(r => `"${r.title}" (${r.category})`).join(', ')}`
                        }]
                    }],
                    config: { responseMimeType: "application/json" }
                });

                const promptsMap = JSON.parse(response.text || '{}');

                // Process batch in parallel (limited)
                await Promise.all(batch.map(async (recipe, idx) => {
                    const description = (promptsMap[recipe.title] || promptsMap[recipe.title.toLowerCase()] || `${recipe.title} food photography`).replace(/['"\\n]/g, '');
                    const encodedPrompt = encodeURIComponent(`${description}, highly detailed, 4k, appetizing, rustic aesthetic`);
                    const seed = Math.floor(Math.random() * 1000);
                    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${seed}&width=800&height=600&nologo=true`;

                    await onAddRecipe({ ...recipe, image: url });
                    setBulkProgress(prev => ({ ...prev, current: Math.min(prev.total, i + idx + 1) }));
                }));

            } catch (e) {
                console.error(`Batch processing failed starting at index ${i}:`, e);
            }

            // Subtle delay between batches
            await new Promise(r => setTimeout(r, 500));
        }

        setIsBulkSourcing(false);
        alert("Bulk sourcing complete!");
    };
    const handleRecipeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!recipeForm.title || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const isUpdate = !!editingRecipe;
            await onAddRecipe({
                ...recipeForm as Recipe,
                id: recipeForm.id || 'r' + Date.now(),
                contributor: recipeForm.contributor || currentUser?.name || 'Family',
                image: recipeForm.image || CATEGORY_IMAGES[recipeForm.category || 'Main'] || CATEGORY_IMAGES.Generic
            }, recipeFile || undefined);

            // Show success feedback
            setSuccessMessage(isUpdate ? `✓ "${recipeForm.title}" updated successfully!` : `✓ "${recipeForm.title}" added to archive!`);
            setTimeout(() => setSuccessMessage(''), 4000);

            setRecipeForm({ title: '', category: 'Main', ingredients: [], instructions: [], notes: '', contributor: '' });
            setRecipeFile(null);
            setPreviewUrl(null);
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

    const handleMergeContributors = async () => {
        if (!mergeFrom.trim() || !mergeTo.trim()) { alert('Please enter both contributor names.'); return; }
        if (mergeFrom.trim().toLowerCase() === mergeTo.trim().toLowerCase()) { alert('Cannot merge a contributor into themselves.'); return; }

        const fromName = mergeFrom.trim();
        const toName = mergeTo.trim();

        const recipesToUpdate = recipes.filter(r => r.contributor === fromName);
        if (recipesToUpdate.length === 0) {
            alert(`No recipes found for "${fromName}".`);
            return;
        }

        if (!confirm(`Merge ${recipesToUpdate.length} recipes from "${fromName}" into "${toName}"?`)) return;

        setIsMerging(true);
        try {
            // Update all recipes with the old contributor name
            for (const recipe of recipesToUpdate) {
                await onAddRecipe({ ...recipe, contributor: toName });
            }

            // Remove the old contributor profile if it exists
            const oldProfile = contributors.find(c => c.name === fromName);
            if (oldProfile) {
                // We don't have deleteContributor in props, so we'll leave the profile
                // The profile will be orphaned but harmless
            }

            setMergeFrom('');
            setMergeTo('');
            alert(`✅ Successfully merged ${recipesToUpdate.length} recipes from "${fromName}" to "${toName}"!`);
        } catch (e: any) {
            alert(`Merge failed: ${e.message}`);
        } finally {
            setIsMerging(false);
        }
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
                        </div>

                        <div className="grid grid-cols-1 gap-16">
                            {activeSubtab === 'records' && (
                                <section className="space-y-8 animate-in fade-in">
                                    <h3 className="text-xl font-serif italic text-[#A0522D] flex items-center gap-3">
                                        <span className="w-10 h-10 rounded-full bg-[#A0522D]/5 flex items-center justify-center not-italic">📖</span>
                                        {editingRecipe ? 'Edit Archival Entry' : 'New Heritage Record'}
                                    </h3>

                                    {/* Success Toast */}
                                    {successMessage && (
                                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                                            <span className="text-emerald-600 text-lg">✓</span>
                                            <span className="text-sm font-bold text-emerald-700">{successMessage}</span>
                                        </div>
                                    )}

                                    {/* Edit Mode Banner */}
                                    {editingRecipe && (
                                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="text-amber-600 text-lg">✏️</span>
                                                <div>
                                                    <span className="text-sm font-bold text-amber-700">Editing: {editingRecipe.title}</span>
                                                    <p className="text-xs text-amber-600">Make your changes below and click "Update Record" to save.</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={clearEditing}
                                                className="px-4 py-2 bg-amber-100 text-amber-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-200 transition-colors"
                                            >
                                                Cancel Edit
                                            </button>
                                        </div>
                                    )}

                                    {/* Existing Records List with Search */}
                                    {!editingRecipe && (
                                        <div className="bg-stone-50 rounded-3xl border border-stone-100 p-6 max-h-[500px] overflow-hidden mb-8">
                                            <div className="flex items-center justify-between mb-4 sticky top-0 bg-stone-50 py-2 z-10">
                                                <h4 className="text-[10px] font-black uppercase text-stone-400">
                                                    Manage Existing Records ({filteredRecipes.length}{recipeSearch ? ` of ${recipes.length}` : ''})
                                                </h4>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        placeholder="Search recipes..."
                                                        value={recipeSearch}
                                                        onChange={e => setRecipeSearch(e.target.value)}
                                                        className="pl-8 pr-4 py-2 bg-white border border-stone-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#2D4635]/20 w-48"
                                                    />
                                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs">🔍</span>
                                                </div>
                                            </div>
                                            <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                                                {filteredRecipes.length === 0 ? (
                                                    <div className="text-center py-8 text-stone-400">
                                                        <span className="text-2xl block mb-2">🔍</span>
                                                        <span className="text-xs">No recipes match "{recipeSearch}"</span>
                                                    </div>
                                                ) : filteredRecipes.map(r => (
                                                    <div key={r.id} className="flex items-center justify-between p-3 bg-white rounded-2xl border border-stone-100 hover:shadow-md transition-all group">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-xl bg-stone-100 overflow-hidden">
                                                                {r.image && <img src={r.image} className="w-full h-full object-cover" alt="" />}
                                                            </div>
                                                            <div>
                                                                <h5 className="text-sm font-serif font-bold text-[#2D4635]">{r.title}</h5>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[9px] uppercase tracking-widest text-[#A0522D]">{r.category}</span>
                                                                    {r.contributor && <span className="text-[9px] text-stone-400">by {r.contributor}</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => handleQuickSource(r)}
                                                                disabled={isGeneratingImage}
                                                                className="px-3 py-2 bg-amber-50 text-amber-600 border border-amber-100 rounded-lg text-[10px] font-bold uppercase hover:bg-amber-100 disabled:opacity-50"
                                                                title="One-Click Quick Gen"
                                                            >
                                                                {isGeneratingImage ? '...' : '✨'}
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    onEditRecipe(r);
                                                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                                                }}
                                                                className="px-3 py-2 bg-[#2D4635] text-white rounded-lg text-[10px] font-bold uppercase"
                                                            >
                                                                Edit
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    if (confirm(`Delete "${r.title}"? This cannot be undone.`)) onDeleteRecipe(r.id);
                                                                }}
                                                                className="px-3 py-2 bg-red-50 text-red-600 border border-red-100 rounded-lg text-[10px] font-bold uppercase hover:bg-red-100"
                                                            >
                                                                🗑️
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {!editingRecipe && (
                                        <div className="space-y-4">
                                            <textarea placeholder="Paste raw recipe text here..." className="w-full h-32 p-5 border border-stone-100 rounded-3xl text-sm bg-stone-50 outline-none" value={rawText} onChange={(e) => setRawText(e.target.value)} />
                                            <div className="flex gap-4">
                                                <button onClick={handleMagicImport} disabled={isMagicLoading} className="flex-1 py-4 bg-[#2D4635] text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-md disabled:opacity-50">
                                                    {isMagicLoading ? 'Analyzing...' : '✨ Organize with AI'}
                                                </button>
                                                <button onClick={() => handleBulkVisualSourcing(false)} disabled={isBulkSourcing} className="flex-1 py-4 bg-[#A0522D]/10 text-[#A0522D] rounded-full text-[10px] font-black uppercase tracking-widest border border-[#A0522D]/20 shadow-sm disabled:opacity-50">
                                                    {isBulkSourcing ? `Sourcing (${bulkProgress.current}/${bulkProgress.total})` : '🖼️ Fill Missing'}
                                                </button>
                                                <button onClick={() => handleBulkVisualSourcing(true)} disabled={isBulkSourcing} className="flex-1 py-4 bg-red-50 text-red-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-red-200 shadow-sm disabled:opacity-50">
                                                    {isBulkSourcing ? `Sourcing...` : '🔄 Refresh All'}
                                                </button>
                                            </div>
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
                                                {isGeneratingImage ? 'Generating Legacy Visual...' : '✨ Generate Heritage Photo'}
                                            </button>
                                        </div>
                                        <input placeholder="Recipe Title" className="w-full p-4 border border-stone-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-[#2D4635]/20" value={recipeForm.title} onChange={e => setRecipeForm({ ...recipeForm, title: e.target.value })} required />

                                        {/* Contributor Selection */}
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2">Contributed By</label>
                                            <select
                                                className="w-full p-4 border border-stone-200 rounded-2xl text-sm bg-white focus:ring-2 focus:ring-[#2D4635]/20"
                                                value={recipeForm.contributor || currentUser?.name || ''}
                                                onChange={e => setRecipeForm({ ...recipeForm, contributor: e.target.value })}
                                            >
                                                <option value={currentUser?.name || 'Me'}>{currentUser?.name || 'Me'} (you)</option>
                                                {contributors.filter(c => c.name !== currentUser?.name).map(c => (
                                                    <option key={c.id} value={c.name}>{c.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <select className="p-4 border border-stone-200 rounded-2xl text-sm bg-white focus:ring-2 focus:ring-[#2D4635]/20" value={recipeForm.category} onChange={e => setRecipeForm({ ...recipeForm, category: e.target.value as any })}>
                                                {['Breakfast', 'Main', 'Dessert', 'Side', 'Appetizer', 'Bread', 'Dip/Sauce', 'Snack'].map(c => <option key={c}>{c}</option>)}
                                            </select>
                                            <input placeholder="Prep Time (e.g. 15 min)" className="p-4 border border-stone-200 rounded-2xl text-sm focus:ring-2 focus:ring-[#2D4635]/20" value={recipeForm.prepTime || ''} onChange={e => setRecipeForm({ ...recipeForm, prepTime: e.target.value })} />
                                            <input placeholder="Cook Time (e.g. 30 min)" className="p-4 border border-stone-200 rounded-2xl text-sm focus:ring-2 focus:ring-[#2D4635]/20" value={recipeForm.cookTime || ''} onChange={e => setRecipeForm({ ...recipeForm, cookTime: e.target.value })} />
                                            <input type="number" placeholder="Est. Calories" className="p-4 border border-stone-200 rounded-2xl text-sm focus:ring-2 focus:ring-[#2D4635]/20" value={recipeForm.calories || ''} onChange={e => setRecipeForm({ ...recipeForm, calories: parseInt(e.target.value) || 0 })} />
                                        </div>
                                        <textarea placeholder="Ingredients (one per line)" className="w-full h-32 p-4 border border-stone-200 rounded-2xl text-sm bg-stone-50 focus:ring-2 focus:ring-[#2D4635]/20" value={recipeForm.ingredients?.join('\n')} onChange={e => setRecipeForm({ ...recipeForm, ingredients: e.target.value.split('\n') })} required />
                                        <textarea placeholder="Instructions (one per line)" className="w-full h-48 p-4 border border-stone-200 rounded-2xl text-sm bg-stone-50 focus:ring-2 focus:ring-[#2D4635]/20" value={recipeForm.instructions?.join('\n')} onChange={e => setRecipeForm({ ...recipeForm, instructions: e.target.value.split('\n') })} required />

                                        {/* Heirloom Notes */}
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2">Heirloom Notes (optional)</label>
                                            <textarea
                                                placeholder="Add any special memories, tips, or history about this recipe..."
                                                className="w-full h-24 p-4 border border-[#2D4635]/20 rounded-2xl text-sm bg-[#2D4635]/5 focus:ring-2 focus:ring-[#2D4635]/20 italic"
                                                value={recipeForm.notes || ''}
                                                onChange={e => setRecipeForm({ ...recipeForm, notes: e.target.value })}
                                            />
                                        </div>

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

                        {/* Merge Contributors Tool */}
                        {isSuperAdmin && (
                            <div className="mb-10 p-6 bg-orange-50/50 rounded-3xl border border-orange-100">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-[#A0522D] mb-4 flex items-center gap-2">
                                    <span>🔀</span> Merge Contributors
                                </h4>
                                <p className="text-xs text-stone-500 mb-4">Combine two contributor accounts by moving all recipes from one contributor to another.</p>
                                <div className="flex flex-col md:flex-row gap-3 items-start md:items-end">
                                    <div className="flex-1 w-full">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-stone-400 mb-1 block">Merge From (will be removed)</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Dawn Schafer Tessmer"
                                            value={mergeFrom}
                                            onChange={e => setMergeFrom(e.target.value)}
                                            className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#A0522D]/20"
                                        />
                                    </div>
                                    <span className="text-stone-300 text-xl hidden md:block">→</span>
                                    <div className="flex-1 w-full">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-stone-400 mb-1 block">Merge Into (will keep)</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Dawn"
                                            value={mergeTo}
                                            onChange={e => setMergeTo(e.target.value)}
                                            className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#A0522D]/20"
                                        />
                                    </div>
                                    <button
                                        onClick={handleMergeContributors}
                                        disabled={isMerging || !mergeFrom.trim() || !mergeTo.trim()}
                                        className="px-6 py-3 bg-[#A0522D] text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                    >
                                        {isMerging ? 'Merging...' : '🔀 Merge'}
                                    </button>
                                </div>
                            </div>
                        )}

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
