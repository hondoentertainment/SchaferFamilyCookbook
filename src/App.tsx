import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { UserProfile, Recipe, GalleryItem, Trivia, DBStats, ContributorProfile } from './types';
import { CloudArchive } from './services/db';
import { Header } from './components/Header';
import RecipeCard from './components/RecipeCard';
import { RecipeModal } from './components/RecipeModal';
import { AdminView } from './components/AdminView';
import { AlphabeticalIndex } from './components/AlphabeticalIndex';
import { ContributorsView } from './components/ContributorsView';
import { ProfileView } from './components/ProfileView';
import { HistoryView } from './components/HistoryView';
import { TriviaView } from './components/TriviaView';
import { HistoryEntry } from './types';
import { TRIVIA_SEED } from './data/trivia_seed';
import { CATEGORY_IMAGES } from './constants';
import { GoogleGenAI } from '@google/genai';

const getGeminiApiKey = () => {
    return ((import.meta as any).env?.VITE_GEMINI_API_KEY) ||
        (process.env?.GEMINI_API_KEY) ||
        (process.env?.VITE_GEMINI_API_KEY) ||
        '';
};

const needsImage = (recipe: Recipe) => {
    if (!recipe.image) return true;
    if (Object.values(CATEGORY_IMAGES).includes(recipe.image)) return true;
    if (recipe.image.includes('fallback-gradient')) return true;
    return false;
};

const autoSourceImage = async (recipe: Recipe): Promise<string | null> => {
    const apiKey = getGeminiApiKey();
    if (!apiKey) return null;

    try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: [{
                role: 'user',
                parts: [{
                    text: `Describe the dish "${recipe.title}" (${recipe.category}) in 5-10 words for an AI image generator. Focus on the food itself in a rustic, appetizing style. Example: "fluffy blackberries pancakes with melting butter rustic farmhouse style". Return ONLY the description.`
                }]
            }],
        });
        const description = response.text.trim().replace(/['"\\n]/g, '');
        if (description.length > 5) {
            const encodedPrompt = encodeURIComponent(`${description} food photography, highly detailed, 4k, appetizing, warm lighting`);
            const seed = Math.floor(Math.random() * 1000);
            return `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${seed}&width=800&height=600&nologo=true`;
        }
    } catch (e) {
        console.error('Auto-source image failed:', e);
    }
    return null;
};

