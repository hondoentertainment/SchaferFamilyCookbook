import React, { useState, useEffect, useCallback, useRef } from 'react';
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

const WIZARD_STEPS = [
    { num: 1, label: 'Basics' },
    { num: 2, label: 'Ingredients' },
    { num: 3, label: 'Instructions' },
    { num: 4, label: 'Image & Notes' },
    { num: 5, label: 'Review' },
] as const;

export const AddRecipeModal: React.FC<AddRecipeModalProps> = ({ onAddRecipe, onClose, contributors, currentUser }) => {
    const { toast } = useUI();
    const AI_COOLDOWN_MS = 5 * 60 * 1000;
    const [recipeForm, setRecipeForm] = useState<Partial<Recipe>>({ title: '', category: 'Main', ingredients: [], instructions: [] });
    const [recipeFile, setRecipeFile] = useState<File | null>(null);
    const [imageSourceForCurrent, setImageSourceForCurrent] = useState<'upload' | 'nano-banana' | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [rawText, setRawText] = useState('');
    const [isMagicLoading, setIsMagicLoading] = useState(false);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [aiCooldownUntil, setAiCooldownUntil] = useState<number>(0);
    const [aiCooldownSecondsLeft, setAiCooldownSecondsLeft] = useState(0);
    const [wizardStep, setWizardStep] = useState(1);
    const [stepErrors, setStepErrors] = useState<Record<number, string[]>>({});

    const previewUrlRef = useRef<string | null>(null);

    useEffect(() => {
        if (!recipeFile) {
            setPreviewUrl(null);
            return;
        }
        const url = URL.createObjectURL(recipeFile);
        previewUrlRef.current = url;
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [recipeFile]);

    // Clean up any lingering object URLs on unmount
    useEffect(() => {
        return () => {
            if (previewUrlRef.current && previewUrlRef.current.startsWith('blob:')) {
                URL.revokeObjectURL(previewUrlRef.current);
            }
        };
    }, []);

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
            const { imageBase64, mimeType, imageSource } = await geminiProxy.generateImage(recipeForm);
            let file: File;
            try {
                file = base64ToFile(imageBase64, `recipe-${Date.now()}.${getFileExtension(mimeType)}`, mimeType);
            } catch (conversionError) {
                toast('Failed to process the generated image. Try uploading a photo instead.', 'error');
                return;
            }
            setRecipeFile(file);
            setImageSourceForCurrent(imageSource);
            setPreviewUrl(prev => { if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
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

    // --- Wizard validation ---
    const validateStep = (step: number): string[] => {
        const errors: string[] = [];
        switch (step) {
            case 1:
                if (!recipeForm.title?.trim()) errors.push('Recipe title is required.');
                break;
            case 2:
                if (!recipeForm.ingredients?.filter(Boolean).length) errors.push('At least one ingredient is required.');
                break;
            case 3:
                if (!recipeForm.instructions?.filter(Boolean).length) errors.push('At least one instruction is required.');
                break;
        }
        return errors;
    };

    const handleNext = () => {
        const errors = validateStep(wizardStep);
        if (errors.length > 0) {
            setStepErrors(prev => ({ ...prev, [wizardStep]: errors }));
            return;
        }
        setStepErrors(prev => ({ ...prev, [wizardStep]: [] }));
        setWizardStep(prev => Math.min(prev + 1, 5));
    };

    const handleBack = () => {
        setWizardStep(prev => Math.max(prev - 1, 1));
    };

    const goToStep = (step: number) => {
        setStepErrors({});
        setWizardStep(step);
    };

    const currentErrors = stepErrors[wizardStep] || [];
    const currentStepValid = validateStep(wizardStep).length === 0;

    // --- Render helpers ---

    const renderProgressIndicator = () => (
        <div className="flex items-center justify-between mb-6 px-1">
            {WIZARD_STEPS.map(({ num, label }) => (
                <div key={num} className="flex flex-col items-center flex-1">
                    <div className="flex items-center w-full">
                        {num > 1 && (
                            <div className={`flex-1 h-0.5 ${num <= wizardStep ? 'bg-[#2D4635]' : 'bg-stone-200'} transition-colors`} />
                        )}
                        <button
                            type="button"
                            onClick={() => { if (num < wizardStep) goToStep(num); }}
                            disabled={num > wizardStep}
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                                num === wizardStep
                                    ? 'bg-[#2D4635] text-white ring-2 ring-[#2D4635]/20 ring-offset-2'
                                    : num < wizardStep
                                    ? 'bg-[#2D4635] text-white cursor-pointer hover:ring-2 hover:ring-[#2D4635]/20 hover:ring-offset-2'
                                    : 'bg-stone-200 text-stone-400'
                            }`}
                            aria-label={`Step ${num}: ${label}`}
                            aria-current={num === wizardStep ? 'step' : undefined}
                        >
                            {num < wizardStep ? '✓' : num}
                        </button>
                        {num < WIZARD_STEPS.length && (
                            <div className={`flex-1 h-0.5 ${num < wizardStep ? 'bg-[#2D4635]' : 'bg-stone-200'} transition-colors`} />
                        )}
                    </div>
                    <span className={`text-[9px] font-bold uppercase tracking-wider mt-1.5 ${
                        num === wizardStep ? 'text-[#2D4635]' : 'text-stone-400'
                    } hidden sm:block`}>
                        {label}
                    </span>
                </div>
            ))}
        </div>
    );

    const renderStepErrors = () => {
        if (currentErrors.length === 0) return null;
        return (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-2xl">
                {currentErrors.map((err, i) => (
                    <p key={i} className="text-sm text-red-600">{err}</p>
                ))}
            </div>
        );
    };

    const renderStep1 = () => (
        <div className="space-y-4">
            <div>
                <label htmlFor="add-recipe-title-input" className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2 block mb-1">Recipe Title *</label>
                <input id="add-recipe-title-input" placeholder="Recipe Title" className="w-full p-4 border border-stone-200 rounded-2xl text-base outline-none focus:ring-2 focus:ring-[#2D4635]/20" value={recipeForm.title} onChange={e => setRecipeForm({ ...recipeForm, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="add-recipe-category" className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2 block mb-1">Category</label>
                    <select id="add-recipe-category" className="p-4 border border-stone-200 rounded-2xl text-base bg-white focus:ring-2 focus:ring-[#2D4635]/20 w-full" value={recipeForm.category} onChange={e => setRecipeForm({ ...recipeForm, category: e.target.value as Recipe['category'] })}>
                        {['Breakfast', 'Main', 'Dessert', 'Side', 'Appetizer', 'Bread', 'Dip/Sauce', 'Snack'].map(c => <option key={c}>{c}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="add-recipe-contributor" className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2 block mb-1">Contributed By</label>
                    <select id="add-recipe-contributor" className="p-4 border border-stone-200 rounded-2xl text-base bg-white focus:ring-2 focus:ring-[#2D4635]/20 w-full" value={recipeForm.contributor || currentUser?.name || ''} onChange={e => setRecipeForm({ ...recipeForm, contributor: e.target.value })}>
                        <option value={currentUser?.name || 'Me'}>{currentUser?.name || 'Me'} (you)</option>
                        {contributors.filter(c => c.name !== currentUser?.name).map(c => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                    </select>
                </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                    <label htmlFor="add-recipe-preptime" className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2 block mb-1">Prep Time</label>
                    <input id="add-recipe-preptime" placeholder="e.g. 15 min" className="p-4 border border-stone-200 rounded-2xl text-base focus:ring-2 focus:ring-[#2D4635]/20 w-full" value={recipeForm.prepTime || ''} onChange={e => setRecipeForm({ ...recipeForm, prepTime: e.target.value })} />
                </div>
                <div>
                    <label htmlFor="add-recipe-cooktime" className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2 block mb-1">Cook Time</label>
                    <input id="add-recipe-cooktime" placeholder="e.g. 30 min" className="p-4 border border-stone-200 rounded-2xl text-base focus:ring-2 focus:ring-[#2D4635]/20 w-full" value={recipeForm.cookTime || ''} onChange={e => setRecipeForm({ ...recipeForm, cookTime: e.target.value })} />
                </div>
                <div>
                    <label htmlFor="add-recipe-servings" className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2 block mb-1">Servings</label>
                    <input id="add-recipe-servings" placeholder="e.g. 4" className="p-4 border border-stone-200 rounded-2xl text-base focus:ring-2 focus:ring-[#2D4635]/20 w-full" value={recipeForm.servings || ''} onChange={e => setRecipeForm({ ...recipeForm, servings: e.target.value })} />
                </div>
                <div>
                    <label htmlFor="add-recipe-calories" className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2 block mb-1">Calories</label>
                    <input id="add-recipe-calories" type="number" placeholder="Calories" className="p-4 border border-stone-200 rounded-2xl text-base focus:ring-2 focus:ring-[#2D4635]/20 w-full" value={recipeForm.calories || ''} onChange={e => setRecipeForm({ ...recipeForm, calories: parseInt(e.target.value) || 0 })} />
                </div>
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div className="space-y-4">
            <div>
                <label htmlFor="add-recipe-magic" className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2 block mb-1">Paste recipe text for AI</label>
                <textarea id="add-recipe-magic" placeholder="Paste recipe text here for AI to parse..." className="w-full h-24 p-4 border border-stone-100 rounded-2xl text-base bg-stone-50 outline-none" value={rawText} onChange={(e) => setRawText(e.target.value)} />
                <button type="button" onClick={handleMagicImport} disabled={isMagicLoading || !rawText.trim() || isAICooldownActive} className="mt-2 w-full py-3 bg-[#2D4635] text-white rounded-full text-[10px] font-black uppercase tracking-widest disabled:opacity-50">
                    {isAICooldownActive ? `Cooldown ${formatCooldown(aiCooldownSecondsLeft)}` : isMagicLoading ? 'Analyzing...' : '✨ Organize with AI'}
                </button>
            </div>
            <div>
                <label htmlFor="add-recipe-ingredients" className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2 block mb-1">Ingredients (one per line) *</label>
                <textarea id="add-recipe-ingredients" placeholder="Ingredients (one per line)" className="w-full h-48 p-4 border border-stone-200 rounded-2xl text-base bg-stone-50 focus:ring-2 focus:ring-[#2D4635]/20" value={recipeForm.ingredients?.join('\n')} onChange={e => setRecipeForm({ ...recipeForm, ingredients: e.target.value.split('\n') })} />
            </div>
        </div>
    );

    const renderStep3 = () => (
        <div className="space-y-4">
            <div>
                <label htmlFor="add-recipe-instructions" className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2 block mb-1">Instructions (one per line) *</label>
                <textarea id="add-recipe-instructions" placeholder="Instructions (one per line)" className="w-full h-64 p-4 border border-stone-200 rounded-2xl text-base bg-stone-50 focus:ring-2 focus:ring-[#2D4635]/20" value={recipeForm.instructions?.join('\n')} onChange={e => setRecipeForm({ ...recipeForm, instructions: e.target.value.split('\n') })} />
            </div>
        </div>
    );

    const renderStep4 = () => (
        <div className="space-y-4">
            <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2">Archival Image</label>
                {previewUrl && (
                    <div className="relative w-full h-40 rounded-[2rem] overflow-hidden mb-3 border border-stone-100 shadow-inner">
                        <img src={previewUrl} className="w-full h-full object-cover" alt="Preview" onError={(e) => { (e.target as HTMLImageElement).src = getDefaultImageForCategory(recipeForm.category); }} />
                    </div>
                )}
                {!previewUrl && (
                    <div className="w-full h-40 rounded-[2rem] mb-3 border border-dashed border-stone-200 bg-stone-50 flex items-center justify-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Recipe image to be added</p>
                    </div>
                )}
                <div className="relative group">
                    <label htmlFor="add-recipe-image-upload" className="block cursor-pointer">
                        <input id="add-recipe-image-upload" type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0] || null; if (f && f.size > 10 * 1024 * 1024) { toast('Image must be under 10 MB.', 'error'); e.target.value = ''; return; } setRecipeFile(f); setImageSourceForCurrent(f ? 'upload' : null); }} className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full" aria-label="Upload recipe image" />
                        <div className="w-full p-4 border-2 border-dashed border-stone-200 rounded-3xl flex items-center justify-center gap-3 text-stone-400 group-hover:border-[#2D4635] transition-all bg-stone-50/30">
                            <span className="text-lg">📁</span>
                            <span className="text-[10px] font-black uppercase tracking-widest">{recipeFile ? recipeFile.name : 'Upload Heritage Photo'}</span>
                        </div>
                    </label>
                    <p className="text-[10px] text-stone-400 mt-1 ml-2">Max file size: 10 MB</p>
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
                <label htmlFor="add-recipe-notes" className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2 block mb-1">Heirloom Notes (optional)</label>
                <textarea id="add-recipe-notes" placeholder="Add any special memories or tips..." className="w-full h-24 p-4 border border-[#2D4635]/20 rounded-2xl text-base bg-[#2D4635]/5 focus:ring-2 focus:ring-[#2D4635]/20 italic" value={recipeForm.notes || ''} onChange={e => setRecipeForm({ ...recipeForm, notes: e.target.value })} />
            </div>
        </div>
    );

    const renderReviewField = (label: string, value: string | undefined, editStep: number) => {
        if (!value) return null;
        return (
            <div className="flex items-start justify-between py-2 border-b border-stone-100 last:border-0">
                <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">{label}</span>
                    <p className="text-sm text-stone-700 mt-0.5 break-words">{value}</p>
                </div>
                <button type="button" onClick={() => goToStep(editStep)} className="text-[10px] font-black uppercase tracking-widest text-[#2D4635] hover:text-[#A0522D] transition-colors ml-3 shrink-0">
                    Edit
                </button>
            </div>
        );
    };

    const renderStep5 = () => {
        const ingredients = recipeForm.ingredients?.filter(Boolean) ?? [];
        const instructions = recipeForm.instructions?.filter(Boolean) ?? [];
        return (
            <div className="space-y-3">
                <p className="text-sm text-stone-500 italic mb-2">Review your recipe before submitting.</p>

                {previewUrl && (
                    <div className="relative w-full h-32 rounded-2xl overflow-hidden border border-stone-100">
                        <img src={previewUrl} className="w-full h-full object-cover" alt="Recipe preview" onError={(e) => { (e.target as HTMLImageElement).src = getDefaultImageForCategory(recipeForm.category); }} />
                        <button type="button" onClick={() => goToStep(4)} className="absolute top-2 right-2 text-[9px] font-black uppercase tracking-widest bg-white/90 text-[#2D4635] px-2 py-1 rounded-full hover:bg-white transition-colors">
                            Edit
                        </button>
                    </div>
                )}

                <div className="bg-stone-50 rounded-2xl p-4 space-y-1">
                    {renderReviewField('Title', recipeForm.title, 1)}
                    {renderReviewField('Category', recipeForm.category, 1)}
                    {renderReviewField('Contributed By', recipeForm.contributor || currentUser?.name || 'Family', 1)}
                    {renderReviewField('Prep Time', recipeForm.prepTime, 1)}
                    {renderReviewField('Cook Time', recipeForm.cookTime, 1)}
                    {renderReviewField('Servings', recipeForm.servings, 1)}
                    {renderReviewField('Calories', recipeForm.calories ? String(recipeForm.calories) : undefined, 1)}
                </div>

                {ingredients.length > 0 && (
                    <div className="bg-stone-50 rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Ingredients</span>
                            <button type="button" onClick={() => goToStep(2)} className="text-[10px] font-black uppercase tracking-widest text-[#2D4635] hover:text-[#A0522D] transition-colors">Edit</button>
                        </div>
                        <ul className="list-disc pl-5 text-sm text-stone-700 space-y-0.5">
                            {ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
                        </ul>
                    </div>
                )}

                {instructions.length > 0 && (
                    <div className="bg-stone-50 rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Instructions</span>
                            <button type="button" onClick={() => goToStep(3)} className="text-[10px] font-black uppercase tracking-widest text-[#2D4635] hover:text-[#A0522D] transition-colors">Edit</button>
                        </div>
                        <ol className="list-decimal pl-5 text-sm text-stone-700 space-y-0.5">
                            {instructions.map((inst, i) => <li key={i}>{inst}</li>)}
                        </ol>
                    </div>
                )}

                {recipeForm.notes && (
                    <div className="bg-[#2D4635]/5 rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Heirloom Notes</span>
                            <button type="button" onClick={() => goToStep(4)} className="text-[10px] font-black uppercase tracking-widest text-[#2D4635] hover:text-[#A0522D] transition-colors">Edit</button>
                        </div>
                        <p className="text-sm text-stone-700 italic">{recipeForm.notes}</p>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="add-recipe-modal-title" onClick={handleBackdropClick}>
            <div className="bg-white rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 border border-stone-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex justify-between items-start mb-4 shrink-0">
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

                {/* Progress indicator */}
                <div className="shrink-0">
                    {renderProgressIndicator()}
                </div>

                {/* Step content - scrollable */}
                <div className="flex-1 overflow-y-auto min-h-0 pr-1">
                    <form id="add-recipe-form" onSubmit={handleRecipeSubmit}>
                        {renderStepErrors()}
                        {wizardStep === 1 && renderStep1()}
                        {wizardStep === 2 && renderStep2()}
                        {wizardStep === 3 && renderStep3()}
                        {wizardStep === 4 && renderStep4()}
                        {wizardStep === 5 && renderStep5()}
                    </form>
                </div>

                {/* Navigation buttons */}
                <div className="flex gap-3 pt-4 mt-4 border-t border-stone-100 shrink-0">
                    {wizardStep > 1 && (
                        <button
                            type="button"
                            onClick={handleBack}
                            className="flex-1 py-3 border border-stone-200 rounded-full text-[10px] font-black uppercase tracking-widest text-stone-500 hover:bg-stone-50 transition-colors"
                        >
                            Back
                        </button>
                    )}
                    {wizardStep < 5 ? (
                        <button
                            type="button"
                            onClick={handleNext}
                            disabled={!currentStepValid && currentErrors.length > 0}
                            className="flex-1 py-3 bg-[#2D4635] text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-[#2D4635]/90 transition-colors disabled:opacity-50"
                        >
                            Next
                        </button>
                    ) : (
                        <button
                            type="submit"
                            form="add-recipe-form"
                            disabled={isSubmitting}
                            aria-busy={isSubmitting}
                            className="flex-1 py-3 bg-[#2D4635] text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Saving...' : 'Add Recipe'}
                        </button>
                    )}
                    {wizardStep === 1 && (
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="flex-1 py-3 border border-stone-200 rounded-full text-[10px] font-black uppercase text-stone-400 disabled:opacity-70"
                        >
                            Cancel
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
