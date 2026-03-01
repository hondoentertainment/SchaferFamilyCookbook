import React, { useMemo, useState, useEffect } from 'react';
import { Recipe } from '../types';

interface AlphabeticalIndexProps {
    recipes: Recipe[];
    onSelect: (r: Recipe) => void;
}

const LETTERS = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")];

export const AlphabeticalIndex: React.FC<AlphabeticalIndexProps> = ({ recipes, onSelect }) => {
    const [activeLetter, setActiveLetter] = useState<string>(LETTERS[0]);

    const grouped = useMemo(() => {
        const groups: Record<string, Recipe[]> = {};
        [...recipes]
            .sort((a, b) => a.title.localeCompare(b.title))
            .forEach(r => {
                const firstChar = r.title[0]?.toUpperCase() || '#';
                const letter = /[A-Z]/.test(firstChar) ? firstChar : '#';
                if (!groups[letter]) groups[letter] = [];
                groups[letter].push(r);
            });
        return groups;
    }, [recipes]);

    const letters = LETTERS;
    const activeLetters = Object.keys(grouped);

    const scrollToLetter = (letter: string) => {
        const el = document.getElementById(`idx-${letter}`);
        if (el) window.scrollTo({ top: el.offsetTop - 120, behavior: 'smooth' });
    };

    // Scroll spy: track which letter section is in view
    useEffect(() => {
        const container = document.getElementById('alphabetical-index-container');
        if (!container) return;

        const sections = activeLetters.map(l => ({ letter: l, el: document.getElementById(`idx-${l}`) })).filter(
            (s): s is { letter: string; el: HTMLElement } => !!s.el
        );

        const onScroll = () => {
            const scrollTop = window.scrollY + 140;
            for (let i = sections.length - 1; i >= 0; i--) {
                const top = sections[i].el.getBoundingClientRect().top + window.scrollY;
                if (scrollTop >= top) {
                    setActiveLetter(sections[i].letter);
                    break;
                }
            }
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
        return () => window.removeEventListener('scroll', onScroll);
    }, [activeLetters.join(',')]);

    const letterButtonClass = (active: boolean, inView: boolean) =>
        `text-[11px] font-black rounded-full flex items-center justify-center transition-all shrink-0 min-w-[2.75rem] min-h-[2.75rem] ${active ? 'text-[#2D4635] hover:bg-[#2D4635] hover:text-white' : 'text-stone-200'} ${inView ? 'ring-2 ring-[#2D4635] ring-offset-2 ring-offset-white' : ''}`;

    return (
        <div id="alphabetical-index-container" className="max-w-5xl mx-auto py-12 px-6 flex flex-col md:flex-row gap-16">
            {/* Mobile: compact horizontal scrollable letter strip */}
            <div className="md:hidden -mx-6 mb-4 sticky top-[var(--header-offset,4rem)] z-10 bg-white/95 backdrop-blur-sm pb-2 border-b border-stone-100">
                <div className="overflow-x-auto overflow-y-hidden scroll-smooth no-scrollbar px-4" style={{ WebkitOverflowScrolling: 'touch' }}>
                    <div className="flex flex-nowrap gap-1.5 justify-start py-2 min-w-max">
                        {letters.map(l => (
                            <button
                                key={l}
                                onClick={() => scrollToLetter(l)}
                                disabled={!activeLetters.includes(l)}
                                aria-current={activeLetters.includes(l) && activeLetter === l ? 'true' : undefined}
                                className={`${letterButtonClass(activeLetters.includes(l), activeLetters.includes(l) && activeLetter === l)} w-8 h-8 md:w-9 md:h-9`}
                                aria-label={activeLetters.includes(l) ? `Jump to recipes starting with ${l}${activeLetter === l ? ' (current section)' : ''}` : `No recipes starting with ${l}`}
                            >
                                {l}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Desktop: sticky vertical letter nav */}
            <div className="hidden md:block w-20 sticky top-32 self-start">
                <div className="flex flex-col gap-1.5 items-center">
                    {letters.map(l => (
                        <button
                            key={l}
                            onClick={() => scrollToLetter(l)}
                            disabled={!activeLetters.includes(l)}
                            aria-current={activeLetters.includes(l) && activeLetter === l ? 'true' : undefined}
                            className={`${letterButtonClass(activeLetters.includes(l), activeLetters.includes(l) && activeLetter === l)}`}
                            aria-label={activeLetters.includes(l) ? `Jump to recipes starting with ${l}${activeLetter === l ? ' (current section)' : ''}` : `No recipes starting with ${l}`}
                        >
                            {l}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 space-y-20">
                <h2 className="text-4xl font-serif italic text-[#2D4635] mb-12">Archival Index</h2>
                {activeLetters.length === 0 && (
                    <div className="text-center py-32 bg-stone-50 rounded-[3rem] border border-stone-100 space-y-2" role="status">
                        <p className="text-stone-400 font-serif">Index is empty.</p>
                        <p className="text-stone-300 text-sm">Try a different filter in Recipes, or use Add New Recipe to add recipes.</p>
                    </div>
                )}
                {letters.filter(l => activeLetters.includes(l)).map(l => (
                    <div key={l} id={`idx-${l}`} className="space-y-8 animate-in fade-in">
                        {/* Added sticky positioning to the h3 header */}
                        <h3 className="text-6xl font-serif italic text-[#A0522D]/10 border-b border-stone-100 pb-4 flex items-center gap-6 sticky top-[120px] bg-white z-10">{l}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {grouped[l].map(r => (
                                <button key={r.id} onClick={() => onSelect(r)} className="group flex items-center justify-between p-6 bg-white rounded-[2rem] border border-stone-100 hover:shadow-xl transition-all text-left">
                                    <div className="overflow-hidden">
                                        <p className="text-xl font-serif italic text-[#2D4635] mb-1 truncate">{r.title}</p>
                                        <p className="text-[9px] uppercase tracking-widest text-stone-400">By {r.contributor} • {r.category}</p>
                                    </div>
                                    <span className="text-[9px] font-black uppercase text-stone-300 group-hover:text-[#2D4635] ml-4 shrink-0 transition-all">Open →</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
