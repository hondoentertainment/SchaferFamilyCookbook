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
            <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => setTab('Recipes')}>
                        <img src={LOGO_URL} className="w-8 h-8 rounded-full object-cover" alt="Schafer Logo" />
                        <span className="font-serif italic text-xl text-[#2D4635] hidden md:block">The Schafer Archive</span>
                    </div>
                    <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                        {['Recipes', 'Index', 'Gallery', 'Trivia', 'Contributors', 'Admin'].map(t => (
                            <button
                                key={t}
                                onClick={() => setTab(t)}
                                className={`px-3 md:px-4 py-2 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === t ? 'bg-[#2D4635] text-white shadow-lg' : 'text-stone-400 hover:bg-stone-50'
                                    }`}
                            >
                                {t === 'Admin' && currentUser?.role !== 'admin' ? '🔒 Admin' : t}
                            </button>
                        ))}
                    </nav>
                </div>
                <div className="flex items-center gap-4">
                    <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-stone-50 rounded-full border border-stone-200">
                        <div className={`w-1.5 h-1.5 rounded-full ${dbStats.activeProvider === 'local' ? 'bg-emerald-400' : 'bg-orange-400'}`} />
                        <span className="text-[7px] font-bold uppercase text-stone-500 tracking-tighter">
                            {dbStats.activeProvider.toUpperCase()} {dbStats.isCloudActive ? 'LIVE' : 'MODE'}
                        </span>
                    </div>
                    {currentUser && (
                        <div className="flex items-center gap-4 pl-4 border-l border-stone-100">
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
                                className="w-8 h-8 rounded-full bg-stone-50 text-[#A0522D] flex items-center justify-center hover:bg-orange-50 transition-all text-[10px] shadow-inner border border-stone-100"
                                title="Exit Archive"
                            >
                                🚪
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};
