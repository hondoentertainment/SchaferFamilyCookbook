import React, { useState, useEffect } from 'react';
import { Recipe, GalleryItem, Trivia, UserProfile, DBStats, ContributorProfile } from '../types';
import { useUI } from '../context/UIContext';
import { isSuperAdmin } from '../config/site';
import { avatarOnError } from '../utils/avatarFallback';
import { RecipeForm, TriviaForm, GalleryUploader, ContributorManager, ImageGenerator } from './admin';

/** When the app uses hosted Firebase, custodians must sign in with Google and hold custom claim admin:true to write. */
export interface FirebaseCustodianProps {
    canWrite: boolean;
    email: string | null;
    onGoogleSignIn: () => Promise<void>;
    onSignOut: () => Promise<void>;
}

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
    onDeleteTrivia: (id: string) => void | Promise<void>;
    onDeleteRecipe: (id: string) => void;
    onUpdateContributor: (c: ContributorProfile) => Promise<void>;
    onUpdateArchivePhone: (p: string) => void | Promise<void>;
    onEditRecipe: (r: Recipe) => void;
    defaultRecipeIds?: string[];
    /** Set when provider is Firebase: gate cloud writes until Google sign-in + admin claim */
    firebaseCustodian?: FirebaseCustodianProps;
}