const App: React.FC = () => {
    const [tab, setTab] = useState('Recipes');
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [gallery, setGallery] = useState<GalleryItem[]>([]);
    const [trivia, setTrivia] = useState<Trivia[]>([]);
    const [contributors, setContributors] = useState<ContributorProfile[]>([]);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
    const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
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
        } catch (e) {
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

    // Filters
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('All');
    const [contributor, setContributor] = useState('All');

    // Wrapped in useCallback to maintain reference stability for React.memo
    const refreshLocalState = useCallback(async () => {
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
    }, []);

    // Sync Listeners
    useEffect(() => {
        const provider = CloudArchive.getProvider();
        if (provider !== 'firebase' || !CloudArchive.getFirebase()) {
            refreshLocalState().then(() => {
                // Auto-seed trivia if empty in local mode
                if (provider === 'local') {
                    CloudArchive.getTrivia().then(current => {
                        if (current.length === 0) {
                            Promise.all(TRIVIA_SEED.map(t => CloudArchive.upsertTrivia(t as any)))
                                .then(refreshLocalState);
                        }
                    });
                }
            });
            return;
        }

        const unsubR = CloudArchive.subscribeRecipes(setRecipes);
        const unsubT = CloudArchive.subscribeTrivia(setTrivia);
        const unsubG = CloudArchive.subscribeGallery(setGallery);
        const unsubC = CloudArchive.subscribeContributors(setContributors);
        const unsubH = CloudArchive.subscribeHistory(setHistory);
        return () => { unsubR(); unsubT(); unsubG(); unsubC(); unsubH(); };
    }, []);

    useEffect(() => {
        setDbStats(prev => ({ ...prev, recipeCount: recipes.length, triviaCount: trivia.length, galleryCount: gallery.length }));
    }, [recipes, trivia, gallery]);

    const handleLoginSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!loginName.trim()) return;

        // Check if we have a stored profile for this person
        const name = loginName.trim();
        const existing = contributors.find(c => c.name.toLowerCase() === name.toLowerCase());

        // Super Admin Detection
        const isSuper = name.toLowerCase() === 'kyle' || name.toLowerCase() === 'hondo4185@gmail.com';
        const email = isSuper && name.includes('@') ? name : (existing?.email);

        const u: UserProfile = {
            id: existing?.id || 'u' + Date.now(),
            name: existing?.name || name,
            picture: existing?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
            role: isSuper ? 'admin' : ((existing?.role as any) || (name.toLowerCase() === 'admin' ? 'admin' : 'user')),
            email: email
        };
        localStorage.setItem('schafer_user', JSON.stringify(u));
        setCurrentUser(u);
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

    const handleRecipeClick = useCallback(async (recipe: Recipe) => {
        if (needsImage(recipe)) {
            // Auto-source image in background, don't block opening
            autoSourceImage(recipe).then(async (url) => {
                if (url && currentUser) {
                    await CloudArchive.upsertRecipe({ ...recipe, image: url }, currentUser.name);
                    await refreshLocalState();
                }
            });
        }
        setSelectedRecipe(recipe);
    }, [currentUser, refreshLocalState]);

    if (!currentUser) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#2D4635] p-6">
                <div className="bg-white rounded-[4rem] p-10 md:p-16 w-full max-w-xl shadow-2xl relative overflow-hidden text-center animate-in zoom-in duration-700">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-800 via-orange-300 to-emerald-800" />

                    <div className="relative mb-12">
                        <div className="w-24 h-24 bg-stone-100 rounded-full mx-auto relative overflow-hidden border-4 border-white shadow-2xl group transition-all">
                            {loginName ? (
                                <img
                                    src={getAvatar(loginName)}
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
                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[#A0522D] ml-2">Legacy Contributor Name</label>
                            <input
                                autoFocus
                                type="text"
                                placeholder="e.g. Grandma Joan"
                                className="w-full p-6 bg-stone-50 border border-stone-100 rounded-3xl text-center text-xl font-serif outline-none focus:ring-2 focus:ring-[#2D4635]/10 focus:bg-white transition-all shadow-inner"
                                value={loginName}
                                onChange={e => setLoginName(e.target.value)}
                            />
                        </div>
                        <button type="submit" className="w-full py-5 bg-[#2D4635] text-white rounded-full text-xs font-black uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all">
                            Enter The Archive
                        </button>
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
                <div className="max-w-7xl mx-auto py-12 px-6">
                    <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-8">
                        <div>
                            <h2 className="text-4xl font-serif italic text-[#2D4635]">Family Gallery</h2>
                            <p className="text-stone-400 font-serif italic mt-2">Captured moments across the generations.</p>
                        </div>
                        {archivePhone && (
                            <div className="bg-emerald-50 rounded-[2rem] p-6 border border-emerald-100 flex items-center gap-6 animate-in slide-in-from-right-8 duration-700">
                                <span className="text-3xl">📱</span>
                                <div>
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-800 leading-none mb-1">Text your memories</h4>
                                    <p className="text-sm text-emerald-700 font-serif italic">Photo/Video to: <span className="font-bold not-italic">{archivePhone}</span></p>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="columns-1 md:columns-2 lg:columns-3 gap-8 space-y-8">
                        {gallery.map(item => (
                            <div key={item.id} className="break-inside-avoid bg-white p-4 rounded-[2rem] border border-stone-100 shadow-md group hover:shadow-2xl transition-all">
                                {item.type === 'video' ? (
                                    <div className="relative rounded-2xl overflow-hidden mb-4 bg-black">
                                        <video
                                            src={item.url}
                                            className="w-full"
                                            controls
                                            muted
                                            onMouseOver={e => (e.target as HTMLVideoElement).play()}
                                            onMouseOut={e => (e.target as HTMLVideoElement).pause()}
                                        />
                                    </div>
                                ) : (
                                    <img src={item.url || `https://images.unsplash.com/photo-1511895426328-dc8714191300?w=500`} className="w-full rounded-2xl mb-4" alt={item.caption} />
                                )}
                                <p className="font-serif italic text-stone-800 text-lg px-2">{item.caption}</p>
                                <div className="flex justify-between items-center mt-4 px-2">
                                    <div className="flex items-center gap-2">
                                        <img src={getAvatar(item.contributor)} className="w-4 h-4 rounded-full" alt="" />
                                        <span className="text-[9px] uppercase tracking-widest text-[#A0522D]">Added by {item.contributor}</span>
                                    </div>
                                    <button onClick={() => CloudArchive.deleteGalleryItem(item.id)} className="text-stone-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">✕</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Trivia View
    if (tab === 'Trivia') {
        return (
            <div className="min-h-screen bg-[#FDFBF7]">
                <Header activeTab={tab} setTab={setTab} currentUser={currentUser} dbStats={dbStats} onLogout={handleLogout} />
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
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FDFBF7] text-stone-800 selection:bg-[#A0522D] selection:text-white pb-20">
            <Header activeTab={tab} setTab={setTab} currentUser={currentUser} dbStats={dbStats} onLogout={handleLogout} />

            {selectedRecipe && (
                <RecipeModal
                    recipe={selectedRecipe}
                    onClose={() => setSelectedRecipe(null)}
                    onEdit={(r) => {
                        setEditingRecipe(r);
                        setSelectedRecipe(null);
                        setTab('Admin');
                    }}
                    onDelete={(id) => {
                        CloudArchive.deleteRecipe(id);
                        setSelectedRecipe(null);
                    }}
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
                            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-stone-400">🔍</span>
                            <input
                                type="text"
                                placeholder="Search by title..."
                                className="w-full pl-14 pr-6 py-4 bg-white/80 backdrop-blur border border-stone-200 rounded-full shadow-sm outline-none focus:ring-2 focus:ring-[#2D4635]/10 transition-all font-serif italic placeholder:text-stone-300"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <select className="px-8 py-4 bg-white/80 backdrop-blur border border-stone-200 rounded-full shadow-sm outline-none text-sm font-bold text-stone-600 cursor-pointer hover:bg-white" value={category} onChange={e => setCategory(e.target.value)}>
                            <option value="All">All Categories</option>
                            {['Breakfast', 'Main', 'Dessert', 'Side', 'Appetizer', 'Bread', 'Dip/Sauce', 'Snack'].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select className="px-8 py-4 bg-white/80 backdrop-blur border border-stone-200 rounded-full shadow-sm outline-none text-sm font-bold text-stone-600 cursor-pointer hover:bg-white" value={contributor} onChange={e => setContributor(e.target.value)}>
                            <option value="All">All Contributors</option>
                            {Array.from(new Set(recipes.map(r => r.contributor))).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    {/* Admin Quick Actions */}
                    {currentUser?.role === 'admin' && (
                        <div className="flex gap-3 items-center justify-end">
                            <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Admin:</span>
                            <button
                                onClick={async () => {
                                    const missing = recipes.filter(r => needsImage(r));
                                    if (missing.length === 0) { alert('All recipes have images!'); return; }
                                    if (!confirm(`Source images for ${missing.length} recipes?`)) return;
                                    for (const r of missing) {
                                        const url = await autoSourceImage(r);
                                        if (url) await CloudArchive.upsertRecipe({ ...r, image: url }, currentUser.name);
                                    }
                                    await refreshLocalState();
                                    alert('Done!');
                                }}
                                className="px-4 py-2 bg-[#A0522D]/10 text-[#A0522D] rounded-full text-[10px] font-black uppercase tracking-widest border border-[#A0522D]/20 hover:bg-[#A0522D]/20 transition-colors"
                            >
                                🖼️ Fill Missing Images
                            </button>
                            <button
                                onClick={async () => {
                                    if (!confirm(`Refresh images for ALL ${recipes.length} recipes?`)) return;
                                    for (const r of recipes) {
                                        const url = await autoSourceImage(r);
                                        if (url) await CloudArchive.upsertRecipe({ ...r, image: url }, currentUser.name);
                                    }
                                    await refreshLocalState();
                                    alert('Done!');
                                }}
                                className="px-4 py-2 bg-red-50 text-red-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-red-200 hover:bg-red-100 transition-colors"
                            >
                                🔄 Refresh All
                            </button>
                        </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {filteredRecipes.map(recipe => (
                            <RecipeCard
                                key={recipe.id}
                                recipe={recipe}
                                onClick={handleRecipeClick}
                                contributorAvatar={getAvatar(recipe.contributor)}
                            />
                        ))}
                    </div>

                    {filteredRecipes.length === 0 && (
                        <div className="py-20 text-center space-y-4 opacity-50">
                            <span className="text-4xl">🍂</span>
                            <p className="font-serif italic text-stone-400">No recipes found in the archive.</p>
                        </div>
                    )}
                </main>
            )}

            {tab === 'Index' && <AlphabeticalIndex recipes={recipes} onSelect={setSelectedRecipe} />}

            {tab === 'History' && <HistoryView />}

            {tab === 'Contributors' && <ContributorsView recipes={recipes} contributors={contributors} onSelectContributor={(c) => { setContributor(c); setTab('Recipes'); window.scrollTo(0, 0); }} />}

            {tab === 'Admin' && currentUser.role === 'admin' && (
                <AdminView
                    editingRecipe={editingRecipe}
                    clearEditing={() => setEditingRecipe(null)}
                    recipes={recipes}
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
                    onUpdateArchivePhone={(p) => {
                        setArchivePhone(p);
                        localStorage.setItem('schafer_archive_phone', p);
                    }}
                />
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
                <ProfileView
                    currentUser={currentUser}
                    userRecipes={recipes.filter(r => r.contributor === currentUser.name)}
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
            )}
        </div>
    );
};

export default App;
