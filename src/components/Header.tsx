import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, DBStats } from '../types';

const LOGO_URL = "https://images.unsplash.com/photo-1500076656116-558758c991c1?auto=format&fit=crop&q=80&w=1000";

const EXTRA_TABS = [
    { id: 'Family Story', title: 'Family food history narrative' },
    { id: 'Contributors', title: 'Contributor directory' },
] as const;

type NavTab = { id: string; title: string; label?: string };

const ALL_NAV_TABS = [
    { id: 'Recipes', title: 'Browse recipes with filters', label: 'Recipes' },
    { id: 'Index', title: 'Browse recipes A–Z', label: 'A–Z' },
    { id: 'Gallery', title: 'Family photos and videos', label: 'Gallery' },
    { id: 'Grocery', title: 'Grocery list', label: 'Grocery' },
    { id: 'Trivia', title: 'Family trivia quiz', label: 'Trivia' },
    ...EXTRA_TABS.map((t) => ({ ...t, label: t.id })),
    { id: 'Profile', title: 'Your profile and contributions', label: 'Profile' }
];

interface HeaderProps {
    activeTab: string;
    setTab: (t: string) => void;
    currentUser: UserProfile | null;
    dbStats: DBStats;
    onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setTab, currentUser, dbStats: _dbStats, onLogout }) => {
    const [moreOpen, setMoreOpen] = useState(false);
    const moreRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!moreOpen) return;
        const onClick = (e: MouseEvent) => {
            if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
                setMoreOpen(false);
            }
        };
        const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setMoreOpen(false); };
        document.addEventListener('click', onClick);
        document.addEventListener('keydown', onKeyDown);
        return () => { document.removeEventListener('click', onClick); document.removeEventListener('keydown', onKeyDown); };
    }, [moreOpen]);

    const navTabs = ALL_NAV_TABS.filter(({ id }) => (id !== 'Profile' && id !== 'Grocery') || currentUser);

    return (
        <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-stone-100 pt-[env(safe-area-inset-top)] shadow-[0_1px_0_rgba(0,0,0,0.03)]">
            <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 flex items-center justify-between gap-2 min-h-[3.5rem] md:min-h-0">
                <div className="flex items-center gap-2 sm:gap-3 md:gap-8 min-w-0 flex-1">
                    <div
                        role="button"
                        tabIndex={0}
                        className="flex items-center gap-2 sm:gap-3 cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2 focus-visible:rounded-lg min-h-11 min-w-11 md:min-h-0 md:min-w-0 justify-center md:justify-start -m-2 p-2 md:m-0 md:p-0"
                        onClick={() => setTab('Recipes')}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTab('Recipes'); } }}
                        aria-label="Go to Recipes"
                    >
                        <img src={LOGO_URL} className="w-8 h-8 sm:w-9 sm:h-9 md:w-8 md:h-8 rounded-full object-cover ring-1 ring-stone-100" alt="" />
                        <span className="font-serif italic text-base sm:text-lg md:text-xl text-[#2D4635] hidden sm:block">Archive</span>
                    </div>

                    {/* Desktop: full horizontal nav */}
                    <nav className="hidden md:flex items-center gap-1 overflow-x-auto no-scrollbar py-1 scroll-smooth" style={{ WebkitOverflowScrolling: 'touch' }} aria-label="Main navigation">
                        {navTabs.map((tab) => {
                            const id = tab.id;
                            const title = tab.title;
                            return (
                            <button
                                key={id}
                                id={`tab-${id}`}
                                onClick={() => {
                                    setTab(id);
                                    document.getElementById(`tab-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                                }}
                                title={title}
                                aria-current={activeTab === id ? 'page' : undefined}
                                className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap min-h-[2.75rem] ${activeTab === id ? 'bg-[#2D4635] text-white shadow-lg' : 'text-stone-400 hover:bg-stone-50'}`}
                            >
                                {(tab as NavTab).label || id}
                            </button>
                            );
                        })}
                    </nav>

                    {/* Mobile: More menu (Family Story, Contributors) */}
                    <div className="relative md:hidden shrink-0" ref={moreRef}>
                        <button
                            type="button"
                            onClick={() => setMoreOpen(v => !v)}
                            aria-expanded={moreOpen}
                            aria-haspopup="true"
                            aria-label="More sections"
                            className="min-h-11 min-w-11 flex items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 active:bg-stone-200 transition-colors"
                        >
                            <span className="text-xl" aria-hidden>☰</span>
                        </button>
                        {moreOpen && (
                            <div
                                role="menu"
                                className="absolute top-full left-0 mt-1 py-2 bg-white rounded-2xl shadow-xl border border-stone-100 min-w-[10rem] animate-in fade-in slide-in-from-top-2 duration-200 z-50"
                                aria-label="More sections"
                            >
                                {EXTRA_TABS.map(({ id }) => (
                                    <button
                                        key={id}
                                        role="menuitem"
                                        onClick={() => { setTab(id); setMoreOpen(false); }}
                                        className={`w-full px-4 py-3 text-left text-sm font-bold uppercase tracking-wider transition-colors first:rounded-t-2xl last:rounded-b-2xl ${activeTab === id ? 'bg-[#2D4635] text-white' : 'text-stone-600 hover:bg-stone-50'}`}
                                    >
                                        {id}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-1 sm:gap-2 md:gap-4 shrink-0">
                    {currentUser && (
                        <div className="flex items-center gap-1 sm:gap-2 md:gap-4">
                            <div
                                role="button"
                                tabIndex={0}
                                className={`flex items-center cursor-pointer rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2 min-h-11 min-w-11 flex items-center justify-center ${activeTab === 'Profile' ? 'ring-2 ring-[#2D4635]' : 'hover:ring-2 hover:ring-stone-200'}`}
                                onClick={() => setTab('Profile')}
                                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTab('Profile'); } }}
                                aria-label={`${currentUser.name}, view profile`}
                            >
                                <img src={currentUser.picture} className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 border-white object-cover shadow-sm" alt="" />
                            </div>
                            <button
                                onClick={onLogout}
                                className="px-3 sm:px-4 py-3 min-h-11 min-w-11 flex items-center justify-center text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-stone-600 hover:bg-stone-50 rounded-full transition-all"
                                title="Switch identity"
                                aria-label="Log out and switch identity"
                            >
                                Log out
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};
