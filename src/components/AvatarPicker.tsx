import React from 'react';
import { HERITAGE_AVATARS } from '../constants';

interface AvatarPickerProps {
    currentAvatar: string;
    onSelect: (url: string) => void;
    onClose: () => void;
}

export const AvatarPicker: React.FC<AvatarPickerProps> = ({ currentAvatar, onSelect, onClose }) => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl border border-stone-100 overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-8 border-b border-stone-50 flex justify-between items-center">
                    <div>
                        <h3 className="text-2xl font-serif italic text-[#2D4635]">Heritage Identity Library</h3>
                        <p className="text-xs text-stone-400 mt-1 uppercase tracking-widest font-black">Select a legacy representative</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-stone-50 text-stone-400 flex items-center justify-center hover:bg-stone-100 transition-all font-bold"
                    >
                        ✕
                    </button>
                </div>

                <div className="p-8 grid grid-cols-4 sm:grid-cols-6 gap-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {HERITAGE_AVATARS.map((url, i) => (
                        <button
                            key={i}
                            onClick={() => {
                                onSelect(url);
                                onClose();
                            }}
                            className={`relative group rounded-2xl overflow-hidden transition-all hover:scale-110 active:scale-90 p-2 ${currentAvatar === url ? 'bg-emerald-50 ring-2 ring-[#2D4635]' : 'bg-stone-50 hover:bg-white'
                                }`}
                        >
                            <img src={url} className="w-full h-full object-contain" alt={`Avatar ${i}`} />
                            {currentAvatar === url && (
                                <div className="absolute top-1 right-1 w-4 h-4 bg-[#2D4635] text-white rounded-full flex items-center justify-center text-[8px]">
                                    ✓
                                </div>
                            )}
                        </button>
                    ))}
                </div>

                <div className="p-8 bg-stone-50 flex justify-between items-center">
                    <p className="text-[10px] text-stone-300 italic">Select an icon to instantly update family identity.</p>
                    <button
                        onClick={onClose}
                        className="px-8 py-3 bg-stone-200 text-stone-500 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-stone-300 transition-all"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};
