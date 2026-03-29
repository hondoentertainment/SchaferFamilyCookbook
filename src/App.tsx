import React, { useState, useEffect, useMemo, lazy, Suspense, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { UserProfile, Recipe, GalleryItem, Trivia, DBStats, ContributorProfile, HistoryEntry } from './types';
import { useUI } from './context/UIContext';
import { FirebaseError } from 'firebase/app';
import { CloudArchive } from './services/db';
import {
    subscribeFirebaseCustodian,
    signInCustodianWithGoogle,
    signOutFirebaseCustodian,
    type CustodianAuthState,
} from './services/firebaseCustodianAuth';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { LoginView } from './components/LoginView';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';
import { getFavoriteIds, toggleFavorite } from './utils/favorites';
import { recordRecipeView, getRecentlyViewedEntries } from './utils/recentlyViewed';
import { optimisticUpdate } from './utils/optimistic';
import { hapticLight } from './utils/haptics';
import { tabFromPath } from './router';
import { TRIVIA_SEED } from './data/trivia_seed';
import defaultRecipes from './data/recipes.json';
import {
    TabFallback,
    RecipeGridSkeleton,
    ContributorsSkeleton,
    GallerySkeleton,
    IndexSkeleton,
    HistorySkeleton,
    ProfileSkeleton,
} from './components/Skeletons';
import { OfflineBanner } from './components/OfflineBanner';

/* ---- Lazy route views ---- */
const RecipeGrid = lazy(() => import('./components/RecipeGrid').then(m => ({ default: m.RecipeGrid })));
const RecipeModal = lazy(() => import('./components/RecipeModal').then(m => ({ default: m.RecipeModal })));
const CookModeView = lazy(() => import('./components/CookModeView').then(m => ({ default: m.CookModeView })));
const AddRecipeModal = lazy(() => import('./components/AddRecipeModal').then(m => ({ default: m.AddRecipeModal })));
const AlphabeticalIndex = lazy(() => import('./components/AlphabeticalIndex').then(m => ({ default: m.AlphabeticalIndex })));
const GalleryView = lazy(() => import('./components/GalleryView').then(m => ({ default: m.GalleryView })));
const ContributorsView = lazy(() => import('./components/ContributorsView').then(m => ({ default: m.ContributorsView })));
const ProfileView = lazy(() => import('./components/ProfileView').then(m => ({ default: m.ProfileView })));
const HistoryView = lazy(() => import('./components/HistoryView').then(m => ({ default: m.HistoryView })));
const TriviaView = lazy(() => import('./components/TriviaView').then(m => ({ default: m.TriviaView })));
const PrivacyView = lazy(() => import('./components/PrivacyView').then(m => ({ default: m.PrivacyView })));

/* ---- Constants ---- */
const RECIPE_HASH_REGEX = /^#recipe\/(.+)$/;
const CLOUD_ERROR_MSG = "Couldn't save. Check your connection and try again.";

/* ================================================================== */
/*  App - data layer + router shell                                    */
/* ================================================================== */
const App: React.FC = () => {
    const { toast } = useUI();
    const navigate = useNavigate();
    const location = useLocation();
    const activeTab = tabFromPath(location.pathname);

    /* ---- core data state ---- */
    const [isDataLoading, setIsDataLoading] = useState(true);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [gallery, setGallery] = useState<GalleryItem[]>([]);
    const [trivia, setTrivia] = useState<Trivia[]>([]);
    const [contributors, setContributors] = useState<ContributorProfile[]>([]);
    const [history, setHistory] = useState<HistoryEntry[]>([]);

    /* ---- recipe modal / cook mode state ---- */
    const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
    const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
    const [cookModeRecipe, setCookModeRecipe] = useState<Recipe | null>(null);
    const [showAddRecipeModal, setShowAddRecipeModal] = useState(false);

    /* ---- user / auth ---- */
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
        const s = localStorage.getItem('schafer_user');
        if (!s) return null;
        try {
            const u = JSON.parse(s);
            if (u.name.toLowerCase() === 'kyle' || u.email === 'hondo4185@gmail.com') {
                u.role = 'admin';
            } else if (!u.role) {
                u.role = u.name.toLowerCase() === 'admin' ? 'admin' : 'user';
            }
            localStorage.setItem('schafer_user', JSON.stringify(u));
            return u;
        } catch {
            return null;
        }
    });

    const handleLogout = useCallback(() => {
        void signOutFirebaseCustodian();
        localStorage.removeItem('schafer_user');
        setCurrentUser(null);
        navigate('/');
    }, [navigate]);

    const handleLogin = useCallback((user: UserProfile) => {
        setCurrentUser(user);
    }, []);

    /* ---- db stats & archive phone ---- */
    const [dbStats, setDbStats] = useState<DBStats>({
        recipeCount: 0, galleryCount: 0, triviaCount: 0,
        isCloudActive: CloudArchive.getProvider() !== 'local',
        activeProvider: CloudArchive.getProvider(),
    });
    const [archivePhone, setArchivePhone] = useState(() => localStorage.getItem('schafer_archive_phone') || '');
    const [custodianAuth, setCustodianAuth] = useState<CustodianAuthState>({ user: null, isAdmin: false });

    /* ---- favorites ---- */
    const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => getFavoriteIds());

    const handleToggleFavorite = useCallback((id: string) => {
        const next = toggleFavorite(id);
        setFavoriteIds(next);
        hapticLight();
        const name = recipes.find(r => r.id === id)?.title ?? 'Recipe';
        toast(next.has(id) ? `Added "${name}" to favorites` : `Removed "${name}" from favorites`, next.has(id) ? 'success' : 'info');
    }, [recipes, toast]);

    /* ---- derived data ---- */
    const defaultRecipeIds = useMemo(
        () => new Set((defaultRecipes as Recipe[]).map(r => r.id)),
        [],
    );

    const getAvatar = useCallback((name: string) => {
        const c = contributors.find(p => p.name === name);
        return c?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;
    }, [contributors]);

    /* ---- data refresh ---- */
    const refreshLocalState = useCallback(async () => {
        const provider = CloudArchive.getProvider();
        if (provider === 'local') {
            try {
                const [r, t, g, c, h] = await Promise.all([
                    CloudArchive.getRecipes(),
                    CloudArchive.getTrivia(),
                    CloudArchive.getGallery(),
                    CloudArchive.getContributors(),
                    CloudArchive.getHistory(),
                ]);
                setRecipes(r);
                setTrivia(t);
                setGallery(g);
                setContributors(c);
                setHistory(h);
            } catch {
                toast(CLOUD_ERROR_MSG, 'error');
            }
        }
    }, [toast]);

    /* ---- Firebase / local sync listeners ---- */
    useEffect(() => {
        const provider = CloudArchive.getProvider();
        if (provider !== 'firebase' || !CloudArchive.getFirebase()) {
            refreshLocalState().then(() => { setIsDataLoading(false); setIsInitialLoad(false); });
            if (provider === 'local') {
                CloudArchive.getTrivia()
                    .then(current => {
                        if (current.length === 0) {
                            return Promise.all(TRIVIA_SEED.map(t => CloudArchive.upsertTrivia(t as any)))
                                .then(refreshLocalState);
                        }
                    })
                    .catch(() => toast(CLOUD_ERROR_MSG, 'error'));
            }
            return;
        }
        const unsubR = CloudArchive.subscribeRecipes(r => { setRecipes(r); setIsDataLoading(false); setIsInitialLoad(false); });
        const unsubT = CloudArchive.subscribeTrivia(setTrivia);
        const unsubG = CloudArchive.subscribeGallery(setGallery);
        const unsubC = CloudArchive.subscribeContributors(setContributors);
        const unsubH = CloudArchive.subscribeHistory(setHistory);
        const unsubPhone = CloudArchive.subscribeArchivePhone(setArchivePhone);
        return () => { unsubR(); unsubT(); unsubG(); unsubC(); unsubH(); unsubPhone(); };
    }, []);

    useEffect(() => {
        if (CloudArchive.getProvider() !== 'firebase') {
            setCustodianAuth({ user: null, isAdmin: false });
            return;
        }
        return subscribeFirebaseCustodian(setCustodianAuth);
    }, [dbStats.activeProvider, dbStats.isCloudActive]);

    /* ---- Hash-based deep links (legacy fallback: #recipe/{id}) ---- */
    useEffect(() => {
        const applyHash = () => {
            const match = window.location.hash.match(RECIPE_HASH_REGEX);
            if (match) {
                const id = decodeURIComponent(match[1]);
                const recipe = recipes.find(r => r.id === id);
                if (recipe) {
                    recordRecipeView(recipe.id, recipe.title);
                    navigate('/');
                    setSelectedRecipe(recipe);
                    window.history.replaceState(null, '', window.location.pathname + window.location.search);
                }
            }
        };
        applyHash();
        window.addEventListener('hashchange', applyHash);
        return () => window.removeEventListener('hashchange', applyHash);
    }, [recipes, navigate]);

    /* ---- Route-based recipe deep link: /recipes/:id ---- */
    useEffect(() => {
        if (!location.pathname.startsWith('/recipes/') || recipes.length === 0) return;
        const id = decodeURIComponent(location.pathname.replace('/recipes/', ''));
        const recipe = recipes.find(r => r.id === id);
        if (recipe && (!selectedRecipe || selectedRecipe.id !== recipe.id)) {
            recordRecipeView(recipe.id, recipe.title);
            setSelectedRecipe(recipe);
        }
    }, [location.pathname, recipes]);

    /* ---- Sync dbStats ---- */
    useEffect(() => {
        setDbStats(prev => ({ ...prev, recipeCount: recipes.length, triviaCount: trivia.length, galleryCount: gallery.length }));
    }, [recipes, trivia, gallery]);

    /* ---- Recipe selection handlers ---- */
    const handleSelectRecipe = useCallback((recipe: Recipe) => {
        recordRecipeView(recipe.id, recipe.title);
        setSelectedRecipe(recipe);
        navigate(`/recipes/${encodeURIComponent(recipe.id)}`, { replace: true });
    }, [navigate]);

    const handleRecipeClose = useCallback(() => {
        setSelectedRecipe(null);
        if (location.pathname.startsWith('/recipes/')) {
            navigate('/', { replace: true });
        }
    }, [navigate, location.pathname]);

    const sortedRecipesForModal = useMemo(() => {
        if (!selectedRecipe) return [];
        return [...recipes].sort((a, b) => a.title.localeCompare(b.title));
    }, [selectedRecipe, recipes]);

    const handleNavigateToRecipe = useCallback((recipe: Recipe) => {
        setSelectedRecipe(recipe);
        navigate(`/recipes/${encodeURIComponent(recipe.id)}`, { replace: true });
    }, [navigate]);

    const breadcrumbContext = useMemo(() => {
        const map: Record<string, string> = {
            Recipes: 'Recipes', Index: 'A-Z', Gallery: 'Gallery', Trivia: 'Trivia',
            'Family Story': 'Family Story', Contributors: 'Contributors', Profile: 'Profile', Privacy: 'Privacy',
        };
        return map[activeTab] ?? 'Recipes';
    }, [activeTab]);

    const offlineContextMessage = useMemo(() => {
        const path = location.pathname;
        if (path === '/gallery') return 'Gallery may be incomplete';
        if (path === '/trivia') return "Scores won't sync until reconnected";
        if (path === '/' || path.startsWith('/recipes')) return 'Showing cached recipes';
        return undefined;
    }, [location.pathname]);

    /* ---- Login gate ---- */
    if (!currentUser) {
        return (
            <>
                <OfflineBanner />
                <LoginView onLogin={handleLogin} contributors={contributors} />
            </>
        );
    }

    /* ---- Shared layout shell ---- */
    return (
        <div className="min-h-screen bg-[#FDFBF7] text-stone-800 selection:bg-[#A0522D] selection:text-white pb-[calc(5rem+env(safe-area-inset-bottom,0px))] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]">
            <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-white focus:text-[#2D4635] focus:rounded-lg focus:font-bold focus:outline-none focus:ring-2 focus:ring-[#2D4635]">
                Skip to main content
            </a>
            <OfflineBanner contextMessage={offlineContextMessage} />
            <Header currentUser={currentUser} dbStats={dbStats} onLogout={handleLogout} />

            {/* Initial load skeleton */}
            {isInitialLoad && (
                <div className="max-w-[1600px] mx-auto px-6 py-8 md:py-12 space-y-10" aria-label="Loading content" role="status">
                    <div className="rounded-[3rem] bg-stone-200 animate-pulse h-48 md:h-64" />
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="space-y-3">
                                <div className="aspect-[3/4] rounded-[2rem] bg-stone-200 animate-pulse" />
                                <div className="h-4 bg-stone-200 rounded animate-pulse w-3/4" />
                                <div className="h-3 bg-stone-200 rounded animate-pulse w-1/2" />
                            </div>
                        ))}
                    </div>
                    <span className="sr-only">Loading recipes and content...</span>
                </div>
            )}

            {/* Global overlays: AddRecipe, RecipeModal, CookMode */}
            {showAddRecipeModal && currentUser?.role === 'admin' && (
                <Suspense fallback={null}>
                    <AddRecipeModal
                        onAddRecipe={async (r, f) => {
                            try {
                                const url = f ? await CloudArchive.uploadFile(f, 'recipes') : r.image;
                                await CloudArchive.upsertRecipe({ ...r, image: url || r.image }, currentUser!.name);
                                await refreshLocalState();
                                setShowAddRecipeModal(false);
                            } catch {
                                toast(CLOUD_ERROR_MSG, 'error');
                            }
                        }}
                        onClose={() => setShowAddRecipeModal(false)}
                        contributors={contributors}
                        currentUser={currentUser}
                    />
                </Suspense>
            )}

            {selectedRecipe && (
                <Suspense fallback={<div className="fixed inset-0 z-[100] bg-stone-900/60 flex items-center justify-center" aria-label="Loading recipe"><span className="animate-pulse text-white">Loading…</span></div>}>
                    <RecipeModal
                        recipe={selectedRecipe}
                        onClose={handleRecipeClose}
                        recipeList={sortedRecipesForModal}
                        onNavigate={handleNavigateToRecipe}
                        isFavorite={(id) => favoriteIds.has(id)}
                        onToggleFavorite={handleToggleFavorite}
                        onStartCook={() => setCookModeRecipe(selectedRecipe)}
                        breadcrumbContext={breadcrumbContext}
                    />
                </Suspense>
            )}

            {cookModeRecipe && (
                <Suspense fallback={<div className="fixed inset-0 z-[150] bg-[#2D4635] flex items-center justify-center" aria-label="Loading cook mode"><span className="animate-pulse text-white">Loading…</span></div>}>
                    <CookModeView recipe={cookModeRecipe} onClose={() => setCookModeRecipe(null)} />
                </Suspense>
            )}

            {/* Route views */}
            <div id="main-content" tabIndex={-1} aria-live="polite" className={isInitialLoad ? 'hidden' : undefined}>
                <Routes>
                    <Route path="/" element={
                        <RouteErrorBoundary label="Recipes">
                            <Suspense fallback={<RecipeGridSkeleton />}>
                                <RecipeGrid
                                    recipes={recipes}
                                    currentUser={currentUser}
                                    onOpenRecipe={handleSelectRecipe}
                                    isFavorite={(id) => favoriteIds.has(id)}
                                    onToggleFavorite={handleToggleFavorite}
                                    isDataLoading={isDataLoading}
                                    getAvatar={getAvatar}
                                    recipeCount={dbStats.recipeCount}
                                    onShowAddRecipe={currentUser.role === 'admin' ? () => setShowAddRecipeModal(true) : undefined}
                                    onEditRecipeAdmin={currentUser.role === 'admin' ? (recipe) => {
                                        setEditingRecipe(recipe);
                                        navigate('/profile');
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    } : undefined}
                                />
                            </Suspense>
                        </RouteErrorBoundary>
                    } />

                    <Route path="/index" element={
                        <RouteErrorBoundary label="A-Z Index">
                            <Suspense fallback={<IndexSkeleton />}>
                                <AlphabeticalIndex
                                    recipes={recipes}
                                    onSelect={handleSelectRecipe}
                                    onGoToRecipes={() => { navigate('/'); window.scrollTo(0, 0); }}
                                />
                            </Suspense>
                        </RouteErrorBoundary>
                    } />

                    <Route path="/gallery" element={
                        <RouteErrorBoundary label="Gallery">
                            <Suspense fallback={<GallerySkeleton />}>
                                <GalleryView
                                    gallery={gallery}
                                    currentUser={currentUser}
                                    dbStats={dbStats}
                                    isDataLoading={isDataLoading}
                                    archivePhone={archivePhone}
                                    getAvatar={getAvatar}
                                    onRefreshLocal={refreshLocalState}
                                />
                            </Suspense>
                        </RouteErrorBoundary>
                    } />

                    <Route path="/trivia" element={
                        <RouteErrorBoundary label="Trivia">
                            <Suspense fallback={<TabFallback />}>
                                <TriviaView
                                    trivia={trivia}
                                    currentUser={currentUser as any}
                                    isDataLoading={isDataLoading}
                                    onAddTrivia={async (t) => {
                                        try { await CloudArchive.upsertTrivia(t); await refreshLocalState(); }
                                        catch { toast(CLOUD_ERROR_MSG, 'error'); }
                                    }}
                                    onDeleteTrivia={async (id) => {
                                        try { await CloudArchive.deleteTrivia(id); await refreshLocalState(); }
                                        catch { toast(CLOUD_ERROR_MSG, 'error'); }
                                    }}
                                />
                            </Suspense>
                        </RouteErrorBoundary>
                    } />

                    <Route path="/history" element={
                        <RouteErrorBoundary label="Family Story">
                            <Suspense fallback={<HistorySkeleton />}>
                                <HistoryView />
                            </Suspense>
                        </RouteErrorBoundary>
                    } />

                    <Route path="/contributors" element={
                        <RouteErrorBoundary label="Contributors">
                            <Suspense fallback={<ContributorsSkeleton />}>
                                {isDataLoading ? <ContributorsSkeleton /> : (
                                    <ContributorsView
                                        recipes={recipes}
                                        gallery={gallery}
                                        trivia={trivia}
                                        contributors={contributors}
                                        onSelectContributor={() => { navigate('/'); }}
                                        onGoToRecipes={() => { navigate('/'); window.scrollTo(0, 0); }}
                                    />
                                )}
                            </Suspense>
                        </RouteErrorBoundary>
                    } />

                    <Route path="/privacy" element={
                        <RouteErrorBoundary label="Privacy">
                            <Suspense fallback={<TabFallback />}>
                                <PrivacyView />
                            </Suspense>
                        </RouteErrorBoundary>
                    } />

                    <Route path="/profile" element={
                        <RouteErrorBoundary label="Profile">
                            <Suspense fallback={<ProfileSkeleton />}>
                                <ProfileView
                                    currentUser={currentUser}
                                    userRecipes={recipes.filter(r => r.contributor === currentUser.name && !defaultRecipeIds.has(r.id))}
                                    userHistory={history.filter(h => h.contributor === currentUser.name)}
                                    favoriteRecipes={recipes.filter(r => favoriteIds.has(r.id))}
                                    recentRecipes={getRecentlyViewedEntries()
                                        .map(e => recipes.find(r => r.id === e.id))
                                        .filter((r): r is Recipe => !!r)}
                                    onViewRecipe={handleSelectRecipe}
                                    onUpdateProfile={async (name, avatar) => {
                                        const existing = contributors.find(c => c.name.toLowerCase() === currentUser.name.toLowerCase());
                                        const profileToUpdate = {
                                            id: existing?.id || currentUser.id,
                                            name, avatar,
                                            role: currentUser.role,
                                            email: currentUser.email,
                                        };
                                        try {
                                            await CloudArchive.upsertContributor(profileToUpdate);
                                            const updatedUser = { ...currentUser, name, picture: avatar };
                                            setCurrentUser(updatedUser);
                                            localStorage.setItem('schafer_user', JSON.stringify(updatedUser));
                                            await refreshLocalState();
                                        } catch (e) {
                                            if (e instanceof FirebaseError && e.code === 'permission-denied') {
                                                throw new Error(
                                                    'The shared family directory is managed by custodians. Sign in with Google under Profile \u2192 Admin tools (if you are one), or ask a custodian to update your profile.'
                                                );
                                            }
                                            throw new Error(CLOUD_ERROR_MSG);
                                        }
                                    }}
                                    onEditRecipe={(recipe) => {
                                        setEditingRecipe(recipe);
                                        navigate('/profile');
                                    }}
                                    contributors={contributors}
                                    adminSectionProps={currentUser.role === 'admin' ? {
                                        editingRecipe,
                                        clearEditing: () => setEditingRecipe(null),
                                        recipes, trivia, contributors,
                                        dbStats: { ...dbStats, archivePhone },
                                        onAddRecipe: async (r, f) => {
                                            const optimisticRecipe = { ...r, image: r.image || '' } as Recipe;
                                            const currentRecipes = recipes;
                                            const existingIdx = currentRecipes.findIndex(x => x.id === r.id);
                                            const optimisticRecipes = existingIdx >= 0
                                                ? currentRecipes.map(x => x.id === r.id ? optimisticRecipe : x)
                                                : [...currentRecipes, optimisticRecipe];
                                            await optimisticUpdate(
                                                currentRecipes,
                                                optimisticRecipes,
                                                setRecipes,
                                                async () => {
                                                    const url = f ? await CloudArchive.uploadFile(f, 'recipes') : r.image;
                                                    await CloudArchive.upsertRecipe({ ...r, image: url || r.image }, currentUser.name);
                                                    await refreshLocalState();
                                                },
                                                () => toast(CLOUD_ERROR_MSG, 'error'),
                                            );
                                        },
                                        onAddGallery: async (g, f) => {
                                            try {
                                                const url = f ? await CloudArchive.uploadFile(f, 'gallery') : '';
                                                await CloudArchive.upsertGalleryItem({ ...g, url: url || '' });
                                                await refreshLocalState();
                                            } catch { toast(CLOUD_ERROR_MSG, 'error'); }
                                        },
                                        onAddTrivia: async (t) => {
                                            try { await CloudArchive.upsertTrivia(t); await refreshLocalState(); }
                                            catch { toast(CLOUD_ERROR_MSG, 'error'); }
                                        },
                                        onDeleteTrivia: async (id) => {
                                            try { await CloudArchive.deleteTrivia(id); await refreshLocalState(); }
                                            catch { toast(CLOUD_ERROR_MSG, 'error'); }
                                        },
                                        onDeleteRecipe: async (id) => {
                                            try { await CloudArchive.deleteRecipe(id); await refreshLocalState(); }
                                            catch { toast(CLOUD_ERROR_MSG, 'error'); }
                                        },
                                        onUpdateContributor: async (p) => {
                                            try {
                                                await CloudArchive.upsertContributor(p);
                                                if (currentUser && p.name.toLowerCase() === currentUser.name.toLowerCase()) {
                                                    const updatedUser = { ...currentUser, name: p.name, picture: p.avatar, role: p.role };
                                                    setCurrentUser(updatedUser);
                                                    localStorage.setItem('schafer_user', JSON.stringify(updatedUser));
                                                }
                                                await refreshLocalState();
                                            } catch { toast(CLOUD_ERROR_MSG, 'error'); }
                                        },
                                        onUpdateArchivePhone: async (p) => {
                                            try { await CloudArchive.setArchivePhone(p); setArchivePhone(p); }
                                            catch { toast(CLOUD_ERROR_MSG, 'error'); }
                                        },
                                        onEditRecipe: setEditingRecipe,
                                        defaultRecipeIds: Array.from(defaultRecipeIds),
                                        ...(CloudArchive.getProvider() === 'firebase' ? {
                                            firebaseCustodian: {
                                                canWrite: custodianAuth.isAdmin,
                                                email: custodianAuth.user?.email ?? null,
                                                onGoogleSignIn: signInCustodianWithGoogle,
                                                onSignOut: signOutFirebaseCustodian,
                                            },
                                        } : {}),
                                    } : undefined}
                                />
                            </Suspense>
                        </RouteErrorBoundary>
                    } />

                    {/* Deep link for recipes */}
                    <Route path="/recipes/:id" element={
                        <RouteErrorBoundary label="Recipes">
                            <Suspense fallback={<RecipeGridSkeleton />}>
                                <RecipeGrid
                                    recipes={recipes}
                                    currentUser={currentUser}
                                    onOpenRecipe={handleSelectRecipe}
                                    isFavorite={(id) => favoriteIds.has(id)}
                                    onToggleFavorite={handleToggleFavorite}
                                    isDataLoading={isDataLoading}
                                    getAvatar={getAvatar}
                                    recipeCount={dbStats.recipeCount}
                                    onShowAddRecipe={currentUser.role === 'admin' ? () => setShowAddRecipeModal(true) : undefined}
                                />
                            </Suspense>
                        </RouteErrorBoundary>
                    } />

                    {/* Catch-all: redirect to recipes */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </div>

            <BottomNav currentUser={currentUser} />
        </div>
    );
};

export default App;
