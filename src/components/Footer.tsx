import React from 'react';
import { UserProfile } from '../types';

interface FooterProps {
    activeTab: string;
    setTab: (t: string) => void;
    currentUser: UserProfile | null;
    className?: string;
}

export const Footer: React.FC<FooterProps> = ({ activeTab, setTab, currentUser, className = '' }) => {
    if (!currentUser) return null;

    return (
        <footer
            className={`fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-t border-stone-100 pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] pb-[env(safe-area-inset-bottom,0px)] ${className}`.trim()}
            role="contentinfo"
            aria-label="Footer"
        >
            <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-center gap-3">
                <button
                    onClick={() => setTab('Profile')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all min-h-[2.75rem] ${
                        activeTab === 'Profile'
                            ? 'bg-[#2D4635] text-white shadow-lg'
                            : 'text-stone-400 hover:bg-stone-50 hover:text-stone-600'
                    }`}
                    aria-current={activeTab === 'Profile' ? 'page' : undefined}
                    aria-label={`${currentUser.name}, view profile`}
                    title="Your profile"
                >
                    <img
                        src={currentUser.picture}
                        alt=""
                        aria-hidden
                        className={`w-7 h-7 rounded-full border-2 object-cover ${
                            activeTab === 'Profile' ? 'border-white/80' : 'border-stone-200'
                        }`}
                    />
                    <span className="hidden sm:inline">Profile</span>
                </button>
                <button
                    onClick={() => setTab('Admin')}
                    className={`px-4 py-2 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all min-h-[2.75rem] flex items-center gap-2 ${
                        activeTab === 'Admin'
                            ? 'bg-[#2D4635] text-white shadow-lg'
                            : 'text-stone-400 hover:bg-stone-50 hover:text-stone-600'
                    }`}
                    aria-current={activeTab === 'Admin' ? 'page' : undefined}
                    aria-label="Admin tools"
                    title="Admin tools"
                >
                    {currentUser.role !== 'admin' ? '🔒 Admin' : 'Admin'}
                </button>
            </div>
        </footer>
    );
};