export const AdminView: React.FC<AdminViewProps> = (props) => {
    const { toast, confirm } = useUI();
    const AI_COOLDOWN_MS = 5 * 60 * 1000;
    const { editingRecipe, clearEditing, recipes, trivia, contributors, currentUser, dbStats, onAddRecipe, onAddGallery, onAddTrivia, onDeleteTrivia, onDeleteRecipe, onUpdateContributor, onUpdateArchivePhone, onEditRecipe, defaultRecipeIds = [], firebaseCustodian } = props;

    const [activeSubtab, setActiveSubtab] = useState<'permissions' | 'records' | 'gallery' | 'trivia' | 'directory'>('records');
    const [newAdminName, setNewAdminName] = useState('');
    const [isPromotingAdmin, setIsPromotingAdmin] = useState(false);
    const [custodianBusy, setCustodianBusy] = useState(false);
    const [aiCooldownUntil, setAiCooldownUntil] = useState<number>(0);
    const [aiCooldownSecondsLeft, setAiCooldownSecondsLeft] = useState(0);
    const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });

    const isSuperAdminUser = isSuperAdmin(currentUser?.name) || isSuperAdmin(currentUser?.email);

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

    const isAICooldownActive = aiCooldownSecondsLeft > 0;

    const formatCooldown = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${String(secs).padStart(2, '0')}`;
    };

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

    const handleAIError = (err: unknown, fallback: string) => {
        if (isQuotaError(err)) {
            setAiCooldownUntil(Date.now() + AI_COOLDOWN_MS);
        }
        toast(getAIErrorMessage(err, fallback), 'error');
    };

    const handleMergeContributors = async (recipesToUpdate: Recipe[], toName: string) => {
        for (const recipe of recipesToUpdate) {
            await onAddRecipe({ ...recipe, contributor: toName });
        }
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="max-w-7xl mx-auto px-6 py-12 space-y-12">
                {firebaseCustodian && (
                    <div
                        role="region"
                        aria-label="Custodian cloud sign-in"
                        className={`rounded-[2rem] border p-6 md:p-8 ${firebaseCustodian.canWrite ? 'border-emerald-200 bg-emerald-50/80' : 'border-amber-200 bg-amber-50/90'}`}
                    >
                        {firebaseCustodian.canWrite ? (
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm text-emerald-900 font-serif">
                                    <span className="font-black uppercase tracking-widest text-[10px] text-emerald-700 block mb-1">Cloud saves enabled</span>
                                    Signed in as <span className="font-semibold">{firebaseCustodian.email || 'custodian'}</span>. Recipe, gallery, and trivia changes sync to the family Firebase project.
                                </p>
                                <button
                                    type="button"
                                    disabled={custodianBusy}
                                    onClick={async () => {
                                        setCustodianBusy(true);
                                        try {
                                            await firebaseCustodian.onSignOut();
                                            toast('Signed out of custodian account', 'info');
                                        } finally {
                                            setCustodianBusy(false);
                                        }
                                    }}
                                    className="shrink-0 px-6 py-3 rounded-full border border-emerald-300 text-emerald-900 text-[10px] font-black uppercase tracking-widest hover:bg-white/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:opacity-60"
                                >
                                    Sign out Google
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <p className="text-sm text-amber-950 font-serif leading-relaxed">
                                    <span className="font-black uppercase tracking-widest text-[10px] text-amber-800 block mb-2">Public archive · custodian sign-in required</span>
                                    The cookbook is <strong>publicly readable</strong>. Saving edits to the cloud requires signing in with Google using an account your project owner has granted the{' '}
                                    <code className="text-xs bg-white/60 px-1 rounded">admin</code> security role (custom claim). Ask your technical contact if saves are denied.
                                </p>
                                <button
                                    type="button"
                                    disabled={custodianBusy}
                                    aria-busy={custodianBusy}
                                    onClick={async () => {
                                        setCustodianBusy(true);
                                        try {
                                            await firebaseCustodian.onGoogleSignIn();
                                            toast('Signed in — if saves still fail, your account may need the admin claim.', 'success');
                                        } catch (e) {
                                            console.error(e);
                                            toast('Google sign-in failed. Check browser popup settings and Firebase Auth (Google provider + authorized domains).', 'error');
                                        } finally {
                                            setCustodianBusy(false);
                                        }
                                    }}
                                    className="px-8 py-4 bg-[#2D4635] text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-[#1e2f23] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2 disabled:opacity-60"
                                >
                                    {custodianBusy ? 'Opening Google…' : 'Sign in with Google (custodian)'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
                {isAICooldownActive && (
                    <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50 text-amber-800 text-xs font-bold uppercase tracking-widest">
                        AI generation is cooling down due to quota limits. Try again in {formatCooldown(aiCooldownSecondsLeft)} or use default/manual images.
                    </div>
                )}
                {/* Sub-navigation bar */}
                <div
                    role="tablist"
                    aria-label="Admin subtabs"
                    className="flex items-center gap-1 overflow-x-auto no-scrollbar py-2 mb-8 bg-stone-50/50 rounded-[2rem] px-2 border border-stone-100"
                >
                    {[
                        { id: 'records', label: '📖 Recipes' },
                        { id: 'gallery', label: '🖼️ Gallery' },
                        { id: 'trivia', label: '💡 Trivia' },
                        { id: 'directory', label: '👥 Directory' },
                        { id: 'permissions', label: '🔐 Admins', restricted: true },
                    ]
                        .filter(tab => !tab.restricted || isSuperAdminUser)
                        .map(tab => (
                            <button
                                key={tab.id}
                                role="tab"
                                aria-selected={activeSubtab === tab.id}
                                aria-current={activeSubtab === tab.id ? 'true' : undefined}
                                aria-controls={`admin-panel-${tab.id}`}
                                id={`admin-tab-${tab.id}`}
                                tabIndex={activeSubtab === tab.id ? 0 : -1}
                                onClick={() => setActiveSubtab(tab.id as typeof activeSubtab)}
                                onKeyDown={(e) => {
                                    const tabs = ['records', 'gallery', 'trivia', 'directory', ...(isSuperAdminUser ? ['permissions'] as const : [])];
                                    const i = tabs.indexOf(activeSubtab);
                                    if (e.key === 'ArrowRight' && i < tabs.length - 1) {
                                        e.preventDefault();
                                        setActiveSubtab(tabs[i + 1]);
                                    } else if (e.key === 'ArrowLeft' && i > 0) {
                                        e.preventDefault();
                                        setActiveSubtab(tabs[i - 1]);
                                    }
                                }}
                                className={`px-4 py-2 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap min-h-[2.75rem] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 ${activeSubtab === tab.id ? 'bg-[#2D4635] text-white shadow-lg ring-2 ring-[#2D4635] ring-offset-2 ring-offset-stone-50' : 'text-stone-400 hover:bg-white hover:text-stone-600'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                </div>

                {/* Permissions & Admin Management */}
                {activeSubtab === 'permissions' && isSuperAdminUser && (
                    <section id="admin-panel-permissions" role="tabpanel" aria-labelledby="admin-tab-permissions" className="bg-white rounded-[2rem] md:rounded-[3rem] p-6 md:p-16 border border-stone-200 shadow-xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-4">
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
                                        <input id="admin-promote-name" type="text" placeholder="Enter name (e.g. Aunt Mary)" className="flex-1 px-6 py-4 bg-stone-50 border border-stone-100 rounded-2xl text-base font-serif outline-none focus:ring-2 focus:ring-[#2D4635]/10" value={newAdminName} onChange={e => setNewAdminName(e.target.value)} />
                                        <button
                                            onClick={async () => {
                                                if (!newAdminName.trim()) return;
                                                const name = newAdminName.trim();
                                                if (isPromotingAdmin) return;
                                                setIsPromotingAdmin(true);
                                                try {
                                                    const profile = props.contributors.find(c => c.name.toLowerCase() === name.toLowerCase());
                                                    await onUpdateContributor({
                                                        id: profile?.id || 'c_' + Date.now(),
                                                        name: profile?.name || name,
                                                        avatar: profile?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
                                                        role: 'admin'
                                                    });
                                                    setNewAdminName('');
                                                    toast(`${name} has been promoted.`, 'success');
                                                } finally { setIsPromotingAdmin(false); }
                                            }}
                                            disabled={isPromotingAdmin}
                                            aria-busy={isPromotingAdmin}
                                            className="px-8 py-4 bg-[#2D4635] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
                                        >
                                            {isPromotingAdmin ? 'Saving...' : 'Grant Access'}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-[#A0522D]">Current Administrators</h4>
                                    <div className="flex flex-wrap gap-3">
                                        {props.contributors.filter(c => c.role === 'admin').map(admin => (
                                            <div key={admin.id} className="flex items-center gap-2 px-3 py-2 bg-stone-50 rounded-full border border-stone-100 group">
                                                <img src={admin.avatar} className="w-6 h-6 rounded-full border border-white object-cover" alt={admin.name} onError={avatarOnError} />
                                                <span className="text-xs font-bold text-stone-600">{admin.name}</span>
                                                {admin.name.toLowerCase() !== 'admin' && (
                                                    <button
                                                        onClick={async () => { if (await confirm(`Revoke admin access for ${admin.name}?`, { variant: 'danger', confirmLabel: 'Revoke' })) onUpdateContributor({ ...admin, role: 'user' }); }}
                                                        className="w-11 h-11 min-w-[2.75rem] min-h-[2.75rem] rounded-full bg-stone-200 text-stone-500 flex items-center justify-center text-[8px] hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                                                        aria-label={`Revoke admin access for ${admin.name}`}
                                                        title={`Revoke admin access for ${admin.name}`}
                                                    >
                                                        ✕
                                                    </button>
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
                    <div id={`admin-panel-${activeSubtab}`} role="tabpanel" aria-labelledby={`admin-tab-${activeSubtab}`} className="bg-white rounded-[2rem] md:rounded-[3rem] p-6 md:p-12 border border-stone-200 shadow-xl overflow-hidden relative animate-in fade-in slide-in-from-bottom-4">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
                            <h2 className="text-3xl font-serif italic text-[#2D4635]">
                                {activeSubtab === 'records' ? 'Manage Recipes' : activeSubtab === 'gallery' ? 'Family Archive' : 'Family Trivia'}
                            </h2>
                        </div>

                        <div className="grid grid-cols-1 gap-16">
                            {activeSubtab === 'records' && (
                                <>
                                    <RecipeForm
                                        editingRecipe={editingRecipe}
                                        clearEditing={clearEditing}
                                        recipes={recipes}
                                        contributors={contributors}
                                        currentUser={currentUser}
                                        defaultRecipeIds={defaultRecipeIds}
                                        onSave={onAddRecipe}
                                        onDelete={onDeleteRecipe}
                                        onEditRecipe={onEditRecipe}
                                        isAICooldownActive={isAICooldownActive}
                                        aiCooldownSecondsLeft={aiCooldownSecondsLeft}
                                        formatCooldown={formatCooldown}
                                        onAIError={handleAIError}
                                    />
                                    {!editingRecipe && (
                                        <ImageGenerator
                                            recipes={recipes}
                                            onGenerate={onAddRecipe}
                                            isAICooldownActive={isAICooldownActive}
                                            bulkProgress={bulkProgress}
                                            onBulkProgressChange={setBulkProgress}
                                            onAIError={handleAIError}
                                            isQuotaError={isQuotaError}
                                            getAIErrorMessage={getAIErrorMessage}
                                        />
                                    )}
                                </>
                            )}

                            {activeSubtab === 'gallery' && (
                                <GalleryUploader
                                    currentUser={currentUser}
                                    dbStats={dbStats}
                                    onUpload={onAddGallery}
                                    onUpdateArchivePhone={onUpdateArchivePhone}
                                />
                            )}

                            {activeSubtab === 'trivia' && (
                                <TriviaForm
                                    trivia={trivia}
                                    currentUser={currentUser}
                                    onSave={onAddTrivia}
                                    onDelete={onDeleteTrivia}
                                />
                            )}
                        </div>
                    </div >
                )}

                {activeSubtab === 'directory' && (
                    <ContributorManager
                        contributors={contributors}
                        recipes={recipes}
                        trivia={trivia}
                        isSuperAdmin={isSuperAdminUser}
                        onSave={onUpdateContributor}
                        onMerge={handleMergeContributors}
                    />
                )}
            </div >
        </div >
    );
};
