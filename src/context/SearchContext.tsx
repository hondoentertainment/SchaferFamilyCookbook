import React, { createContext, useContext } from 'react';
import type { SearchHit } from '../utils/siteSearch';

export interface SiteSearchContextValue {
    query: string;
    setQuery: (query: string) => void;
    hits: SearchHit[];
    recent: string[];
    clearQuery: () => void;
    clearRecent: () => void;
    applyRecent: (query: string) => void;
    onSelectHit: (hit: SearchHit) => void;
    headerOpen: boolean;
    setHeaderOpen: (open: boolean) => void;
}

const SiteSearchContext = createContext<SiteSearchContextValue | null>(null);

export const SiteSearchProvider: React.FC<{
    value: SiteSearchContextValue;
    children: React.ReactNode;
}> = ({ value, children }) => (
    <SiteSearchContext.Provider value={value}>{children}</SiteSearchContext.Provider>
);

export function useSiteSearch(): SiteSearchContextValue {
    const ctx = useContext(SiteSearchContext);
    if (!ctx) {
        throw new Error('useSiteSearch must be used within SiteSearchProvider');
    }
    return ctx;
}

export function useSiteSearchOptional(): SiteSearchContextValue | null {
    return useContext(SiteSearchContext);
}
