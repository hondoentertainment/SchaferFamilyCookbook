import React, { useMemo, useState, useCallback } from 'react';
import { Recipe, GalleryItem, Trivia, ContributorProfile } from '../types';

interface ContributorsViewProps {
    recipes: Recipe[];
    gallery?: GalleryItem[];
    trivia?: Trivia[];
    contributors: ContributorProfile[];
    onSelectContributor: (name: string) => void;
}

interface ContributorStats {
    name: string;
    recipeCount: number;
    galleryCount: number;
    triviaCount: number;
    categories: Set<string>;
}

const normalizeName = (n: string) => n.trim().toLowerCase();

/** Data URI for a neutral avatar when both profile image and dicebear fail */
const PLACEHOLDER_AVATAR = `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%23d6d3d1"/><circle cx="50" cy="38" r="18" fill="%23a8a29e"/><path d="M20 92c0-16 13-30 30-30s30 14 30 30z" fill="%23a8a29e"/></svg>'
)}`;

export const ContributorsView: React.FC<ContributorsViewProps> = ({
    recipes,
    gallery = [],
    trivia = [],
    contributors,
    onSelectContributor
}) => {
    const [search, setSearch] = useState('');
    const [avatarErrors, setAvatarErrors] = useState<Set<string>>(new Set());

    const stats = useMemo<ContributorStats[]>(() => {
        const s: Record<string, ContributorStats> = {};
        const add = (name: string, recipes = 0, gallery = 0, trivia = 0, cat?: string) => {
            const key = name.trim() || 'Unknown';
            if (!s[key]) s[key] = { name: key, recipeCount: 0, galleryCount: 0, triviaCount: 0, categories: new Set() };
            s[key].recipeCount += recipes;
            s[key].galleryCount += gallery;
            s[key].triviaCount += trivia;
            if (cat) s[key].categories.add(cat);
        };
        recipes.forEach(r => add(r.contributor, 1, 0, 0, r.category));
        gallery.forEach(g => add(g.contributor, 0, 1, 0));
        trivia.forEach(t => add(t.contributor, 0, 0, 1));
        return Object.values(s)
            .filter(x => x.recipeCount > 0 || x.galleryCount > 0 || x.triviaCount > 0)
            .sort((a, b) => {
                const ta = a.recipeCount + a.galleryCount + a.triviaCount;
                const tb = b.recipeCount + b.galleryCount + b.triviaCount;
                return tb - ta;
            });
    }, [recipes, gallery, trivia]);

    const filteredStats = useMemo(() => {
        if (!search.trim()) return stats;
        const q = search.trim().toLowerCase();
        return stats.filter(s => s.name.toLowerCase().includes(q));
    }, [stats, search]);

    const getAvatar = useCallback((name: string) => {
        const c = contributors.find(p => normalizeName(p.name) === normalizeName(name));
        return c?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`;
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

    return (
        <section
            className="max-w-7xl mx-auto py-12 px-6"
            aria-labelledby="contributors-heading"
            aria-describedby="contributors-description"
        >
            <h2 id="contributors-heading" className="text-4xl md:text-5xl font-serif italic text-[#2D4635] mb-4">
                The Contributors
            </h2>
            <p id="contributors-description" className="text-stone-500 font-serif italic text-lg mb-10 max-w-2xl">
                The family members who have shared recipes, memories, and stories in this archive.
            </p>

            {hasContributors && (
                <div className="mb-10">
                    <label htmlFor="contributor-search" className="sr-only">
                        Search contributors by name
                    </label>
                    <input
                        id="contributor-search"
                        type="search"
                        placeholder="Search contributors…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full max-w-md px-6 py-4 bg-white/80 backdrop-blur border border-stone-200 rounded-full shadow-sm outline-none text-base text-stone-700 placeholder:text-stone-400 focus:ring-2 focus:ring-[#2D4635]/20 focus:border-[#2D4635] transition-all"
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
                    className="py-20 text-center border-2 border-dashed border-stone-100 rounded-[3rem] bg-white/50"
                    role="status"
                    aria-live="polite"
                >
                    <span className="text-5xl block mb-6" aria-hidden="true">👨‍👩‍👧‍👦</span>
                    <p className="text-stone-400 font-serif italic text-lg">No contributors yet.</p>
                    <p className="text-stone-300 text-sm mt-2">Add recipes, photos, or trivia to see contributors appear here.</p>
                    <p className="text-stone-300 text-xs mt-4">Every contribution counts—recipes, gallery memories, and trivia questions.</p>
                </div>
            ) : filteredStats.length === 0 ? (
                <div className="py-12 text-center border-2 border-dashed border-stone-100 rounded-[3rem] bg-white/50" role="status">
                    <p className="text-stone-400 font-serif italic">No contributors match &ldquo;{search}&rdquo;.</p>
                    <button
                        type="button"
                        onClick={() => setSearch('')}
                        className="mt-4 text-[#2D4635] font-bold underline hover:no-underline focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2 rounded px-4 py-2"
                    >
                        Clear search
                    </button>
                </div>
            ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 md:gap-10 list-none p-0 m-0">
                    {filteredStats.map((stat) => {
                        const avatarUrl = avatarErrors.has(stat.name)
                            ? PLACEHOLDER_AVATAR
                            : getAvatar(stat.name);
                        const admin = isAdmin(stat.name);

                        return (
                            <li key={stat.name}>
                                <article className="bg-white rounded-[3rem] p-8 md:p-10 border border-stone-100 shadow-sm hover:shadow-2xl transition-all duration-300 group relative overflow-hidden text-center h-full flex flex-col">
                                    <div className="relative inline-block mb-6">
                                        <img
                                            src={avatarUrl}
                                            className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-stone-50 border-8 border-white shadow-xl mx-auto group-hover:rotate-6 transition-transform duration-300"
                                            alt=""
                                            onError={() => handleAvatarError(stat.name)}
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
                                    <h3 className="text-2xl md:text-3xl font-serif italic text-[#2D4635]">{stat.name}</h3>
                                    <p className="text-[10px] uppercase tracking-widest text-stone-400 mt-1 mb-4">
                                        Archive Contributor
                                    </p>
                                    <div className="flex flex-wrap justify-center gap-2 mb-6 flex-1">
                                        {Array.from(stat.categories).slice(0, 4).map(cat => (
                                            <span
                                                key={cat}
                                                className="text-[8px] font-black uppercase bg-stone-50 text-stone-500 px-3 py-1 rounded-full"
                                            >
                                                {cat}
                                            </span>
                                        ))}
                                    </div>
                                    <p className="text-xs text-stone-500 mb-6" aria-hidden="true">
                                        {contributionSummary(stat)}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => onSelectContributor(stat.name)}
                                        className="mt-auto w-full py-4 bg-stone-50 text-[#2D4635] rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-[#2D4635] hover:text-white transition-all min-h-[2.75rem] focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2"
                                        aria-label={`Explore ${stat.name}'s collection: ${contributionSummary(stat)}`}
                                    >
                                        Explore Collection ({totalContributions(stat)})
                                    </button>
                                </article>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
};
