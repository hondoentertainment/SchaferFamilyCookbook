import { useEffect, useState } from 'react';
import { listOfflineRecipeIds, OFFLINE_CACHE_UPDATED_EVENT } from '../utils/recipeOfflineCache';

/** Recipe ids saved in IndexedDB for offline cook mode. */
export function useOfflineRecipeIds(): Set<string> {
    const [ids, setIds] = useState<Set<string>>(() => new Set());

    useEffect(() => {
        let cancelled = false;

        const refresh = () => {
            void listOfflineRecipeIds().then((list) => {
                if (!cancelled) setIds(new Set(list));
            });
        };

        refresh();
        window.addEventListener(OFFLINE_CACHE_UPDATED_EVENT, refresh);
        return () => {
            cancelled = true;
            window.removeEventListener(OFFLINE_CACHE_UPDATED_EVENT, refresh);
        };
    }, []);

    return ids;
}
