import React, { useRef, useEffect } from 'react';
import { AVATAR_SETS } from '../constants';
import { useFocusTrap } from '../utils/focusTrap';

interface AvatarPickerProps {
    currentAvatar: string;
    onSelect: (url: string) => void;
    onClose: () => void;
}

export const AvatarPicker: React.FC<AvatarPickerProps> = ({ currentAvatar, onSelect, onClose }) => {
    const [selectedUrl, setSelectedUrl] = React.useState(currentAvatar);
    const [activeSetIndex, setActiveSetIndex] = React.useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const currentSet = AVATAR_SETS[activeSetIndex];
    const urls = currentSet.urls;

    // If current avatar belongs to another set, switch tab to it on open
    useEffect(() => {
        for (let i = 0; i < AVATAR_SETS.length; i++) {
            if (AVATAR_SETS[i].urls.includes(currentAvatar)) {
                setActiveSetIndex(i);
                break;
            }
        }
    }, [currentAvatar]);

    useFocusTrap(true, containerRef);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    return (
        <div ref={containerRef} className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-300 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))]" role="dialog" aria-modal="true" aria-labelledby="avatar-picker-title">
            <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl border border-stone-100 overflow-hidden animate-in zoom-in-95 duration-300 motion-reduce:animate-none">
                <div className="p-8 border-b border-stone-50 flex justify-between items-center">
                    <div>
                        <h3 id="avatar-picker-title" className="text-2xl font-serif italic text-[#2D4635]">Heritage Identity Library</h3>
                        <p className="text-xs text-stone-500 mt-1 uppercase tracking-widest font-black">Select a legacy representative</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-11 h-11 min-w-[2.75rem] min-h-[2.75rem] rounded-full bg-stone-50 text-stone-500 flex items-center justify-center hover:bg-stone-100 transition-colors font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2"
                        aria-label="Close avatar picker"
                    >
                        ✕
                    </button>
                </div>

                <div className="px-6 pt-4 border-b border-stone-100">
                    <div className="flex gap-2" role="tablist" aria-label="Avatar set">
                        {AVATAR_SETS.map((set, i) => (
                            <button
                                key={set.label}
                                type="button"
                                role="tab"
                                aria-selected={activeSetIndex === i}
                                aria-controls="avatar-grid"
                                id={`avatar-tab-${i}`}
                                onClick={() => setActiveSetIndex(i)}
                                className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors ${activeSetIndex === i ? 'bg-[#2D4635] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                            >
                                {set.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div id="avatar-grid" role="tabpanel" aria-labelledby={`avatar-tab-${activeSetIndex}`} className="p-8 grid grid-cols-4 sm:grid-cols-6 gap-4 max-h-[50vh] overflow-y-auto custom-scrollbar">
                    {urls.map((url, i) => (
                        <button
                            key={`${activeSetIndex}-${i}`}
                            onClick={() => setSelectedUrl(url)}
                            className={`relative group rounded-2xl overflow-hidden transition-colors p-2 motion-reduce:transition-none ${!prefersReducedMotion ? 'hover:scale-110 active:scale-95 transition-transform' : ''} ${selectedUrl === url ? 'bg-emerald-50 ring-2 ring-[#2D4635]' : 'bg-stone-50 hover:bg-white'}`}
                            aria-label={`Select avatar ${i + 1} from ${currentSet.label}`}
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
                        className="px-8 py-3 bg-white border border-stone-200 text-stone-500 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-stone-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2"
                    >
                        Cancel
                    </button>
                    <div className="flex items-center gap-4">
                        <p className="text-[10px] text-stone-500 italic hidden sm:block">Select an icon then click save.</p>
                        <button
                            onClick={() => {
                                onSelect(selectedUrl);
                                onClose();
                            }}
                            className="px-8 py-3 bg-[#2D4635] text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-[#1e2f23] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50"
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
