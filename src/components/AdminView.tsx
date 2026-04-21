import React, { useState } from 'react';
import { Recipe, GalleryItem, Trivia, UserProfile, DBStats, ContributorProfile } from '../types';
import { useUI } from '../context/UIContext';
import { AdminPermissions } from './admin/AdminPermissions';
import { AdminDirectory } from './admin/AdminDirectory';
import { AdminTrivia } from './admin/AdminTrivia';
import { AdminGallery } from './admin/AdminGallery';
import { AdminRecipes } from './admin/AdminRecipes';

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
    firebaseCustodian?: FirebaseCustodianProps;
}

export const AdminView: React.FC<AdminViewProps> = (props) => {
    const { toast } = useUI();
    const { 
        editingRecipe, clearEditing, recipes, trivia, contributors, currentUser, 
        dbStats, onAddRecipe, onAddGallery, onAddTrivia, onDeleteTrivia, 
        onDeleteRecipe, onUpdateContributor, onUpdateArchivePhone, onEditRecipe, 
        defaultRecipeIds = [], firebaseCustodian 
    } = props;

    const [activeSubtab, setActiveSubtab] = useState<'permissions' | 'records' | 'gallery' | 'trivia' | 'directory'>('records');
    const [custodianBusy, setCustodianBusy] = useState(false);

    const isSuperAdmin = currentUser?.name.toLowerCase() === 'kyle' || currentUser?.email === 'hondo4185@gmail.com';

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
                                            toast('Google sign-in failed. Check browser popup settings and Firebase Auth.', 'error');
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
                        .filter(tab => !tab.restricted || isSuperAdmin)
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
                                    const tabs = ['records', 'gallery', 'trivia', 'directory', ...(isSuperAdmin ? ['permissions'] as const : [])];
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

                {activeSubtab === 'records' && (
                    <AdminRecipes
                        recipes={recipes}
                        editingRecipe={editingRecipe}
                        onAddRecipe={onAddRecipe}
                        onDeleteRecipe={onDeleteRecipe}
                        onEditRecipe={onEditRecipe}
                        clearEditing={clearEditing}
                        defaultRecipeIds={defaultRecipeIds}
                        currentUser={currentUser}
                        contributors={contributors}
                    />
                )}

                {activeSubtab === 'gallery' && (
                    <AdminGallery
                        onAddGallery={onAddGallery}
                        dbStats={dbStats}
                        onUpdateArchivePhone={onUpdateArchivePhone}
                        currentUser={currentUser}
                    />
                )}

                {activeSubtab === 'trivia' && (
                    <AdminTrivia
                        trivia={trivia}
                        onAddTrivia={onAddTrivia}
                        onDeleteTrivia={onDeleteTrivia}
                        currentUser={currentUser}
                    />
                )}

                {activeSubtab === 'directory' && (
                    <AdminDirectory
                        contributors={contributors}
                        recipes={recipes}
                        trivia={trivia}
                        onUpdateContributor={onUpdateContributor}
                        onAddRecipe={onAddRecipe}
                        isSuperAdmin={isSuperAdmin}
                    />
                )}

                {activeSubtab === 'permissions' && isSuperAdmin && (
                    <AdminPermissions
                        contributors={contributors}
                        onUpdateContributor={onUpdateContributor}
                    />
                )}

            </div>
        </div>
    );
};
