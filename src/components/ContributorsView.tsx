import React, { useMemo, useState, useCallback } from 'react';
import { Recipe, GalleryItem, Trivia, ContributorProfile } from '../types';
import { PLACEHOLDER_AVATAR } from '../constants';
import { contributorAvatarUrlForName } from '../utils/contributorAvatar';
import { avatarOnError } from '../utils/avatarFallback';
import { PageHeader } from './PageHeader';
import { filterPublicGalleryItems } from '../utils/galleryModeration';
import { normalizeContributorName } from '../constants/taxonomy';

interface ContributorsViewProps {
    recipes: Recipe[];
    gallery?: GalleryItem[];
    trivia?: Trivia[];
    contributors: ContributorProfile[];
    onSelectContributor: (name: string) => void;
    /** Open the contributor's spotlight (tribute) overlay */
    onOpenSpotlight?: (name: string) => void;
    /** Jump to Gallery tab filtered to this contributor's approved photos */
    onViewGallery?: (name: string) => void;
    /** Optional: called when user taps "Browse recipes" in empty state */
    onGoToRecipes?: () => void;
    isDataLoading?: boolean;
}

const ContributorsSkeleton: React.FC = () => (
    <section className="view-shell-wide">
        <div className="animate-pulse space-y-10">
            <div className="space-y-4">
                <div className="h-10 bg-stone-200 rounded w-1/3" />
                <div className="h-5 bg-stone-100 rounded w-2/5" />
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 md:gap-10 list-none p-0 m-0">
                {[0, 1, 2, 3].map(i => (
                    <li key={i}>
                        <div className="bg-white dark:bg-[var(--card-bg)] rounded-[3rem] p-8 md:p-10 border border-stone-100 dark:border-stone-800 shadow-sm text-center h-full flex flex-col items-center">
                            <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-stone-200 dark:bg-stone-700 mb-6" />
                            <div className="h-6 bg-stone-200 rounded w-2/3 mb-2" />
                            <div className="h-3 bg-stone-100 rounded w-1/3 mb-6" />
                            <div className="h-10 bg-stone-100 rounded-full w-full mt-auto" />
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    </section>
);

interface ContributorStats {
    name: string;
    recipeCount: number;
    galleryCount: number;
    triviaCount: number;
    categories: Set<string>;
}

const normalizeName = (n: string) => n.trim().toLowerCase();

export const ContributorsView: React.FC<ContributorsViewProps> = ({
    recipes,
    gallery = [],
    trivia = [],
    contributors,
    onSelectContributor,
    onOpenSpotlight,
    onViewGallery,
    onGoToRecipes,
    isDataLoading
}) => {
    const publicGallery = useMemo(() => filterPublicGalleryItems(gallery), [gallery]);
    const [search, setSearch] = useState('');
    const [avatarErrors, setAvatarErrors] = useState<Set<string>>(new Set());

    const stats = useMemo<ContributorStats[]>(() => {
        const s: Record<string, ContributorStats> = {};
        const add = (rawName: string, recipes = 0, gallery = 0, trivia = 0, cat?: string) => {
            const name = normalizeContributorName(rawName.trim() || 'Unknown');
            const key = name.trim().toLowerCase();
            if (!s[key]) s[key] = { name, recipeCount: 0, galleryCount: 0, triviaCount: 0, categories: new Set() };
            s[key].recipeCount += recipes;
            s[key].galleryCount += gallery;
            s[key].triviaCount += trivia;
            if (cat) s[key].categories.add(cat);
        };
        recipes.forEach(r => add(r.contributor, 1, 0, 0, r.category));
        publicGallery.forEach(g => add(g.contributor, 0, 1, 0));
        trivia.forEach(t => add(t.contributor, 0, 0, 1));
        contributors.forEach(c => add(c.name));
        return Object.values(s)
            .sort((a, b) => {
                const ta = a.recipeCount + a.galleryCount + a.triviaCount;
                const tb = b.recipeCount + b.galleryCount + b.triviaCount;
                if (tb !== ta) return tb - ta;
                return a.name.localeCompare(b.name);
            });
    }, [recipes, publicGallery, trivia, contributors]);

    const filteredStats = useMemo(() => {
        if (!search.trim()) return stats;
        const q = search.trim().toLowerCase();
        return stats.filter(s => s.name.toLowerCase().includes(q));
    }, [stats, search]);

    const getAvatar = useCallback((name: string) => {
        const c = contributors.find(p => normalizeName(p.name) === normalizeName(name));
        return c?.avatar || contributorAvatarUrlForName(name);
    }, [contributors]);

    const isAdmin = useCallback((name: string) =>
        contributors.some(c => normalizeName(c.name) === normalizeName(name) && c.role === 'admin'),
        [contributors]
    );

    const handleAvatarError = useCallback((name: string) => {
        setAvatarErrors(prev => new Set(prev).add(name));
    }, []);

    const totalContributions = (s: ContributorStats) =>
        s.recipeCount + s.galleryCount + s.triviaCount;

    const contributionSummary = (s: ContributorStats) => {
        const parts: string[] = [];
        if (s.recipeCount) parts.push(`${s.recipeCount} recipe${s.recipeCount !== 1 ? 's' : ''}`);
        if (s.galleryCount) parts.push(`${s.galleryCount} memory${s.galleryCount !== 1 ? 'ies' : ''}`);
        if (s.triviaCount) parts.push(`${s.triviaCount} trivia`);
        return parts.join(', ');
    };

    const hasContributors = stats.length > 0;

    if (isDataLoading && contributors.length === 0) {
        return <ContributorsSkeleton />;
    }

    return (
        <section
            className="view-shell-wide view-stack"
            aria-labelledby="contributors-heading"
            aria-describedby="contributors-description"
        >
            <PageHeader
                id="contributors-heading"
                title="The Contributors"
                description="The family members who have shared recipes, memories, and stories in this archive."
            />
            <p id="contributors-description" className="sr-only">
                Browse contributors and open their recipes from the archive.
            </p>

            {hasContributors && (
                <div>
                    <label htmlFor="contributor-search" className="sr-only">
                        Search contributors by name
                    </label>
                    <input
                        id="contributor-search"
                        type="search"
                        placeholder="Search contributors…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full max-w-md px-6 py-4 bg-white/80 dark:bg-[var(--input-bg)] backdrop-blur border border-stone-200 dark:border-stone-700 rounded-full shadow-sm outline-none text-base text-stone-700 dark:text-stone-200 placeholder:text-stone-500 dark:placeholder:text-stone-500 focus:ring-2 focus:ring-[#2D4635]/20 focus:border-[#2D4635] transition-colors"
                        aria-describedby={search ? "search-results" : undefined}
                    />
                    {search && (
                        <p id="search-results" className="mt-2 text-sm text-stone-500" aria-live="polite">
                            {filteredStats.length} contributor{filteredStats.length !== 1 ? 's' : ''} match{filteredStats.length === 1 ? 'es' : ''}
                        </p>
                    )}
                </div>
            )}

            {!hasContributors ? (
                <div
                    className="py-12 text-center border-2 border-dashed border-stone-100 dark:border-stone-800 rounded-[2rem] bg-white/50 dark:bg-[var(--card-bg)]/50"
                    role="status"
                    aria-live="polite"
                >
                    <span className="text-5xl block mb-6" aria-hidden="true">👨‍👩‍👧‍👦</span>
                    <p className="text-stone-500 font-serif italic text-lg">No contributors yet.</p>
                    <p className="text-stone-500 text-sm mt-2">Add recipes, photos, or trivia to see contributors appear here.</p>
                    <p className="text-stone-500 text-xs mt-4">Every contribution counts—recipes, gallery memories, and trivia questions.</p>
                    {onGoToRecipes && (
                        <div className="empty-state-actions mt-6">
                        <button
                            type="button"
                            onClick={onGoToRecipes}
                            className="btn btn-primary btn-body"
                        >
                            Browse recipes
                        </button>
                        </div>
                    )}
                </div>
            ) : filteredStats.length === 0 ? (
                <div className="py-12 text-center border-2 border-dashed border-stone-100 dark:border-stone-800 rounded-[3rem] bg-white/50 dark:bg-[var(--card-bg)]/50" role="status">
                    <p className="text-stone-500 font-serif italic">No contributors match &ldquo;{search}&rdquo;.</p>
                    <button
                        type="button"
                        onClick={() => setSearch('')}
                        className="btn btn-link btn-body mt-4"
                    >
                        Clear search
                    </button>
                </div>
            ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 md:gap-6 list-none p-0 m-0">
                    {filteredStats.map((stat) => {
                        const avatarUrl = avatarErrors.has(stat.name)
                            ? PLACEHOLDER_AVATAR
                            : getAvatar(stat.name);
                        const admin = isAdmin(stat.name);

                        return (
                            <li key={stat.name}>
                                <article className="bg-white dark:bg-[var(--card-bg)] rounded-[2rem] p-6 md:p-8 border border-stone-100 dark:border-stone-800 shadow-sm hover:shadow-xl transition-all duration-300 group relative overflow-hidden text-center h-full flex flex-col">
                                    <div className="relative inline-block mb-4">
                                        <img
                                            src={avatarUrl}
                                            className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-stone-50 dark:bg-stone-800 border-4 border-white dark:border-stone-700 shadow-xl mx-auto group-hover:rotate-6 transition-transform duration-300 object-cover"
                                            alt={`${stat.name}'s avatar`}
                                            onError={(e) => { handleAvatarError(stat.name); avatarOnError(e); }}
                                            loading="lazy"
                                        />
                                        {admin && (
                                            <span
                                                className="absolute bottom-0 right-0 w-8 h-8 md:w-9 md:h-9 bg-[#2D4635] text-white rounded-full flex items-center justify-center text-xs font-bold shadow-lg"
                                                title={`${stat.name} is an administrator`}
                                                aria-label={`${stat.name} is an administrator`}
                                            >
                                                A
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-2xl md:text-3xl font-serif italic text-[#2D4635] dark:text-emerald-300">{stat.name}</h3>
                                    <p className="text-[10px] uppercase tracking-widest text-stone-400 dark:text-stone-500 mt-1 mb-4">
                                        Archive Contributor
                                    </p>
                                    <div className="flex flex-wrap justify-center gap-2 mb-6 flex-1">
                                        {Array.from(stat.categories).slice(0, 4).map(cat => (
                                            <span
                                                key={cat}
                                                className="text-[8px] font-black uppercase bg-stone-50 dark:bg-stone-800 text-stone-500 dark:text-stone-400 px-3 py-1 rounded-full"
                                            >
                                                {cat}
                                            </span>
                                        ))}
                                    </div>
                                    <p className="text-xs text-stone-500 dark:text-stone-400 mb-6" aria-hidden="true">
                                        {contributionSummary(stat)}
                                    </p>
                                    <div className="mt-auto w-full space-y-2">
                                        {onOpenSpotlight && (
                                            <button
                                                type="button"
                                                data-testid="open-contributor-spotlight"
                                                onClick={() => onOpenSpotlight(stat.name)}
                                                className="btn btn-primary w-full"
                                                aria-label={`Open ${stat.name}'s spotlight with their recipes and family memories`}
                                            >
                                                🕯 Spotlight &amp; Memories
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => onSelectContributor(stat.name)}
                                            className="btn btn-secondary btn-invert-on-hover w-full"
                                            aria-label={`Explore ${stat.name}'s collection: ${contributionSummary(stat)}`}
                                        >
                                            Explore Collection ({totalContributions(stat)})
                                        </button>
                                        {onViewGallery && stat.galleryCount > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => onViewGallery(stat.name)}
                                                className="btn btn-link btn-body w-full"
                                                aria-label={`View ${stat.galleryCount} photo${stat.galleryCount !== 1 ? 's' : ''} from ${stat.name}`}
                                            >
                                                View photos ({stat.galleryCount})
                                            </button>
                                        )}
                                    </div>
                                </article>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
};
