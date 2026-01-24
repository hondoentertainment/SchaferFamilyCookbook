import React, { useState } from 'react';
import { UserProfile, Recipe, HistoryEntry } from '../types';

interface ProfileViewProps {
    currentUser: UserProfile;
    userRecipes: Recipe[];
    userHistory: HistoryEntry[];
    onUpdateProfile: (name: string, avatar: string) => Promise<void>;
    onEditRecipe: (recipe: Recipe) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = (props) => {
    const { currentUser, userRecipes, userHistory, onUpdateProfile, onEditRecipe } = props;
    const [name, setName] = useState(currentUser.name);
    const [avatar, setAvatar] = useState(currentUser.picture);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onUpdateProfile(name, avatar);
            alert("Profile updated successfully!");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto py-12 px-6 space-y-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Identity Card */}
            <section className="bg-white rounded-[4rem] p-10 md:p-16 border border-stone-100 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full -mr-32 -mt-32 blur-3xl opacity-50" />
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-12">
                    <div className="relative group">
                        <img src={avatar} className="w-48 h-48 rounded-full border-8 border-white shadow-2xl transition-all group-hover:scale-105" alt={name} />
                        <button
                            onClick={() => {
                                const newUrl = prompt("Enter new Avatar URL:", avatar);
                                if (newUrl) setAvatar(newUrl);
                            }}
                            className="absolute bottom-4 right-4 w-12 h-12 bg-[#2D4635] text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 active:scale-90 transition-all text-xl"
                        >
                            📷
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
                                className="px-12 py-5 bg-[#2D4635] text-white rounded-full text-[10px] font-black uppercase tracking-[0.3em] shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                            >
                                {isSaving ? 'Updating...' : 'Save Profile'}
                            </button>
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
                <section className="space-y-8">
                    <h3 className="text-3xl font-serif italic text-[#2D4635] flex items-center gap-4">
                        <span className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center not-italic text-2xl">📖</span>
                        My Shared Recipes
                    </h3>

                    <div className="space-y-4">
                        {userRecipes.map(recipe => (
                            <div key={recipe.id} className="bg-white p-6 rounded-[2.5rem] border border-stone-100 shadow-sm flex items-center gap-6 group hover:shadow-md transition-all">
                                <img src={recipe.image} className="w-20 h-20 rounded-2xl object-cover shadow-sm" alt={recipe.title} />
                                <div className="flex-1">
                                    <h4 className="font-serif italic text-[#2D4635] text-xl">{recipe.title}</h4>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-stone-400">{recipe.category}</span>
                                </div>
                                <button
                                    onClick={() => onEditRecipe(recipe)}
                                    className="p-4 bg-stone-50 text-stone-400 rounded-2xl hover:bg-[#2D4635] hover:text-white transition-all text-sm shadow-inner"
                                >
                                    ✏️
                                </button>
                            </div>
                        ))}
                        {userRecipes.length === 0 && (
                            <div className="py-20 text-center border-2 border-dashed border-stone-100 rounded-[3rem]">
                                <p className="text-stone-300 font-serif italic text-lg">No recipes shared yet.</p>
                            </div>
                        )}
                    </div>
                </section>

                {/* My History */}
                <section className="space-y-8">
                    <h3 className="text-3xl font-serif italic text-[#2D4635] flex items-center gap-4">
                        <span className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center not-italic text-2xl">⏲️</span>
                        My Contribution Log
                    </h3>

                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {userHistory.map(entry => (
                            <div key={entry.id} className="flex gap-4 p-5 bg-stone-50/50 rounded-3xl border border-stone-100 items-start">
                                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-lg mt-1">
                                    {entry.type === 'recipe' ? '🍲' : entry.type === 'gallery' ? '🖼️' : '💡'}
                                </div>
                                <div className="flex-1 space-y-1">
                                    <p className="text-sm text-stone-600">
                                        <span className="font-bold text-[#2D4635] capitalize">{entry.action}</span>
                                        {' '}{entry.type}{' '}
                                        <span className="italic font-serif">"{entry.itemName}"</span>
                                    </p>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-300">
                                        {new Date(entry.timestamp).toLocaleDateString()} at {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
        </div>
    );
};
