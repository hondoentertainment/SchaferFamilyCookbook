import React from 'react';
import { UserProfile } from '../types';

interface FooterProps {
    activeTab: string;
    setTab: (t: string) => void;
    currentUser: UserProfile | null;
}

export const Footer: React.FC<FooterProps> = ({ activeTab, setTab, currentUser }) => {
    if (!currentUser) return null;

    return (
        <footer
            className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-t border-stone-100 pb-[env(safe-area-inset-bottom)]"
            role="contentinfo"
            aria-label="Footer"
        >
            <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-center">
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
