import React from 'react';

interface InstructionsSectionProps {
    instructions: string[];
    onStartCook?: () => void;
}

export const InstructionsSection: React.FC<InstructionsSectionProps> = ({
    instructions,
    onStartCook,
}) => {
    return (
        <div className="space-y-5" id="recipe-instructions">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-stone-200">
                <h3 className="text-xl font-serif italic text-[#2D4635] flex items-center gap-2">
                    <span className="text-2xl">📝</span>
                    <span>Instructions</span>
                </h3>
                {instructions.length >= 5 && (
                    <div className="flex flex-wrap gap-2 print:hidden">
                        <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 self-center">Jump to:</span>
                        {instructions.map((_, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => {
                                    const el = document.getElementById(`recipe-step-${i}`);
                                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }}
                                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-[#2D4635] hover:text-white text-stone-600 text-xs font-bold transition-colors"
                                aria-label={`Go to step ${i + 1}`}
                            >
                                {i + 1}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <div className="space-y-6">
                {instructions.map((step, i) => (
                    <div key={i} id={`recipe-step-${i}`} className="flex gap-4 group hover:bg-white/50 p-4 rounded-xl transition-all -ml-4 scroll-mt-24">
                        <span className="text-3xl font-serif italic text-[#A0522D]/30 group-hover:text-[#A0522D]/50 shrink-0 tabular-nums transition-colors leading-none pt-1">
                            {(i + 1).toString().padStart(2, '0')}
                        </span>
                        <p className="text-sm md:text-base text-stone-700 leading-relaxed flex-1 group-hover:text-[#2D4635] transition-colors">
                            {step}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
};
