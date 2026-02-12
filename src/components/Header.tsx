import React from 'react';
import { UserProfile, DBStats } from '../types';

const LOGO_URL = "https://images.unsplash.com/photo-1500076656116-558758c991c1?auto=format&fit=crop&q=80&w=1000";

interface HeaderProps {
    activeTab: string;
    setTab: (t: string) => void;
    currentUser: UserProfile | null;
    dbStats: DBStats;
    onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setTab, currentUser, dbStats, onLogout }) => {
    return (
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-stone-100">
            <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 md:gap-8 min-w-0">
                    <div className="flex items-center gap-3 cursor-pointer shrink-0" onClick={() => setTab('Recipes')}>
                        <img src={LOGO_URL} className="w-7 h-7 md:w-8 md:h-8 rounded-full object-cover" alt="Schafer Logo" />
                        <span className="font-serif italic text-lg md:text-xl text-[#2D4635] hidden sm:block">Archive</span>
                    </div>
                    <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1 scroll-smooth">
                        {[
                            { id: 'Recipes', title: 'Browse recipes with filters' },
                            { id: 'Index', title: 'Alphabetical recipe index A–Z' },
                            { id: 'Gallery', title: 'Family photos and videos' },
                            { id: 'Trivia', title: 'Family trivia quiz' },
                            { id: 'Family Story', title: 'Family food history narrative' },
                            { id: 'Contributors', title: 'Contributor directory' },
                            { id: 'Profile', title: 'Your profile and contributions' },
                            { id: 'Admin', title: 'Admin tools' }
                        ]
                            .filter(({ id }) => id !== 'Profile' || currentUser)
                            .map(({ id, title }) => (
                                <button
                                    key={id}
                                    id={`tab-${id}`}
                                    onClick={() => {
                                        setTab(id);
                                        document.getElementById(`tab-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                                    }}
                                    title={title}
                                    className={`px-3 md:px-4 py-2 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === id ? 'bg-[#2D4635] text-white shadow-lg' : 'text-stone-400 hover:bg-stone-50'
                                        }`}
                                >
                                    {id === 'Admin' && currentUser?.role !== 'admin' ? '🔒 Admin' : id}
                                </button>
                            ))}
                    </nav>
                </div>
                <div className="flex items-center gap-4">
                    {currentUser && (
                        <div className="flex items-center gap-3 md:gap-4">
                            <div
                                className={`flex items-center gap-3 cursor-pointer group px-2 py-1 rounded-full transition-all ${activeTab === 'Profile' ? 'bg-stone-50' : 'hover:bg-stone-50/50'}`}
                                onClick={() => setTab('Profile')}
                            >
                                <div className="text-right hidden md:block">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-[#2D4635] leading-none mb-1">{currentUser.name}</p>
                                    <p className="text-[8px] font-bold text-stone-400 uppercase tracking-[0.2em]">View Identity</p>
                                </div>
                                <img src={currentUser.picture} className={`w-9 h-9 rounded-full border-2 transition-all shadow-sm ${activeTab === 'Profile' ? 'border-[#2D4635]' : 'border-white group-hover:border-stone-200'}`} alt={currentUser.name} />
                            </div>
                            <button
                                onClick={onLogout}
                                className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-stone-400 hover:text-stone-600 hover:bg-stone-50 rounded-full transition-all"
                                title="Switch identity"
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
