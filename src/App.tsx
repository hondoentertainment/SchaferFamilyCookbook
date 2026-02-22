import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { UserProfile, Recipe, GalleryItem, Trivia, DBStats, ContributorProfile } from './types';
import { CloudArchive } from './services/db';
import { Header } from './components/Header';
import { PLACEHOLDER_AVATAR } from './constants';
import { Footer } from './components/Footer';
import { RecipeModal } from './components/RecipeModal';

const AdminView = lazy(() => import('./components/AdminView').then(m => ({ default: m.AdminView })));
const AlphabeticalIndex = lazy(() => import('./components/AlphabeticalIndex').then(m => ({ default: m.AlphabeticalIndex })));
const ContributorsView = lazy(() => import('./components/ContributorsView').then(m => ({ default: m.ContributorsView })));
const ProfileView = lazy(() => import('./components/ProfileView').then(m => ({ default: m.ProfileView })));
const HistoryView = lazy(() => import('./components/HistoryView').then(m => ({ default: m.HistoryView })));
const TriviaView = lazy(() => import('./components/TriviaView').then(m => ({ default: m.TriviaView })));

const TabFallback = () => (
    <div className="flex items-center justify-center min-h-[50vh] text-stone-400">
        <span className="animate-pulse font-serif italic">Loading…</span>
    </div>
);

const RecipeGridSkeleton: React.FC = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-[2rem] bg-stone-200 animate-pulse" />
        ))}
    </div>
);

const ContributorsSkeleton: React.FC = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
        {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-[3rem] p-10 border border-stone-100">
                <div className="w-28 h-28 rounded-full bg-stone-200 animate-pulse mx-auto mb-8" />
                <div className="h-8 bg-stone-200 rounded animate-pulse w-3/4 mx-auto mb-4" />
                <div className="h-4 bg-stone-100 rounded animate-pulse w-1/2 mx-auto" />
                <div className="h-10 bg-stone-100 rounded-full mt-6 animate-pulse" />
            </div>
        ))}
    </div>
);

const GallerySkeleton: React.FC = () => (
    <div className="columns-1 md:columns-2 lg:columns-3 gap-8 space-y-8">
        {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="break-inside-avoid bg-white p-4 rounded-[2rem] border border-stone-100 shadow-md">
                <div className="w-full aspect-video rounded-2xl mb-4 bg-stone-200 animate-pulse" />
                <div className="h-5 bg-stone-200 rounded animate-pulse w-3/4 mb-4" />
                <div className="flex justify-between items-center">
                    <div className="w-4 h-4 rounded-full bg-stone-200 animate-pulse" />
                    <div className="h-3 bg-stone-100 rounded animate-pulse w-24" />
                </div>
            </div>
        ))}
    </div>
);

const GalleryImage: React.FC<{ url: string; caption: string; onClick?: () => void }> = ({ url, caption, onClick }) => {
    const [broken, setBroken] = useState(false);
    if (!url || broken) {
        return (
            <div className="w-full aspect-video rounded-2xl mb-4 bg-stone-100 flex flex-col items-center justify-center gap-2 text-stone-400 border-2 border-dashed border-stone-200">
                <span className="text-2xl">📷</span>
                <span className="text-xs font-bold uppercase tracking-widest">{url ? 'Image failed to load' : 'No image'}</span>
                <span className="text-[10px] italic">Upload may have failed or URL is invalid</span>
            </div>
        );
    }
    const imgEl = (
        <img
            src={url}
            className={`w-full rounded-2xl mb-4 object-cover ${onClick ? 'cursor-pointer hover:opacity-95 transition-opacity' : ''}`}
            alt={caption || 'Gallery photo'}
            onError={() => setBroken(true)}
            loading="lazy"
        />
    );
    if (onClick) {
        return (
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onClick(); }}
                className="w-full text-left rounded-2xl overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                aria-label={`View full size: ${caption || 'Gallery photo'}`}
            >
                {imgEl}
            </button>
        );
    }
    return <div>{imgEl}</div>;
};

