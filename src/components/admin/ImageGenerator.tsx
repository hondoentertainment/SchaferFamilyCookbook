import React, { useState } from 'react';
import { Recipe } from '../../types';
import * as geminiProxy from '../../services/geminiProxy';
import { CATEGORY_IMAGES } from '../../constants';
import { useUI } from '../../context/UIContext';

export interface ImageGeneratorProps {
    recipes: Recipe[];
    onGenerate: (r: Recipe, file?: File) => Promise<void>;
    isAICooldownActive: boolean;
    bulkProgress: { current: number; total: number };
    onBulkProgressChange: (progress: { current: number; total: number }) => void;
    onAIError: (err: unknown, fallback: string) => void;
    isQuotaError: (err: unknown) => boolean;
    getAIErrorMessage: (err: unknown, fallback: string) => string;
}

export const ImageGenerator: React.FC<ImageGeneratorProps> = ({
    recipes,
    onGenerate,
    isAICooldownActive,
    bulkProgress,
    onBulkProgressChange,
    onAIError,
    isQuotaError,
    getAIErrorMessage,
}) => {
    const { toast, confirm } = useUI();

    const [isBulkSourcing, setIsBulkSourcing] = useState(false);

    const base64ToFile = (base64: string, filename: string, mimeType: string = 'image/png'): File => {
        const byteCharacters = atob(base64);
        const byteArrays: Uint8Array[] = [];
        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
            const slice = byteCharacters.slice(offset, offset + 512);
            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) byteNumbers[i] = slice.charCodeAt(i);
            byteArrays.push(new Uint8Array(byteNumbers));
        }
        const blobs: ArrayBuffer[] = byteArrays.map((ua) => {
            const ab = new ArrayBuffer(ua.byteLength);
            new Uint8Array(ab).set(ua);
            return ab;
        });
        return new File([new Blob(blobs, { type: mimeType })], filename, { type: mimeType });
    };

    const getFileExtension = (mimeType: string = 'image/png') => {
        if (mimeType === 'image/jpeg') return 'jpg';
        if (mimeType === 'image/webp') return 'webp';
        return 'png';
    };

    const handleBulkVisualSourcing = async (forceRefresh: boolean = false) => {
        const targetRecipes = forceRefresh
            ? recipes
            : recipes.filter(r => {
                const isCategoryPlaceholder = Object.values(CATEGORY_IMAGES).includes(r.image);
                const isPollinations = r.image?.includes('pollinations.ai');
                const isMissingImage = !r.image || r.image.includes('fallback-gradient') || r.image.includes('source.unsplash.com');
                return isCategoryPlaceholder || isPollinations || isMissingImage;
            });

        if (targetRecipes.length === 0) {
            toast('No recipes to update!', 'info');
            return;
        }

        const message = forceRefresh
            ? `This will generate Nano Banana recipe photos for ALL ${targetRecipes.length} recipes using their ingredients. This may take several minutes. Continue?`
            : `Found ${targetRecipes.length} recipes needing photos. Generate Nano Banana images from ingredients? This may take several minutes.`;

        const ok = await confirm(message, { title: 'Bulk Image Generation', confirmLabel: 'Continue' });
        if (!ok) return;

        setIsBulkSourcing(true);
        onBulkProgressChange({ current: 0, total: targetRecipes.length });

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < targetRecipes.length; i++) {
            const recipe = targetRecipes[i];
            try {
                const { imageBase64, mimeType, imageSource } = await geminiProxy.generateImage(recipe);
                const file = base64ToFile(imageBase64, `recipe-${Date.now()}.${getFileExtension(mimeType)}`, mimeType);
                await onGenerate({ ...recipe, imageSource }, file);
                successCount++;
            } catch (e) {
                console.error(`Failed to generate image for "${recipe.title}":`, e);
                failCount++;
                if (isQuotaError(e)) {
                    onAIError(e, 'AI quota exhausted during bulk generation: ${message}');
                    toast(`Stopped early after ${successCount} images because Gemini quota is exhausted. Resume later to continue.`, 'error');
                    break;
                }
                if (failCount === 1) {
                    const friendly = getAIErrorMessage(e, '${message}');
                    if (friendly.includes('GEMINI_API_KEY')) {
                        toast(friendly, 'error');
                        break;
                    }
                }
            }
            onBulkProgressChange({ current: i + 1, total: targetRecipes.length });
            if (i < targetRecipes.length - 1) await new Promise(r => setTimeout(r, 2000));
        }

        setIsBulkSourcing(false);
        if (failCount > 0) {
            toast(`Bulk sourcing complete: ${successCount} succeeded, ${failCount} failed. Failed recipes kept their existing images.`, 'error');
        } else {
            toast(`Bulk sourcing complete! All ${successCount} recipes now have Nano Banana-generated photos.`, 'success');
        }
    };

    return (
        <div className="space-y-4">
            {/* Recipe images progress */}
            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-500 mb-2">Recipe images</h4>
                <p className="text-sm text-stone-700">
                    <span className="font-bold">{recipes.filter(r => r.image?.trim()).length}</span> of <span className="font-bold">{recipes.length}</span> recipes have images
                    {recipes.length - recipes.filter(r => r.image?.trim()).length > 0 && (
                        <> · <span className="text-amber-700">{recipes.length - recipes.filter(r => r.image?.trim()).length} missing</span></>
                    )}
                </p>
                <p className="text-xs text-stone-500 mt-1">Use Fill Missing below or run <code className="bg-white px-1 rounded">npm run images:batch</code> locally for quota-safe batches.</p>
            </div>
            <div className="flex gap-4 flex-wrap">
                <button onClick={() => handleBulkVisualSourcing(false)} disabled={isBulkSourcing || isAICooldownActive} className="flex-1 min-w-[140px] py-4 bg-[#A0522D]/10 text-[#A0522D] rounded-full text-[10px] font-black uppercase tracking-widest border border-[#A0522D]/20 shadow-sm disabled:opacity-50">
                    {isBulkSourcing ? `Imagen (${bulkProgress.current}/${bulkProgress.total})` : '🖼️ Fill Missing (Imagen)'}
                </button>
                <button onClick={() => handleBulkVisualSourcing(true)} disabled={isBulkSourcing || isAICooldownActive} className="flex-1 min-w-[140px] py-4 bg-red-50 text-red-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-red-200 shadow-sm disabled:opacity-50">
                    {isBulkSourcing ? `Generating...` : '🔄 Regenerate All (Imagen)'}
                </button>
            </div>
        </div>
    );
};
