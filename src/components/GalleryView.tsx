import React, { useState, useEffect } from 'react';
import { UserProfile, GalleryItem, DBStats } from '../types';
import { useFocusTrap } from '../utils/focusTrap';
import { avatarOnError } from '../utils/avatarFallback';
import { hapticLight } from '../utils/haptics';
import { useUI } from '../context/UIContext';
import { CloudArchive } from '../services/db';

const CLOUD_ERROR_MSG = "Couldn't save. Check your connection and try again.";

/* ---------- sub-components (previously inline in App.tsx) ---------- */

const GalleryImage: React.FC<{ url: string; caption: string; onClick?: () => void }> = ({ url, caption, onClick }) => {
    const [broken, setBroken] = useState(false);
    if (!url || broken) {
        return (
            <div className="w-full aspect-video rounded-2xl mb-4 bg-gradient-to-br from-stone-100 to-stone-200 flex flex-col items-center justify-center gap-2 text-stone-400 border border-stone-200">
                <span className="text-4xl opacity-60">📷</span>
                <span className="text-[10px] font-medium uppercase tracking-wider">{url ? 'Preview unavailable' : 'No image'}</span>
            </div>
        );
    }
    const imgEl = (
        <img
            src={url}
            width={800}
            height={600}
            className={`w-full rounded-2xl mb-4 object-cover max-h-[32rem] ${onClick ? 'cursor-pointer hover:opacity-95 transition-opacity' : ''}`}
            alt={caption || 'Gallery photo'}
            onError={() => setBroken(true)}
            loading="lazy"
        />
    );
    if (onClick) {
        return (
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onClick(); }}
                className="w-full text-left rounded-2xl overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                aria-label={`View full size: ${caption || 'Gallery photo'}`}
            >
                {imgEl}
            </button>
        );
    }
    return <div>{imgEl}</div>;
};

const GalleryDeleteConfirmDialog: React.FC<{ item: GalleryItem; onClose: () => void; onConfirm: () => void | Promise<void> }> = ({ item, onClose, onConfirm }) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const cancelRef = React.useRef<HTMLButtonElement>(null);

    useFocusTrap(true, containerRef);
    useEffect(() => {
        cancelRef.current?.focus();
        const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="gallery-delete-title"
            aria-describedby="gallery-delete-desc"
            className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
            onClick={onClose}
        >
            <div
                ref={containerRef}
                className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 fade-in duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 id="gallery-delete-title" className="text-xl font-serif italic text-[#2D4635] mb-2">Remove from gallery?</h3>
                <p id="gallery-delete-desc" className="text-stone-500 mb-6">
                    &quot;{item.caption}&quot; will be permanently removed. This cannot be undone.
                </p>
                <div className="flex gap-3 justify-end">
                    <button
                        ref={cancelRef}
                        type="button"
                        onClick={onClose}
                        className="min-h-11 min-w-11 px-6 py-3 rounded-full text-sm font-bold uppercase tracking-widest text-stone-600 hover:bg-stone-50 transition-colors touch-manipulation"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => { hapticLight(); onConfirm(); }}
                        className="min-h-11 min-w-11 px-6 py-3 rounded-full text-sm font-bold uppercase tracking-widest text-white bg-red-500 hover:bg-red-600 transition-colors touch-manipulation"
                    >
                        Remove
                    </button>
                </div>
            </div>
        </div>
    );
};

const GalleryLightbox: React.FC<{ item: GalleryItem; onClose: () => void }> = ({ item, onClose }) => {
    const closeRef = React.useRef<HTMLButtonElement>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        closeRef.current?.focus();
        const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    useFocusTrap(true, containerRef);

    const isVideo = item.type === 'video';

    return (
        <div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-label={isVideo ? 'Fullscreen gallery video' : 'Enlarged gallery image'}
            className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-lg flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-300 cursor-zoom-out pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
            onClick={onClose}
        >
            <button
                ref={closeRef}
                onClick={() => { hapticLight(); onClose(); }}
                className="absolute top-[max(1.5rem,env(safe-area-inset-top))] right-[max(1.5rem,env(safe-area-inset-right))] w-12 h-12 min-w-11 min-h-11 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white text-2xl transition-colors z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white touch-manipulation"
                aria-label="Close"
            >
                ✕
            </button>
            {isVideo ? (
                <video
                    src={item.url}
                    controls
                    autoPlay
                    playsInline
                    className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl animate-in zoom-in-105 duration-500"
                    onClick={(e) => e.stopPropagation()}
                    title={item.caption || 'Family video'}
                    aria-label={`Video: ${item.caption || 'Family memory'}`}
                >
                    <track kind="captions" srcLang="en" label="English" />
                </video>
            ) : (
                <img
                    src={item.url}
                    width={800}
                    height={600}
                    loading="lazy"
                    className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl animate-in zoom-in-105 duration-500 pointer-events-none"
                    alt={item.caption || 'Gallery photo'}
                    onClick={(e) => e.stopPropagation()}
                />
            )}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/60 text-xs uppercase tracking-widest text-center">
                {item.caption}
                <br />
                <span className="text-[10px]">Click anywhere or press Escape to close</span>
            </div>
        </div>
    );
};

