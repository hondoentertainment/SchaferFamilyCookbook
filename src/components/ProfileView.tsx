import React, { useState } from 'react';
import { UserProfile, Recipe, HistoryEntry } from '../types';
import { CATEGORY_IMAGES } from '../constants';
import { AvatarPicker } from './AvatarPicker';
import { useUI } from '../context/UIContext';

interface ProfileViewProps {
    currentUser: UserProfile;
    userRecipes: Recipe[];
    userHistory: HistoryEntry[];
    onUpdateProfile: (name: string, avatar: string) => Promise<void>;
    onEditRecipe: (recipe: Recipe) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = (props) => {
    const { currentUser, userRecipes, userHistory, onUpdateProfile, onEditRecipe } = props;
    const { toast } = useUI();
    const [name, setName] = useState(currentUser.name);
    const [avatar, setAvatar] = useState(currentUser.picture);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [showPicker, setShowPicker] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        setSaveSuccess(false);
        setSaveError(null);
        try {
            await onUpdateProfile(name, avatar);
            setSaveSuccess(true);
            setSaveError(null);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to save profile';
            setSaveError(message);
            toast(message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto py-8 md:py-12 px-4 md:px-6 space-y-12 md:space-y-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Identity Card */}
            <section className="bg-white rounded-[3rem] md:rounded-[4rem] p-6 md:p-16 border border-stone-100 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full -mr-32 -mt-32 blur-3xl opacity-50" />
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 md:gap-12">
                    <div className="relative group">
                        <img src={avatar} className="w-40 h-40 md:w-48 md:h-48 rounded-full border-8 border-white shadow-2xl transition-all group-hover:scale-105" alt={name} />
                        <button
                            onClick={() => setShowPicker(true)}
                            className="absolute bottom-4 right-4 w-12 h-12 bg-[#2D4635] text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 active:scale-90 transition-all text-xl"
                        >
                            🎭
                        </button>
                    </div>

                    <div className="flex-1 space-y-8 w-full">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[#A0522D] ml-2">Display Identity</label>
                            <input
                                type="text"
                                className="w-full p-6 bg-stone-50 border border-stone-100 rounded-3xl text-3xl font-serif italic text-[#2D4635] outline-none focus:ring-2 focus:ring-[#2D4635]/10 focus:bg-white transition-all shadow-inner"
                                value={name}
                                onChange={e => setName(e.target.value)}
                            />
                        </div>

                        <div className="flex flex-wrap gap-4">
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="px-12 py-5 bg-[#2D4635] text-white rounded-full text-[10px] font-black uppercase tracking-[0.3em] shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#2D4635]"
                                aria-busy={isSaving}
                                aria-live="polite"
                            >
                                {isSaving ? 'Saving...' : 'Save Profile'}
                            </button>
                            {saveError && (
                                <div className="flex items-center gap-2 px-6 py-3 bg-red-50 text-red-700 rounded-full border border-red-200 animate-in fade-in slide-in-from-left-4 duration-300">
                                    <span className="text-lg">⚠</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest">{saveError}</span>
                                </div>
                            )}
                            {saveSuccess && (
                                <div className="flex items-center gap-2 px-6 py-3 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100 animate-in fade-in slide-in-from-left-4 duration-300">
                                    <span className="text-lg">✓</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest">Profile Updated</span>
                                </div>
                            )}
                            <div className="flex items-center gap-3 px-8 py-4 bg-stone-50 rounded-full border border-stone-100">
                                <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Status:</span>
                                <span className={`text-[10px] font-black uppercase tracking-widest ${currentUser.role === 'admin' ? 'text-orange-500' : 'text-emerald-600'}`}>
                                    {currentUser.role === 'admin' ? '🏆 Legacy Custodian' : '👤 Family Member'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <div className="grid lg:grid-cols-2 gap-12">
                {/* My Recipes */}
                <section className="space-y-6 md:space-y-8">
                    <h3 className="text-2xl md:text-3xl font-serif italic text-[#2D4635] flex items-center gap-4">
                        <span className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-emerald-50 flex items-center justify-center not-italic text-xl md:text-2xl">📖</span>
                        My Shared Recipes
                    </h3>

                    <div className="space-y-3 md:space-y-4">
                        {userRecipes.map(recipe => (
                            <div key={recipe.id} className="bg-white p-4 md:p-6 rounded-[2rem] md:rounded-[2.5rem] border border-stone-100 shadow-sm flex items-center gap-4 md:gap-6 group hover:shadow-md transition-all">
                                <img
                                    src={recipe.image}
                                    className="w-16 h-16 md:w-20 md:h-20 rounded-2xl object-cover shadow-sm"
                                    alt={recipe.title}
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = CATEGORY_IMAGES[recipe.category] || CATEGORY_IMAGES.Generic;
                                    }}
                                />
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-serif italic text-[#2D4635] text-lg md:text-xl truncate">{recipe.title}</h4>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-stone-400">{recipe.category}</span>
                                </div>
                                {currentUser.role === 'admin' ? (
                                    <button
                                        onClick={() => onEditRecipe(recipe)}
                                        className="p-3 md:p-4 bg-stone-50 text-stone-400 rounded-2xl hover:bg-[#2D4635] hover:text-white transition-all text-sm shadow-inner shrink-0"
                                        title="Edit recipe"
                                        aria-label="Edit recipe"
                                    >
                                        ✏️
                                    </button>
                                ) : (
                                    <span className="p-3 md:p-4 text-stone-300 text-xs italic shrink-0" title="Contact an administrator to request edits">View only</span>
                                )}
                            </div>
                        ))}
                        {userRecipes.length === 0 && (
                            <div className="py-12 md:py-20 text-center border-2 border-dashed border-stone-100 rounded-[2.5rem] md:rounded-[3rem]">
                                <p className="text-stone-300 font-serif italic text-lg">No recipes shared yet.</p>
                            </div>
                        )}
                    </div>
                </section>

                {/* My History */}
                <section className="space-y-6 md:space-y-8">
                    <h3 className="text-2xl md:text-3xl font-serif italic text-[#2D4635] flex items-center gap-4">
                        <span className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-orange-50 flex items-center justify-center not-italic text-xl md:text-2xl">⏲️</span>
                        My Contribution Log
                    </h3>

                    <div className="space-y-3 md:space-y-4 max-h-[500px] md:max-h-[600px] overflow-y-auto pr-1 md:pr-2 custom-scrollbar">
                        {userHistory.map(entry => (
                            <div key={entry.id} className="flex gap-4 p-4 md:p-5 bg-stone-50/50 rounded-2xl md:rounded-3xl border border-stone-100 items-start">
                                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-base md:text-lg mt-0.5 md:mt-1 shrink-0">
                                    {entry.type === 'recipe' ? '🍲' : entry.type === 'gallery' ? '🖼️' : '💡'}
                                </div>
                                <div className="flex-1 space-y-1 min-w-0">
                                    <p className="text-xs md:text-sm text-stone-600">
                                        <span className="font-bold text-[#2D4635] capitalize">{entry.action}</span>
                                        {' '}{entry.type}{' '}
                                        <span className="italic font-serif">"{entry.itemName}"</span>
                                    </p>
                                    <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-stone-300">
                                        {new Date(entry.timestamp).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                        {userHistory.length === 0 && (
                            <div className="py-20 text-center border-2 border-dashed border-stone-100 rounded-[3rem]">
                                <p className="text-stone-300 font-serif italic text-lg">Your activity will appear here.</p>
                            </div>
                        )}
                    </div>
                </section>
            </div>

            {showPicker && (
                <AvatarPicker
                    currentAvatar={avatar}
                    onSelect={(url) => {
                        setAvatar(url);
                        setShowPicker(false);
                    }}
                    onClose={() => setShowPicker(false)}
                />
            )}
        </div>
    );
};
