import React, { useState, useEffect } from 'react';
import { Recipe, UserProfile, ContributorProfile } from '../../types';
import * as geminiProxy from '../../services/geminiProxy';
import { CATEGORY_IMAGES } from '../../constants';
import { useUI } from '../../context/UIContext';

interface AdminRecipesProps {
    recipes: Recipe[];
    editingRecipe: Recipe | null;
    onAddRecipe: (r: Recipe, file?: File) => Promise<void>;
    onDeleteRecipe: (id: string) => void;
    onEditRecipe: (r: Recipe) => void;
    clearEditing: () => void;
    defaultRecipeIds?: string[];
    currentUser: UserProfile | null;
    contributors: ContributorProfile[];
}

export const AdminRecipes: React.FC<AdminRecipesProps> = ({
    recipes,
    editingRecipe,
    onAddRecipe,
    onDeleteRecipe,
    onEditRecipe,
    clearEditing,
    defaultRecipeIds = [],
    currentUser,
    contributors
}) => {
    const { toast, confirm } = useUI();
    const AI_COOLDOWN_MS = 5 * 60 * 1000;

    const [recipeForm, setRecipeForm] = useState<Partial<Recipe>>(() => {
        try {
            const saved = localStorage.getItem('sc_recipe_draft_form');
            if (saved) return JSON.parse(saved);
        } catch { }
        return { title: '', category: 'Main', ingredients: [], instructions: [] };
    });
    const [rawText, setRawText] = useState(() => localStorage.getItem('sc_recipe_draft_text') || '');

    const [recipeFile, setRecipeFile] = useState<File | null>(null);
    const [imageSourceForCurrent, setImageSourceForCurrent] = useState<'upload' | 'nano-banana' | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isMagicLoading, setIsMagicLoading] = useState(false);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [isBulkSourcing, setIsBulkSourcing] = useState(false);
    const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
    const [recipeSearch, setRecipeSearch] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [aiCooldownUntil, setAiCooldownUntil] = useState<number>(0);
    const [aiCooldownSecondsLeft, setAiCooldownSecondsLeft] = useState(0);

    // List Virtualization Limit
    const [visibleCount, setVisibleCount] = useState(20);

    // Staging Queues
    interface StagedImage { recipe: Recipe; file: File; previewUrl: string; }
    const [stagedImages, setStagedImages] = useState<StagedImage[]>([]);
    const [stagedMagicImports, setStagedMagicImports] = useState<Partial<Recipe>[]>([]);

    useEffect(() => {
        if (!editingRecipe) {
            localStorage.setItem('sc_recipe_draft_form', JSON.stringify(recipeForm));
            localStorage.setItem('sc_recipe_draft_text', rawText);
        }
    }, [recipeForm, rawText, editingRecipe]);

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (!isSubmitting && !editingRecipe && (recipeForm.title?.trim() || rawText.trim())) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [recipeForm, rawText, isSubmitting, editingRecipe]);

    const managedRecipes = recipes.filter(r => !defaultRecipeIds.includes(r.id));
    const filteredRecipes = managedRecipes.filter(r =>
        r.title.toLowerCase().includes(recipeSearch.toLowerCase()) ||
        r.category.toLowerCase().includes(recipeSearch.toLowerCase()) ||
        r.contributor?.toLowerCase().includes(recipeSearch.toLowerCase())
    );

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
        if (scrollHeight - scrollTop <= clientHeight + 100) {
            setVisibleCount(prev => prev + 20);
        }
    };

    useEffect(() => {
        setVisibleCount(20);
    }, [recipeSearch]);

    useEffect(() => {
        if (editingRecipe) {
            setRecipeForm(editingRecipe);
            setPreviewUrl(editingRecipe.image || CATEGORY_IMAGES[editingRecipe.category] || CATEGORY_IMAGES.Generic);
        } else {
            const saved = localStorage.getItem('sc_recipe_draft_form');
            if (saved) {
                 try { setRecipeForm(JSON.parse(saved)); } catch {}
            } else {
                 setRecipeForm({ title: '', category: 'Main', ingredients: [], instructions: [] });
            }
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
            return 'AI quota exhausted. Temporarily unavailable. Try again later or upgrade limits.';
        }
        if (msg.includes('500') || msg.includes('not configured')) return 'AI features unavailable. Ensure GEMINI_API_KEY is set on the server.';
        if (msg.includes('fetch') || msg.includes('network')) return 'Could not reach AI service. Check connection.';
        return fallback.replace('${message}', msg || 'unknown error');
    };

    const isQuotaError = (err: unknown): boolean => {
        const msg = ((err as Error)?.message || '').toLowerCase();
        return msg.includes('429') || msg.includes('quota') || msg.includes('rate limit');
    };

    const formatCooldown = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

    const handleAIError = (err: unknown, fallback: string) => {
        if (isQuotaError(err)) setAiCooldownUntil(Date.now() + AI_COOLDOWN_MS);
        toast(getAIErrorMessage(err, fallback), 'error');
    };

    const getDefaultImageForCategory = (category?: string) => CATEGORY_IMAGES[category || 'Main'] || CATEGORY_IMAGES.Generic;

    const useDefaultImageForForm = () => {
        const defaultImage = getDefaultImageForCategory(recipeForm.category);
        setRecipeFile(null);
        setPreviewUrl(defaultImage);
        setRecipeForm(prev => ({ ...prev, image: defaultImage, imageSource: undefined }));
    };

    const useDefaultImageForRecipe = async (recipe: Recipe) => {
        const defaultImage = getDefaultImageForCategory(recipe.category);
        await onAddRecipe({ ...recipe, image: defaultImage, imageSource: undefined });
        setSuccessMessage(`✓ "${recipe.title}" uses the default image.`);
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
        const blobs: ArrayBuffer[] = byteArrays.map(ua => {
            const ab = new ArrayBuffer(ua.byteLength);
            new Uint8Array(ab).set(ua);
            return ab;
        });
        return new File([new Blob(blobs, { type: mimeType })], filename, { type: mimeType });
    };

    const getFileExtension = (mimeType: string = 'image/png') => mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png';

    const handleMagicImport = async () => {
        if (!rawText.trim()) return;
        setIsMagicLoading(true);
        try {
            const parsedArray = await geminiProxy.magicImportBulk(rawText);
            if (parsedArray.length === 1) {
                setRecipeForm(prev => ({ ...prev, ...parsedArray[0] }));
                setRawText('');
                toast('Magic import successful!', 'success');
            } else if (parsedArray.length > 1) {
                setStagedMagicImports(parsedArray as Partial<Recipe>[]);
                setRawText('');
                toast(`Parsed ${parsedArray.length} recipes. Review them below.`, 'success');
            } else {
                 toast('No valid formats found in text.', 'error');
            }
        } catch (e: any) {
            console.error(e);
            handleAIError(e, 'AI Analysis failed: ${message}');
        } finally { setIsMagicLoading(false); }
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
            handleAIError(e, 'Failed to generate image: ${message}.');
        } finally { setIsGeneratingImage(false); }
    };

    const handleQuickSource = async (recipe: Recipe) => {
        setIsGeneratingImage(true);
        try {
            const { imageBase64, mimeType, imageSource } = await geminiProxy.generateImage(recipe);
            const file = base64ToFile(imageBase64, `recipe-${Date.now()}.${getFileExtension(mimeType)}`, mimeType);
            await onAddRecipe({ ...recipe, imageSource }, file);
        } catch (e: any) {
            console.error(e);
            handleAIError(e, 'Quick generation failed: ${message}.');
        } finally { setIsGeneratingImage(false); }
    };

    const handleBulkVisualSourcing = async (forceRefresh: boolean = false) => {
        const targetRecipes = forceRefresh
            ? recipes
            : recipes.filter(r => {
                const isPlaceholder = Object.values(CATEGORY_IMAGES).includes(r.image);
                const isPollinations = r.image?.includes('pollinations.ai');
                const isMissing = !r.image || r.image.includes('fallback-gradient') || r.image.includes('source.unsplash.com');
                return isPlaceholder || isPollinations || isMissing;
            });

        if (targetRecipes.length === 0) {
            toast('No recipes to update!', 'info');
            return;
        }

        const msg = forceRefresh ? `Regenerate all ${targetRecipes.length} images to queue?` : `Generate Nano Banana photos for ${targetRecipes.length} missing recipes?`;
        const ok = await confirm(msg, { title: 'Bulk Image Staging', confirmLabel: 'Generate to Queue' });
        if (!ok) return;

        setIsBulkSourcing(true);
        setBulkProgress({ current: 0, total: targetRecipes.length });

        let successCount = 0;
        let failCount = 0;
        const newStaged: StagedImage[] = [];

        for (let i = 0; i < targetRecipes.length; i++) {
            const recipe = targetRecipes[i];
            try {
                const { imageBase64, mimeType } = await geminiProxy.generateImage(recipe);
                const file = base64ToFile(imageBase64, `recipe-${Date.now()}.${getFileExtension(mimeType)}`, mimeType);
                const previewUrl = URL.createObjectURL(file);
                
                newStaged.push({ recipe, file, previewUrl });
                successCount++;
            } catch (e) {
                console.error(`Failed to stage image for "${recipe.title}":`, e);
                failCount++;
                if (isQuotaError(e)) {
                    toast(`AI quota exhausted during bulk generation. Queued ${successCount}.`, 'error');
                    break;
                }
            }
            setBulkProgress({ current: i + 1, total: targetRecipes.length });
            if (i < targetRecipes.length - 1) await new Promise(r => setTimeout(r, 2000));
        }

        setIsBulkSourcing(false);
        if (newStaged.length > 0) {
            setStagedImages(prev => [...prev, ...newStaged]);
            toast(failCount > 0 ? `Staged ${successCount} images. ${failCount} failed.` : `Successfully staged ${successCount} images.`, 'success');
        } else if (failCount > 0) {
            toast(`Failed to stage any images.`, 'error');
        }
    };

    const approveAllStagedImages = async () => {
        setIsSubmitting(true);
        try {
            for (const item of stagedImages) {
                await onAddRecipe({ ...item.recipe, imageSource: 'nano-banana' }, item.file);
            }
            toast(`Approved and saved ${stagedImages.length} images to the archive.`, 'success');
            stagedImages.forEach(s => URL.revokeObjectURL(s.previewUrl));
            setStagedImages([]);
        } finally {
            setIsSubmitting(false);
        }
    };

    const discardStagedImages = () => {
        stagedImages.forEach(s => URL.revokeObjectURL(s.previewUrl));
        setStagedImages([]);
        toast('Queue discarded.', 'info');
    };

    const commitAllStagedMagicImports = async () => {
        setIsSubmitting(true);
        try {
            for (const r of stagedMagicImports) {
                 await onAddRecipe({
                    ...r as Recipe,
                    id: r.id || 'r' + Date.now() + Math.random().toString(36).slice(2, 6),
                    contributor: r.contributor || currentUser?.name || 'Family',
                    image: r.image || CATEGORY_IMAGES[r.category || 'Main'] || CATEGORY_IMAGES.Generic,
                    ingredients: r.ingredients?.filter(Boolean) || [],
                    instructions: r.instructions?.filter(Boolean) || []
                 });
            }
            toast(`Committed ${stagedMagicImports.length} recipes to archive.`, 'success');
            setStagedMagicImports([]);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRecipeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!recipeForm.title?.trim()) return toast('Recipe title required.', 'error');
        if (!recipeForm.ingredients?.filter(Boolean).length || !recipeForm.instructions?.filter(Boolean).length) {
            return toast('Ingredients and instructions required.', 'error');
        }
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            const isUpdate = !!editingRecipe;
            const source = recipeFile ? (imageSourceForCurrent || 'upload') : recipeForm.imageSource;
            await onAddRecipe({
                ...recipeForm as Recipe,
                id: recipeForm.id || 'r' + Date.now(),
                contributor: recipeForm.contributor || currentUser?.name || 'Family',
                image: recipeForm.image || CATEGORY_IMAGES[recipeForm.category || 'Main'] || CATEGORY_IMAGES.Generic,
                imageSource: source || undefined,
                ingredients: recipeForm.ingredients.filter(Boolean),
                instructions: recipeForm.instructions.filter(Boolean)
            }, recipeFile || undefined);

            setSuccessMessage(isUpdate ? `✓ "${recipeForm.title}" updated!` : `✓ "${recipeForm.title}" added to archive!`);
            toast(isUpdate ? 'Recipe updated' : 'Recipe saved', 'success');
            setTimeout(() => setSuccessMessage(''), 4000);

            // Clear draft forms upon success
            setRecipeForm({ title: '', category: 'Main', ingredients: [], instructions: [], notes: '', contributor: '' });
            setRawText('');
            localStorage.removeItem('sc_recipe_draft_form');
            localStorage.removeItem('sc_recipe_draft_text');

            setRecipeFile(null);
            setImageSourceForCurrent(null);
            setPreviewUrl(null);
            if (editingRecipe) clearEditing();
        } finally { setIsSubmitting(false); }
    };

    const isStagingActive = stagedImages.length > 0 || stagedMagicImports.length > 0;

    return (
        <section id="admin-panel-records" role="tabpanel" aria-labelledby="admin-tab-records" className="bg-white/70 backdrop-blur-xl rounded-[2rem] md:rounded-[3rem] p-6 md:p-12 border border-stone-200/50 shadow-[0_20px_40px_rgba(45,70,53,0.08)] overflow-hidden relative animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-3xl font-serif italic text-[#2D4635] mb-10 flex items-center justify-between">
                <div>Manage Recipes</div>
                <button
                    onClick={() => {
                        clearEditing();
                        setRecipeForm({ title: '', category: 'Main', ingredients: [], instructions: [] });
                        setRawText('');
                        localStorage.removeItem('sc_recipe_draft_form');
                        localStorage.removeItem('sc_recipe_draft_text');
                        setRecipeFile(null);
                        setPreviewUrl(null);
                    }}
                    className={`text-sm tracking-widest uppercase font-bold py-2 px-6 rounded-full transition-all ${!editingRecipe ? 'bg-[#2D4635] text-white shadow-md' : 'bg-stone-100 text-[#2D4635] hover:bg-stone-200'}`}
                >
                    + New Form
                </button>
            </h2>

            {/* AI Magic Staging View */}
            {!editingRecipe && stagedMagicImports.length > 0 && (
                <div className="space-y-6 mb-12 p-6 bg-stone-50 border border-stone-200 rounded-[2rem] shadow-sm animate-in zoom-in-95">
                    <div className="flex justify-between items-center">
                        <h3 className="text-xl font-serif italic text-[#2D4635] flex items-center gap-2">
                            <span>✨</span> Magic Draft Staging ({stagedMagicImports.length})
                        </h3>
                        <div className="flex gap-2">
                             <button onClick={() => setStagedMagicImports([])} className="text-[10px] font-black uppercase text-stone-500 hover:text-red-500 bg-white border border-stone-200 px-4 py-2 rounded-xl">Discard</button>
                             <button onClick={commitAllStagedMagicImports} disabled={isSubmitting} className="text-[10px] font-black uppercase text-white bg-[#2D4635] px-4 py-2 rounded-xl">Commit All Quick Saves</button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {stagedMagicImports.map((draft, i) => (
                             <div key={i} className="p-4 bg-white border border-stone-100 rounded-2xl shadow-sm flex flex-col justify-between">
                                 <div>
                                     <h4 className="font-bold text-[#A0522D]">{draft.title}</h4>
                                     <p className="text-xs text-stone-400 font-serif italic">{draft.category}</p>
                                     <p className="text-xs mt-2 text-stone-600 line-clamp-2">{draft.ingredients?.join(', ')}</p>
                                 </div>
                                 <button onClick={() => {
                                      setRecipeForm(prev => ({...prev, ...draft}));
                                      setStagedMagicImports(stagedMagicImports.filter((_, idx) => idx !== i));
                                 }} className="mt-4 w-full py-2 bg-stone-100 text-[10px] text-stone-600 uppercase font-black tracking-widest rounded-xl hover:bg-stone-200 transition-colors">Load to Form Editor</button>
                             </div>
                        ))}
                    </div>
                </div>
            )}

            {/* AI Image Staging View */}
            {!editingRecipe && stagedImages.length > 0 && (
                <div className="space-y-6 mb-12 p-6 bg-[#A0522D]/5 border border-[#A0522D]/20 rounded-[2rem] shadow-sm animate-in zoom-in-95">
                    <div className="flex justify-between items-center">
                        <h3 className="text-xl font-serif italic text-[#A0522D] flex items-center gap-2">
                            <span>🖼️</span> Queue Generated Assets ({stagedImages.length})
                        </h3>
                        <div className="flex gap-2">
                             <button onClick={discardStagedImages} className="text-[10px] font-black uppercase text-stone-500 hover:text-red-500 bg-white border border-stone-200 px-4 py-2 rounded-xl">Discard</button>
                             <button onClick={approveAllStagedImages} disabled={isSubmitting} className="text-[10px] font-black uppercase text-white bg-[#A0522D] shadow-sm px-4 py-2 rounded-xl hover:bg-[#8B4513]">Approve All to Archive</button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-h-96 overflow-y-auto no-scrollbar p-1">
                        {stagedImages.map(item => (
                             <div key={item.recipe.id} className="bg-white border border-stone-100 rounded-2xl shadow-sm overflow-hidden group">
                                 <img src={item.previewUrl} className="w-full h-32 object-cover" />
                                 <div className="p-3">
                                     <h4 className="text-[10px] font-bold text-[#2D4635] truncate">{item.recipe.title}</h4>
                                     <div className="mt-2 flex gap-1">
                                         <button onClick={() => setStagedImages(prev => prev.filter(x => x.recipe.id !== item.recipe.id))} className="w-full py-1 bg-red-50 text-[9px] text-red-600 font-bold uppercase rounded hover:bg-red-100">Reject</button>
                                     </div>
                                 </div>
                             </div>
                        ))}
                    </div>
                </div>
            )}

            {/* List View */}
            {!editingRecipe && !isStagingActive && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="relative">
                        <label htmlFor="admin-search-recipes" className="sr-only">Search recipes</label>
                        <input id="admin-search-recipes" placeholder="Search archive (e.g. Grandma's, Pie...)" className="w-full p-4 bg-white/80 border border-stone-200/80 rounded-2xl text-base outline-none focus:ring-2 focus:ring-[#2D4635]/20 focus:bg-white pl-12 transition-all shadow-sm" value={recipeSearch} onChange={e => setRecipeSearch(e.target.value)} />
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" aria-hidden="true">🔍</span>
                    </div>

                    <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar bg-stone-50/50 rounded-3xl p-4 border border-stone-200/50 backdrop-blur-sm shadow-inner" onScroll={handleScroll}>
                        {filteredRecipes.length === 0 ? (
                            <div className="p-8 text-center text-stone-400 font-serif italic">Archive empty or no match.</div>
                        ) : (
                            filteredRecipes.slice(0, visibleCount).map((r, index) => (
                                <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white/90 rounded-2xl border border-stone-100 hover:border-[#2D4635]/30 hover:shadow-md transition-all gap-4 group animate-in slide-in-from-bottom-2" style={{ animationDelay: `${(index % 20) * 30}ms` }}>
                                    <div className="flex items-center gap-4 flex-1 truncate">
                                        <div className="w-12 h-12 rounded-xl border border-stone-100 overflow-hidden shrink-0 group-hover:scale-105 transition-transform bg-stone-50">
                                            <img src={r.image || CATEGORY_IMAGES[r.category] || CATEGORY_IMAGES.Generic} className="w-full h-full object-cover" alt="" />
                                        </div>
                                        <div className="truncate flex-1">
                                            <div className="font-bold text-[#2D4635] truncate text-base group-hover:text-[#A0522D] transition-colors">{r.title}</div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-[#A0522D] bg-[#A0522D]/5 px-2 py-0.5 rounded-full">{r.category}</span>
                                                <span className="text-[9px] uppercase tracking-widest text-stone-400 truncate">By {r.contributor}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-end gap-2 shrink-0 border-t sm:border-t-0 border-stone-50 pt-3 sm:pt-0">
                                        <button onClick={() => onEditRecipe(r)} className="px-5 py-2.5 bg-stone-100 text-[#2D4635] hover:bg-[#2D4635] hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Edit</button>
                                        <button
                                            onClick={async () => {
                                                if (await confirm(`Delete "${r.title}"?`, { variant: 'danger', confirmLabel: 'Delete', title: 'Delete Recipe' })) {
                                                    onDeleteRecipe(r.id);
                                                    toast('Recipe deleted', 'success');
                                                }
                                            }}
                                            className="min-w-[40px] h-[40px] flex items-center justify-center text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
                                            aria-label={`Delete ${r.title}`}
                                        >✕</button>
                                        <details className="relative">
                                            <summary className="cursor-pointer select-none list-none text-xl min-w-[40px] h-[40px] flex items-center justify-center text-stone-400 hover:text-[#2D4635] hover:bg-stone-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D4635]/20">&hellip;</summary>
                                            <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-stone-200 rounded-2xl shadow-xl z-20 overflow-hidden text-left p-1 animate-in slide-in-from-top-2">
                                                <button onClick={() => handleQuickSource(r)} disabled={isGeneratingImage || isAICooldownActive} className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#A0522D] hover:bg-[#A0522D]/5 flex justify-between items-center rounded-xl transition-colors">
                                                    <span>✨ AI Source Photo</span>
                                                </button>
                                                <button onClick={() => useDefaultImageForRecipe(r)} disabled={isGeneratingImage} className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-stone-600 hover:bg-stone-50 flex justify-between items-center rounded-xl transition-colors">
                                                    <span>🖼️ Auto Default Image</span>
                                                </button>
                                            </div>
                                        </details>
                                    </div>
                                </div>
                            ))
                        )}
                        {visibleCount < filteredRecipes.length && (
                             <div className="p-4 text-center text-stone-400 text-[10px] font-black uppercase tracking-widest">Scroll for more ({visibleCount} of {filteredRecipes.length})</div>
                        )}
                    </div>
                </div>
            )}

            {successMessage && (
                <div className="p-4 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-100 text-sm font-bold flex items-center justify-between my-8 animate-in slide-in-from-top-4">
                    <span>{successMessage}</span>
                    <button onClick={() => setSuccessMessage('')} className="text-emerald-600 hover:text-emerald-900">✕</button>
                </div>
            )}

            {!editingRecipe && managedRecipes.length > 0 && !isStagingActive && (
                <div className="mt-6 mb-8 p-5 bg-[#A0522D]/5 border border-[#A0522D]/20 rounded-[2rem] flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-left">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-[#A0522D] flex items-center gap-2"><span>✨</span> Bulk Visual Management</h4>
                        <p className="text-[10px] text-stone-600 font-serif italic mt-1">Generate AI ingredients photos for missing recipes.</p>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <button onClick={() => handleBulkVisualSourcing(false)} disabled={isBulkSourcing || isAICooldownActive} className="flex-1 min-w-[140px] py-4 bg-[#A0522D]/10 text-[#A0522D] rounded-full text-[10px] font-black uppercase tracking-widest border border-[#A0522D]/20 shadow-sm disabled:opacity-50 hover:bg-[#A0522D]/20 transition-colors">
                            {isBulkSourcing ? `Imagen Queue (${bulkProgress.current}/${bulkProgress.total})` : '🖼️ Stage Missing'}
                        </button>
                        <button onClick={() => handleBulkVisualSourcing(true)} disabled={isBulkSourcing || isAICooldownActive} className="flex-1 min-w-[140px] py-4 bg-red-50 text-red-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-red-200 shadow-sm disabled:opacity-50 hover:bg-red-100 transition-colors">
                            {isBulkSourcing ? `Generating...` : '🔄 Regen All (AI)'}
                        </button>
                    </div>
                </div>
            )}

            {!editingRecipe && !isStagingActive && (
                <div className="mb-10 p-6 bg-[#2D4635]/5 backdrop-blur-sm border border-[#2D4635]/10 rounded-[2rem] shadow-sm animate-in slide-in-from-bottom-6">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-[#2D4635] mb-2 flex items-center gap-2"><span>✨</span> Magic Scanner</h4>
                    <p className="text-xs text-stone-600 font-serif italic mb-4">Paste unformatted text containing single or MULTIPLE recipes.</p>
                    <textarea
                         className="w-full h-32 p-4 border border-stone-200/60 bg-white/80 rounded-2xl text-base outline-none focus:ring-2 focus:ring-[#2D4635]/20 font-serif transition-colors"
                         placeholder="Paste your unformatted recipe(s) text here..."
                         value={rawText}
                         onChange={(e) => setRawText(e.target.value)}
                    />
                    <button
                        onClick={handleMagicImport}
                        disabled={!rawText.trim() || isMagicLoading || isAICooldownActive}
                        className="mt-3 w-full py-4 bg-[#2D4635] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#1e2f23]"
                    >
                        {isMagicLoading ? 'Analyzing Extracting Queue...' : 'Parse with AI'}
                    </button>
                </div>
            )}

            {editingRecipe && (
                <div className="flex items-center gap-4 mb-6 bg-stone-50 p-4 rounded-2xl border border-stone-200 shadow-sm animate-in fade-in">
                    <button onClick={clearEditing} className="w-10 h-10 flex items-center justify-center rounded-full bg-white text-[#2D4635] border border-stone-200 hover:bg-stone-100 shadow-sm">&larr;</button>
                    <div className="font-serif italic text-xl text-[#2D4635] font-bold">Editing: {editingRecipe.title || 'Untitled'}</div>
                </div>
            )}

            <form onSubmit={handleRecipeSubmit} className={`space-y-6 ${editingRecipe ? 'animate-in fade-in' : ''}`}>
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2">Archival Image</label>
                    {previewUrl ? (
                        <div className="relative w-full h-56 md:h-64 rounded-[2rem] overflow-hidden mb-4 border border-stone-200/50 shadow-inner group">
                            <img src={previewUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="Preview" onError={(e) => {(e.target as HTMLImageElement).src = CATEGORY_IMAGES[recipeForm.category || 'Main'] || CATEGORY_IMAGES.Generic;}} />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                                <p className="text-[10px] font-black uppercase tracking-widest text-white tracking-[0.2em]">Current Heritage Photo</p>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full h-48 rounded-[2rem] mb-4 border border-dashed border-stone-200 bg-white/50 flex flex-col items-center justify-center gap-2">
                            <span className="text-3xl text-stone-300">📷</span>
                            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Recipe image to be added</p>
                        </div>
                    )}
                    <div className="relative group">
                        <label className="block cursor-pointer">
                            <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0] || null; setRecipeFile(f); setImageSourceForCurrent(f ? 'upload' : null); }} className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full" />
                            <div className="w-full p-4 border-2 border-dashed border-stone-200/80 rounded-3xl flex items-center justify-center gap-3 text-stone-500 group-hover:border-[#2D4635] group-hover:text-[#2D4635] group-hover:bg-[#2D4635]/5 transition-all bg-white/70">
                                <span className="text-xl">📁</span>
                                <span className="text-[10px] font-black uppercase tracking-widest">{recipeFile ? recipeFile.name : editingRecipe ? 'Change Heritage Photo' : 'Upload Heritage Photo'}</span>
                            </div>
                        </label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                        <button type="button" onClick={handleVisualSourcing} disabled={isGeneratingImage || !recipeForm.title || isAICooldownActive} className="w-full py-3.5 bg-[#A0522D]/10 text-[#A0522D] rounded-2xl text-[10px] font-black uppercase tracking-widest border border-[#A0522D]/20 hover:bg-[#A0522D]/20 transition-all disabled:opacity-50">
                            {isAICooldownActive ? `Cooldown ${formatCooldown(aiCooldownSecondsLeft)}` : isGeneratingImage ? 'Generating...' : '✨ Gen Photo (AI)'}
                        </button>
                        <button type="button" onClick={useDefaultImageForForm} className="w-full py-3.5 bg-white/80 text-stone-700 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-stone-200/80 hover:bg-stone-50 transition-all shadow-sm">
                            🖼️ Use Default Pattern
                        </button>
                    </div>
                </div>

                <div className="pt-8 mt-8 border-t border-stone-200/50 space-y-6">
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2 block mb-1">Recipe Title</label>
                        <input placeholder="Recipe Title" className="w-full p-4 border border-stone-200/60 bg-white/80 rounded-2xl text-base outline-none focus:bg-white focus:ring-2 focus:ring-[#2D4635]/20 font-serif font-bold text-[#2D4635] transition-colors" value={recipeForm.title} onChange={e => setRecipeForm({ ...recipeForm, title: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2">Contributed By</label>
                        <select className="w-full p-4 border border-stone-200/60 bg-white/80 rounded-2xl text-base focus:bg-white focus:ring-2 focus:ring-[#2D4635]/20 transition-colors" value={recipeForm.contributor || currentUser?.name || ''} onChange={e => setRecipeForm({ ...recipeForm, contributor: e.target.value })}>
                            <option value={currentUser?.name || 'Me'}>{currentUser?.name || 'Me'} (you)</option>
                            {contributors.filter(c => c.name !== currentUser?.name).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2 block mb-1">Category</label>
                            <select className="p-4 border border-stone-200/60 bg-white/80 rounded-2xl text-base focus:bg-white focus:ring-2 focus:ring-[#2D4635]/20 w-full transition-colors" value={recipeForm.category} onChange={e => setRecipeForm({ ...recipeForm, category: e.target.value as any })}>
                                {['Breakfast', 'Main', 'Dessert', 'Side', 'Appetizer', 'Bread', 'Dip/Sauce', 'Snack'].map(c => <option key={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2 block mb-1">Prep</label>
                            <input placeholder="e.g. 15 min" className="p-4 border border-stone-200/60 bg-white/80 rounded-2xl text-base focus:bg-white focus:ring-2 focus:ring-[#2D4635]/20 w-full transition-colors" value={recipeForm.prepTime || ''} onChange={e => setRecipeForm({ ...recipeForm, prepTime: e.target.value })} />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2 block mb-1">Cook</label>
                            <input placeholder="e.g. 30 min" className="p-4 border border-stone-200/60 bg-white/80 rounded-2xl text-base focus:bg-white focus:ring-2 focus:ring-[#2D4635]/20 w-full transition-colors" value={recipeForm.cookTime || ''} onChange={e => setRecipeForm({ ...recipeForm, cookTime: e.target.value })} />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2 block mb-1">Calories</label>
                            <input type="number" placeholder="Est. Cal" className="p-4 border border-stone-200/60 bg-white/80 rounded-2xl text-base focus:bg-white focus:ring-2 focus:ring-[#2D4635]/20 w-full transition-colors" value={recipeForm.calories || ''} onChange={e => setRecipeForm({ ...recipeForm, calories: parseInt(e.target.value) || 0 })} />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2 block mb-1">Ingredients (one per line)</label>
                        <textarea placeholder="Ingredients (one per line)" className="w-full h-40 p-4 border border-stone-200/60 bg-white/80 rounded-2xl text-base focus:bg-white focus:ring-2 focus:ring-[#2D4635]/20 transition-colors" value={recipeForm.ingredients?.join('\n')} onChange={e => setRecipeForm({ ...recipeForm, ingredients: e.target.value.split('\n') })} required />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2 block mb-1">Instructions (one per line)</label>
                        <textarea placeholder="Instructions (one per line)" className="w-full h-48 p-4 border border-stone-200/60 bg-white/80 rounded-2xl text-base focus:bg-white focus:ring-2 focus:ring-[#2D4635]/20 transition-colors" value={recipeForm.instructions?.join('\n')} onChange={e => setRecipeForm({ ...recipeForm, instructions: e.target.value.split('\n') })} required />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2">Heirloom Notes (optional)</label>
                        <textarea placeholder="Add any special memories, tips, or history about this recipe..." className="w-full h-24 p-4 border border-[#2D4635]/20 bg-[#2D4635]/5 rounded-2xl text-base focus:bg-[#2D4635]/5 focus:ring-2 focus:ring-[#2D4635]/30 italic transition-colors" value={recipeForm.notes || ''} onChange={e => setRecipeForm({ ...recipeForm, notes: e.target.value })} />
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-stone-200/50">
                    <button type="submit" disabled={isSubmitting} className="flex-1 py-4 bg-[#2D4635] text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-[#1e2f23] transition-all disabled:opacity-70 disabled:cursor-not-allowed">
                        {isSubmitting ? 'Saving...' : editingRecipe ? 'Update Record' : 'Commit to Archive'}
                    </button>
                    {editingRecipe && <button type="button" onClick={clearEditing} disabled={isSubmitting} className="flex-1 py-4 bg-white border border-stone-200/80 hover:bg-stone-50 rounded-full text-[10px] font-black uppercase text-stone-500 transition-colors disabled:opacity-70">Cancel Edit</button>}
                </div>
            </form>
        </section>
    );
};