const GalleryLightbox: React.FC<{ item: GalleryItem; onClose: () => void }> = ({ item, onClose }) => {
    const closeRef = React.useRef<HTMLButtonElement>(null);

    useEffect(() => {
        closeRef.current?.focus();
        const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    const isVideo = item.type === 'video';

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={isVideo ? 'Fullscreen gallery video' : 'Enlarged gallery image'}
            className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-lg flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-300 cursor-zoom-out"
            onClick={onClose}
        >
            <button
                ref={closeRef}
                onClick={onClose}
                className="absolute top-6 right-6 w-12 h-12 min-w-[3rem] min-h-[3rem] bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white text-2xl transition-colors z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label="Close"
            >
                ✕
            </button>
            {isVideo ? (
                <video
                    src={item.url}
                    controls
                    autoPlay
                    playsInline
                    className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl animate-in zoom-in-105 duration-500"
                    onClick={(e) => e.stopPropagation()}
                    title={item.caption || 'Family video'}
                    aria-label={`Video: ${item.caption || 'Family memory'}`}
                />
            ) : (
                <img
                    src={item.url}
                    loading="lazy"
                    className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl animate-in zoom-in-105 duration-500 pointer-events-none"
                    alt={item.caption || 'Gallery photo'}
                    onClick={(e) => e.stopPropagation()}
                />
            )}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/60 text-xs uppercase tracking-widest text-center">
                {item.caption}
                <br />
                <span className="text-[10px]">Click anywhere or press Escape to close</span>
            </div>
        </div>
    );
};

import { HistoryEntry } from './types';
import { TRIVIA_SEED } from './data/trivia_seed';
import defaultRecipes from './data/recipes.json';

const RecipeCardImage: React.FC<{ recipe: Recipe }> = ({ recipe }) => {
    const [broken, setBroken] = useState(false);
    const hasAffiliatedImage = !!recipe.image && recipe.image.startsWith('/recipe-images/') && !broken;

    if (hasAffiliatedImage) {
        return (
            <img
                src={recipe.image}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                loading="lazy"
                alt={recipe.title}
                onError={() => setBroken(true)}
            />
        );
    }

    return (
        <>
            <div className="absolute inset-0 bg-gradient-to-br from-stone-200 to-stone-300" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#2D4635]/80 to-transparent" />
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg z-10">
                <span className="text-xs">📝</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-stone-500">Recipe coming</span>
            </div>
        </>
    );
};

const RECIPE_HASH_REGEX = /^#recipe\/(.+)$/;

const App: React.FC = () => {
    const [tab, setTab] = useState('Recipes');
    const [isDataLoading, setIsDataLoading] = useState(true);
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [gallery, setGallery] = useState<GalleryItem[]>([]);
    const [trivia, setTrivia] = useState<Trivia[]>([]);
    const [contributors, setContributors] = useState<ContributorProfile[]>([]);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
    const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
    const [selectedGalleryItem, setSelectedGalleryItem] = useState<GalleryItem | null>(null);
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
        const s = localStorage.getItem('schafer_user');
        if (!s) return null;
        try {
            const u = JSON.parse(s);
            // Super Admin Auto-assign
            if (u.name.toLowerCase() === 'kyle' || u.email === 'hondo4185@gmail.com') {
                u.role = 'admin';
            } else if (!u.role) {
                u.role = (u.name.toLowerCase() === 'admin' ? 'admin' : 'user');
            }
            localStorage.setItem('schafer_user', JSON.stringify(u));
            return u;
        } catch {
            return null;
        }
    });

    const handleLogout = () => {
        localStorage.removeItem('schafer_user');
        setCurrentUser(null);
        setTab('Recipes');
    };

    const [dbStats, setDbStats] = useState<DBStats>({
        recipeCount: 0, galleryCount: 0, triviaCount: 0,
        isCloudActive: CloudArchive.getProvider() !== 'local',
        activeProvider: CloudArchive.getProvider()
    });

    const [archivePhone, setArchivePhone] = useState(() => localStorage.getItem('schafer_archive_phone') || '');

    const [loginName, setLoginName] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    // Filters
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('All');
    const [contributor, setContributor] = useState('All');

    const defaultRecipeIds = useMemo(
        () => new Set((defaultRecipes as Recipe[]).map(r => r.id)),
        []
    );

    const refreshLocalState = async () => {
        const provider = CloudArchive.getProvider();
        if (provider === 'local') {
            const [r, t, g, c, h] = await Promise.all([
                CloudArchive.getRecipes(),
                CloudArchive.getTrivia(),
                CloudArchive.getGallery(),
                CloudArchive.getContributors(),
                CloudArchive.getHistory()
            ]);
            setRecipes(r);
            setTrivia(t);
            setGallery(g);
            setContributors(c);
            setHistory(h);
        }
    };

    // Sync Listeners
    useEffect(() => {
        const provider = CloudArchive.getProvider();
        if (provider !== 'firebase' || !CloudArchive.getFirebase()) {
            refreshLocalState().then(() => setIsDataLoading(false));
            // Auto-seed trivia if empty in local mode
            if (provider === 'local') {
                CloudArchive.getTrivia().then(current => {
                    if (current.length === 0) {
                        Promise.all(TRIVIA_SEED.map(t => CloudArchive.upsertTrivia(t as any)))
                            .then(refreshLocalState);
                    }
                });
            }
            return;
        }

        const unsubR = CloudArchive.subscribeRecipes(r => {
            setRecipes(r);
            setIsDataLoading(false);
        });
        const unsubT = CloudArchive.subscribeTrivia(setTrivia);
        const unsubG = CloudArchive.subscribeGallery(setGallery);
        const unsubC = CloudArchive.subscribeContributors(setContributors);
        const unsubH = CloudArchive.subscribeHistory(setHistory);
        const unsubPhone = CloudArchive.subscribeArchivePhone(setArchivePhone);
        return () => { unsubR(); unsubT(); unsubG(); unsubC(); unsubH(); unsubPhone(); };
    }, []);

    // Deep-link handling: open recipe from #recipe/{id}
    useEffect(() => {
        const applyHash = () => {
            const match = window.location.hash.match(RECIPE_HASH_REGEX);
            if (match) {
                const id = decodeURIComponent(match[1]);
                const recipe = recipes.find(r => r.id === id);
                if (recipe) {
                    setTab('Recipes');
                    setSelectedRecipe(recipe);
                }
            }
        };
        applyHash();
        window.addEventListener('hashchange', applyHash);
        return () => window.removeEventListener('hashchange', applyHash);
    }, [recipes]);

    useEffect(() => {
        setDbStats(prev => ({ ...prev, recipeCount: recipes.length, triviaCount: trivia.length, galleryCount: gallery.length }));
    }, [recipes, trivia, gallery]);

    const handleLoginSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!loginName.trim() || isLoggingIn) return;

        setIsLoggingIn(true);

        // Check if we have a stored profile for this person
        const name = loginName.trim();
        const existing = contributors.find(c => c.name.toLowerCase() === name.toLowerCase());

        // Super Admin Detection
        const isSuper = name.toLowerCase() === 'kyle' || name.toLowerCase() === 'hondo4185@gmail.com';
        const email = isSuper && name.includes('@') ? name : (existing?.email);

        const u: UserProfile = {
            id: existing?.id || 'u' + Date.now(),
            name: existing?.name || name,
            picture: existing?.avatar ?? PLACEHOLDER_AVATAR,
            role: isSuper ? 'admin' : ((existing?.role as any) || (name.toLowerCase() === 'admin' ? 'admin' : 'user')),
            email: email
        };
        localStorage.setItem('schafer_user', JSON.stringify(u));
        setCurrentUser(u);
        setIsLoggingIn(false);
    };

    // Helper to get avatar
    const getAvatar = (name: string) => {
        const c = contributors.find(p => p.name === name);
        return c?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;
    };

    const filteredRecipes = useMemo(() => {
        return recipes.filter(r => {
            const matchS = r.title.toLowerCase().includes(search.toLowerCase());
            const matchC = category === 'All' || r.category === category;
            const matchA = contributor === 'All' || r.contributor === contributor;
            return matchS && matchC && matchA;
        });
    }, [recipes, search, category, contributor]);

    const handleRecipeClick = (recipe: Recipe) => {
        setSelectedRecipe(recipe);
        window.history.replaceState(null, '', `#recipe/${encodeURIComponent(recipe.id)}`);
    };

    const handleRecipeClose = () => {
        setSelectedRecipe(null);
        if (window.location.hash.match(RECIPE_HASH_REGEX)) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
    };

    if (!currentUser) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#2D4635] p-6">
                <div className="bg-white rounded-[4rem] p-10 md:p-16 w-full max-w-xl shadow-2xl relative overflow-hidden text-center animate-in zoom-in duration-700">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-800 via-orange-300 to-emerald-800" />

                    <div className="relative mb-12">
                        <div className="w-24 h-24 bg-stone-100 rounded-full mx-auto relative overflow-hidden border-4 border-white shadow-2xl group transition-all">
                            {loginName ? (
                                <img
                                    src={contributors.find(c => c.name.toLowerCase() === loginName.trim().toLowerCase())?.avatar ?? PLACEHOLDER_AVATAR}
                                    className="w-full h-full object-cover animate-in fade-in zoom-in"
                                    alt="Identity"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-stone-300 text-3xl font-serif">?</div>
                            )}
                        </div>
                        <div className="mt-8">
                            <h1 className="text-4xl font-serif italic text-[#2D4635] mb-2">Identify Yourself</h1>
                            <p className="text-stone-400 italic font-serif text-sm">Welcome to the Schafer Family Archive.</p>
                        </div>
                    </div>

                    <form onSubmit={handleLoginSubmit} className="space-y-8 relative z-10">
                        <div className="space-y-2">
                            <label htmlFor="login-name" className="text-[10px] font-black uppercase tracking-[0.3em] text-[#A0522D] ml-2">Legacy Contributor Name</label>
                            <input
                                id="login-name"
                                type="text"
                                placeholder="e.g. Grandma Joan"
                                autoComplete="name"
                                disabled={isLoggingIn}
                                aria-busy={isLoggingIn}
                                className="w-full p-6 bg-stone-50 border border-stone-100 rounded-3xl text-center text-xl font-serif outline-none focus:ring-2 focus:ring-[#2D4635]/10 focus:bg-white transition-all shadow-inner text-base disabled:opacity-70 disabled:cursor-not-allowed"
                                value={loginName}
                                onChange={e => setLoginName(e.target.value)}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isLoggingIn}
                            aria-busy={isLoggingIn}
                            className="w-full py-5 bg-[#2D4635] text-white rounded-full text-xs font-black uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
                        >
                            {isLoggingIn ? 'Entering…' : 'Enter The Archive'}
                        </button>
                        <p className="text-stone-400 text-xs italic pt-4">
                            <a href="mailto:?subject=Schafer%20Family%20Cookbook%20Access%20Request" className="underline hover:text-[#2D4635] focus:outline-none focus:ring-2 focus:ring-[#2D4635] focus:ring-offset-2 rounded">Need access? Contact an administrator.</a>
                        </p>
                    </form>
                </div>
            </div>
        );
    }

    // Gallery View
    if (tab === 'Gallery') {
        return (
            <div className="min-h-screen bg-[#FDFBF7]">
                <Header activeTab={tab} setTab={setTab} currentUser={currentUser} dbStats={dbStats} onLogout={handleLogout} />
                <main className="max-w-7xl mx-auto py-12 px-6" role="main" aria-label="Family Gallery">
                    <section className="flex flex-col md:flex-row justify-between items-center mb-12 gap-8">
                        <div>
                            <h2 className="text-4xl font-serif italic text-[#2D4635]">Family Gallery</h2>
                            <p className="text-stone-400 font-serif italic mt-2">Captured moments across the generations.</p>
                        </div>
                        {archivePhone ? (
                            <div className="bg-emerald-50 rounded-[2rem] p-6 border border-emerald-100 flex items-center gap-6 animate-in slide-in-from-right-8 duration-700" role="region" aria-label="Text-to-archive instructions">
                                <span className="text-3xl" aria-hidden="true">📱</span>
                                <div>
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-800 leading-none mb-1">Text your memories</h4>
                                    <p className="text-sm text-emerald-700 font-serif italic">
                                        Photo/Video to:{' '}
                                        <a
                                            href={`sms:${archivePhone.replace(/\s/g, '')}`}
                                            className="font-bold not-italic underline decoration-emerald-600/50 hover:decoration-emerald-700 underline-offset-2 hover:text-emerald-800 transition-colors"
                                            aria-label={`Text photos or videos to ${archivePhone}`}
                                        >
                                            {archivePhone}
                                        </a>
                                    </p>
                                    <p className="text-[10px] text-emerald-600/80 mt-1">Tap the number to open your messaging app</p>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-stone-50 rounded-[2rem] p-6 border border-stone-100 flex items-center gap-6 max-w-md" role="region" aria-label="How to add photos">
                                <span className="text-2xl" aria-hidden="true">📷</span>
                                <div>
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-500 leading-none mb-1">Want to add photos?</h4>
                                    <p className="text-sm text-stone-500 font-serif italic">Admins can enable text-to-archive in Admin → Gallery. Or ask an administrator to add your memories.</p>
                                </div>
                            </div>
                        )}
                    </section>

                    {isDataLoading ? (
                        <GallerySkeleton />
                    ) : gallery.length === 0 ? (
                        <div className="py-24 text-center space-y-8 animate-in fade-in duration-500" role="status">
                            <div className="w-32 h-32 mx-auto rounded-full bg-stone-100 flex items-center justify-center text-5xl border-2 border-dashed border-stone-200">🖼️</div>
                            <div className="space-y-3">
                                <h3 className="text-2xl font-serif italic text-[#2D4635]">The gallery awaits your memories</h3>
                                <p className="text-stone-500 font-serif italic max-w-md mx-auto">Be the first to add a photo or video. Text to the archive number once admins enable it, or ask a family custodian to add your moments.</p>
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Share the moments that matter</p>
                        </div>
                    ) : (
                        <>
                            <div className="columns-1 md:columns-2 lg:columns-3 gap-8 space-y-8" role="list">
                                {gallery.map(item => (
                                    <article key={item.id} className="break-inside-avoid bg-white p-4 rounded-[2rem] border border-stone-100 shadow-md group hover:shadow-2xl transition-all focus-within:shadow-2xl" role="listitem">
                                        {item.type === 'video' ? (
                                            <button
                                                type="button"
                                                onClick={() => setSelectedGalleryItem(item)}
                                                className="w-full text-left rounded-2xl overflow-hidden mb-4 bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                                                aria-label={`View full size: ${item.caption || 'Family video'}`}
                                            >
                                                <video
                                                    src={item.url}
                                                    className="w-full pointer-events-none"
                                                    muted
                                                    playsInline
                                                    preload="metadata"
                                                    title={item.caption || 'Family video'}
                                                    aria-hidden
                                                    onMouseOver={e => (e.target as HTMLVideoElement).play()}
                                                    onMouseOut={e => (e.target as HTMLVideoElement).pause()}
                                                    onFocus={e => (e.target as HTMLVideoElement).play()}
                                                    onBlur={e => (e.target as HTMLVideoElement).pause()}
                                                    onTouchStart={e => {
                                                        const el = e.target as HTMLVideoElement;
                                                        if (el.paused) el.play();
                                                        else el.pause();
                                                    }}
                                                />
                                                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity bg-black/30 pointer-events-none">
                                                    <span className="bg-white/90 text-stone-800 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest">▶ Fullscreen</span>
                                                </div>
                                            </button>
                                        ) : (
                                            <GalleryImage
                                                url={item.url}
                                                caption={item.caption}
                                                onClick={() => setSelectedGalleryItem(item)}
                                            />
                                        )}
                                        <p className="font-serif italic text-stone-800 text-lg px-2">{item.caption}</p>
                                        <div className="flex justify-between items-center mt-4 px-2">
                                            <div className="flex items-center gap-2">
                                                <img src={getAvatar(item.contributor)} className="w-4 h-4 rounded-full" alt={item.contributor} />
                                                <span className="text-[9px] uppercase tracking-widest text-[#A0522D]">Added by {item.contributor}</span>
                                            </div>
                                            {currentUser?.role === 'admin' && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); CloudArchive.deleteGalleryItem(item.id); }}
                                                    className="w-11 h-11 min-w-[2.75rem] min-h-[2.75rem] flex items-center justify-center text-stone-300 hover:text-red-500 opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D4635] rounded-full transition-opacity"
                                                    aria-label={`Remove "${item.caption}" from gallery`}
                                                    title="Remove from gallery"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    </article>
                                ))}
                            </div>

                            {/* Gallery Lightbox (images and videos) */}
                            {selectedGalleryItem && (
                                <GalleryLightbox
                                    item={selectedGalleryItem}
                                    onClose={() => setSelectedGalleryItem(null)}
                                />
                            )}
                        </>
                    )}
                </main>
                <Footer activeTab={tab} setTab={setTab} currentUser={currentUser} />
            </div>
        );
    }

    // Trivia View
    if (tab === 'Trivia') {
        return (
            <div className="min-h-screen bg-[#FDFBF7] pb-20">
                <Header activeTab={tab} setTab={setTab} currentUser={currentUser} dbStats={dbStats} onLogout={handleLogout} />
                <Suspense fallback={<TabFallback />}>
                    <TriviaView
                        trivia={trivia}
                        currentUser={currentUser as any}
                        onAddTrivia={async (t) => {
                            await CloudArchive.upsertTrivia(t);
                            await refreshLocalState();
                        }}
                        onDeleteTrivia={async (id) => {
                            await CloudArchive.deleteTrivia(id);
                            await refreshLocalState();
                        }}
                    />
                </Suspense>
                <Footer activeTab={tab} setTab={setTab} currentUser={currentUser} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FDFBF7] text-stone-800 selection:bg-[#A0522D] selection:text-white pb-20">
            <Header activeTab={tab} setTab={setTab} currentUser={currentUser} dbStats={dbStats} onLogout={handleLogout} />

            {selectedRecipe && (
                <RecipeModal
                    recipe={selectedRecipe}
                    onClose={handleRecipeClose}
                />
            )}

            {tab === 'Recipes' && (
                <main className="max-w-[1600px] mx-auto px-6 py-8 md:py-12 space-y-12">
                    {/* Hero Section */}
                    <div className="relative rounded-[3rem] overflow-hidden bg-[#2D4635] text-white p-8 md:p-20 shadow-2xl">
                        <div className="relative z-10 max-w-2xl space-y-6">
                            <span className="inline-block px-4 py-1.5 rounded-full border border-white/20 bg-white/10 backdrop-blur-md text-[10px] font-black uppercase tracking-widest text-emerald-100">
                                Est. 2024 • The Schafer Collection
                            </span>
                            <h1 className="text-5xl md:text-7xl font-serif italic leading-[0.9]">
                                Preserving the <span className="text-[#F4A460]">flavor</span> of our family history.
                            </h1>
                            <div className="flex gap-4 pt-4">
                                <div className="h-px bg-white/20 flex-1 my-auto" />
                                <p className="text-emerald-100/60 text-xs uppercase tracking-widest">
                                    {dbStats.recipeCount} Recipes Archived
                                </p>
                            </div>
                        </div>

                        {/* Decorative Circles */}
                        <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#F4A460] rounded-full blur-[100px] opacity-20" />
                        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-emerald-400 rounded-full blur-[80px] opacity-10" />
                    </div>

                    <div className="flex flex-col md:flex-row gap-6 sticky top-24 z-30">
                        <div className="relative flex-1">
                            <label htmlFor="recipe-search" className="sr-only">Search recipes by title</label>
                            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-stone-400" aria-hidden="true">🔍</span>
                            <input
                                id="recipe-search"
                                type="text"
                                placeholder="Search by title..."
                                aria-label="Search recipes by title"
                                className="w-full pl-14 pr-6 py-4 bg-white/80 backdrop-blur border border-stone-200 rounded-full shadow-sm outline-none focus:ring-2 focus:ring-[#2D4635]/10 transition-all font-serif italic placeholder:text-stone-300"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <label htmlFor="recipe-category" className="sr-only">Filter by category</label>
                        <select id="recipe-category" aria-label="Filter by category" className="px-8 py-4 bg-white/80 backdrop-blur border border-stone-200 rounded-full shadow-sm outline-none text-sm font-bold text-stone-600 cursor-pointer hover:bg-white min-h-[2.75rem]" value={category} onChange={e => setCategory(e.target.value)}>
                            <option value="All">All Categories</option>
                            {['Breakfast', 'Main', 'Dessert', 'Side', 'Appetizer', 'Bread', 'Dip/Sauce', 'Snack'].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <label htmlFor="recipe-contributor" className="sr-only">Filter by contributor</label>
                        <select id="recipe-contributor" aria-label="Filter by contributor" className="px-8 py-4 bg-white/80 backdrop-blur border border-stone-200 rounded-full shadow-sm outline-none text-sm font-bold text-stone-600 cursor-pointer hover:bg-white min-h-[2.75rem]" value={contributor} onChange={e => setContributor(e.target.value)}>
                            <option value="All">All Contributors</option>
                            {Array.from(new Set(recipes.map(r => r.contributor))).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>


                    {isDataLoading ? (
                        <RecipeGridSkeleton />
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                            {filteredRecipes.map(recipe => (
                                <div
                                    key={recipe.id}
                                    onClick={() => handleRecipeClick(recipe)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            handleRecipeClick(recipe);
                                        }
                                    }}
                                    tabIndex={0}
                                    role="button"
                                    aria-label={`View recipe: ${recipe.title}`}
                                    className="group cursor-pointer relative aspect-[3/4] rounded-[2rem] overflow-hidden bg-stone-200 shadow-md hover:shadow-2xl transition-all duration-500 focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FDFBF7]"
                                >
                                    {/* Affiliated recipe image or placeholder */}
                                    <RecipeCardImage recipe={recipe} />

                                    <div className="absolute inset-0 bg-gradient-to-br from-[#2D4635]/20 to-[#A0522D]/20 group-[.fallback-gradient]:from-[#2D4635] group-[.fallback-gradient]:to-[#A0522D]" />

                                    {/* Overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-6 flex flex-col justify-end">
                                        <div className="transform translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
                                            <div className="flex justify-between items-center mb-2 opacity-80">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-200">{recipe.category}</span>
                                            </div>
                                            <h3 className="text-xl md:text-2xl font-serif italic text-white leading-none mb-1 shadow-black drop-shadow-md">{recipe.title}</h3>
                                            <p className="text-[10px] text-stone-300 uppercase tracking-widest mt-2 opacity-0 group-hover:opacity-100 transition-opacity delay-100 flex items-center gap-1">
                                                By <img src={getAvatar(recipe.contributor)} className="w-4 h-4 rounded-full inline-block" alt={recipe.contributor} /> {recipe.contributor}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Admin Quick-Action Button */}
                                    {currentUser?.role === 'admin' && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingRecipe(recipe);
                                                setTab('Admin');
                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                            }}
                                            className="absolute top-4 right-4 w-11 h-11 min-w-[2.75rem] min-h-[2.75rem] rounded-full bg-white/90 backdrop-blur-sm text-[#A0522D] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:scale-110 hover:bg-white z-20"
                                            title="Edit with AI"
                                            aria-label={`Edit ${recipe.title} with AI`}
                                        >
                                            ✨
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {!isDataLoading && filteredRecipes.length === 0 && (
                        <div className="py-20 text-center space-y-4 opacity-50">
                            <span className="text-4xl">🍂</span>
                            <p className="font-serif italic text-stone-400">No recipes found in the archive.</p>
                        </div>
                    )}
                </main>
            )}

            {tab === 'Index' && (
                <Suspense fallback={<TabFallback />}>
                    <AlphabeticalIndex recipes={recipes} onSelect={setSelectedRecipe} />
                </Suspense>
            )}

            {tab === 'Family Story' && (
                <Suspense fallback={<TabFallback />}>
                    <HistoryView />
                </Suspense>
            )}

            {tab === 'Contributors' && (
                <Suspense fallback={<TabFallback />}>
                    {isDataLoading ? (
                        <div className="max-w-7xl mx-auto py-12 px-6">
                            <h2 className="text-4xl font-serif italic text-[#2D4635] mb-12">The Contributors</h2>
                            <ContributorsSkeleton />
                        </div>
                    ) : (
                        <ContributorsView recipes={recipes} gallery={gallery} trivia={trivia} contributors={contributors} onSelectContributor={(c) => { setContributor(c); setTab('Recipes'); window.scrollTo(0, 0); }} />
                    )}
                </Suspense>
            )}

            {tab === 'Admin' && currentUser.role === 'admin' && (
                <Suspense fallback={<TabFallback />}>
                    <AdminView
                        editingRecipe={editingRecipe}
                        clearEditing={() => setEditingRecipe(null)}
                        recipes={recipes}
                        defaultRecipeIds={Array.from(defaultRecipeIds)}
                        trivia={trivia}
                        contributors={contributors}
                        currentUser={currentUser}
                        dbStats={{ ...dbStats, archivePhone }}
                        onAddRecipe={async (r, f) => {
                            const url = f ? await CloudArchive.uploadFile(f, 'recipes') : r.image;
                            await CloudArchive.upsertRecipe({ ...r, image: url || r.image }, currentUser.name);
                            await refreshLocalState();
                        }}
                        onAddGallery={async (g, f) => {
                            const url = f ? await CloudArchive.uploadFile(f, 'gallery') : '';
                            await CloudArchive.upsertGalleryItem({ ...g, url: url || '' });
                            await refreshLocalState();
                        }}
                        onAddTrivia={async (t) => {
                            await CloudArchive.upsertTrivia(t);
                            await refreshLocalState();
                        }}
                        onDeleteTrivia={async (id) => {
                            await CloudArchive.deleteTrivia(id);
                            await refreshLocalState();
                        }}
                        onDeleteRecipe={async (id) => {
                            await CloudArchive.deleteRecipe(id);
                            await refreshLocalState();
                        }}
                        onUpdateContributor={async (p) => {
                            await CloudArchive.upsertContributor(p);
                            // Sync with current user if they just updated themselves
                            if (currentUser && p.name.toLowerCase() === currentUser.name.toLowerCase()) {
                                const updatedUser = { ...currentUser, name: p.name, picture: p.avatar, role: p.role };
                                setCurrentUser(updatedUser);
                                localStorage.setItem('schafer_user', JSON.stringify(updatedUser));
                            }
                            await refreshLocalState();
                        }}
                        onUpdateArchivePhone={async (p) => {
                            await CloudArchive.setArchivePhone(p);
                            setArchivePhone(p);
                        }}
                        onEditRecipe={setEditingRecipe}
                    />
                </Suspense>
            )}
            {tab === 'Admin' && currentUser.role !== 'admin' && (
                <div className="max-w-4xl mx-auto py-20 px-6 space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                    <div className="text-center space-y-6">
                        <div className="w-24 h-24 bg-orange-50 rounded-full mx-auto flex items-center justify-center text-4xl shadow-inner border border-stone-100">🔐</div>
                        <h2 className="text-5xl font-serif italic text-[#2D4635]">Meet your Administrators</h2>
                        <p className="text-stone-400 font-serif max-w-lg mx-auto italic">
                            These family members help maintain the archive, organize heritage recipes, and verify memories.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
                        {contributors.filter(c => c.role === 'admin').map(admin => (
                            <div key={admin.id} className="bg-white p-8 rounded-[3rem] border border-stone-100 shadow-sm flex flex-col items-center gap-4 transition-all hover:shadow-xl hover:scale-105">
                                <img src={admin.avatar} className="w-24 h-24 rounded-full border-4 border-white shadow-xl bg-stone-50" alt={admin.name} />
                                <div className="text-center">
                                    <h4 className="font-serif italic text-[#2D4635] text-xl leading-none">{admin.name}</h4>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-orange-500 mt-2 block">Legacy Custodian</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="pt-12 border-t border-stone-50 text-center">
                        <p className="text-stone-400 text-xs italic">
                            Need administrative access? Contact one of the curators above to be promoted.
                        </p>
                    </div>
                </div>
            )}

            {tab === 'Profile' && currentUser && (
                <Suspense fallback={<TabFallback />}>
                    <ProfileView
                        currentUser={currentUser}
                        userRecipes={recipes.filter(r => r.contributor === currentUser.name && !defaultRecipeIds.has(r.id))}
                        userHistory={history.filter(h => h.contributor === currentUser.name)}
                        onUpdateProfile={async (name, avatar) => {
                            const existing = contributors.find(c => c.name.toLowerCase() === currentUser.name.toLowerCase());
                            const profileToUpdate = {
                                id: existing?.id || currentUser.id,
                                name,
                                avatar,
                                role: currentUser.role,
                                email: currentUser.email
                            };

                            await CloudArchive.upsertContributor(profileToUpdate);

                            // Local sync
                            const updatedUser = { ...currentUser, name, picture: avatar };
                            setCurrentUser(updatedUser);
                            localStorage.setItem('schafer_user', JSON.stringify(updatedUser));

                            await refreshLocalState();
                        }}
                        onEditRecipe={(recipe) => {
                            setEditingRecipe(recipe);
                            setTab('Admin');
                        }}
                    />
                </Suspense>
            )}
            <Footer activeTab={tab} setTab={setTab} currentUser={currentUser} />
        </div>
    );
};

export default App;
