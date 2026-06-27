import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GalleryUploadPanel } from './GalleryUploadPanel';

describe('GalleryUploadPanel', () => {
    it('renders upload form for contributor', () => {
        render(
            <GalleryUploadPanel contributorName="Alice" onUpload={vi.fn().mockResolvedValue(undefined)} />
        );
        expect(screen.getByRole('region', { name: /share a memory/i })).toBeInTheDocument();
        expect(screen.getByText(/Sharing as/)).toHaveTextContent('Alice');
        expect(screen.getByTestId('gallery-upload-submit')).toBeDisabled();
    });

    it('submits file and caption via onUpload', async () => {
        const onUpload = vi.fn().mockResolvedValue(undefined);
        render(<GalleryUploadPanel contributorName="Bob" onUpload={onUpload} />);

        const file = new File(['pixels'], 'family.jpg', { type: 'image/jpeg' });
        const input = screen.getByTestId('gallery-upload-file');
        fireEvent.change(input, { target: { files: [file] } });

        fireEvent.change(screen.getByTestId('gallery-upload-caption'), {
            target: { value: 'Holiday dinner' },
        });

        fireEvent.click(screen.getByTestId('gallery-upload-submit'));

        await waitFor(() => {
            expect(onUpload).toHaveBeenCalledTimes(1);
        });

        const [item, uploadedFile] = onUpload.mock.calls[0];
        expect(item.caption).toBe('Holiday dinner');
        expect(item.contributor).toBe('Bob');
        expect(item.type).toBe('image');
        expect(uploadedFile).toBe(file);
    });

    it('shows validation error for invalid file type', async () => {
        const onUpload = vi.fn();
        render(<GalleryUploadPanel contributorName="Bob" onUpload={onUpload} />);

        const file = new File(['x'], 'notes.txt', { type: 'text/plain' });
        fireEvent.change(screen.getByTestId('gallery-upload-file'), { target: { files: [file] } });
        fireEvent.click(screen.getByTestId('gallery-upload-submit'));

        expect(await screen.findByRole('alert')).toHaveTextContent(/photo or video/i);
        expect(onUpload).not.toHaveBeenCalled();
    });
});
