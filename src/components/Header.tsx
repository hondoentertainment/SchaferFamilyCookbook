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
    { id: 'Grocery List', title: 'Grocery list and meal planning from saved recipes', label: 'Groceries' },
    { id: 'Profile', title: 'Profile, preferences, admin tools, privacy, and help', label: 'Me' },
];

const NAV_GROUPS: Record<string, string[]> = {
    Home: ['Home'],
    Recipes: ['Recipes', 'Index', 'Collections'],
    'Grocery List': ['Grocery List'],
    Gallery: ['Gallery', 'Trivia', 'Family Story', 'Contributors'],
    Profile: ['Profile', 'Privacy', 'Help'],
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
        <header className="sticky top-0 z-50 border-b border-[#E8DCCB]/80 bg-[#FFF8EC]/90 pt-[env(safe-area-inset-top)] shadow-[0_8px_30px_rgba(45,70,53,0.08)] backdrop-blur-xl dark:border-stone-800 dark:bg-[var(--header-bg)]">
            <div className="mx-auto flex min-h-[3.75rem] max-w-7xl items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-3 md:min-h-0 md:px-6 md:py-4">
                <div className="flex items-center gap-2 sm:gap-3 md:gap-5 min-w-0 flex-1">
                    <button
                        type="button"
                        className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-2xl p-2 transition-colors hover:bg-white/70 active:scale-[0.98] sm:gap-3 md:m-0 md:min-h-0 md:min-w-0 md:justify-start md:p-1"
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
                            className="hidden max-w-[11rem] truncate font-serif text-base italic text-[#2D4635] sm:block sm:text-lg md:text-xl lg:max-w-[14rem] dark:text-emerald-100/90"
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
                                    type="button"
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
                                    className={`min-h-[2.75rem] whitespace-nowrap rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all motion-reduce:transition-none ${
                                        isTabActive(id)
                                            ? 'bg-[#2D4635] text-white shadow-[0_10px_24px_rgba(45,70,53,0.22)]'
                                            : 'text-stone-700 hover:bg-white/75 hover:text-[#2D4635] dark:text-stone-300 dark:hover:bg-stone-800'
                                    }`}
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
                        className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-transparent text-stone-700 transition-colors hover:border-[#E8DCCB] hover:bg-white/75 dark:text-stone-300 dark:hover:bg-stone-800"
                        title={THEME_LABELS[themeMode]}
                        aria-label={`Toggle theme (currently ${THEME_LABELS[themeMode]})`}
                    >
                        <span className="text-lg leading-none">{THEME_ICONS[themeMode]}</span>
                    </button>
                    {currentUser && (
                        <div className="flex items-center gap-1 sm:gap-2 md:gap-4">
                            <div
                                className="hidden min-h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-[#E8DCCB]/80 bg-white/55 px-2 shadow-sm md:flex dark:border-stone-700 dark:bg-stone-900/60"
                                aria-label={`${currentUser.name}, signed in`}
                            >
                                <img src={currentUser.picture} className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 border-white dark:border-stone-700 object-cover shadow-sm shrink-0" alt="" onError={avatarOnError} />
                                <span className="hidden lg:inline text-[10px] font-black uppercase tracking-widest text-stone-500 dark:text-stone-400">
                                    {currentUser.name}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={onLogout}
                                className="flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 py-3 text-[10px] font-black uppercase tracking-widest text-stone-700 transition-colors hover:bg-white/75 hover:text-[#2D4635] sm:px-4 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-100 motion-reduce:transition-none"
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
