import React from 'react';

export const TabFallback = () => (
    <div className="flex items-center justify-center min-h-[50vh] text-stone-500">
        <span className="animate-pulse font-serif italic motion-reduce:animate-none">Loading…</span>
    </div>
);

export const RecipeGridSkeleton: React.FC = () => (
    <div className="max-w-[1600px] mx-auto px-6 py-8 md:py-12">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {Array.from({ length: 15 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] rounded-[2rem] bg-stone-200 animate-pulse" />
            ))}
        </div>
    </div>
);

export const ContributorsSkeleton: React.FC = () => (
    <div className="max-w-7xl mx-auto py-12 px-6">
        <h2 className="text-4xl font-serif italic text-[#2D4635] mb-12">The Contributors</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
            {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-white rounded-[3rem] p-10 border border-stone-100">
                    <div className="w-28 h-28 rounded-full bg-stone-200 animate-pulse mx-auto mb-8" />
                    <div className="h-8 bg-stone-200 rounded animate-pulse w-3/4 mx-auto mb-4" />
                    <div className="h-4 bg-stone-100 rounded animate-pulse w-1/2 mx-auto" />
                </div>
            ))}
        </div>
    </div>
);

export const GallerySkeleton: React.FC = () => (
    <div className="max-w-7xl mx-auto py-12 px-6">
        <div className="columns-1 md:columns-2 lg:columns-3 gap-8 space-y-8">
            {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="break-inside-avoid bg-white p-4 rounded-[2rem] border border-stone-100 shadow-md">
                    <div className="w-full aspect-video rounded-2xl mb-4 bg-stone-200 animate-pulse" />
                    <div className="h-5 bg-stone-200 rounded animate-pulse w-3/4 mb-4" />
                </div>
            ))}
        </div>
    </div>
);

export const IndexSkeleton: React.FC = () => (
    <div className="max-w-5xl mx-auto py-12 px-6 flex flex-col md:flex-row gap-16">
        <div className="hidden md:block w-20 shrink-0">
            <div className="flex flex-col gap-1.5">
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="w-11 h-11 rounded-full bg-stone-200 animate-pulse" />
                ))}
            </div>
        </div>
        <div className="flex-1 space-y-12">
            <div className="h-10 bg-stone-200 rounded w-48 animate-pulse" />
        </div>
    </div>
);

export const HistorySkeleton: React.FC = () => (
    <div className="max-w-6xl mx-auto py-12 md:py-20 px-4 md:px-6 flex flex-col lg:flex-row gap-12 lg:gap-16">
        <nav className="lg:w-56 shrink-0 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-stone-100 rounded-xl animate-pulse" />
            ))}
        </nav>
        <article className="flex-1 space-y-12">
            <div className="h-24 bg-stone-200 rounded w-3/4 animate-pulse" />
        </article>
    </div>
);

export const ProfileSkeleton: React.FC = () => (
    <div className="max-w-6xl mx-auto py-8 md:py-12 px-4 md:px-6 space-y-12 md:space-y-16">
        <section className="bg-white rounded-[3rem] md:rounded-[4rem] p-6 md:p-16 border border-stone-100">
            <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
                <div className="w-40 h-40 md:w-48 md:h-48 rounded-full bg-stone-200 animate-pulse" />
                <div className="flex-1 space-y-6 w-full">
                    <div className="h-16 bg-stone-100 rounded-3xl animate-pulse" />
                </div>
            </div>
        </section>
    </div>
);