const GallerySkeleton: React.FC = () => (
    <div className="columns-1 md:columns-2 lg:columns-3 gap-8 space-y-8">
        {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="break-inside-avoid bg-white p-4 rounded-[2rem] border border-stone-100 shadow-md">
                <div className="w-full aspect-video rounded-2xl mb-4 bg-stone-200 animate-pulse" />
                <div className="h-5 bg-stone-200 rounded animate-pulse w-3/4 mb-4" />
                <div className="flex justify-between items-center">
                    <div className="w-4 h-4 rounded-full bg-stone-200 animate-pulse" />
                    <div className="h-3 bg-stone-100 rounded animate-pulse w-24" />
                </div>
            </div>
        ))}
    </div>
);

/* ---------- GalleryView ---------- */

interface GalleryViewProps {
    gallery: GalleryItem[];
    currentUser: UserProfile;
    dbStats: DBStats;
    isDataLoading?: boolean;
    /** Phone number for MMS send-to-archive */
    archivePhone?: string;
    /** Resolve contributor avatar by name */
    getAvatar: (name: string) => string;
    /** Called after a gallery item is deleted so the parent can refresh */
    onRefreshLocal: () => Promise<void>;
}

export const GalleryView: React.FC<GalleryViewProps> = ({
    gallery,
    currentUser,
    isDataLoading,
    archivePhone,
    getAvatar,
    onRefreshLocal,
}) => {
    const { toast } = useUI();
    const [selectedGalleryItem, setSelectedGalleryItem] = useState<GalleryItem | null>(null);
    const [galleryDeleteConfirm, setGalleryDeleteConfirm] = useState<GalleryItem | null>(null);

    return (
        <main id="main-content" className="max-w-7xl mx-auto py-12 pl-[max(1.5rem,env(safe-area-inset-left,0px))] pr-[max(1.5rem,env(safe-area-inset-right,0px))]" role="main" aria-label="Family Gallery" tabIndex={-1}>
            <section className="flex flex-col md:flex-row justify-between items-center mb-12 gap-8">
                <div>
                    <h2 className="text-4xl font-serif italic text-[#2D4635]">Family Gallery</h2>
                    <p className="text-stone-500 font-serif italic mt-2">Captured moments across the generations.</p>
                </div>
                {archivePhone ? (
                    <div className="bg-emerald-50 rounded-[2rem] p-6 border border-emerald-100 flex items-center gap-6 animate-in slide-in-from-right-8 duration-700" role="region" aria-label="Text-to-archive instructions">
                        <span className="text-3xl" aria-hidden="true">📱</span>
                        <div>
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-800 leading-none mb-1">Text your memories</h4>
                            <p className="text-sm text-emerald-700 font-serif italic">
                                Photo/Video to:{' '}
                                <a
                                    href={`sms:${archivePhone.replace(/\s/g, '')}`}
                                    className="font-bold not-italic underline decoration-emerald-600/50 hover:decoration-emerald-700 underline-offset-2 hover:text-emerald-800 transition-colors"
                                    aria-label={`Text photos or videos to ${archivePhone}`}
                                >
                                    {archivePhone}
                                </a>
                            </p>
                            <p className="text-[10px] text-emerald-600/80 mt-1">Tap the number to open your messaging app</p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-stone-50 rounded-[2rem] p-6 border border-stone-100 flex items-center gap-6 max-w-md" role="region" aria-label="How to add photos">
                        <span className="text-2xl" aria-hidden="true">📷</span>
                        <div>
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-500 leading-none mb-1">Want to add photos?</h4>
                            <p className="text-sm text-stone-500 font-serif italic">Admins can enable text-to-archive in Profile → Admin Tools → Gallery. Or ask an administrator to add your memories.</p>
                        </div>
                    </div>
                )}
            </section>

            {isDataLoading ? (
                <GallerySkeleton />
            ) : gallery.length === 0 ? (
                <div className="py-24 text-center space-y-8 animate-in fade-in duration-500" role="status">
                    <div className="w-32 h-32 mx-auto rounded-full bg-stone-100 flex items-center justify-center text-5xl border-2 border-dashed border-stone-200">🖼️</div>
                    <div className="space-y-3">
                        <h3 className="text-2xl font-serif italic text-[#2D4635]">The gallery awaits your memories</h3>
                        <p className="text-stone-500 font-serif italic max-w-md mx-auto">Be the first to add a photo or video. Text to the archive number once admins enable it, or ask a family custodian to add your moments.</p>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-500">Share the moments that matter</p>
                </div>
            ) : (
                <>
                    <div className="columns-1 md:columns-2 lg:columns-3 gap-8 space-y-8" role="list">
                        {gallery.map(item => (
                            <article key={item.id} className="break-inside-avoid bg-white p-4 rounded-[2rem] border border-stone-100 shadow-md group hover:shadow-2xl transition-all focus-within:shadow-2xl" role="listitem">
                                {item.type === 'video' ? (
                                    <button
                                        type="button"
                                        onClick={() => setSelectedGalleryItem(item)}
                                        className="w-full text-left rounded-2xl overflow-hidden mb-4 bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2 focus-visible:ring-offset-white relative"
                                        aria-label={`View full size: ${item.caption || 'Family video'}`}
                                        onFocus={e => {
                                            const vid = e.currentTarget.querySelector('video');
                                            if (vid) vid.play();
                                        }}
                                        onBlur={e => {
                                            const vid = e.currentTarget.querySelector('video');
                                            if (vid) vid.pause();
                                        }}
                                        onMouseOver={e => {
                                            const vid = e.currentTarget.querySelector('video');
                                            if (vid) vid.play();
                                        }}
                                        onMouseOut={e => {
                                            const vid = e.currentTarget.querySelector('video');
                                            if (vid) vid.pause();
                                        }}
                                    >
                                        <video
                                            src={item.url}
                                            className="w-full pointer-events-none"
                                            muted
                                            playsInline
                                            preload="metadata"
                                            title={item.caption || 'Family video'}
                                            aria-hidden
                                            onTouchStart={e => {
                                                const el = e.target as HTMLVideoElement;
                                                if (el.paused) el.play();
                                                else el.pause();
                                            }}
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center opacity-100 md:opacity-0 md:hover:opacity-100 focus-within:opacity-100 transition-opacity bg-black/30 pointer-events-none">
                                            <span className="bg-white/90 text-stone-800 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest">▶ Fullscreen</span>
                                        </div>
                                        <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/70 text-white text-[10px] font-black uppercase tracking-widest pointer-events-none">
                                            Video
                                        </div>
                                    </button>
                                ) : (
                                    <GalleryImage
                                        url={item.url}
                                        caption={item.caption}
                                        onClick={() => setSelectedGalleryItem(item)}
                                    />
                                )}
                                <p className="font-serif italic text-stone-800 text-lg px-2 line-clamp-3">{item.caption}</p>
                                <div className="flex justify-between items-center mt-4 px-2">
                                    <div className="flex items-center gap-2">
                                        <img src={getAvatar(item.contributor)} className="w-4 h-4 rounded-full object-cover" alt={item.contributor} onError={avatarOnError} />
                                        <span className="text-[9px] uppercase tracking-widest text-[#A0522D]">Added by {item.contributor}</span>
                                    </div>
                                    {currentUser?.role === 'admin' && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setGalleryDeleteConfirm(item); }}
                                            className="w-11 h-11 min-w-[2.75rem] min-h-[2.75rem] flex items-center justify-center text-stone-300 hover:text-red-500 opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D4635] rounded-full transition-opacity"
                                            aria-label={`Remove "${item.caption}" from gallery`}
                                            title="Remove from gallery"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                            </article>
                        ))}
                    </div>

                    {selectedGalleryItem && (
                        <GalleryLightbox
                            item={selectedGalleryItem}
                            onClose={() => setSelectedGalleryItem(null)}
                        />
                    )}

                    {galleryDeleteConfirm && (
                        <GalleryDeleteConfirmDialog
                            item={galleryDeleteConfirm}
                            onClose={() => setGalleryDeleteConfirm(null)}
                            onConfirm={async () => {
                                const id = galleryDeleteConfirm.id;
                                setGalleryDeleteConfirm(null);
                                try {
                                    await CloudArchive.deleteGalleryItem(id);
                                    await onRefreshLocal();
                                } catch {
                                    toast(CLOUD_ERROR_MSG, 'error');
                                }
                            }}
                        />
                    )}
                </>
            )}
        </main>
    );
};
