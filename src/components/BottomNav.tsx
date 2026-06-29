import React from 'react';
import { UserProfile } from '../types';
import { BOTTOM_NAV_TABS } from '../config/navConfig';
import { hapticLight } from '../utils/haptics';
import { avatarOnError } from '../utils/avatarFallback';

const NavIcon: React.FC<{ id: string; active: boolean }> = ({ id, active }) => {
    const stroke = active ? '#2D4635' : 'currentColor';
    const fill = active ? '#2D4635' : 'none';
    const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
    if (id === 'Home') {
        return (
            <svg {...common} aria-hidden>
                <path d="M3 11.5 12 4l9 7.5" fill={active ? '#2D4635' : 'none'} fillOpacity={active ? 0.08 : 0} />
                <path d="M5 10.5V20h14v-9.5" />
                <path d="M10 20v-5h4v5" />
            </svg>
        );
    }
    if (id === 'Recipes') {
        return (
            <svg {...common} aria-hidden>
                <path d="M4 4h12a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4Z" fill={active ? '#2D4635' : 'none'} fillOpacity={active ? 0.08 : 0} />
                <path d="M4 4h12a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4Z" />
                <path d="M9 8h6M9 12h6M9 16h4" />
            </svg>
        );
    }
    if (id === 'Index') {
        return (
            <svg {...common} aria-hidden>
                <path d="M6 7h2M6 12h2M6 17h2" />
                <path d="M11 7h7M11 12h7M11 17h5" />
            </svg>
        );
    }
    if (id === 'Grocery List') {
        return (
            <svg {...common} aria-hidden>
                <path d="M3 5h2l2.5 11h11L21 8H7" fill={fill} fillOpacity={active ? 0.08 : 0} />
                <circle cx="9" cy="20" r="1.5" fill={active ? '#2D4635' : 'none'} />
                <circle cx="17" cy="20" r="1.5" fill={active ? '#2D4635' : 'none'} />
            </svg>
        );
    }
    if (id === 'Gallery') {
        return (
            <svg {...common} aria-hidden>
                <rect x="3" y="6" width="18" height="14" rx="2.5" fill={fill} fillOpacity={active ? 0.08 : 0} />
                <path d="M3 16l5-5 4 4 3-3 6 6" />
                <circle cx="9" cy="10" r="1.6" fill={active ? '#2D4635' : 'none'} />
            </svg>
        );
    }
    return null;
};

interface BottomNavProps {
    activeTab: string;
    setTab: (t: string) => void;
    currentUser: UserProfile | null;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setTab, currentUser }) => {
    if (!currentUser) return null;

    return (
        <nav
            className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#E8DCCB]/90 bg-[#FFF8EC]/95 pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-12px_34px_rgba(45,70,53,0.12)] backdrop-blur-xl md:hidden dark:border-stone-800 dark:bg-stone-950/95"
            role="navigation"
            aria-label="Main navigation"
        >
            <div className="flex min-h-16 items-stretch justify-around px-1">
                {BOTTOM_NAV_TABS.map(({ id, label, group }) => {
                    const isActive = group.some((tabId) => tabId === activeTab);
                    return (
                        <button
                            key={id}
                            type="button"
                            data-testid={
                                id === 'Profile' ? 'bottom-nav-profile' : undefined
                            }
                            onClick={() => {
                                hapticLight();
                                setTab(id);
                            }}
                            aria-current={isActive ? 'page' : undefined}
                            className={`relative flex min-h-11 min-w-0 flex-1 touch-manipulation flex-col items-center justify-center rounded-2xl px-0.5 py-1.5 transition-all active:scale-95 motion-reduce:transition-none ${
                                isActive ? 'bg-white/65 shadow-sm dark:bg-stone-900/70' : 'hover:bg-white/45 dark:hover:bg-stone-900/50'
                            }`}
                            aria-label={id === 'Profile' ? `${currentUser.name}, view profile` : label}
                        >
                            <span
                                className={`absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-b-full transition-all ${
                                    isActive ? 'bg-[#2D4635] opacity-100' : 'bg-transparent opacity-0'
                                }`}
                                aria-hidden
                            />
                            <span className={`mb-0.5 transition-transform ${isActive ? 'scale-105' : ''} ${isActive ? 'text-[#2D4635] dark:text-emerald-300' : 'text-stone-600 dark:text-stone-300'}`}>
                                {id === 'Profile' ? (
                                    <img
                                        src={currentUser.picture}
                                        alt=""
                                        aria-hidden
                                        decoding="async"
                                        onError={avatarOnError}
                                        className={`w-7 h-7 rounded-full object-cover border-2 ${isActive ? 'border-[#2D4635]' : 'border-stone-200 dark:border-stone-700'}`}
                                    />
                                ) : (
                                    <NavIcon id={id} active={isActive} />
                                )}
                            </span>
                            <span
                                className={`max-w-full truncate px-0.5 text-[10px] font-bold tracking-wide sm:text-xs ${
                                    isActive ? 'text-[#2D4635] dark:text-emerald-300' : 'text-stone-700 dark:text-stone-300'
                                }`}
                            >
                                {label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};
