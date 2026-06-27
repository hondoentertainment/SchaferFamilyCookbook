import React, { useRef, useState } from 'react';
import type { GalleryItem } from '../types';
import {
    buildGalleryItem,
    MAX_GALLERY_CAPTION_LENGTH,
    validateGalleryFile,
} from '../utils/galleryUpload';

export interface GalleryUploadPanelProps {
    contributorName: string;
    onUpload: (item: GalleryItem, file: File) => Promise<void>;
    disabled?: boolean;
    className?: string;
}

export const GalleryUploadPanel: React.FC<GalleryUploadPanelProps> = ({
    contributorName,
    onUpload,
    disabled = false,
    className = '',
}) => {
    const [file, setFile] = useState<File | null>(null);
    const [caption, setCaption] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const resetForm = () => {
        setFile(null);
        setCaption('');
        setError(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || disabled || isSubmitting) return;

        const validation = validateGalleryFile(file);
        if (!validation.ok) {
            setError(validation.message);
            return;
        }

        setIsSubmitting(true);
        setError(null);
        try {
            const item = buildGalleryItem(file, caption, contributorName);
            await onUpload(item, file);
            resetForm();
        } catch {
            setError('Upload failed. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <section
            className={`rounded-[2rem] border border-stone-200 dark:border-stone-700 bg-white dark:bg-[var(--card-bg)] p-6 shadow-sm ${className}`.trim()}
            aria-labelledby="gallery-upload-heading"
        >
            <div className="flex items-start gap-4 mb-5">
                <span className="text-3xl" aria-hidden="true">
                    📤
                </span>
                <div>
                    <h3
                        id="gallery-upload-heading"
                        className="text-[10px] font-black uppercase tracking-widest text-[#2D4635] dark:text-emerald-300 leading-none mb-1"
                    >
                        Share a memory
                    </h3>
                    <p className="text-sm text-stone-500 dark:text-stone-400 font-serif italic">
                        Upload a photo or video for the family gallery. Sharing as{' '}
                        <span className="font-bold not-italic text-[#A0522D]">{contributorName}</span>.
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative group">
                    <label htmlFor="gallery-upload-file" className="block cursor-pointer">
                        <input
                            ref={fileInputRef}
                            id="gallery-upload-file"
                            data-testid="gallery-upload-file"
                            type="file"
                            accept="image/*,video/*"
                            disabled={disabled || isSubmitting}
                            onChange={(e) => {
                                const next = e.target.files?.[0] ?? null;
                                setFile(next);
                                setError(null);
                            }}
                            className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full disabled:cursor-not-allowed"
                            aria-label="Choose photo or video to upload to the family gallery"
                        />
                        <div className="w-full min-h-[7.5rem] border-2 border-dashed border-stone-200 dark:border-stone-600 rounded-[1.5rem] flex flex-col items-center justify-center gap-2 text-stone-400 group-hover:border-[#A0522D] group-hover:text-[#A0522D] transition-all px-4 py-6">
                            <span className="text-3xl" aria-hidden="true">
                                🏞️
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-center">
                                {file ? file.name : 'Tap to choose photo or video'}
                            </span>
                            <span className="text-[10px] text-stone-400">Max 25 MB</span>
                        </div>
                    </label>
                </div>

                <div>
                    <label htmlFor="gallery-upload-caption" className="sr-only">
                        Caption (optional)
                    </label>
                    <input
                        id="gallery-upload-caption"
                        data-testid="gallery-upload-caption"
                        type="text"
                        placeholder="Caption (e.g. Summer BBQ 1985)"
                        maxLength={MAX_GALLERY_CAPTION_LENGTH}
                        disabled={disabled || isSubmitting}
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        className="w-full p-4 border border-stone-200 dark:border-stone-600 rounded-2xl text-base bg-white dark:bg-[var(--bg-secondary)] outline-none focus:ring-2 focus:ring-[#2D4635]/20 disabled:opacity-60"
                    />
                </div>

                {error && (
                    <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                        {error}
                    </p>
                )}

                <button
                    type="submit"
                    data-testid="gallery-upload-submit"
                    disabled={!file || disabled || isSubmitting}
                    aria-busy={isSubmitting}
                    className="btn btn-accent w-full"
                >
                    {isSubmitting ? 'Uploading…' : 'Add to gallery'}
                </button>
            </form>
        </section>
    );
};
