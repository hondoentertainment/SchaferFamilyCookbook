import React, { useState, useEffect } from 'react';
import { Recipe, UserProfile, ContributorProfile } from '../../types';
import * as geminiProxy from '../../services/geminiProxy';
import { CATEGORY_IMAGES } from '../../constants';
import { useUI } from '../../context/UIContext';

export interface AdminRecordsTabProps {
    editingRecipe: Recipe | null;
    clearEditing: () => void;
    recipes: Recipe[];
    contributors: ContributorProfile[];
    currentUser: UserProfile | null;
    onAddRecipe: (r: Recipe, file?: File) => Promise<void>;
    onDeleteRecipe: (id: string) => void;
    onEditRecipe: (r: Recipe) => void;
    defaultRecipeIds: string[];
}

export const AdminRecordsTab: React.FC<AdminRecordsTabProps> = ({
    editingRecipe, clearEditing, recipes, contributors, currentUser,
    onAddRecipe, onDeleteRecipe, onEditRecipe, defaultRecipeIds,
}) => {
    const { toast, confirm } = useUI();
    const AI_COOLDOWN_MS = 5 * 60 * 1000;

    const [recipeForm, setRecipeForm] = useState<Partial<Recipe>>({ title: '', category: 'Main', ingredients: [], instructions: [] });
    const [recipeFile, setRecipeFile] = useState<File | null>(null);
    const [imageSourceForCurrent, setImageSourceForCurrent] = useState<'upload' | 'nano-banana' | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [isBulkSourcing, setIsBulkSourcing] = useState(false);
    const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
    const [recipeSearch, setRecipeSearch] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [aiCooldownUntil, setAiCooldownUntil] = useState<number>(0);
    const [aiCooldownSecondsLeft, setAiCooldownSecondsLeft] = useState(0);

    const managedRecipes = recipes.filter(r => !defaultRecipeIds.includes(r.id));
    const filteredRecipes = managedRecipes.filter(r =>
        r.title.toLowerCase().includes(recipeSearch.toLowerCase()) ||
        r.category.toLowerCase().includes(recipeSearch.toLowerCase()) ||
        r.contributor?.toLowerCase().includes(recipeSearch.toLowerCase())
    );

    useEffect(() => {
        if (editingRecipe) {
            setRecipeForm(editingRecipe);
            setPreviewUrl(editingRecipe.image || CATEGORY_IMAGES[editingRecipe.category] || CATEGORY_IMAGES.Generic);
        } else {
            setRecipeForm({ title: '', category: 'Main', ingredients: [], instructions: [] });
            setPreviewUrl(null);
        }
        setRecipeFile(null);
        setImageSourceForCurrent(null);
    }, [editingRecipe]);

    useEffect(() => {
        if (!recipeFile) { if (!editingRecipe) setPreviewUrl(null); return; }
        const url = URL.createObjectURL(recipeFile);
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [recipeFile, editingRecipe]);

    useEffect(() => {
        if (!aiCooldownUntil) { setAiCooldownSecondsLeft(0); return; }
        const tick = () => {
            const remaining = Math.max(0, Math.ceil((aiCooldownUntil - Date.now()) / 1000));
            setAiCooldownSecondsLeft(remaining);
            if (remaining === 0) setAiCooldownUntil(0);
        };
        tick();
        const timer = window.setInterval(tick, 1000);
        return () => window.clearInterval(timer);
    }, [aiCooldownUntil]);

    const isQuotaError = (err: unknown): boolean => {
        const msg = ((err as Error)?.message || '').toLowerCase();
        return msg.includes('429') || msg.includes('quota') || msg.includes('rate limit');
    };

    const getAIErrorMessage = (err: unknown, fallback: string): string => {
        const msg = (err as Error)?.message || '';
        const lower = msg.toLowerCase();
        if (msg.includes('429') || lower.includes('quota') || lower.includes('rate limit'))
            return 'AI quota is currently exhausted. Quick generation is temporarily unavailable. Please try again later, add a manual photo, or upgrade Gemini API billing limits.';
        if (msg.includes('500') || msg.includes('not configured'))
            return 'AI features are not available. Make sure GEMINI_API_KEY is set on the server (Vercel). Try uploading a photo manually instead.';
        if (msg.includes('fetch') || msg.includes('network'))
            return 'Could not reach the AI service. Check your connection and try again.';
        return fallback.replace('${message}', msg || 'unknown error');
    };

    const formatCooldown = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${String(secs).padStart(2, '0')}`;
    };

    const handleAIError = (err: unknown, fallback: string) => {
        if (isQuotaError(err)) setAiCooldownUntil(Date.now() + AI_COOLDOWN_MS);
        toast(getAIErrorMessage(err, fallback), 'error');
    };

    const getDefaultImageForCategory = (category?: string) =>
        CATEGORY_IMAGES[category || 'Main'] || CATEGORY_IMAGES.Generic;

    const useDefaultImageForForm = () => {
        const defaultImage = getDefaultImageForCategory(recipeForm.category);
        setRecipeFile(null);
        setPreviewUrl(defaultImage);
        setRecipeForm(prev => ({ ...prev, image: defaultImage, imageSource: undefined }));
    };

    const useDefaultImageForRecipe = async (recipe: Recipe) => {
        const defaultImage = getDefaultImageForCategory(recipe.category);
        await onAddRecipe({ ...recipe, image: defaultImage, imageSource: undefined });
        setSuccessMessage(`\u2713 "${recipe.title}" now uses the default ${recipe.category} image.`);
        setTimeout(() => setSuccessMessage(''), 4000);
    };

    const isAICooldownActive = aiCooldownSecondsLeft > 0;

    const base64ToFile = (base64: string, filename: string, mimeType: string = 'image/png'): File => {
        const byteCharacters = atob(base64);
        const byteArrays: Uint8Array[] = [];
        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
            const slice = byteCharacters.slice(offset, offset + 512);
            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) byteNumbers[i] = slice.charCodeAt(i);
            byteArrays.push(new Uint8Array(byteNumbers));
        }
        const blobs: ArrayBuffer[] = byteArrays.map((ua) => {
            const ab = new ArrayBuffer(ua.byteLength);
            new Uint8Array(ab).set(ua);
            return ab;
        });
        return new File([new Blob(blobs, { type: mimeType })], filename, { type: mimeType });
    };

    const getFileExtension = (mimeType: string = 'image/png') => {
        if (mimeType === 'image/jpeg') return 'jpg';
        if (mimeType === 'image/webp') return 'webp';
        return 'png';
    };

    const handleVisualSourcing = async () => {
        if (!recipeForm.title) return;
        setIsGeneratingImage(true);
        try {
            const { imageBase64, mimeType, imageSource } = await geminiProxy.generateImage(recipeForm);
            const file = base64ToFile(imageBase64, `recipe-${Date.now()}.${getFileExtension(mimeType)}`, mimeType);
            setRecipeFile(file);
            setImageSourceForCurrent(imageSource);
            setPreviewUrl(URL.createObjectURL(file));
        } catch (e: unknown) {
            console.error(e);
            handleAIError(e, 'Failed to generate image: ${message}. Try uploading a heritage photo instead.');
        } finally { setIsGeneratingImage(false); }
    };

    const handleQuickSource = async (recipe: Recipe) => {
        setIsGeneratingImage(true);
        try {
            const { imageBase64, mimeType, imageSource } = await geminiProxy.generateImage(recipe);
            const file = base64ToFile(imageBase64, `recipe-${Date.now()}.${getFileExtension(mimeType)}`, mimeType);
            await onAddRecipe({ ...recipe, imageSource }, file);
        } catch (e: unknown) {
            console.error(e);
            handleAIError(e, 'Quick generation failed: ${message}. Try uploading a photo for this recipe.');
        } finally { setIsGeneratingImage(false); }
    };

    const handleBulkVisualSourcing = async (forceRefresh: boolean = false) => {
        const targetRecipes = forceRefresh
            ? recipes
            : recipes.filter(r => {
                const isCategoryPlaceholder = Object.values(CATEGORY_IMAGES).includes(r.image);
                const isPollinations = r.image?.includes('pollinations.ai');
                const isMissingImage = !r.image || r.image.includes('fallback-gradient') || r.image.includes('source.unsplash.com');
                return isCategoryPlaceholder || isPollinations || isMissingImage;
            });
        if (targetRecipes.length === 0) { toast('No recipes to update!', 'info'); return; }
        const message = forceRefresh
            ? `This will generate Nano Banana recipe photos for ALL ${targetRecipes.length} recipes using their ingredients. This may take several minutes. Continue?`
            : `Found ${targetRecipes.length} recipes needing photos. Generate Nano Banana images from ingredients? This may take several minutes.`;
        const ok = await confirm(message, { title: 'Bulk Image Generation', confirmLabel: 'Continue' });
        if (!ok) return;
        setIsBulkSourcing(true);
        setBulkProgress({ current: 0, total: targetRecipes.length });
        let successCount = 0;
        let failCount = 0;
        for (let i = 0; i < targetRecipes.length; i++) {
            const recipe = targetRecipes[i];
            try {
                const { imageBase64, mimeType, imageSource } = await geminiProxy.generateImage(recipe);
                const file = base64ToFile(imageBase64, `recipe-${Date.now()}.${getFileExtension(mimeType)}`, mimeType);
                await onAddRecipe({ ...recipe, imageSource }, file);
                successCount++;
            } catch (e) {
                console.error(`Failed to generate image for "${recipe.title}":`, e);
                failCount++;
                if (isQuotaError(e)) {
                    handleAIError(e, 'AI quota exhausted during bulk generation: ${message}');
                    toast(`Stopped early after ${successCount} images because Gemini quota is exhausted. Resume later to continue.`, 'error');
                    break;
                }
                if (failCount === 1) {
                    const friendly = getAIErrorMessage(e, '${message}');
                    if (friendly.includes('GEMINI_API_KEY')) { toast(friendly, 'error'); break; }
                }
            }
            setBulkProgress({ current: i + 1, total: targetRecipes.length });
            if (i < targetRecipes.length - 1) await new Promise(r => setTimeout(r, 2000));
        }
        setIsBulkSourcing(false);
        if (failCount > 0) {
            toast(`Bulk sourcing complete: ${successCount} succeeded, ${failCount} failed. Failed recipes kept their existing images.`, 'error');
        } else {
            toast(`Bulk sourcing complete! All ${successCount} recipes now have Nano Banana-generated photos.`, 'success');
        }
    };

    const handleRecipeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!recipeForm.title?.trim()) { toast('Recipe title is required.', 'error'); return; }
        const ingredients = recipeForm.ingredients?.filter(Boolean) ?? [];
        const instructions = recipeForm.instructions?.filter(Boolean) ?? [];
        if (ingredients.length === 0 || instructions.length === 0) { toast('Ingredients and instructions are required.', 'error'); return; }
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            const isUpdate = !!editingRecipe;
            const imageSource = recipeFile ? (imageSourceForCurrent || 'upload') : recipeForm.imageSource;
            await onAddRecipe({
                ...recipeForm as Recipe,
                id: recipeForm.id || 'r' + Date.now(),
                contributor: recipeForm.contributor || currentUser?.name || 'Family',
                image: recipeForm.image || CATEGORY_IMAGES[recipeForm.category || 'Main'] || CATEGORY_IMAGES.Generic,
                imageSource: imageSource || undefined,
                ingredients,
                instructions
            }, recipeFile || undefined);
            setSuccessMessage(isUpdate ? `\u2713 "${recipeForm.title}" updated successfully!` : `\u2713 "${recipeForm.title}" added to archive!`);
            toast(isUpdate ? 'Recipe updated' : 'Recipe saved', 'success');
            setTimeout(() => setSuccessMessage(''), 4000);
            setRecipeForm({ title: '', category: 'Main', ingredients: [], instructions: [], notes: '', contributor: '' });
            setRecipeFile(null);
            setImageSourceForCurrent(null);
            setPreviewUrl(null);
            if (editingRecipe) clearEditing();
        } finally { setIsSubmitting(false); }
    };

    return (
        <section className="space-y-8 animate-in fade-in">
            {successMessage && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <span className="text-emerald-600 text-lg">{'\u2713'}</span>
                    <span className="text-sm font-bold text-emerald-700">{successMessage}</span>
                </div>
            )}
            {editingRecipe && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-amber-600 text-lg">{'\u270f\ufe0f'}</span>
                        <div>
                            <span className="text-sm font-bold text-amber-700">Editing: {editingRecipe.title}</span>
                            <p className="text-xs text-amber-600">Make your changes below and click &quot;Update Record&quot; to save.</p>
                        </div>
                    </div>
                    <button onClick={clearEditing} className="px-4 py-2 bg-amber-100 text-amber-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-200 transition-colors">Cancel Edit</button>
                </div>
            )}
            {!editingRecipe && (
                <div className="bg-stone-50 rounded-3xl border border-stone-100 p-6 max-h-[500px] overflow-hidden mb-8">
                    <div className="flex items-center justify-between mb-4 sticky top-0 bg-stone-50 py-2 z-10">
                        <h4 className="text-[10px] font-black uppercase text-stone-400">
                            Manage Recipes ({filteredRecipes.length}{recipeSearch ? ` of ${managedRecipes.length}` : ''})
                        </h4>
                        <div className="relative">
                            <label htmlFor="admin-recipe-search" className="sr-only">Search recipes</label>
                            <input id="admin-recipe-search" type="search" placeholder="Search recipes..." value={recipeSearch} onChange={e => setRecipeSearch(e.target.value)} className="pl-8 pr-4 py-2 bg-white border border-stone-200 rounded-xl text-base outline-none focus:ring-2 focus:ring-[#2D4635]/20 w-48" />
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs">{'\ud83d\udd0d'}</span>
                        </div>
                    </div>
                    <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                        {filteredRecipes.length === 0 ? (
                            <div className="text-center py-8 text-stone-400 space-y-3">
                                <span className="text-2xl block mb-2">{'\ud83d\udd0d'}</span>
                                <span className="text-xs">No recipes match &quot;{recipeSearch}&quot;</span>
                                <button type="button" onClick={() => setRecipeSearch('')} className="block mx-auto mt-2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[#2D4635] hover:text-[#A0522D] rounded-full border border-stone-200 hover:border-[#A0522D]/30" aria-label="Clear search">Clear search</button>
                            </div>
                        ) : filteredRecipes.map(r => (
                            <div key={r.id} className="flex items-center justify-between p-3 bg-white rounded-2xl border border-stone-100 hover:shadow-md transition-all group">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-stone-100 overflow-hidden">
                                        {r.image && <img src={r.image} className="w-full h-full object-cover" alt={r.title} loading="lazy" width={40} height={40} />}
                                    </div>
                                    <div>
                                        <h5 className="text-sm font-serif font-bold text-[#2D4635]">{r.title}</h5>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-[9px] uppercase tracking-widest text-[#A0522D]">{r.category}</span>
                                            {r.contributor && <span className="text-[9px] text-stone-500">by {r.contributor}</span>}
                                            {r.imageSource && (
                                                <span className="text-[8px] px-1.5 py-0.5 rounded bg-stone-200 text-stone-600 font-bold uppercase" title={`Image source: ${r.imageSource}`}>
                                                    {r.imageSource === 'nano-banana' ? 'Imagen' : r.imageSource === 'upload' ? 'Upload' : r.imageSource}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleQuickSource(r)} disabled={isGeneratingImage || isAICooldownActive} className="min-w-[2.75rem] min-h-[2.75rem] px-3 py-2 bg-amber-50 text-amber-600 border border-amber-100 rounded-lg text-[10px] font-bold uppercase hover:bg-amber-100 disabled:opacity-50 flex items-center justify-center" title="One-Click Quick Gen" aria-label={`Generate AI image for ${r.title}`}>
                                        {isAICooldownActive ? '\u23f3' : isGeneratingImage ? '...' : '\u2728'}
                                    </button>
                                    <button onClick={async () => { try { await useDefaultImageForRecipe(r); } catch (e: unknown) { toast(`Couldn't set default image: ${(e as Error)?.message || 'unknown error'}. Try again.`, 'error'); } }} className="min-w-[2.75rem] min-h-[2.75rem] px-3 py-2 bg-stone-50 text-stone-600 border border-stone-200 rounded-lg text-[10px] font-bold uppercase hover:bg-stone-100 flex items-center justify-center" title="Use default recipe image" aria-label={`Use default ${r.category} image for ${r.title}`}>
                                        {'\ud83d\uddbc\ufe0f'}
                                    </button>
                                    <button onClick={() => { onEditRecipe(r); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="min-w-[2.75rem] min-h-[2.75rem] px-3 py-2 bg-[#2D4635] text-white rounded-lg text-[10px] font-bold uppercase flex items-center justify-center" aria-label={`Edit ${r.title}`}>Edit</button>
                                    <button onClick={async () => { if (await confirm(`Are you sure you want to delete "${r.title}"?`, { title: 'Confirm Delete', variant: 'danger', confirmLabel: 'Delete', cancelLabel: 'Keep' })) onDeleteRecipe(r.id); }} className="min-w-[2.75rem] min-h-[2.75rem] px-3 py-2 bg-red-50 text-red-600 border border-red-100 rounded-lg text-[10px] font-bold uppercase hover:bg-red-100 flex items-center justify-center" aria-label={`Delete ${r.title}`}>
                                        {'\ud83d\uddd1\ufe0f'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {!editingRecipe && (
                <div className="space-y-4">
                    <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-500 mb-2">Recipe images</h4>
                        <p className="text-sm text-stone-700">
                            <span className="font-bold">{recipes.filter(r => r.image?.trim()).length}</span> of <span className="font-bold">{recipes.length}</span> recipes have images
                            {recipes.length - recipes.filter(r => r.image?.trim()).length > 0 && (
                                <>{' \u00b7 '}<span className="text-amber-700">{recipes.length - recipes.filter(r => r.image?.trim()).length} missing</span></>
                            )}
                        </p>
                        <p className="text-xs text-stone-500 mt-1">Use Fill Missing below or run <code className="bg-white px-1 rounded">npm run images:batch</code> locally for quota-safe batches.</p>
                    </div>
                    <div className="flex gap-4 flex-wrap">
                        <button onClick={() => handleBulkVisualSourcing(false)} disabled={isBulkSourcing || isAICooldownActive} className="flex-1 min-w-[140px] py-4 bg-[#A0522D]/10 text-[#A0522D] rounded-full text-[10px] font-black uppercase tracking-widest border border-[#A0522D]/20 shadow-sm disabled:opacity-50">
                            {isBulkSourcing ? `Imagen (${bulkProgress.current}/${bulkProgress.total})` : '\ud83d\uddbc\ufe0f Fill Missing (Imagen)'}
                        </button>
                        <button onClick={() => handleBulkVisualSourcing(true)} disabled={isBulkSourcing || isAICooldownActive} className="flex-1 min-w-[140px] py-4 bg-red-50 text-red-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-red-200 shadow-sm disabled:opacity-50">
                            {isBulkSourcing ? 'Generating...' : '\ud83d\udd04 Regenerate All (Imagen)'}
                        </button>
                    </div>
                </div>
            )}
            {editingRecipe && (
            <form onSubmit={handleRecipeSubmit} className="space-y-6 pt-8 border-t border-stone-50">
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2">Archival Image</label>
                    {previewUrl && (
                        <div className="relative w-full h-48 rounded-[2rem] overflow-hidden mb-4 border border-stone-100 shadow-inner group">
                            <img src={previewUrl} className="w-full h-full object-cover" alt="Preview" onError={(e) => { (e.target as HTMLImageElement).src = CATEGORY_IMAGES[recipeForm.category || 'Main'] || CATEGORY_IMAGES.Generic; }} />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <p className="text-[10px] font-black uppercase tracking-widest text-white">Current Heritage Photo</p>
                            </div>
                        </div>
                    )}
                    {!previewUrl && (
                        <div className="w-full h-48 rounded-[2rem] mb-4 border border-dashed border-stone-200 bg-stone-50 flex items-center justify-center">
                            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Recipe image to be added</p>
                        </div>
                    )}
                    <div className="relative group">
                        <label htmlFor="admin-recipe-image-upload" className="block cursor-pointer">
                            <input id="admin-recipe-image-upload" type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0] || null; setRecipeFile(f); setImageSourceForCurrent(f ? 'upload' : null); }} className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full" aria-label="Upload recipe image" />
                            <div className="w-full p-4 border-2 border-dashed border-stone-200 rounded-3xl flex items-center justify-center gap-3 text-stone-400 group-hover:border-[#2D4635] transition-all bg-stone-50/30">
                                <span className="text-lg">{'\ud83d\udcc1'}</span>
                                <span className="text-[10px] font-black uppercase tracking-widest">
                                    {recipeFile ? recipeFile.name : editingRecipe ? 'Change Heritage Photo' : 'Upload Heritage Photo'}
                                </span>
                            </div>
                        </label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                        <button type="button" onClick={handleVisualSourcing} disabled={isGeneratingImage || !recipeForm.title || isAICooldownActive} className="w-full py-3 bg-[#A0522D]/10 text-[#A0522D] rounded-2xl text-[10px] font-black uppercase tracking-widest border border-[#A0522D]/20 hover:bg-[#A0522D]/20 transition-all disabled:opacity-50">
                            {isAICooldownActive ? `Cooldown ${formatCooldown(aiCooldownSecondsLeft)}` : isGeneratingImage ? 'Generating with Imagen...' : '\u2728 Generate Photo (Imagen)'}
                        </button>
                        <button type="button" onClick={useDefaultImageForForm} className="w-full py-3 bg-stone-100 text-stone-700 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-stone-200 hover:bg-stone-200 transition-all">
                            {'\ud83d\uddbc\ufe0f'} Use Default Image
                        </button>
                    </div>
                </div>
                <div>
                    <label htmlFor="admin-recipe-title" className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2 block mb-1">Recipe Title</label>
                    <input id="admin-recipe-title" placeholder="Recipe Title" className="w-full p-4 border border-stone-200 rounded-2xl text-base outline-none focus:ring-2 focus:ring-[#2D4635]/20" value={recipeForm.title} onChange={e => setRecipeForm({ ...recipeForm, title: e.target.value })} required />
                </div>
                <div className="space-y-2">
                    <label htmlFor="admin-recipe-contributor" className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2">Contributed By</label>
                    <select id="admin-recipe-contributor" className="w-full p-4 border border-stone-200 rounded-2xl text-base bg-white focus:ring-2 focus:ring-[#2D4635]/20" value={recipeForm.contributor || currentUser?.name || ''} onChange={e => setRecipeForm({ ...recipeForm, contributor: e.target.value })}>
                        <option value={currentUser?.name || 'Me'}>{currentUser?.name || 'Me'} (you)</option>
                        {contributors.filter(c => c.name !== currentUser?.name).map(c => (<option key={c.id} value={c.name}>{c.name}</option>))}
                    </select>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <label htmlFor="admin-recipe-category" className="sr-only">Recipe Category</label>
                        <select id="admin-recipe-category" className="p-4 border border-stone-200 rounded-2xl text-base bg-white focus:ring-2 focus:ring-[#2D4635]/20 w-full" value={recipeForm.category} onChange={e => setRecipeForm({ ...recipeForm, category: e.target.value as Recipe['category'] })}>
                            {['Breakfast', 'Main', 'Dessert', 'Side', 'Appetizer', 'Bread', 'Dip/Sauce', 'Snack'].map(c => <option key={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="admin-recipe-preptime" className="sr-only">Prep time</label>
                        <input id="admin-recipe-preptime" placeholder="Prep Time (e.g. 15 min)" aria-label="Prep time" className="p-4 border border-stone-200 rounded-2xl text-base focus:ring-2 focus:ring-[#2D4635]/20 w-full" value={recipeForm.prepTime || ''} onChange={e => setRecipeForm({ ...recipeForm, prepTime: e.target.value })} />
                    </div>
                    <div>
                        <label htmlFor="admin-recipe-cooktime" className="sr-only">Cook Time</label>
                        <input id="admin-recipe-cooktime" placeholder="Cook Time (e.g. 30 min)" className="p-4 border border-stone-200 rounded-2xl text-base focus:ring-2 focus:ring-[#2D4635]/20 w-full" value={recipeForm.cookTime || ''} onChange={e => setRecipeForm({ ...recipeForm, cookTime: e.target.value })} />
                    </div>
                    <div>
                        <label htmlFor="admin-recipe-calories" className="sr-only">Estimated calories</label>
                        <input id="admin-recipe-calories" type="number" placeholder="Est. Calories" aria-label="Estimated calories" className="p-4 border border-stone-200 rounded-2xl text-base focus:ring-2 focus:ring-[#2D4635]/20 w-full" value={recipeForm.calories || ''} onChange={e => setRecipeForm({ ...recipeForm, calories: parseInt(e.target.value) || 0 })} />
                    </div>
                </div>
                <div>
                    <label htmlFor="admin-recipe-ingredients" className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2 block mb-1">Ingredients (one per line)</label>
                    <textarea id="admin-recipe-ingredients" placeholder="Ingredients (one per line)" className="w-full h-32 p-4 border border-stone-200 rounded-2xl text-base bg-stone-50 focus:ring-2 focus:ring-[#2D4635]/20" value={recipeForm.ingredients?.join('\n')} onChange={e => setRecipeForm({ ...recipeForm, ingredients: e.target.value.split('\n') })} required />
                </div>
                <div>
                    <label htmlFor="admin-recipe-instructions" className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2 block mb-1">Instructions (one per line)</label>
                    <textarea id="admin-recipe-instructions" placeholder="Instructions (one per line)" className="w-full h-48 p-4 border border-stone-200 rounded-2xl text-base bg-stone-50 focus:ring-2 focus:ring-[#2D4635]/20" value={recipeForm.instructions?.join('\n')} onChange={e => setRecipeForm({ ...recipeForm, instructions: e.target.value.split('\n') })} required />
                </div>
                <div className="space-y-2">
                    <label htmlFor="admin-recipe-notes" className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2">Heirloom Notes (optional)</label>
                    <textarea id="admin-recipe-notes" placeholder="Add any special memories, tips, or history about this recipe..." className="w-full h-24 p-4 border border-[#2D4635]/20 rounded-2xl text-base bg-[#2D4635]/5 focus:ring-2 focus:ring-[#2D4635]/20 italic" value={recipeForm.notes || ''} onChange={e => setRecipeForm({ ...recipeForm, notes: e.target.value })} />
                </div>
                <div className="flex gap-4">
                    <button type="submit" disabled={isSubmitting} aria-busy={isSubmitting} className="flex-1 py-4 bg-[#2D4635] text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl disabled:opacity-70 disabled:cursor-not-allowed">
                        {isSubmitting ? 'Saving...' : editingRecipe ? 'Update Record' : 'Commit to Archive'}
                    </button>
                    {editingRecipe && <button type="button" onClick={clearEditing} disabled={isSubmitting} className="flex-1 py-4 border border-stone-200 rounded-full text-[10px] font-black uppercase text-stone-400 disabled:opacity-70">Cancel</button>}
                </div>
            </form>
            )}
        </section>
    );
};
