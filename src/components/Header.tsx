import React, { useState } from 'react';
import { UserProfile, DBStats } from '../types';
import { siteConfig } from '../config/site';
import { PRIMARY_NAV_TABS, isNavGroupActive } from '../config/navConfig';
import { avatarOnError } from '../utils/avatarFallback';
import { hapticLight } from '../utils/haptics';
import { getStoredTheme, setStoredTheme } from '../utils/theme';
import type { ThemeMode } from '../types';
import { ThemeIcon } from './ThemeIcon';

const FALLBACK_LOGO_SVG = `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="50" fill="var(--color-brand)"/><text x="50" y="62" font-family="serif" font-size="44" fill="white" text-anchor="middle" font-style="italic">S</text></svg>'
)}`;

interface HeaderProps {
    activeTab: string;
    setTab: (t: string) => void;
    currentUser: UserProfile | null;
    dbStats: DBStats;
    onLogout: () => void;
}

const THEME_CYCLE: ThemeMode[] = ['system', 'light', 'dark'];
const THEME_LABELS: Record<ThemeMode, string> = { system: 'System theme', light: 'Light theme', dark: 'Dark theme' };

export const Header: React.FC<HeaderProps> = ({ activeTab, setTab, currentUser, dbStats: _dbStats, onLogout }) => {
    const [logoFailed, setLogoFailed] = useState(false);
    const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredTheme());

    const brandLogoSrc = logoFailed ? FALLBACK_LOGO_SVG : siteConfig.logoUrl;
    const brandLabel = siteConfig.siteName.replace(/\s*Family Cookbook\s*$/i, ' Cookbook');

    const handleThemeToggle = () => {
        hapticLight();
        const next = THEME_CYCLE[(THEME_CYCLE.indexOf(themeMode) + 1) % THEME_CYCLE.length];
        setStoredTheme(next);
        setThemeMode(next);
    };

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
                            className="hidden max-w-[11rem] truncate font-serif text-base italic text-[var(--color-brand)] sm:block sm:text-lg md:text-xl lg:max-w-[14rem] dark:text-emerald-100/90"
                            title={siteConfig.siteName}
                        >
                            {brandLabel}
                        </span>
                    </button>

                    <nav className="hidden md:flex items-center gap-1 overflow-x-auto no-scrollbar py-1 scroll-smooth" style={{ WebkitOverflowScrolling: 'touch' }} aria-label="Main navigation">
                        {PRIMARY_NAV_TABS.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                id={`tab-${tab.id}`}
                                onClick={() => {
                                    hapticLight();
                                    setTab(tab.id);
                                    document.getElementById(`tab-${tab.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        hapticLight();
                                        setTab(tab.id);
                                    }
                                }}
                                title={tab.title}
                                data-testid={tab.id === 'Profile' ? 'nav-profile' : undefined}
                                aria-current={isNavGroupActive(activeTab, tab.id) ? 'page' : undefined}
                                className={`min-h-[2.75rem] whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all motion-reduce:transition-none ${
                                    isNavGroupActive(activeTab, tab.id)
                                        ? 'bg-[var(--color-brand)] text-white shadow-[0_10px_24px_rgba(45,70,53,0.22)]'
                                        : 'text-stone-700 hover:bg-white/75 hover:text-[var(--color-brand)] dark:text-stone-300 dark:hover:bg-stone-800'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
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
                        <ThemeIcon mode={themeMode} />
                    </button>
                    {currentUser && (
                        <div className="flex items-center gap-1 sm:gap-2 md:gap-4">
                            <div
                                className="hidden min-h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-[#E8DCCB]/80 bg-white/55 px-2 shadow-sm md:flex dark:border-stone-700 dark:bg-stone-900/60"
                                aria-label={`${currentUser.name}, signed in`}
                            >
                                <img src={currentUser.picture} className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 border-white dark:border-stone-700 object-cover shadow-sm shrink-0" alt="" onError={avatarOnError} />
                                <span className="hidden lg:inline text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                                    {currentUser.name}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={onLogout}
                                className="flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 py-3 text-xs font-bold uppercase tracking-wider text-stone-700 transition-colors hover:bg-white/75 hover:text-[var(--color-brand)] sm:px-4 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-100 motion-reduce:transition-none"
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
