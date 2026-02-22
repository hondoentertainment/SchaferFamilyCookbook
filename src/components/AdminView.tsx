import React, { useState, useEffect } from 'react';
import { Recipe, GalleryItem, Trivia, UserProfile, DBStats, ContributorProfile } from '../types';
import * as geminiProxy from '../services/geminiProxy';
import { CATEGORY_IMAGES } from '../constants';
import { AvatarPicker } from './AvatarPicker';
import { useUI } from '../context/UIContext';

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
    defaultRecipeIds?: string[];
}

export const AdminView: React.FC<AdminViewProps> = (props) => {
    const { toast, confirm } = useUI();
    const AI_COOLDOWN_MS = 5 * 60 * 1000;
    const { editingRecipe, clearEditing, recipes, trivia, contributors, currentUser, dbStats, onAddRecipe, onAddGallery, onAddTrivia, onDeleteTrivia, onDeleteRecipe, onUpdateContributor, onUpdateArchivePhone, onEditRecipe, defaultRecipeIds = [] } = props;
    const [recipeForm, setRecipeForm] = useState<Partial<Recipe>>({ title: '', category: 'Main', ingredients: [], instructions: [] });
    const [galleryForm, setGalleryForm] = useState<Partial<GalleryItem>>({ caption: '' });
    const [triviaForm, setTriviaForm] = useState<Partial<Trivia>>({ question: '', options: ['', '', '', ''], answer: '' });
    const [recipeFile, setRecipeFile] = useState<File | null>(null);
    const [imageSourceForCurrent, setImageSourceForCurrent] = useState<'upload' | 'imagen' | null>(null);
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
    const [bulkFiles, setBulkFiles] = useState<FileList | null>(null);
    const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; errors: string[] }>({ current: 0, total: 0, errors: [] });
    const [aiCooldownUntil, setAiCooldownUntil] = useState<number>(0);
    const [aiCooldownSecondsLeft, setAiCooldownSecondsLeft] = useState(0);

    // Hide seed/default recipes in Admin record management.
    const managedRecipes = recipes.filter(r => !defaultRecipeIds.includes(r.id));

    // Filter admin-managed recipes based on search
    const filteredRecipes = managedRecipes.filter(r =>
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
            return 'AI quota is currently exhausted. Quick generation is temporarily unavailable. Please try again later, add a manual photo, or upgrade Gemini API billing limits.';
        }
        if (msg.includes('500') || msg.includes('not configured')) return 'AI features are not available. Make sure GEMINI_API_KEY is set on the server (Vercel). Try uploading a photo manually instead.';
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
        if (isQuotaError(err)) {
            setAiCooldownUntil(Date.now() + AI_COOLDOWN_MS);
        }
        toast(getAIErrorMessage(err, fallback), 'error');
    };

    const getDefaultImageForCategory = (category?: string) =>
        CATEGORY_IMAGES[category || 'Main'] || CATEGORY_IMAGES.Generic;

    const useDefaultImageForForm = () => {
        const defaultImage = getDefaultImageForCategory(recipeForm.category);
        setRecipeFile(null);
        setPreviewUrl(defaultImage);
        setRecipeForm(prev => ({ ...prev, image: defaultImage }));
    };

    const useDefaultImageForRecipe = async (recipe: Recipe) => {
        const defaultImage = getDefaultImageForCategory(recipe.category);
        await onAddRecipe({ ...recipe, image: defaultImage });
        setSuccessMessage(`✓ "${recipe.title}" now uses the default ${recipe.category} image.`);
        setTimeout(() => setSuccessMessage(''), 4000);
    };

    const isAICooldownActive = aiCooldownSecondsLeft > 0;

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

    const handleMagicImport = async () => {
        if (!rawText.trim()) return;
        setIsMagicLoading(true);
        try {
            const parsed = await geminiProxy.magicImport(rawText);
            setRecipeForm(prev => ({ ...prev, ...parsed }));
            setRawText('');
            toast('Magic import successful!', 'success');
        } catch (e: any) {
            console.error(e);
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
        } catch (e: any) {
            console.error(e);
            handleAIError(e, 'Failed to generate image: ${message}. Try uploading a heritage photo instead.');
        } finally { setIsGeneratingImage(false); }
    };

    const handleQuickSource = async (recipe: Recipe) => {
        setIsGeneratingImage(true);
        try {
            const imageBase64 = await geminiProxy.generateImage(recipe);
            const file = base64ToFile(imageBase64, `recipe-${Date.now()}.png`);
            await onAddRecipe({ ...recipe, imageSource: 'imagen' }, file);
        } catch (e: any) {
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

        if (targetRecipes.length === 0) {
            toast('No recipes to update!', 'info');
            return;
        }

        const message = forceRefresh
            ? `This will generate Imagen photos for ALL ${targetRecipes.length} recipes using their ingredients. This may take several minutes. Continue?`
            : `Found ${targetRecipes.length} recipes needing photos. Generate Imagen images from ingredients? This may take several minutes.`;

        const ok = await confirm(message, { title: 'Bulk Image Generation', confirmLabel: 'Continue' });
        if (!ok) return;

        setIsBulkSourcing(true);
        setBulkProgress({ current: 0, total: targetRecipes.length });

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < targetRecipes.length; i++) {
            const recipe = targetRecipes[i];
            try {
                const imageBase64 = await geminiProxy.generateImage(recipe);
                const file = base64ToFile(imageBase64, `recipe-${Date.now()}.png`);
                await onAddRecipe({ ...recipe, imageSource: 'imagen' }, file);
                successCount++;
            } catch (e) {
                console.error(`Failed to generate image for "${recipe.title}":`, e);
                failCount++;
                if (failCount === 1) {
                    const friendly = getAIErrorMessage(e, '${message}');
                    if (friendly.includes('GEMINI_API_KEY')) {
                        toast(friendly, 'error');
                        break;
                    }
                }
            }
            setBulkProgress({ current: i + 1, total: targetRecipes.length });
            if (i < targetRecipes.length - 1) await new Promise(r => setTimeout(r, 2000));
        }

        setIsBulkSourcing(false);
        if (failCount > 0) {
            toast(`Bulk sourcing complete: ${successCount} succeeded, ${failCount} failed. Failed recipes kept their existing images.`, 'error');
        } else {
            toast(`Bulk sourcing complete! All ${successCount} recipes now have Imagen-generated photos.`, 'success');
        }
    };
    const handleRecipeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!recipeForm.title || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const isUpdate = !!editingRecipe;
            const imageSource = recipeFile ? (imageSourceForCurrent || 'upload') : recipeForm.imageSource;
            await onAddRecipe({
                ...recipeForm as Recipe,
                id: recipeForm.id || 'r' + Date.now(),
                contributor: recipeForm.contributor || currentUser?.name || 'Family',
                image: recipeForm.image || CATEGORY_IMAGES[recipeForm.category || 'Main'] || CATEGORY_IMAGES.Generic,
                imageSource: imageSource || undefined
            }, recipeFile || undefined);

            // Show success feedback
            setSuccessMessage(isUpdate ? `✓ "${recipeForm.title}" updated successfully!` : `✓ "${recipeForm.title}" added to archive!`);
            setTimeout(() => setSuccessMessage(''), 4000);

            setRecipeForm({ title: '', category: 'Main', ingredients: [], instructions: [], notes: '', contributor: '' });
            setRecipeFile(null);
            setImageSourceForCurrent(null);
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

    const handleBulkGalleryUpload = async () => {
        if (!bulkFiles || bulkFiles.length === 0) return;

        const files: File[] = (Array.from(bulkFiles) as File[]).filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'));
        if (files.length === 0) {
            toast('No valid image or video files selected.', 'error');
            return;
        }

        const ok = await confirm(`Upload ${files.length} files to the gallery?`, { title: 'Bulk Upload', confirmLabel: 'Upload' });
        if (!ok) return;

        setIsSubmitting(true);
        setUploadProgress({ current: 0, total: files.length, errors: [] });

        let successCount = 0;
        const errors: string[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                const isVideo = file.type.startsWith('video/');
                const baseName = file.name.replace(/\.[^/.]+$/, '');
                await onAddGallery({
                    id: 'g' + Date.now() + '_' + i,
                    type: isVideo ? 'video' : 'image',
                    url: '',
                    caption: galleryForm.caption || baseName || 'Family Memory',
                    contributor: currentUser?.name || 'Family'
                }, file as File);
                successCount++;
            } catch (e: any) {
                errors.push(`${file.name}: ${e.message}`);
            }

            setUploadProgress({ current: i + 1, total: files.length, errors });
        }

        setIsSubmitting(false);
        setBulkFiles(null);

        if (errors.length > 0) {
            toast(`Upload complete: ${successCount} succeeded, ${errors.length} failed. ${errors.slice(0, 2).join('; ')}${errors.length > 2 ? '…' : ''}`, 'error');
        } else {
            toast(`Successfully uploaded ${successCount} files to the gallery!`, 'success');
        }
    };

    // Reset bulk upload progress after completion so user can upload again
    useEffect(() => {
        if (!isSubmitting && uploadProgress.total > 0 && uploadProgress.current >= uploadProgress.total) {
            const t = setTimeout(() => setUploadProgress({ current: 0, total: 0, errors: [] }), 3000);
            return () => clearTimeout(t);
        }
    }, [isSubmitting, uploadProgress.current, uploadProgress.total]);

    const handleMergeContributors = async () => {
        if (!mergeFrom.trim() || !mergeTo.trim()) { toast('Please enter both contributor names.', 'error'); return; }
        if (mergeFrom.trim().toLowerCase() === mergeTo.trim().toLowerCase()) { toast('Cannot merge a contributor into themselves.', 'error'); return; }

        const fromName = mergeFrom.trim();
        const toName = mergeTo.trim();

        const recipesToUpdate = recipes.filter(r => r.contributor === fromName);
        if (recipesToUpdate.length === 0) {
            toast(`No recipes found for "${fromName}".`, 'error');
            return;
        }

        const ok = await confirm(`Merge ${recipesToUpdate.length} recipes from "${fromName}" into "${toName}"?`, { title: 'Merge Contributors', confirmLabel: 'Merge' });
        if (!ok) return;

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
            toast(`Successfully merged ${recipesToUpdate.length} recipes from "${fromName}" to "${toName}"!`, 'success');
        } catch (e: any) {
            toast(`Merge failed: ${e.message}`, 'error');
        } finally {
            setIsMerging(false);
        }
    };




    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="max-w-7xl mx-auto px-6 py-12 space-y-12">
                {isAICooldownActive && (
                    <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50 text-amber-800 text-xs font-bold uppercase tracking-widest">
                        AI generation is cooling down due to quota limits. Try again in {formatCooldown(aiCooldownSecondsLeft)} or use default/manual images.
                    </div>
                )}
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
                                        <label htmlFor="admin-promote-name" className="sr-only">Enter name to promote</label>
                                        <input id="admin-promote-name" type="text" placeholder="Enter name (e.g. Aunt Mary)" className="flex-1 px-6 py-4 bg-stone-50 border border-stone-100 rounded-2xl text-sm font-serif outline-none focus:ring-2 focus:ring-[#2D4635]/10 text-base" value={newAdminName} onChange={e => setNewAdminName(e.target.value)} />
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
                                            toast(`${name} has been promoted.`, 'success');
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
                                                    <button onClick={async () => { if (await confirm(`Revoke admin access for ${admin.name}?`, { variant: 'danger', confirmLabel: 'Revoke' })) onUpdateContributor({ ...admin, role: 'user' }); }} className="w-4 h-4 rounded-full bg-stone-200 text-stone-500 flex items-center justify-center text-[8px] hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100">✕</button>
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
                                                    Manage Existing Records ({filteredRecipes.length}{recipeSearch ? ` of ${managedRecipes.length}` : ''})
                                                </h4>
                                                <div className="relative">
                                                    <label htmlFor="admin-recipe-search" className="sr-only">Search recipes</label>
                                                    <input
                                                        id="admin-recipe-search"
                                                        type="search"
                                                        placeholder="Search recipes..."
                                                        value={recipeSearch}
                                                        onChange={e => setRecipeSearch(e.target.value)}
                                                        className="pl-8 pr-4 py-2 bg-white border border-stone-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#2D4635]/20 w-48 text-base"
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
                                                                        toast(`Default image failed: ${e?.message || 'unknown error'}`, 'error');
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
                                                                    if (await confirm(`Delete "${r.title}"? This cannot be undone.`, { variant: 'danger', confirmLabel: 'Delete' })) onDeleteRecipe(r.id);
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

                                    {!editingRecipe && (
                                        <div className="space-y-4">
                                            <label htmlFor="admin-magic-import" className="sr-only">Paste raw recipe text for AI analysis</label>
                                            <textarea id="admin-magic-import" placeholder="Paste raw recipe text here..." aria-label="Paste raw recipe text for AI analysis" className="w-full h-32 p-5 border border-stone-100 rounded-3xl text-sm bg-stone-50 outline-none" value={rawText} onChange={(e) => setRawText(e.target.value)} />
                                            <div className="flex gap-4">
                                                <button onClick={handleMagicImport} disabled={isMagicLoading || isAICooldownActive} className="flex-1 py-4 bg-[#2D4635] text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-md disabled:opacity-50">
                                                    {isAICooldownActive ? `Cooldown ${formatCooldown(aiCooldownSecondsLeft)}` : isMagicLoading ? 'Analyzing...' : '✨ Organize with AI'}
                                                </button>
                                                <button onClick={() => handleBulkVisualSourcing(false)} disabled={isBulkSourcing || isAICooldownActive} className="flex-1 py-4 bg-[#A0522D]/10 text-[#A0522D] rounded-full text-[10px] font-black uppercase tracking-widest border border-[#A0522D]/20 shadow-sm disabled:opacity-50">
                                                    {isBulkSourcing ? `Imagen (${bulkProgress.current}/${bulkProgress.total})` : '🖼️ Fill Missing (Imagen)'}
                                                </button>
                                                <button onClick={() => handleBulkVisualSourcing(true)} disabled={isBulkSourcing || isAICooldownActive} className="flex-1 py-4 bg-red-50 text-red-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-red-200 shadow-sm disabled:opacity-50">
                                                    {isBulkSourcing ? `Generating...` : '🔄 Regenerate All (Imagen)'}
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
                                            <input id="admin-recipe-title" placeholder="Recipe Title" className="w-full p-4 border border-stone-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-[#2D4635]/20 text-base" value={recipeForm.title} onChange={e => setRecipeForm({ ...recipeForm, title: e.target.value })} required />
                                        </div>

                                        {/* Contributor Selection */}
                                        <div className="space-y-2">
                                            <label htmlFor="admin-recipe-contributor" className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2">Contributed By</label>
                                            <select
                                                id="admin-recipe-contributor"
                                                className="w-full p-4 border border-stone-200 rounded-2xl text-sm bg-white focus:ring-2 focus:ring-[#2D4635]/20 text-base"
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
                                                <label htmlFor="admin-recipe-category" className="sr-only">Category</label>
                                                <select id="admin-recipe-category" aria-label="Recipe category" className="p-4 border border-stone-200 rounded-2xl text-sm bg-white focus:ring-2 focus:ring-[#2D4635]/20 w-full" value={recipeForm.category} onChange={e => setRecipeForm({ ...recipeForm, category: e.target.value as any })}>
                                                    {['Breakfast', 'Main', 'Dessert', 'Side', 'Appetizer', 'Bread', 'Dip/Sauce', 'Snack'].map(c => <option key={c}>{c}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label htmlFor="admin-recipe-preptime" className="sr-only">Prep time</label>
                                                <input id="admin-recipe-preptime" placeholder="Prep Time (e.g. 15 min)" aria-label="Prep time" className="p-4 border border-stone-200 rounded-2xl text-sm focus:ring-2 focus:ring-[#2D4635]/20 w-full" value={recipeForm.prepTime || ''} onChange={e => setRecipeForm({ ...recipeForm, prepTime: e.target.value })} />
                                            </div>
                                            <div>
                                                <label htmlFor="admin-recipe-cooktime" className="sr-only">Cook time</label>
                                                <input id="admin-recipe-cooktime" placeholder="Cook Time (e.g. 30 min)" aria-label="Cook time" className="p-4 border border-stone-200 rounded-2xl text-sm focus:ring-2 focus:ring-[#2D4635]/20 w-full" value={recipeForm.cookTime || ''} onChange={e => setRecipeForm({ ...recipeForm, cookTime: e.target.value })} />
                                            </div>
                                            <div>
                                                <label htmlFor="admin-recipe-calories" className="sr-only">Estimated calories</label>
                                                <input id="admin-recipe-calories" type="number" placeholder="Est. Calories" aria-label="Estimated calories" className="p-4 border border-stone-200 rounded-2xl text-sm focus:ring-2 focus:ring-[#2D4635]/20 w-full" value={recipeForm.calories || ''} onChange={e => setRecipeForm({ ...recipeForm, calories: parseInt(e.target.value) || 0 })} />
                                            </div>
                                        </div>
                                        <div>
                                            <label htmlFor="admin-recipe-ingredients" className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2 block mb-1">Ingredients (one per line)</label>
                                            <textarea id="admin-recipe-ingredients" placeholder="Ingredients (one per line)" className="w-full h-32 p-4 border border-stone-200 rounded-2xl text-sm bg-stone-50 focus:ring-2 focus:ring-[#2D4635]/20" value={recipeForm.ingredients?.join('\n')} onChange={e => setRecipeForm({ ...recipeForm, ingredients: e.target.value.split('\n') })} required />
                                        </div>
                                        <div>
                                            <label htmlFor="admin-recipe-instructions" className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2 block mb-1">Instructions (one per line)</label>
                                            <textarea id="admin-recipe-instructions" placeholder="Instructions (one per line)" className="w-full h-48 p-4 border border-stone-200 rounded-2xl text-sm bg-stone-50 focus:ring-2 focus:ring-[#2D4635]/20" value={recipeForm.instructions?.join('\n')} onChange={e => setRecipeForm({ ...recipeForm, instructions: e.target.value.split('\n') })} required />
                                        </div>

                                        {/* Heirloom Notes */}
                                        <div className="space-y-2">
                                            <label htmlFor="admin-recipe-notes" className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2">Heirloom Notes (optional)</label>
                                            <textarea
                                                id="admin-recipe-notes"
                                                placeholder="Add any special memories, tips, or history about this recipe..."
                                                className="w-full h-24 p-4 border border-[#2D4635]/20 rounded-2xl text-sm bg-[#2D4635]/5 focus:ring-2 focus:ring-[#2D4635]/20 italic text-base"
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
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Twilio Configuration</h4>
                                        <p className="text-xs text-stone-500 mb-4">Enter your Twilio number (E.164, e.g. +15551234567) so family members can text photos and videos to the gallery. The number appears in the Gallery tab once set.</p>
                                        <div className="flex gap-4">
                                            <label htmlFor="admin-archive-phone" className="sr-only">Archive phone number (E.164)</label>
                                            <input
                                                id="admin-archive-phone"
                                                placeholder="e.g. +15551234567"
                                                className="flex-1 p-3 border border-stone-200 rounded-xl text-xs bg-white text-base"
                                                value={dbStats.archivePhone || ''}
                                                onChange={e => onUpdateArchivePhone(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <form onSubmit={handleGallerySubmit} className="space-y-4">
                                        <div className="relative group">
                                            <label htmlFor="admin-gallery-file" className="block cursor-pointer">
                                                <input id="admin-gallery-file" type="file" accept="image/*,video/*" onChange={e => setGalleryFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full" aria-label="Choose family photo or video to upload" />
                                                <div className="w-full h-32 border-2 border-dashed border-stone-200 rounded-[2rem] flex flex-col items-center justify-center gap-2 text-stone-300 group-hover:border-[#A0522D] group-hover:text-[#A0522D] transition-all">
                                                    <span className="text-3xl" aria-hidden="true">🏞️</span>
                                                    <span className="text-[9px] font-black uppercase tracking-widest">{galleryFile ? galleryFile.name : 'Choose Family Photo or Video'}</span>
                                                </div>
                                            </label>
                                        </div>
                                        <div>
                                            <label htmlFor="admin-gallery-caption" className="sr-only">Caption for gallery item</label>
                                            <input id="admin-gallery-caption" placeholder="Short caption..." aria-label="Caption for gallery item" className="w-full p-4 border border-stone-200 rounded-2xl text-sm outline-none" value={galleryForm.caption} onChange={e => setGalleryForm({ ...galleryForm, caption: e.target.value })} />
                                        </div>
                                        <button type="submit" disabled={!galleryFile || isSubmitting} className="w-full py-4 bg-[#A0522D] text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
                                            {isSubmitting ? 'Uploading...' : 'Upload Memory'}
                                        </button>
                                    </form>

                                    {/* Bulk Upload Section */}
                                    <div className="mt-8 pt-8 border-t border-stone-200">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-[#2D4635] mb-4 flex items-center gap-2">
                                            <span>📚</span> Bulk Image Upload
                                        </h4>
                                        <div className="p-6 bg-[#2D4635]/5 rounded-3xl border border-[#2D4635]/10">
                                            <div className="relative group">
                                                <label htmlFor="admin-bulk-gallery-files" className="block cursor-pointer">
                                                    <input
                                                        id="admin-bulk-gallery-files"
                                                        type="file"
                                                        accept="image/*,video/*"
                                                        multiple
                                                        onChange={e => setBulkFiles(e.target.files)}
                                                        className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full"
                                                        aria-label="Select multiple photos or videos for bulk upload"
                                                    />
                                                    <div className="w-full h-24 border-2 border-dashed border-[#2D4635]/30 rounded-[2rem] flex flex-col items-center justify-center gap-2 text-[#2D4635]/60 group-hover:border-[#2D4635] group-hover:text-[#2D4635] transition-all bg-white/50">
                                                        <span className="text-2xl" aria-hidden="true">📁</span>
                                                        <span className="text-[9px] font-black uppercase tracking-widest">
                                                            {bulkFiles && bulkFiles.length > 0
                                                                ? `${bulkFiles.length} files selected`
                                                                : 'Drag & Drop or Click to Select Multiple'}
                                                        </span>
                                                    </div>
                                                </label>
                                            </div>

                                            {bulkFiles && bulkFiles.length > 0 && (
                                                <div className="mt-4 space-y-3">
                                                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                                                        {(Array.from(bulkFiles) as File[]).slice(0, 10).map((file, idx) => (
                                                            <span key={idx} className="px-3 py-1 bg-white rounded-full text-[9px] font-medium text-stone-600 truncate max-w-[150px]">
                                                                {file.name}
                                                            </span>
                                                        ))}
                                                        {bulkFiles.length > 10 && (
                                                            <span className="px-3 py-1 bg-white/50 rounded-full text-[9px] font-medium text-stone-500">
                                                                +{bulkFiles.length - 10} more
                                                            </span>
                                                        )}
                                                    </div>

                                                    <label htmlFor="admin-bulk-gallery-caption" className="sr-only">Caption for all bulk upload files (optional)</label>
                                                    <input
                                                        id="admin-bulk-gallery-caption"
                                                        placeholder="Caption for all (optional)..."
                                                        aria-label="Caption for all bulk upload files (optional)"
                                                        className="w-full p-3 border border-stone-200 rounded-xl text-sm outline-none bg-white"
                                                        value={galleryForm.caption}
                                                        onChange={e => setGalleryForm({ ...galleryForm, caption: e.target.value })}
                                                    />

                                                    {/* Progress Display */}
                                                    {uploadProgress.total > 0 && (
                                                        <div className="space-y-2" role="status" aria-live="polite" aria-busy={uploadProgress.current < uploadProgress.total}>
                                                            <div className="flex items-center justify-between text-[10px] font-bold text-[#2D4635]">
                                                                <span>{uploadProgress.current >= uploadProgress.total ? '✓ Complete!' : 'Uploading...'}</span>
                                                                <span>{uploadProgress.current}/{uploadProgress.total}</span>
                                                            </div>
                                                            <div className="w-full h-2 bg-white rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-[#2D4635] transition-all duration-300"
                                                                    style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                                                                />
                                                            </div>
                                                            {uploadProgress.errors.length > 0 && (
                                                                <p className="text-[9px] text-red-600 font-medium">
                                                                    {uploadProgress.errors.length} file(s) failed to upload
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}

                                                    <button
                                                        onClick={handleBulkGalleryUpload}
                                                        disabled={isSubmitting || uploadProgress.total > 0}
                                                        className="w-full py-3 bg-[#2D4635] text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {isSubmitting && uploadProgress.total > 0
                                                            ? `Uploading ${uploadProgress.current}/${uploadProgress.total}...`
                                                            : `Upload ${bulkFiles.length} Files to Gallery`}
                                                    </button>

                                                    {uploadProgress.errors.length > 0 && (
                                                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                                                            <p className="text-[9px] font-bold text-red-600 uppercase tracking-widest mb-2">
                                                                {uploadProgress.errors.length} Failed:
                                                            </p>
                                                            <p className="text-[9px] text-red-500 max-h-20 overflow-y-auto">
                                                                {uploadProgress.errors.join('\\n')}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
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
                                                <span onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (!isSuperAdmin) { toast("Only Super Admins (Kyle) can modify roles.", 'error'); return; }
                                                    if (await confirm(`Revoke admin access for ${name}?`, { variant: 'danger', confirmLabel: 'Revoke' })) onUpdateContributor({ id: profile?.id || 'c_' + Date.now(), name, avatar, role: 'user' });
                                                }} className="text-[9px] uppercase tracking-widest text-orange-500 font-bold hover:text-orange-600">Admin ✓</span>
                                            ) : (
                                                <span onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (!isSuperAdmin) { toast("Only Super Admins (Kyle) can modify roles.", 'error'); return; }
                                                    if (await confirm(`Promote ${name} to Administrator?`, { confirmLabel: 'Promote' })) onUpdateContributor({ id: profile?.id || 'c_' + Date.now(), name, avatar, role: 'admin' });
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
