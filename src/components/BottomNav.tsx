import React from 'react';
import { UserProfile } from '../types';
import { hapticLight } from '../utils/haptics';

const MAIN_TABS = [
    { id: 'Recipes', label: 'Recipes', icon: '📖' },
    { id: 'Index', label: 'A–Z', icon: '🔤' },
    { id: 'Gallery', label: 'Gallery', icon: '🖼️' },
    { id: 'Grocery', label: 'Grocery', icon: '🛒' },
    { id: 'Trivia', label: 'Trivia', icon: '💡' },
] as const;

interface BottomNavProps {
    activeTab: string;
    setTab: (t: string) => void;
    currentUser: UserProfile | null;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setTab, currentUser }) => {
    if (!currentUser) return null;

    const tabs = MAIN_TABS;

    return (
        <nav
            className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-100 shadow-[0_-1px_0_rgba(0,0,0,0.04)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] pb-[env(safe-area-inset-bottom,0px)] pt-px"
            role="navigation"
            aria-label="Main navigation"
        >
            <div className="flex items-center justify-around min-h-[3.5rem] py-1">
                {tabs.map(({ id, label, icon }) => (
                    <button
                        key={id}
                        onClick={() => {
                            hapticLight();
                            setTab(id);
                        }}
                        aria-current={activeTab === id ? 'page' : undefined}
                        className={`flex flex-col items-center justify-center flex-1 min-w-0 min-h-11 py-2 px-1 transition-colors touch-manipulation active:scale-95 ${
                            activeTab === id
                                ? 'text-[#2D4635]'
                                : 'text-stone-400'
                        }`}
                        aria-label={label}
                    >
                        <span className="text-xl sm:text-2xl mb-0.5 select-none" aria-hidden>
                            {icon}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider truncate max-w-full px-0.5">
                            {label}
                        </span>
                    </button>
                ))}
            </div>
        </nav>
    );
};
