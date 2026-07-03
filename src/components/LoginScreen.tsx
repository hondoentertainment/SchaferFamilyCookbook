import React, { useMemo, useState } from 'react';
import type { ContributorProfile, GalleryItem, Recipe, Trivia } from '../types';
import { siteConfig } from '../config/site';
import { PLACEHOLDER_AVATAR } from '../constants';
import { avatarOnError } from '../utils/avatarFallback';
import { contributorAvatarUrlForName } from '../utils/contributorAvatar';
import { hapticLight } from '../utils/haptics';
import {
    findLoginNameSuggestions,
    formatAffiliationSummary,
    resolveLoginAffiliation,
    totalContributorContent,
} from '../utils/loginMatch';

export type LoginIntent = 'returning' | 'new';

interface LoginScreenProps {
    contributors: ContributorProfile[];
    recipes: Recipe[];
    gallery: GalleryItem[];
    trivia: Trivia[];
    recipeCount: number;
    onLogin: (name: string) => void;
    onBrowseGuest: () => void;
}

function firstName(name: string): string {
    return name.trim().split(/\s+/)[0] ?? name;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
    contributors,
    recipes,
    gallery,
    trivia,
    recipeCount,
    onLogin,
    onBrowseGuest,
}) => {
    const [intent, setIntent] = useState<LoginIntent | null>(null);
    const [loginName, setLoginName] = useState('');
    const [familySearch, setFamilySearch] = useState('');

    const lc = siteConfig.loginCopy;
    const loginPlaceholder = lc?.placeholder ?? 'Your name';
    const loginCta = lc?.cta ?? 'Continue';
    const loginHelp = lc?.helpText ?? 'Need access?';
    const trustStrip = lc?.trustStrip ?? [
        'Save favorites & notes across devices',
        'Link to recipes already in the archive',
        'Share photos with the family gallery',
    ];

    const trimmedName = loginName.trim();
    const affiliation = useMemo(
        () => resolveLoginAffiliation(trimmedName, contributors, recipes, gallery, trivia),
        [trimmedName, contributors, recipes, gallery, trivia]
    );

    const suggestions = useMemo(() => {
        if (!trimmedName || trimmedName.length < 2) return [];
        if (affiliation.matchType === 'exact' || affiliation.matchType === 'alias') return [];
        return findLoginNameSuggestions(trimmedName, contributors, recipes, gallery, trivia, 4);
    }, [trimmedName, contributors, recipes, gallery, trivia, affiliation.matchType]);

    const filteredQuickFamily = useMemo(() => {
        const q = familySearch.trim().toLowerCase();
        const sorted = [...contributors].sort((a, b) => a.name.localeCompare(b.name));
        if (!q) return sorted.slice(0, 9);
        return sorted.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 9);
    }, [contributors, familySearch]);

    const loginPreviewAvatar = useMemo(() => {
        if (!trimmedName) return PLACEHOLDER_AVATAR;
        return (
            affiliation.profile?.avatar
            ?? contributors.find((c) => c.name.toLowerCase() === trimmedName.toLowerCase())?.avatar
            ?? contributorAvatarUrlForName(trimmedName)
        );
    }, [trimmedName, affiliation.profile, contributors]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!trimmedName) return;
        hapticLight();
        onLogin(trimmedName);
    };

    const handlePickName = (name: string) => {
        hapticLight();
        onLogin(name);
    };

    const returningTitle = lc?.returningTitle ?? 'Welcome back';
    const returningSubtitle =
        lc?.returningSubtitle ?? 'Find your name to connect with recipes, photos, and notes already in the archive.';
    const newTitle = lc?.newTitle ?? 'Join the family table';
    const newSubtitle =
        lc?.newSubtitle ?? 'Choose a display name your family will recognize. You can browse recipes right away.';
    const chooserTitle = lc?.chooserTitle ?? "Who's cooking?";
    const chooserSubtitle =
        lc?.chooserSubtitle ?? 'Sign in with your family name, or take a quick look around first.';

    const archiveLine =
        recipeCount > 0
            ? `${recipeCount} family recipe${recipeCount !== 1 ? 's' : ''}${
                  contributors.length ? ` · ${contributors.length} family member${contributors.length !== 1 ? 's' : ''}` : ''
              }`
            : null;

    if (!intent) {
        return (
            <div className="cookbook-paper min-h-screen overflow-hidden bg-[#FDFBF7] p-4 dark:bg-stone-950 sm:p-6">
                <a
                    href="#main-content-login"
                    className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[9999] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:font-bold focus:text-[#2D4635] focus:outline-none focus:ring-2 focus:ring-[#2D4635]"
                >
                    Skip to main content
                </a>
                <main
                    id="main-content-login"
                    role="main"
                    aria-label="Sign in"
                    tabIndex={-1}
                    className="relative z-10 mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-lg items-center justify-center py-[max(1rem,env(safe-area-inset-top,0px))]"
                >
                    <section className="heirloom-card w-full rounded-[2rem] border border-white/80 p-6 shadow-2xl dark:border-stone-800 sm:p-8">
                        <div className="mb-8 text-center">
                            <p className="text-xs font-black uppercase tracking-[0.3em] text-[#7A3F22] dark:text-orange-200">
                                {siteConfig.tagline ?? 'The Schafer Cookbook'}
                            </p>
                            <h1 className="mt-3 font-serif text-4xl italic leading-tight text-[#2D4635] dark:text-emerald-100">
                                {chooserTitle}
                            </h1>
                            <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-stone-700 dark:text-stone-300">
                                {chooserSubtitle}
                            </p>
                            {archiveLine && (
                                <p className="mx-auto mt-2 text-sm font-bold text-[#7A3F22] dark:text-orange-200/90">
                                    {archiveLine}
                                </p>
                            )}
                        </div>

                        <div className="space-y-3">
                            <button
                                type="button"
                                data-testid="login-intent-returning"
                                onClick={() => {
                                    hapticLight();
                                    setIntent('returning');
                                }}
                                className="flex w-full min-h-[5.5rem] flex-col items-start gap-1 rounded-2xl border border-[#A0522D]/25 bg-[#FFF8EC] p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#A0522D]/45 hover:shadow-md active:scale-[0.99] dark:border-stone-700 dark:bg-stone-900/70"
                            >
                                <span className="text-lg" aria-hidden="true">
                                    👋
                                </span>
                                <span className="font-serif text-xl italic text-[#2D4635] dark:text-emerald-100">
                                    I have recipes here
                                </span>
                                <span className="text-sm text-stone-600 dark:text-stone-400">
                                    Match your name to recipes and photos already in the cookbook.
                                </span>
                            </button>

                            <button
                                type="button"
                                data-testid="login-intent-new"
                                onClick={() => {
                                    hapticLight();
                                    setIntent('new');
                                }}
                                className="flex w-full min-h-[5.5rem] flex-col items-start gap-1 rounded-2xl border border-stone-200/80 bg-white/80 p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#A0522D]/35 hover:bg-white hover:shadow-md active:scale-[0.99] dark:border-stone-700 dark:bg-stone-900/70"
                            >
                                <span className="text-lg" aria-hidden="true">
                                    ✨
                                </span>
                                <span className="font-serif text-xl italic text-[#2D4635] dark:text-emerald-100">
                                    I&apos;m new here
                                </span>
                                <span className="text-sm text-stone-600 dark:text-stone-400">
                                    Pick a display name and start exploring — no password needed.
                                </span>
                            </button>
                        </div>

                        <button
                            type="button"
                            data-testid="login-browse-guest"
                            onClick={() => {
                                hapticLight();
                                onBrowseGuest();
                            }}
                            className="mt-6 w-full min-h-12 rounded-2xl border border-dashed border-stone-300 bg-transparent px-4 py-3 text-sm font-bold text-stone-600 transition-colors hover:border-[#A0522D]/40 hover:text-[#2D4635] dark:border-stone-600 dark:text-stone-300 dark:hover:text-emerald-100"
                        >
                            Browse recipes without signing in
                        </button>

                        <ul className="mt-6 space-y-2 border-t border-stone-100 pt-6 dark:border-stone-800">
                            {trustStrip.map((line) => (
                                <li
                                    key={line}
                                    className="flex items-start gap-2 text-sm text-stone-600 dark:text-stone-400"
                                >
                                    <span className="mt-0.5 text-[#A0522D]" aria-hidden="true">
                                        ✓
                                    </span>
                                    {line}
                                </li>
                            ))}
                        </ul>
                    </section>
                </main>
            </div>
        );
    }

    const isReturning = intent === 'returning';
    const title = isReturning ? returningTitle : newTitle;
    const subtitle = isReturning ? returningSubtitle : newSubtitle;
    const affiliationSummary = formatAffiliationSummary(affiliation);
    const hasAffiliation = totalContributorContent(affiliation) > 0;

    return (
        <div className="cookbook-paper min-h-screen overflow-hidden bg-[#FDFBF7] p-4 dark:bg-stone-950 sm:p-6">
            <a
                href="#main-content-login"
                className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[9999] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:font-bold focus:text-[#2D4635] focus:outline-none focus:ring-2 focus:ring-[#2D4635]"
            >
                Skip to main content
            </a>
            <main
                id="main-content-login"
                role="main"
                aria-label="Sign in"
                tabIndex={-1}
                className="relative z-10 mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-md items-center justify-center py-[max(1rem,env(safe-area-inset-top,0px))]"
            >
                <section className="heirloom-card w-full rounded-[2rem] border border-white/80 p-6 shadow-2xl dark:border-stone-800 sm:p-8">
                    <button
                        type="button"
                        onClick={() => {
                            hapticLight();
                            setIntent(null);
                            setLoginName('');
                            setFamilySearch('');
                        }}
                        className="mb-4 text-[10px] font-black uppercase tracking-[0.22em] text-stone-500 transition-colors hover:text-[#2D4635] dark:hover:text-emerald-200"
                    >
                        ← Back
                    </button>

                    <div className="mb-6 text-center">
                        <h1 className="font-serif text-3xl italic leading-tight text-[#2D4635] dark:text-emerald-100 sm:text-4xl">
                            {title}
                        </h1>
                        <p className="mx-auto mt-3 max-w-sm text-base leading-relaxed text-stone-700 dark:text-stone-300">
                            {subtitle}
                        </p>
                        {!isReturning && (
                            <p className="mx-auto mt-2 max-w-sm text-sm text-stone-500 dark:text-stone-400">
                                Your display name is shared with the family — it&apos;s not a password.
                            </p>
                        )}
                    </div>

                    {isReturning && contributors.length > 0 && (
                        <div className="mb-6">
                            <div className="mb-3 flex items-center justify-between gap-2">
                                <p className="text-sm font-black uppercase tracking-[0.2em] text-stone-700 dark:text-stone-200">
                                    Tap your name
                                </p>
                                {contributors.length > 9 && (
                                    <label className="sr-only" htmlFor="login-family-search">
                                        Search family names
                                    </label>
                                )}
                            </div>
                            {contributors.length > 9 && (
                                <input
                                    id="login-family-search"
                                    type="search"
                                    value={familySearch}
                                    onChange={(e) => setFamilySearch(e.target.value)}
                                    placeholder="Search names…"
                                    className="mb-3 min-h-11 w-full rounded-xl border border-stone-200 bg-white/90 px-4 py-2 text-sm outline-none focus:border-[#A0522D] dark:border-stone-700 dark:bg-stone-950"
                                />
                            )}
                            <div className="grid grid-cols-3 gap-2.5">
                                {filteredQuickFamily.map((c) => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => handlePickName(c.name.trim())}
                                        className="group flex min-h-[5.5rem] flex-col items-center justify-center gap-1.5 rounded-2xl border border-stone-200/80 bg-white/80 p-2.5 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#A0522D]/35 hover:bg-[#FFF8EC] hover:shadow-md active:scale-[0.98] dark:border-stone-700 dark:bg-stone-900/70 dark:hover:bg-stone-800"
                                        aria-label={`Sign in as ${c.name}`}
                                    >
                                        <img
                                            src={c.avatar || contributorAvatarUrlForName(c.name)}
                                            alt=""
                                            onError={avatarOnError}
                                            className="h-12 w-12 rounded-full border-2 border-white object-cover shadow-md transition-transform group-hover:scale-105 dark:border-stone-700"
                                        />
                                        <span className="max-w-full truncate text-xs font-bold text-stone-800 dark:text-stone-100">
                                            {firstName(c.name)}
                                        </span>
                                    </button>
                                ))}
                            </div>
                            {filteredQuickFamily.length === 0 && (
                                <p className="text-center text-sm italic text-stone-500">No names match that search.</p>
                            )}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="relative">
                            <label htmlFor="login-name" className="sr-only">
                                Your name
                            </label>
                            <input
                                id="login-name"
                                type="text"
                                placeholder={loginPlaceholder}
                                autoComplete="name"
                                autoFocus
                                className="min-h-14 w-full rounded-2xl border border-stone-300 bg-white/90 py-4 pl-16 pr-4 text-base text-stone-900 shadow-inner outline-none transition-all placeholder:text-stone-500 focus:border-[#A0522D] focus:bg-white dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100 dark:placeholder:text-stone-400 dark:focus:bg-stone-900"
                                value={loginName}
                                onChange={(e) => setLoginName(e.target.value)}
                            />
                            <img
                                src={loginPreviewAvatar}
                                alt=""
                                onError={avatarOnError}
                                className="absolute left-3 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full border border-stone-200 object-cover dark:border-stone-700"
                                aria-hidden
                            />
                        </div>

                        {trimmedName && hasAffiliation && (
                            <div
                                className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center dark:border-emerald-900 dark:bg-emerald-950/40"
                                role="status"
                                data-testid="login-affiliation-preview"
                            >
                                <p className="font-serif text-sm italic text-emerald-900 dark:text-emerald-100">
                                    {affiliation.matchType === 'alias' ? (
                                        <>
                                            We&apos;ll sign you in as{' '}
                                            <strong className="not-italic">{affiliation.canonicalName}</strong>
                                        </>
                                    ) : (
                                        <>
                                            Welcome back, {firstName(affiliation.canonicalName)}.
                                        </>
                                    )}
                                </p>
                                {affiliationSummary && (
                                    <p className="mt-1 text-xs font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
                                        {affiliationSummary} in the archive
                                    </p>
                                )}
                            </div>
                        )}

                        {trimmedName && !hasAffiliation && isReturning && (
                            <p
                                className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
                                role="status"
                            >
                                We couldn&apos;t find archive items for that exact name. Try a suggestion below, or{' '}
                                <button
                                    type="button"
                                    className="font-bold underline underline-offset-2"
                                    onClick={() => setIntent('new')}
                                >
                                    join as a new member
                                </button>
                                .
                            </p>
                        )}

                        {suggestions.length > 0 && (
                            <div className="space-y-2" data-testid="login-name-suggestions">
                                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-500">
                                    Did you mean
                                </p>
                                {suggestions.map((s) => {
                                    const summary = formatAffiliationSummary(s);
                                    return (
                                        <button
                                            key={s.name}
                                            type="button"
                                            onClick={() => handlePickName(s.name)}
                                            className="flex w-full items-center gap-3 rounded-2xl border border-stone-200 bg-white/90 px-3 py-2.5 text-left transition-colors hover:border-[#A0522D]/35 hover:bg-[#FFF8EC] dark:border-stone-700 dark:bg-stone-900/70"
                                        >
                                            <img
                                                src={s.avatar || contributorAvatarUrlForName(s.name)}
                                                alt=""
                                                onError={avatarOnError}
                                                className="h-9 w-9 rounded-full object-cover"
                                            />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-bold text-stone-800 dark:text-stone-100">
                                                    {s.name}
                                                </span>
                                                {summary && (
                                                    <span className="block truncate text-xs text-stone-500">
                                                        {summary}
                                                    </span>
                                                )}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={!trimmedName}
                            className="w-full min-h-14 rounded-2xl bg-[#2D4635] px-6 py-4 text-sm font-black uppercase tracking-[0.22em] text-white shadow-[0_14px_30px_rgba(45,70,53,0.28)] transition-all hover:-translate-y-0.5 hover:bg-[#1B2C22] hover:shadow-[0_18px_36px_rgba(45,70,53,0.34)] active:scale-[0.99] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none"
                        >
                            {hasAffiliation && isReturning
                                ? `Continue as ${firstName(affiliation.canonicalName)}`
                                : loginCta}
                        </button>

                        <p className="pt-1 text-center text-sm text-stone-700 dark:text-stone-300">
                            {loginHelp}{' '}
                            <a
                                href="mailto:?subject=Schafer%20Family%20Cookbook%20Access%20Request"
                                className="font-bold text-[#7A3F22] underline decoration-[#A0522D]/40 underline-offset-4 hover:text-[#2D4635] dark:text-orange-200 dark:hover:text-emerald-100"
                            >
                                Email an admin.
                            </a>
                        </p>
                    </form>
                </section>
            </main>
        </div>
    );
};
