import React, { useState, useEffect, useCallback } from 'react';
import { Recipe, ContributorProfile, UserProfile } from '../types';
import * as geminiProxy from '../services/geminiProxy';
import { CATEGORY_IMAGES } from '../constants';
import { useUI } from '../context/UIContext';

interface AddRecipeModalProps {
    onAddRecipe: (r: Recipe, file?: File) => Promise<void>;
    onClose: () => void;
    contributors: ContributorProfile[];
    currentUser: UserProfile | null;
}

export const AddRecipeModal: React.FC<AddRecipeModalProps> = ({ onAddRecipe, onClose, contributors, currentUser }) => {
    const { toast } = useUI();
    const AI_COOLDOWN_MS = 5 * 60 * 1000;
    const [recipeForm, setRecipeForm] = useState<Partial<Recipe>>({ title: '', category: 'Main', ingredients: [], instructions: [] });
    const [recipeFile, setRecipeFile] = useState<File | null>(null);
    const [imageSourceForCurrent, setImageSourceForCurrent] = useState<'upload' | 'imagen' | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [rawText, setRawText] = useState('');
    const [isMagicLoading, setIsMagicLoading] = useState(false);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [aiCooldownUntil, setAiCooldownUntil] = useState<number>(0);
    const [aiCooldownSecondsLeft, setAiCooldownSecondsLeft] = useState(0);

    useEffect(() => {
        if (!recipeFile) {
            setPreviewUrl(null);
            return;
        }
        const url = URL.createObjectURL(recipeFile);
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [recipeFile]);

    useEffect(() => {
        if (!aiCooldownUntil) {
            setAiCooldownSecondsLeft(0);
            return;
        }
        const tick = () => {
            const remaining = Math.max(0, Math.ceil((aiCooldownUntil - Date.now()) / 1000));
            setAiCooldownSecondsLeft(remaining);
            if (remaining === 0) setAiCooldownUntil(0);
        };
        tick();
        const timer = window.setInterval(tick, 1000);
        return () => window.clearInterval(timer);
    }, [aiCooldownUntil]);

    const getAIErrorMessage = (err: unknown, fallback: string): string => {
        const msg = (err as Error)?.message || '';
        const lower = msg.toLowerCase();
        if (msg.includes('429') || lower.includes('quota') || lower.includes('rate limit')) {
            return 'AI quota is currently exhausted. Try again later or add a manual photo.';
        }
        if (msg.includes('500') || msg.includes('not configured')) return 'AI features are not available. Try uploading a photo manually instead.';
        if (msg.includes('fetch') || msg.includes('network')) return 'Could not reach the AI service. Check your connection and try again.';
        return fallback.replace('${message}', msg || 'unknown error');
    };

    const isQuotaError = (err: unknown): boolean => {
        const msg = ((err as Error)?.message || '').toLowerCase();
        return msg.includes('429') || msg.includes('quota') || msg.includes('rate limit');
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

    const base64ToFile = (base64: string, filename: string): File => {
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
        return new File([new Blob(blobs, { type: 'image/png' })], filename, { type: 'image/png' });
    };

    const getDefaultImageForCategory = (category?: string) =>
        CATEGORY_IMAGES[category || 'Main'] || CATEGORY_IMAGES.Generic;

    const useDefaultImageForForm = () => {
        const defaultImage = getDefaultImageForCategory(recipeForm.category);
        setRecipeFile(null);
        setPreviewUrl(defaultImage);
        setRecipeForm(prev => ({ ...prev, image: defaultImage, imageSource: undefined }));
    };

    const handleMagicImport = async () => {
        if (!rawText.trim()) return;
        setIsMagicLoading(true);
        try {
            const parsed = await geminiProxy.magicImport(rawText);
            setRecipeForm(prev => ({ ...prev, ...parsed }));
            setRawText('');
            toast('Magic import successful!', 'success');
        } catch (e: unknown) {
            handleAIError(e, 'AI Analysis failed: ${message}');
        } finally { setIsMagicLoading(false); }
    };

    const handleVisualSourcing = async () => {
        if (!recipeForm.title) return;
        setIsGeneratingImage(true);
        try {
            const imageBase64 = await geminiProxy.generateImage(recipeForm);
            const file = base64ToFile(imageBase64, `recipe-${Date.now()}.png`);
            setRecipeFile(file);
            setImageSourceForCurrent('imagen');
            setPreviewUrl(URL.createObjectURL(file));
        } catch (e: unknown) {
            handleAIError(e, 'Failed to generate image: ${message}. Try uploading a photo instead.');
        } finally { setIsGeneratingImage(false); }
    };

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
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
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
            toast('Recipe saved', 'success');
            onClose();
        } finally { setIsSubmitting(false); }
    };

    const isAICooldownActive = aiCooldownSecondsLeft > 0;

    const handleBackdropClick = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
    }, [onClose]);

    useEffect(() => {
        const onEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onEscape);
        return () => document.removeEventListener('keydown', onEscape);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="add-recipe-modal-title" onClick={handleBackdropClick}>
            <div className="bg-white rounded-[2rem] md:rounded-[3rem] p-6 md:p-12 border border-stone-200 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-6">
                    <h2 id="add-recipe-modal-title" className="text-2xl font-serif italic text-[#2D4635]">Add New Recipe</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500"
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>
                <form onSubmit={handleRecipeSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2">Archival Image</label>
                        {previewUrl && (
                            <div className="relative w-full h-48 rounded-[2rem] overflow-hidden mb-4 border border-stone-100 shadow-inner">
                                <img src={previewUrl} className="w-full h-full object-cover" alt="Preview" onError={(e) => { (e.target as HTMLImageElement).src = getDefaultImageForCategory(recipeForm.category); }} />
                            </div>
                        )}
                        {!previewUrl && (
                            <div className="w-full h-48 rounded-[2rem] mb-4 border border-dashed border-stone-200 bg-stone-50 flex items-center justify-center">
                                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Recipe image to be added</p>
                            </div>
                        )}
                        <div className="relative group">
                            <label htmlFor="add-recipe-image-upload" className="block cursor-pointer">
                                <input id="add-recipe-image-upload" type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0] || null; setRecipeFile(f); setImageSourceForCurrent(f ? 'upload' : null); }} className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full" aria-label="Upload recipe image" />
                                <div className="w-full p-4 border-2 border-dashed border-stone-200 rounded-3xl flex items-center justify-center gap-3 text-stone-400 group-hover:border-[#2D4635] transition-all bg-stone-50/30">
                                    <span className="text-lg">📁</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest">{recipeFile ? recipeFile.name : 'Upload Heritage Photo'}</span>
                                </div>
                            </label>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                            <button type="button" onClick={handleVisualSourcing} disabled={isGeneratingImage || !recipeForm.title || isAICooldownActive} className="w-full py-3 bg-[#A0522D]/10 text-[#A0522D] rounded-2xl text-[10px] font-black uppercase tracking-widest border border-[#A0522D]/20 hover:bg-[#A0522D]/20 transition-all disabled:opacity-50">
                                {isAICooldownActive ? `Cooldown ${formatCooldown(aiCooldownSecondsLeft)}` : isGeneratingImage ? 'Generating...' : '✨ Generate Photo (Imagen)'}
                            </button>
                            <button type="button" onClick={useDefaultImageForForm} className="w-full py-3 bg-stone-100 text-stone-700 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-stone-200 hover:bg-stone-200 transition-all">
                                🖼️ Use Default Image
                            </button>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="add-recipe-magic" className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2 block mb-1">Paste recipe text for AI</label>
                        <textarea id="add-recipe-magic" placeholder="Paste recipe text here for AI to parse…" className="w-full h-24 p-4 border border-stone-100 rounded-2xl text-base bg-stone-50 outline-none" value={rawText} onChange={(e) => setRawText(e.target.value)} />
                        <button type="button" onClick={handleMagicImport} disabled={isMagicLoading || !rawText.trim() || isAICooldownActive} className="mt-2 w-full py-3 bg-[#2D4635] text-white rounded-full text-[10px] font-black uppercase tracking-widest disabled:opacity-50">
                            {isAICooldownActive ? `Cooldown ${formatCooldown(aiCooldownSecondsLeft)}` : isMagicLoading ? 'Analyzing...' : '✨ Organize with AI'}
                        </button>
                    </div>
                    <div>
                        <label htmlFor="add-recipe-title-input" className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2 block mb-1">Recipe Title</label>
                        <input id="add-recipe-title-input" placeholder="Recipe Title" className="w-full p-4 border border-stone-200 rounded-2xl text-base outline-none focus:ring-2 focus:ring-[#2D4635]/20" value={recipeForm.title} onChange={e => setRecipeForm({ ...recipeForm, title: e.target.value })} required />
                    </div>
                    <div>
                        <label htmlFor="add-recipe-contributor" className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2">Contributed By</label>
                        <select id="add-recipe-contributor" className="w-full p-4 border border-stone-200 rounded-2xl text-base bg-white focus:ring-2 focus:ring-[#2D4635]/20 mt-1" value={recipeForm.contributor || currentUser?.name || ''} onChange={e => setRecipeForm({ ...recipeForm, contributor: e.target.value })}>
                            <option value={currentUser?.name || 'Me'}>{currentUser?.name || 'Me'} (you)</option>
                            {contributors.filter(c => c.name !== currentUser?.name).map(c => (
                                <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label htmlFor="add-recipe-category" className="sr-only">Category</label>
                            <select id="add-recipe-category" className="p-4 border border-stone-200 rounded-2xl text-base bg-white focus:ring-2 focus:ring-[#2D4635]/20 w-full" value={recipeForm.category} onChange={e => setRecipeForm({ ...recipeForm, category: e.target.value as Recipe['category'] })}>
                                {['Breakfast', 'Main', 'Dessert', 'Side', 'Appetizer', 'Bread', 'Dip/Sauce', 'Snack'].map(c => <option key={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="add-recipe-preptime" className="sr-only">Prep time</label>
                            <input id="add-recipe-preptime" placeholder="Prep (e.g. 15 min)" className="p-4 border border-stone-200 rounded-2xl text-base focus:ring-2 focus:ring-[#2D4635]/20 w-full" value={recipeForm.prepTime || ''} onChange={e => setRecipeForm({ ...recipeForm, prepTime: e.target.value })} />
                        </div>
                        <div>
                            <label htmlFor="add-recipe-cooktime" className="sr-only">Cook Time</label>
                            <input id="add-recipe-cooktime" placeholder="Cook (e.g. 30 min)" className="p-4 border border-stone-200 rounded-2xl text-base focus:ring-2 focus:ring-[#2D4635]/20 w-full" value={recipeForm.cookTime || ''} onChange={e => setRecipeForm({ ...recipeForm, cookTime: e.target.value })} />
                        </div>
                        <div>
                            <label htmlFor="add-recipe-calories" className="sr-only">Calories</label>
                            <input id="add-recipe-calories" type="number" placeholder="Calories" className="p-4 border border-stone-200 rounded-2xl text-base focus:ring-2 focus:ring-[#2D4635]/20 w-full" value={recipeForm.calories || ''} onChange={e => setRecipeForm({ ...recipeForm, calories: parseInt(e.target.value) || 0 })} />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="add-recipe-ingredients" className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2 block mb-1">Ingredients (one per line)</label>
                        <textarea id="add-recipe-ingredients" placeholder="Ingredients (one per line)" className="w-full h-32 p-4 border border-stone-200 rounded-2xl text-base bg-stone-50 focus:ring-2 focus:ring-[#2D4635]/20" value={recipeForm.ingredients?.join('\n')} onChange={e => setRecipeForm({ ...recipeForm, ingredients: e.target.value.split('\n') })} required />
                    </div>
                    <div>
                        <label htmlFor="add-recipe-instructions" className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2 block mb-1">Instructions (one per line)</label>
                        <textarea id="add-recipe-instructions" placeholder="Instructions (one per line)" className="w-full h-48 p-4 border border-stone-200 rounded-2xl text-base bg-stone-50 focus:ring-2 focus:ring-[#2D4635]/20" value={recipeForm.instructions?.join('\n')} onChange={e => setRecipeForm({ ...recipeForm, instructions: e.target.value.split('\n') })} required />
                    </div>
                    <div>
                        <label htmlFor="add-recipe-notes" className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2">Heirloom Notes (optional)</label>
                        <textarea id="add-recipe-notes" placeholder="Add any special memories or tips…" className="w-full h-24 p-4 border border-[#2D4635]/20 rounded-2xl text-base bg-[#2D4635]/5 focus:ring-2 focus:ring-[#2D4635]/20 italic mt-1" value={recipeForm.notes || ''} onChange={e => setRecipeForm({ ...recipeForm, notes: e.target.value })} />
                    </div>
                    <div className="flex gap-4 pt-4">
                        <button type="submit" disabled={isSubmitting} aria-busy={isSubmitting} className="flex-1 py-4 bg-[#2D4635] text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl disabled:opacity-70 disabled:cursor-not-allowed">
                            {isSubmitting ? 'Saving...' : 'Add Recipe'}
                        </button>
                        <button type="button" onClick={onClose} disabled={isSubmitting} className="flex-1 py-4 border border-stone-200 rounded-full text-[10px] font-black uppercase text-stone-400 disabled:opacity-70">
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
