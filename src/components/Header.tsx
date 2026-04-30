import React, { useState } from 'react';
import { UserProfile, DBStats } from '../types';
import { siteConfig } from '../config/site';
import { avatarOnError } from '../utils/avatarFallback';
import { hapticLight } from '../utils/haptics';
import { getStoredTheme, setStoredTheme } from '../utils/theme';
import type { ThemeMode } from '../types';

const FALLBACK_LOGO_SVG = `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="50" fill="#2D4635"/><text x="50" y="62" font-family="serif" font-size="44" fill="white" text-anchor="middle" font-style="italic">S</text></svg>'
)}`;

type NavTab = { id: string; title: string; label?: string };

const PRIMARY_NAV_TABS: Array<{ id: string; title: string; label: string }> = [
    { id: 'Home', title: 'Your personalized cookbook home', label: 'Home' },
    { id: 'Recipes', title: 'Search recipes, collections, and the A–Z index', label: 'Recipes' },
    { id: 'Gallery', title: 'Family photos, story, contributors, and trivia', label: 'Family' },
    { id: 'Grocery List', title: 'Plan shopping and cooking from saved recipes', label: 'Cook' },
    { id: 'Profile', title: 'Profile, preferences, admin tools, and privacy', label: 'Me' },
];

const NAV_GROUPS: Record<string, string[]> = {
    Home: ['Home'],
    Recipes: ['Recipes', 'Index', 'Collections'],
    'Grocery List': ['Grocery List'],
    Gallery: ['Gallery', 'Trivia', 'Family Story', 'Contributors'],
    Profile: ['Profile', 'Privacy'],
};

interface HeaderProps {
    activeTab: string;
    setTab: (t: string) => void;
    currentUser: UserProfile | null;
    dbStats: DBStats;
    onLogout: () => void;
}

const THEME_CYCLE: ThemeMode[] = ['system', 'light', 'dark'];
const THEME_ICONS: Record<ThemeMode, string> = { system: '💻', light: '☀️', dark: '🌙' };
const THEME_LABELS: Record<ThemeMode, string> = { system: 'System theme', light: 'Light theme', dark: 'Dark theme' };

export const Header: React.FC<HeaderProps> = ({ activeTab, setTab, currentUser, dbStats: _dbStats, onLogout }) => {
    const [logoFailed, setLogoFailed] = useState(false);
    const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredTheme());

    const brandLogoSrc = logoFailed ? FALLBACK_LOGO_SVG : FALLBACK_LOGO_SVG;
    const brandLabel = siteConfig.siteName.replace(/\s*Family Cookbook\s*$/i, ' Cookbook');

    const handleThemeToggle = () => {
        hapticLight();
        const next = THEME_CYCLE[(THEME_CYCLE.indexOf(themeMode) + 1) % THEME_CYCLE.length];
        setStoredTheme(next);
        setThemeMode(next);
    };

    const navTabs = PRIMARY_NAV_TABS;
    const isTabActive = (id: string) => NAV_GROUPS[id]?.includes(activeTab) ?? activeTab === id;

    return (
        <header className="sticky top-0 z-50 bg-white/90 dark:bg-[var(--header-bg)] backdrop-blur-md border-b border-stone-100 dark:border-stone-800 pt-[env(safe-area-inset-top)] shadow-[0_1px_0_rgba(0,0,0,0.03)]">
            <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 flex items-center justify-between gap-2 min-h-[3.5rem] md:min-h-0">
                <div className="flex items-center gap-2 sm:gap-3 md:gap-5 min-w-0 flex-1">
                    <button
                        type="button"
                        className="flex items-center gap-2 sm:gap-3 cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2 focus-visible:rounded-lg min-h-11 min-w-11 md:min-h-0 md:min-w-0 justify-center md:justify-start -m-2 p-2 md:m-0 md:p-0"
                        onClick={() => { hapticLight(); setTab('Home'); }}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hapticLight(); setTab('Home'); } }}
                        aria-label={`${siteConfig.siteName} — go to home`}
                    >
                        <img
                            src={brandLogoSrc}
                            className="w-8 h-8 sm:w-9 sm:h-9 md:w-8 md:h-8 rounded-full object-cover ring-1 ring-stone-100 shadow-sm"
                            alt=""
                            onError={() => setLogoFailed(true)}
                        />
                        <span
                            className="font-serif italic text-base sm:text-lg md:text-xl text-[#2D4635] dark:text-emerald-100/90 hidden sm:block max-w-[11rem] lg:max-w-[14rem] truncate"
                            title={siteConfig.siteName}
                        >
                            {brandLabel}
                        </span>
                    </button>

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
                                        hapticLight();
                                        setTab(id);
                                        document.getElementById(`tab-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            hapticLight();
                                            setTab(id);
                                        }
                                    }}
                                    title={title}
                                    data-testid={id === 'Profile' ? 'nav-profile' : undefined}
                                    aria-current={isTabActive(id) ? 'page' : undefined}
                                    className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors whitespace-nowrap min-h-[2.75rem] motion-reduce:transition-none ${isTabActive(id) ? 'bg-[#2D4635] text-white shadow-lg' : 'text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800'}`}
                                >
                                    {(tab as NavTab).label || id}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                <div className="flex items-center gap-1 sm:gap-2 md:gap-4 shrink-0">
                    <button
                        type="button"
                        onClick={handleThemeToggle}
                        className="min-h-11 min-w-11 flex items-center justify-center rounded-full text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                        title={THEME_LABELS[themeMode]}
                        aria-label={`Toggle theme (currently ${THEME_LABELS[themeMode]})`}
                    >
                        <span className="text-lg leading-none">{THEME_ICONS[themeMode]}</span>
                    </button>
                    {currentUser && (
                        <div className="flex items-center gap-1 sm:gap-2 md:gap-4">
                            <div
                                className="hidden md:flex items-center gap-2 rounded-full min-h-11 min-w-11 justify-center px-2"
                                aria-label={`${currentUser.name}, signed in`}
                            >
                                <img src={currentUser.picture} className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 border-white dark:border-stone-700 object-cover shadow-sm shrink-0" alt="" onError={avatarOnError} />
                                <span className="hidden lg:inline text-[10px] font-black uppercase tracking-widest text-stone-500 dark:text-stone-400">
                                    {currentUser.name}
                                </span>
                            </div>
                            <button
                                onClick={onLogout}
                                className="px-3 sm:px-4 py-3 min-h-11 min-w-11 flex items-center justify-center text-[10px] font-black uppercase tracking-widest text-stone-500 dark:text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 rounded-full transition-colors motion-reduce:transition-none"
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
