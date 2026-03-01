import React, { useRef, useEffect } from 'react';
import { HERITAGE_AVATARS } from '../constants';
import { useFocusTrap } from '../utils/focusTrap';

interface AvatarPickerProps {
    currentAvatar: string;
    onSelect: (url: string) => void;
    onClose: () => void;
}

export const AvatarPicker: React.FC<AvatarPickerProps> = ({ currentAvatar, onSelect, onClose }) => {
    const [selectedUrl, setSelectedUrl] = React.useState(currentAvatar);
    const containerRef = useRef<HTMLDivElement>(null);

    useFocusTrap(true, containerRef);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    return (
        <div ref={containerRef} className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-300 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))]" role="dialog" aria-modal="true" aria-labelledby="avatar-picker-title">
            <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl border border-stone-100 overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-8 border-b border-stone-50 flex justify-between items-center">
                    <div>
                        <h3 id="avatar-picker-title" className="text-2xl font-serif italic text-[#2D4635]">Heritage Identity Library</h3>
                        <p className="text-xs text-stone-400 mt-1 uppercase tracking-widest font-black">Select a legacy representative</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-11 h-11 min-w-[2.75rem] min-h-[2.75rem] rounded-full bg-stone-50 text-stone-400 flex items-center justify-center hover:bg-stone-100 transition-all font-bold"
                        aria-label="Close avatar picker"
                    >
                        ✕
                    </button>
                </div>

                <div className="p-8 grid grid-cols-4 sm:grid-cols-6 gap-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {HERITAGE_AVATARS.map((url, i) => (
                        <button
                            key={i}
                            onClick={() => setSelectedUrl(url)}
                            className={`relative group rounded-2xl overflow-hidden transition-all hover:scale-110 active:scale-90 p-2 ${selectedUrl === url ? 'bg-emerald-50 ring-2 ring-[#2D4635]' : 'bg-stone-50 hover:bg-white'
                                }`}
                            aria-label={`Select avatar ${i + 1}`}
                            aria-pressed={selectedUrl === url}
                        >
                            <img src={url} className="w-full aspect-square object-cover rounded-xl" alt="" aria-hidden />
                            {selectedUrl === url && (
                                <div className="absolute top-1 right-1 w-4 h-4 bg-[#2D4635] text-white rounded-full flex items-center justify-center text-[8px]">
                                    ✓
                                </div>
                            )}
                        </button>
                    ))}
                </div>

                <div className="p-8 bg-stone-50 flex justify-between items-center gap-4">
                    <button
                        onClick={onClose}
                        className="px-8 py-3 bg-white border border-stone-200 text-stone-400 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-stone-100 transition-all"
                    >
                        Cancel
                    </button>
                    <div className="flex items-center gap-4">
                        <p className="text-[10px] text-stone-400 italic hidden sm:block">Select an icon then click save.</p>
                        <button
                            onClick={() => {
                                onSelect(selectedUrl);
                                onClose();
                            }}
                            className="px-8 py-3 bg-[#2D4635] text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-[#1e2f23] transition-all"
                            aria-label="Save selected avatar"
                        >
                            Save Identity
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
