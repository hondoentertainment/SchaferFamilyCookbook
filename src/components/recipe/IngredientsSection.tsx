import React from 'react';
import { useUI } from '../../context/UIContext';

interface IngredientsSectionProps {
    ingredients: string[];
    baseServings: number;
    scaleTo: number;
    onScaleChange: (value: number) => void;
    scaleFlash: boolean;
}

export const IngredientsSection: React.FC<IngredientsSectionProps> = ({
    ingredients,
    baseServings,
    scaleTo,
    onScaleChange,
    scaleFlash,
}) => {
    const { toast } = useUI();

    return (
        <div className={`print-simplify space-y-4 bg-white/50 p-6 rounded-2xl border border-stone-200/50 transition-all duration-300${scaleFlash ? ' ring-2 ring-[#A0522D]/30' : ''}`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
                <h3 className="text-xl font-serif italic text-[#2D4635] flex items-center gap-2">
                    <span className="text-2xl">🥘</span>
                    <span>Ingredients</span>
                </h3>
                <div className="flex flex-wrap items-center gap-3">
                    {baseServings > 0 && (
                        <label className="flex items-center gap-2 text-sm">
                            <span className="text-stone-500 font-medium">Scale to:</span>
                            <select
                                value={scaleTo}
                                onChange={(e) => onScaleChange(parseInt(e.target.value, 10))}
                                className="px-3 py-2 rounded-full border border-stone-200 bg-white text-stone-700 font-medium focus:ring-2 focus:ring-[#2D4635]/20"
                                aria-label="Scale ingredients by serving size"
                            >
                                {[...new Set([1, 2, 4, 6, 8, 10, 12, baseServings])]
                                    .sort((a, b) => a - b)
                                    .map((n) => (
                                        <option key={n} value={n}>
                                            {n} serving{n !== 1 ? 's' : ''}
                                        </option>
                                    ))}
                            </select>
                        </label>
                    )}
                    <button
                        type="button"
                        onClick={async () => {
                            const text = ingredients.join('\n');
                            try {
                                await navigator.clipboard.writeText(text);
                                toast('Ingredients copied to clipboard', 'success');
                            } catch {
                                toast("Couldn't copy ingredients. Check clipboard permissions and try again.", 'error');
                            }
                        }}
                        className="print:hidden shrink-0 px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#2D4635] hover:text-[#A0522D] hover:bg-white/80 rounded-full border border-stone-200 transition-colors"
                        aria-label="Copy ingredients to clipboard"
                    >
                        Copy ingredients
                    </button>
                </div>
            </div>
            <ul className="space-y-3 pl-2">
                {ingredients.map((ing, i) => (
                    <li key={i} className="text-sm md:text-base text-stone-700 flex items-start gap-3 leading-relaxed group hover:text-[#2D4635] transition-colors">
                        <span className="text-[#A0522D] mt-2 w-2 h-2 rounded-full bg-[#A0522D]/30 shrink-0 group-hover:bg-[#A0522D] transition-colors" />
                        <span className="flex-1">{ing}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};
