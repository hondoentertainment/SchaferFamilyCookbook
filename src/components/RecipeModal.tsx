import React, { useState } from 'react';
import { Recipe } from '../types';

interface RecipeModalProps {
    recipe: Recipe;
    onClose: () => void;
    onEdit: (r: Recipe) => void;
    onDelete: (id: string) => void;
    onUpdate?: (recipe: Recipe, file?: File) => Promise<void>;
}

export const RecipeModal: React.FC<RecipeModalProps> = ({ recipe, onClose, onEdit, onDelete, onUpdate }) => {
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // Hidden file input ref
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    if (!recipe) return null; // Safety check

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !onUpdate) return;

        setIsUploading(true);
        try {
            await onUpdate(recipe, file);
        } catch (error) {
            console.error("Upload failed", error);
            alert("Failed to upload image.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <>
            {/* Lightbox Overlay */}
            {lightboxOpen && (
                <div
                    className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-lg flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-300 cursor-zoom-out"
                    onClick={() => setLightboxOpen(false)}
                >
                    <button
                        onClick={() => setLightboxOpen(false)}
                        className="absolute top-6 right-6 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white text-2xl transition-colors"
                        title="Close"
                    >
                        ✕
                    </button>
                    <img
                        src={recipe.image}
                        className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl animate-in zoom-in-105 duration-500"
                        alt={recipe.title}
                    />
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/60 text-xs uppercase tracking-widest">
                        Click anywhere to close
                    </div>
                </div>
            )}

            {/* Main Modal */}
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-8">
                <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-md" onClick={onClose} />
                <div className="bg-[#FDFBF7] w-full md:max-w-4xl h-full md:h-auto md:max-h-[90vh] md:rounded-[3rem] overflow-hidden shadow-2xl relative animate-in fade-in slide-in-from-bottom-10 md:zoom-in-95 duration-500 flex flex-col md:flex-row">
                    <div className="absolute top-6 right-6 z-10 flex gap-2">
                        <button onClick={() => { if (confirm("Discard this record forever?")) onDelete(recipe.id); }} className="w-10 h-10 bg-white border border-stone-100 rounded-full shadow-lg flex items-center justify-center text-stone-300 hover:text-red-500 transition-colors" title="Delete">✕</button>
                        <button onClick={() => onEdit(recipe)} className="w-10 h-10 bg-[#2D4635] rounded-full shadow-lg flex items-center justify-center text-white hover:bg-[#1e3023] transition-colors" title="Edit">✎</button>
                        <button onClick={onClose} className="w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-stone-400 hover:text-stone-900 transition-colors" title="Close">✕</button>
                    </div>

                    <div
                        className="w-full md:w-1/2 h-64 md:h-auto relative cursor-zoom-in group"
                        onClick={(e) => {
                            // Don't open lightbox if clicking upload button
                            if ((e.target as HTMLElement).closest('.upload-btn')) return;
                            setLightboxOpen(true);
                        }}
                    >
                        <img src={recipe.image} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt={recipe.title} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent md:hidden" />

                        {/* Interactive Overlay & Upload Button */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center gap-2">
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-stone-800 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest shadow-lg pointer-events-none">
                                🔍 Enlarge
                            </span>

                            {/* Upload Button */}
                            {onUpdate && (
                                <>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                    />
                                    <button
                                        className="upload-btn opacity-0 group-hover:opacity-100 transition-opacity bg-[#2D4635]/90 text-white px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest shadow-lg hover:bg-[#2D4635] flex items-center gap-2"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            fileInputRef.current?.click();
                                        }}
                                        disabled={isUploading}
                                    >
                                        {isUploading ? '⏳ Uploading...' : '📷 Change Photo'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-8 md:p-12 space-y-8">
                        <div>
                            <span className="text-[10px] font-black uppercase text-[#A0522D] tracking-widest">{recipe.category}</span>
                            <h2 className="text-4xl font-serif italic text-[#2D4635] mt-2 leading-tight">{recipe.title}</h2>
                            <div className="flex gap-4 mt-4 text-[10px] font-black uppercase text-stone-400 tracking-widest">
                                <span>By {recipe.contributor}</span>
                                {(recipe.prepTime || recipe.cookTime || recipe.calories) && (
                                    <span className="flex gap-2 text-[#A0522D]">
                                        {recipe.prepTime && <span>Prep: {recipe.prepTime}</span>}
                                        {recipe.cookTime && <span>Cook: {recipe.cookTime}</span>}
                                        {recipe.calories && <span className="flex items-center gap-1"><span>•</span> <span>~{recipe.calories} kcal</span></span>}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-lg font-serif italic text-[#2D4635] border-b border-stone-100 pb-2">Ingredients</h3>
                            <ul className="space-y-2">
                                {recipe.ingredients.map((ing, i) => (
                                    <li key={i} className="text-sm text-stone-600 flex items-start gap-3">
                                        <span className="text-[#A0522D] mt-1.5 w-1.5 h-1.5 rounded-full bg-[#A0522D]/20 shrink-0" />
                                        {ing}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-lg font-serif italic text-[#2D4635] border-b border-stone-100 pb-2">Instructions</h3>
                            <div className="space-y-6">
                                {recipe.instructions.map((step, i) => (
                                    <div key={i} className="flex gap-4">
                                        <span className="text-2xl font-serif italic text-[#A0522D]/20 shrink-0 tabular-nums">{(i + 1).toString().padStart(2, '0')}</span>
                                        <p className="text-sm text-stone-700 leading-relaxed">{step}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {recipe.notes && (
                            <div className="bg-[#2D4635]/5 p-6 rounded-3xl border border-[#2D4635]/10 italic text-stone-600 text-sm">
                                <span className="font-serif block mb-1 text-[#2D4635]">Heirloom Notes</span>
                                {recipe.notes}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};
