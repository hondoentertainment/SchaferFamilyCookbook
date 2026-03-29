import React, { useState, useEffect } from 'react';
import { GalleryItem, UserProfile, DBStats } from '../../types';
import { useUI } from '../../context/UIContext';
import { useDebounceAction } from '../../hooks';

export interface GalleryUploaderProps {
    currentUser: UserProfile | null;
    dbStats: DBStats;
    onUpload: (g: GalleryItem, file?: File) => Promise<void>;
    onUpdateArchivePhone: (p: string) => void | Promise<void>;
}

export const GalleryUploader: React.FC<GalleryUploaderProps> = ({
    currentUser,
    dbStats,
    onUpload,
    onUpdateArchivePhone,
}) => {
    const { toast, confirm } = useUI();

    const [galleryForm, setGalleryForm] = useState<Partial<GalleryItem>>({ caption: '' });
    const [galleryFile, setGalleryFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [bulkFiles, setBulkFiles] = useState<FileList | null>(null);
    const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; errors: string[] }>({ current: 0, total: 0, errors: [] });
    const [archivePhoneLocal, setArchivePhoneLocal] = useState('');
    const [isSavingArchivePhone, setIsSavingArchivePhone] = useState(false);

    // Sync archive phone from dbStats
    useEffect(() => {
        setArchivePhoneLocal(dbStats.archivePhone || '');
    }, [dbStats.archivePhone]);

    // Reset bulk upload progress after completion so user can upload again
    useEffect(() => {
        if (!isSubmitting && uploadProgress.total > 0 && uploadProgress.current >= uploadProgress.total) {
            const t = setTimeout(() => setUploadProgress({ current: 0, total: 0, errors: [] }), 3000);
            return () => clearTimeout(t);
        }
    }, [isSubmitting, uploadProgress.current, uploadProgress.total]);

    const handleGallerySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!galleryFile) {
            toast('Please select a photo or video to upload.', 'error');
            return;
        }
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            const isVideo = galleryFile.type.startsWith('video/');
            await onUpload({
                id: 'g' + Date.now(),
                type: isVideo ? 'video' : 'image',
                url: '',
                caption: galleryForm.caption || (isVideo ? 'Family Video' : 'Family Memory'),
                contributor: currentUser?.name || 'Family'
            }, galleryFile);
            toast('Gallery updated', 'success');
            setGalleryForm({ caption: '' });
            setGalleryFile(null);
        } finally { setIsSubmitting(false); }
    };

    const handleBulkGalleryUpload = async () => {
        if (!bulkFiles || bulkFiles.length === 0) return;

        const files: File[] = (Array.from(bulkFiles) as File[]).filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'));
        if (files.length === 0) {
            toast('No valid image or video files selected.', 'error');
            return;
        }

        const ok = await confirm(`Upload ${files.length} files to the gallery?`, { title: 'Bulk Upload', confirmLabel: 'Upload' });
        if (!ok) return;

        setIsSubmitting(true);
        setUploadProgress({ current: 0, total: files.length, errors: [] });

        let successCount = 0;
        const errors: string[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                const isVideo = file.type.startsWith('video/');
                const baseName = file.name.replace(/\.[^/.]+$/, '');
                await onUpload({
                    id: 'g' + Date.now() + '_' + i,
                    type: isVideo ? 'video' : 'image',
                    url: '',
                    caption: galleryForm.caption || baseName || 'Family Memory',
                    contributor: currentUser?.name || 'Family'
                }, file as File);
                successCount++;
            } catch (e: any) {
                errors.push(`${file.name}: ${e.message}`);
            }

            setUploadProgress({ current: i + 1, total: files.length, errors });
        }

        setIsSubmitting(false);
        setBulkFiles(null);

        if (errors.length > 0) {
            toast(`Upload complete: ${successCount} succeeded, ${errors.length} failed. ${errors.slice(0, 2).join('; ')}${errors.length > 2 ? '…' : ''}`, 'error');
        } else {
            toast(`Successfully uploaded ${successCount} files to the gallery!`, 'success');
        }
    };

    return (
        <section className="space-y-6 animate-in fade-in">
            <h3 className="text-xl font-serif italic text-[#A0522D] flex items-center gap-3">
                <span className="w-10 h-10 rounded-full bg-[#A0522D]/5 flex items-center justify-center not-italic">🖼️</span>
                Family Archive
            </h3>
            <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100 flex items-start gap-4 mb-4">
                <span className="text-2xl mt-1">📱</span>
                <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-800">Archive by Text</h4>
                    <p className="text-xs text-emerald-700 font-serif italic mt-1 leading-relaxed">
                        Family members can text photos or videos to the archive. Text to: <br />
                        <span className="font-bold not-italic">{dbStats.archivePhone || 'Not Configured'}</span>
                    </p>
                </div>
            </div>

            <div className="p-6 bg-stone-50 rounded-[2rem] border border-stone-200 mb-8">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-500 mb-2">Twilio Configuration</h4>
                <p className="text-xs text-stone-500 mb-4">Enter your Twilio number (E.164, e.g. +15551234567) so family members can text photos and videos to the gallery. The number appears in the Gallery tab once set.</p>
                <div className="flex flex-col sm:flex-row gap-3">
                    <label htmlFor="admin-archive-phone" className="sr-only">Archive phone number (E.164)</label>
                    <input
                        id="admin-archive-phone"
                        placeholder="e.g. +15551234567"
                        className="flex-1 p-4 border border-stone-200 rounded-2xl text-base bg-white outline-none focus:ring-2 focus:ring-[#2D4635]/20"
                        value={archivePhoneLocal}
                        onChange={e => setArchivePhoneLocal(e.target.value)}
                    />
                    <button
                        type="button"
                        onClick={async () => {
                            if (isSavingArchivePhone) return;
                            setIsSavingArchivePhone(true);
                            try {
                                await Promise.resolve(onUpdateArchivePhone(archivePhoneLocal));
                                toast('Gallery config updated', 'success');
                            } finally { setIsSavingArchivePhone(false); }
                        }}
                        disabled={isSavingArchivePhone}
                        aria-busy={isSavingArchivePhone}
                        className="px-6 py-4 bg-[#2D4635] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg disabled:opacity-70 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                        {isSavingArchivePhone ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>
            <form onSubmit={handleGallerySubmit} className="space-y-4">
                <div className="relative group">
                    <label htmlFor="admin-gallery-file" className="block cursor-pointer">
                        <input id="admin-gallery-file" type="file" accept="image/*,video/*" onChange={e => setGalleryFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full" aria-label="Choose family photo or video to upload" />
                        <div className="w-full h-32 border-2 border-dashed border-stone-200 rounded-[2rem] flex flex-col items-center justify-center gap-2 text-stone-300 group-hover:border-[#A0522D] group-hover:text-[#A0522D] transition-all">
                            <span className="text-3xl" aria-hidden="true">🏞️</span>
                            <span className="text-[10px] font-black uppercase tracking-widest">{galleryFile ? galleryFile.name : 'Choose Family Memory'}</span>
                        </div>
                    </label>
                </div>
                <div>
                    <label htmlFor="admin-gallery-caption" className="sr-only">Gallery Caption</label>
                    <input id="admin-gallery-caption" placeholder="Caption (e.g. Summer BBQ 1985)" className="w-full p-4 border border-stone-200 rounded-2xl text-base outline-none focus:ring-2 focus:ring-[#2D4635]/20" value={galleryForm.caption} onChange={e => setGalleryForm({ ...galleryForm, caption: e.target.value })} />
                </div>
                <button type="submit" disabled={!galleryFile || isSubmitting} aria-busy={isSubmitting} className="w-full py-4 bg-[#A0522D] text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg disabled:opacity-70 disabled:cursor-not-allowed">
                    {isSubmitting ? 'Saving...' : 'Upload Memory'}
                </button>
            </form>

            {/* Bulk Upload Section */}
            <div className="mt-8 pt-8 border-t border-stone-200">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-[#2D4635] mb-4 flex items-center gap-2">
                    <span>📚</span> Bulk Image Upload
                </h4>
                <div className="p-6 bg-[#2D4635]/5 rounded-3xl border border-[#2D4635]/10">
                    <div className="relative group">
                        <label htmlFor="admin-bulk-gallery-files" className="block cursor-pointer">
                            <input
                                id="admin-bulk-gallery-files"
                                type="file"
                                accept="image/*,video/*"
                                multiple
                                onChange={e => setBulkFiles(e.target.files)}
                                className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full"
                                aria-label="Select multiple photos or videos for bulk upload"
                            />
                            <div className="w-full h-24 border-2 border-dashed border-[#2D4635]/30 rounded-[2rem] flex flex-col items-center justify-center gap-2 text-[#2D4635]/60 group-hover:border-[#2D4635] group-hover:text-[#2D4635] transition-all bg-white/50">
                                <span className="text-2xl" aria-hidden="true">📁</span>
                                <span className="text-[9px] font-black uppercase tracking-widest">
                                    {bulkFiles && bulkFiles.length > 0
                                        ? `${bulkFiles.length} files selected`
                                        : 'Drag & Drop or Click to Select Multiple'}
                                </span>
                            </div>
                        </label>
                    </div>

                    {bulkFiles && bulkFiles.length > 0 && (
                        <div className="mt-4 space-y-3">
                            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                                {(Array.from(bulkFiles) as File[]).slice(0, 10).map((file, idx) => (
                                    <span key={idx} className="px-3 py-1 bg-white rounded-full text-[9px] font-medium text-stone-600 truncate max-w-[150px]">
                                        {file.name}
                                    </span>
                                ))}
                                {bulkFiles.length > 10 && (
                                    <span className="px-3 py-1 bg-white/50 rounded-full text-[9px] font-medium text-stone-500">
                                        +{bulkFiles.length - 10} more
                                    </span>
                                )}
                            </div>

                            <label htmlFor="admin-bulk-gallery-caption" className="sr-only">Caption for all bulk upload files (optional)</label>
                            <input
                                id="admin-bulk-gallery-caption"
                                placeholder="Caption for all (optional)..."
                                aria-label="Caption for all bulk upload files (optional)"
                                className="w-full p-3 border border-stone-200 rounded-xl text-base outline-none bg-white"
                                value={galleryForm.caption}
                                onChange={e => setGalleryForm({ ...galleryForm, caption: e.target.value })}
                            />

                            {/* Progress Display */}
                            {uploadProgress.total > 0 && (
                                <div className="space-y-2" role="status" aria-live="polite" aria-busy={uploadProgress.current < uploadProgress.total}>
                                    <div className="flex items-center justify-between text-[10px] font-bold text-[#2D4635]">
                                        <span>{uploadProgress.current >= uploadProgress.total ? '✓ Complete!' : 'Uploading...'}</span>
                                        <span>{uploadProgress.current}/{uploadProgress.total}</span>
                                    </div>
                                    <div className="w-full h-2 bg-white rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-[#2D4635] transition-all duration-300"
                                            style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                                        />
                                    </div>
                                    {uploadProgress.errors.length > 0 && (
                                        <p className="text-[9px] text-red-600 font-medium">
                                            {uploadProgress.errors.length} file(s) failed to upload
                                        </p>
                                    )}
                                </div>
                            )}

                            <button
                                onClick={handleBulkGalleryUpload}
                                disabled={isSubmitting || uploadProgress.total > 0}
                                className="w-full py-3 bg-[#2D4635] text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting && uploadProgress.total > 0
                                    ? `Uploading ${uploadProgress.current}/${uploadProgress.total}...`
                                    : `Upload ${bulkFiles.length} Files to Gallery`}
                            </button>

                            {uploadProgress.errors.length > 0 && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                                    <p className="text-[9px] font-bold text-red-600 uppercase tracking-widest mb-2">
                                        {uploadProgress.errors.length} Failed:
                                    </p>
                                    <p className="text-[9px] text-red-500 max-h-20 overflow-y-auto whitespace-pre-line">
                                        {uploadProgress.errors.join('\n')}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
};
