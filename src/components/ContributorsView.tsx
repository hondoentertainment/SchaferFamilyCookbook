import React, { useMemo } from 'react';
import { Recipe, ContributorProfile } from '../types';

interface ContributorsViewProps {
    recipes: Recipe[];
    contributors: ContributorProfile[];
    onSelectContributor: (name: string) => void;
}

export const ContributorsView: React.FC<ContributorsViewProps> = ({ recipes, contributors, onSelectContributor }) => {
    const stats = useMemo(() => {
        const s: Record<string, { count: number; cats: Set<string> }> = {};
        recipes.forEach(r => {
            if (!s[r.contributor]) s[r.contributor] = { count: 0, cats: new Set() };
            s[r.contributor].count++;
            s[r.contributor].cats.add(r.category);
        });
        return Object.entries(s).sort((a, b) => b[1].count - a[1].count);
    }, [recipes]);

    const getAvatar = (name: string) => {
        const c = contributors.find(p => p.name === name);
        return c?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;
    };

    return (
        <div className="max-w-7xl mx-auto py-12 px-6">
            <h2 className="text-4xl font-serif italic text-[#2D4635] mb-12">The Contributors</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
                {stats.map(([name, stat]) => (
                    <div key={name} className="bg-white rounded-[3rem] p-10 border border-stone-100 shadow-sm hover:shadow-2xl transition-all group relative overflow-hidden text-center">
                        <img src={getAvatar(name)} className="w-28 h-28 rounded-full bg-stone-50 border-8 border-white shadow-xl mx-auto mb-8 group-hover:rotate-6 transition-all" alt={name} />
                        <h3 className="text-3xl font-serif italic text-[#2D4635]">{name}</h3>
                        <p className="text-[10px] uppercase tracking-widest text-stone-400 mt-2 mb-6">Archive Contributor</p>
                        <div className="flex flex-wrap justify-center gap-2 mb-8">
                            {Array.from(stat.cats).slice(0, 3).map(cat => <span key={cat} className="text-[8px] font-black uppercase bg-stone-50 text-stone-500 px-3 py-1 rounded-full">{cat}</span>)}
                        </div>
                        <button onClick={() => onSelectContributor(name)} className="w-full py-4 bg-stone-50 text-[#2D4635] rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-[#2D4635] hover:text-white transition-all">Explore Collection ({stat.count})</button>
                    </div>
                ))}
            </div>
        </div>
    );
};
