import React, { useState, useEffect } from 'react';
import { Recipe, ContributorProfile, UserProfile } from '../../types';
import * as geminiProxy from '../../services/geminiProxy';
import { CATEGORY_IMAGES } from '../../constants';
import { useUI } from '../../context/UIContext';
import { useDebounceAction } from '../../hooks';

export interface RecipeFormProps {
    editingRecipe: Recipe | null;
    clearEditing: () => void;
    recipes: Recipe[];
    contributors: ContributorProfile[];
    currentUser: UserProfile | null;
    defaultRecipeIds: string[];
    onSave: (r: Recipe, file?: File) => Promise<void>;
    onDelete: (id: string) => void;
    onEditRecipe: (r: Recipe) => void;
    /** Whether AI cooldown is active (managed by parent) */
    isAICooldownActive: boolean;
    aiCooldownSecondsLeft: number;
    formatCooldown: (seconds: number) => string;
    onAIError: (err: unknown, fallback: string) => void;
}

export const RecipeForm: React.FC<RecipeFormProps> = ({
    editingRecipe,
    clearEditing,
    recipes,
    contributors,
    currentUser,
    defaultRecipeIds,
    onSave,
    onDelete,
    onEditRecipe,
    isAICooldownActive,
    aiCooldownSecondsLeft,
    formatCooldown,
    onAIError,
}) => {
    const { toast, confirm } = useUI();

    const [recipeForm, setRecipeForm] = useState<Partial<Recipe>>({ title: '', category: 'Main', ingredients: [], instructions: [] });
    const [recipeFile, setRecipeFile] = useState<File | null>(null);
    const [imageSourceForCurrent, setImageSourceForCurrent] = useState<'upload' | 'nano-banana' | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [recipeSearch, setRecipeSearch] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Hide seed/default recipes in Admin record management.
    const managedRecipes = recipes.filter(r => !defaultRecipeIds.includes(r.id));

    // Filter admin-managed recipes based on search
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
        if (!recipeFile) {
            if (!editingRecipe) setPreviewUrl(null);
            return;
        }
        const url = URL.createObjectURL(recipeFile);
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [recipeFile, editingRecipe]);

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
        await onSave({ ...recipe, image: defaultImage, imageSource: undefined });
        setSuccessMessage(`✓ "${recipe.title}" now uses the default ${recipe.category} image.`);
        setTimeout(() => setSuccessMessage(''), 4000);
    };

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
        } catch (e: any) {
            console.error(e);
            onAIError(e, 'Failed to generate image: ${message}. Try uploading a heritage photo instead.');
        } finally { setIsGeneratingImage(false); }
    };

    const handleQuickSource = async (recipe: Recipe) => {
        setIsGeneratingImage(true);
        try {
            const { imageBase64, mimeType, imageSource } = await geminiProxy.generateImage(recipe);
            const file = base64ToFile(imageBase64, `recipe-${Date.now()}.${getFileExtension(mimeType)}`, mimeType);
            await onSave({ ...recipe, imageSource }, file);
        } catch (e: any) {
            console.error(e);
            onAIError(e, 'Quick generation failed: ${message}. Try uploading a photo for this recipe.');
        } finally { setIsGeneratingImage(false); }
    };

    const debouncedSave = useDebounceAction(async () => {
        setIsSubmitting(true);
        try {
            const isUpdate = !!editingRecipe;
            const ingredients = recipeForm.ingredients?.filter(Boolean) ?? [];
            const instructions = recipeForm.instructions?.filter(Boolean) ?? [];
            const imageSource = recipeFile ? (imageSourceForCurrent || 'upload') : recipeForm.imageSource;
            await onSave({
                ...recipeForm as Recipe,
                id: recipeForm.id || 'r' + Date.now(),
                contributor: recipeForm.contributor || currentUser?.name || 'Family',
                image: recipeForm.image || CATEGORY_IMAGES[recipeForm.category || 'Main'] || CATEGORY_IMAGES.Generic,
                imageSource: imageSource || undefined,
                ingredients,
                instructions
            }, recipeFile || undefined);

            setSuccessMessage(isUpdate ? `✓ "${recipeForm.title}" updated successfully!` : `✓ "${recipeForm.title}" added to archive!`);
            toast(isUpdate ? 'Recipe updated' : 'Recipe saved', 'success');
            setTimeout(() => setSuccessMessage(''), 4000);

            setRecipeForm({ title: '', category: 'Main', ingredients: [], instructions: [], notes: '', contributor: '' });
            setRecipeFile(null);
            setImageSourceForCurrent(null);
            setPreviewUrl(null);
            if (editingRecipe) clearEditing();
        } finally { setIsSubmitting(false); }
    });

    const handleRecipeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!recipeForm.title?.trim()) {
            toast('Recipe title is required.', 'error');
            return;
        }
        const ingredients = recipeForm.ingredients?.filter(Boolean) ?? [];
        const instructions = recipeForm.instructions?.filter(Boolean) ?? [];
        if (ingredients.length === 0 || instructions.length === 0) {
            toast('Ingredients and instructions are required.', 'error');
            return;
        }
        await debouncedSave();
    };

    return (
        <section className="space-y-8 animate-in fade-in">
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

            {/* Manage Recipes List with Search */}
            {!editingRecipe && (
                <div className="bg-stone-50 rounded-3xl border border-stone-100 p-6 max-h-[500px] overflow-hidden mb-8">
                    <div className="flex items-center justify-between mb-4 sticky top-0 bg-stone-50 py-2 z-10">
                        <h4 className="text-[10px] font-black uppercase text-stone-400">
                            Manage Recipes ({filteredRecipes.length}{recipeSearch ? ` of ${managedRecipes.length}` : ''})
                        </h4>
                        <div className="relative">
                            <label htmlFor="admin-recipe-search" className="sr-only">Search recipes</label>
                            <input
                                id="admin-recipe-search"
                                type="search"
                                placeholder="Search recipes..."
                                value={recipeSearch}
                                onChange={e => setRecipeSearch(e.target.value)}
                                className="pl-8 pr-4 py-2 bg-white border border-stone-200 rounded-xl text-base outline-none focus:ring-2 focus:ring-[#2D4635]/20 w-48"
                            />
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs">🔍</span>
                        </div>
                    </div>
                    <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                        {filteredRecipes.length === 0 ? (
                            <div className="text-center py-8 text-stone-400 space-y-3">
                                <span className="text-2xl block mb-2">🔍</span>
                                <span className="text-xs">No recipes match &quot;{recipeSearch}&quot;</span>
                                <button
                                    type="button"
                                    onClick={() => setRecipeSearch('')}
                                    className="block mx-auto mt-2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[#2D4635] hover:text-[#A0522D] rounded-full border border-stone-200 hover:border-[#A0522D]/30"
                                    aria-label="Clear search"
                                >
                                    Clear search
                                </button>
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
                                    <button
                                        onClick={() => handleQuickSource(r)}
                                        disabled={isGeneratingImage || isAICooldownActive}
                                        className="min-w-[2.75rem] min-h-[2.75rem] px-3 py-2 bg-amber-50 text-amber-600 border border-amber-100 rounded-lg text-[10px] font-bold uppercase hover:bg-amber-100 disabled:opacity-50 flex items-center justify-center"
                                        title="One-Click Quick Gen"
                                        aria-label={`Generate AI image for ${r.title}`}
                                    >
                                        {isAICooldownActive ? '⏳' : isGeneratingImage ? '...' : '✨'}
                                    </button>
                                    <button
                                        onClick={async () => {
                                            try {
                                                await useDefaultImageForRecipe(r);
                                            } catch (e: any) {
                                                toast(`Couldn't set default image: ${e?.message || 'unknown error'}. Try again.`, 'error');
                                            }
                                        }}
                                        className="min-w-[2.75rem] min-h-[2.75rem] px-3 py-2 bg-stone-50 text-stone-600 border border-stone-200 rounded-lg text-[10px] font-bold uppercase hover:bg-stone-100 flex items-center justify-center"
                                        title="Use default recipe image"
                                        aria-label={`Use default ${r.category} image for ${r.title}`}
                                    >
                                        🖼️
                                    </button>
                                    <button
                                        onClick={() => {
                                            onEditRecipe(r);
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }}
                                        className="min-w-[2.75rem] min-h-[2.75rem] px-3 py-2 bg-[#2D4635] text-white rounded-lg text-[10px] font-bold uppercase flex items-center justify-center"
                                        aria-label={`Edit ${r.title}`}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (await confirm(`Are you sure you want to delete "${r.title}"?`, { title: 'Confirm Delete', variant: 'danger', confirmLabel: 'Delete', cancelLabel: 'Keep' })) onDelete(r.id);
                                        }}
                                        className="min-w-[2.75rem] min-h-[2.75rem] px-3 py-2 bg-red-50 text-red-600 border border-red-100 rounded-lg text-[10px] font-bold uppercase hover:bg-red-100 flex items-center justify-center"
                                        aria-label={`Delete ${r.title}`}
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {editingRecipe && (
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
                    {!previewUrl && (
                        <div className="w-full h-48 rounded-[2rem] mb-4 border border-dashed border-stone-200 bg-stone-50 flex items-center justify-center">
                            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Recipe image to be added</p>
                        </div>
                    )}

                    <div className="relative group">
                        <label htmlFor="admin-recipe-image-upload" className="block cursor-pointer">
                            <input id="admin-recipe-image-upload" type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0] || null; setRecipeFile(f); setImageSourceForCurrent(f ? 'upload' : null); }} className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full" aria-label="Upload recipe image" />
                            <div className="w-full p-4 border-2 border-dashed border-stone-200 rounded-3xl flex items-center justify-center gap-3 text-stone-400 group-hover:border-[#2D4635] transition-all bg-stone-50/30">
                                <span className="text-lg">📁</span>
                                <span className="text-[10px] font-black uppercase tracking-widest">
                                    {recipeFile ? recipeFile.name : editingRecipe ? 'Change Heritage Photo' : 'Upload Heritage Photo'}
                                </span>
                            </div>
                        </label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                        <button type="button" onClick={handleVisualSourcing} disabled={isGeneratingImage || !recipeForm.title || isAICooldownActive} className="w-full py-3 bg-[#A0522D]/10 text-[#A0522D] rounded-2xl text-[10px] font-black uppercase tracking-widest border border-[#A0522D]/20 hover:bg-[#A0522D]/20 transition-all disabled:opacity-50">
                            {isAICooldownActive ? `Cooldown ${formatCooldown(aiCooldownSecondsLeft)}` : isGeneratingImage ? 'Generating with Imagen...' : '✨ Generate Photo (Imagen)'}
                        </button>
                        <button type="button" onClick={useDefaultImageForForm} className="w-full py-3 bg-stone-100 text-stone-700 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-stone-200 hover:bg-stone-200 transition-all">
                            🖼️ Use Default Image
                        </button>
                    </div>
                </div>
                <div>
                    <label htmlFor="admin-recipe-title" className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2 block mb-1">Recipe Title</label>
                    <input id="admin-recipe-title" placeholder="Recipe Title" className="w-full p-4 border border-stone-200 rounded-2xl text-base outline-none focus:ring-2 focus:ring-[#2D4635]/20" value={recipeForm.title} onChange={e => setRecipeForm({ ...recipeForm, title: e.target.value })} required />
                </div>

                {/* Contributor Selection */}
                <div className="space-y-2">
                    <label htmlFor="admin-recipe-contributor" className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2">Contributed By</label>
                    <select
                        id="admin-recipe-contributor"
                        className="w-full p-4 border border-stone-200 rounded-2xl text-base bg-white focus:ring-2 focus:ring-[#2D4635]/20"
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
                    <div>
                        <label htmlFor="admin-recipe-category" className="sr-only">Recipe Category</label>
                        <select id="admin-recipe-category" className="p-4 border border-stone-200 rounded-2xl text-base bg-white focus:ring-2 focus:ring-[#2D4635]/20 w-full" value={recipeForm.category} onChange={e => setRecipeForm({ ...recipeForm, category: e.target.value as any })}>
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

                {/* Heirloom Notes */}
                <div className="space-y-2">
                    <label htmlFor="admin-recipe-notes" className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2">Heirloom Notes (optional)</label>
                    <textarea
                        id="admin-recipe-notes"
                        placeholder="Add any special memories, tips, or history about this recipe..."
                        className="w-full h-24 p-4 border border-[#2D4635]/20 rounded-2xl text-base bg-[#2D4635]/5 focus:ring-2 focus:ring-[#2D4635]/20 italic"
                        value={recipeForm.notes || ''}
                        onChange={e => setRecipeForm({ ...recipeForm, notes: e.target.value })}
                    />
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
