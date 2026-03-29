import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { GalleryView } from './GalleryView';
import { renderWithProviders, createMockGalleryItem } from '../test/utils';
import { UserProfile, DBStats } from '../types';

vi.mock('../utils/focusTrap', () => ({
    useFocusTrap: vi.fn(),
}));

vi.mock('../utils/avatarFallback', () => ({
    avatarOnError: vi.fn(),
}));

vi.mock('../utils/haptics', () => ({
    hapticLight: vi.fn(),
}));

vi.mock('../services/db', () => ({
    CloudArchive: {
        deleteGalleryItem: vi.fn(),
    },
}));

describe('GalleryView', () => {
    const currentUser: UserProfile = {
        id: 'u1',
        name: 'Test User',
        picture: 'https://example.com/pic.jpg',
        role: 'user',
    };

    const dbStats: DBStats = {
        recipeCount: 10,
        galleryCount: 3,
        triviaCount: 5,
        isCloudActive: true,
        activeProvider: 'firebase',
    };

    const galleryItems = [
        createMockGalleryItem({ id: 'g1', caption: 'Summer picnic', url: 'https://example.com/1.jpg' }),
        createMockGalleryItem({ id: 'g2', caption: 'Christmas dinner', url: 'https://example.com/2.jpg' }),
        createMockGalleryItem({ id: 'g3', caption: 'Birthday party', url: 'https://example.com/3.jpg' }),
    ];

    const defaultProps = {
        gallery: galleryItems,
        currentUser,
        dbStats,
        isDataLoading: false,
        getAvatar: vi.fn(() => 'https://example.com/avatar.jpg'),
        onRefreshLocal: vi.fn(async () => {}),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders gallery grid with items', () => {
        renderWithProviders(<GalleryView {...defaultProps} />);

        expect(screen.getByText('Summer picnic')).toBeInTheDocument();
        expect(screen.getByText('Christmas dinner')).toBeInTheDocument();
        expect(screen.getByText('Birthday party')).toBeInTheDocument();
    });

    it('renders gallery heading', () => {
        renderWithProviders(<GalleryView {...defaultProps} />);

        expect(screen.getByText('Family Gallery')).toBeInTheDocument();
    });

    it('shows loading skeleton when isDataLoading is true', () => {
        renderWithProviders(<GalleryView {...defaultProps} isDataLoading={true} />);

        // Skeleton shows pulse-animated placeholder divs, items should not be present
        expect(screen.queryByText('Summer picnic')).not.toBeInTheDocument();
        // The skeleton renders 9 pulse divs
        const pulsingElements = document.querySelectorAll('.animate-pulse');
        expect(pulsingElements.length).toBeGreaterThan(0);
    });

    it('shows empty state when no items', () => {
        renderWithProviders(<GalleryView {...defaultProps} gallery={[]} />);

        expect(screen.getByText(/the gallery awaits your memories/i)).toBeInTheDocument();
    });

    it('opens lightbox on image click', () => {
        renderWithProviders(<GalleryView {...defaultProps} />);

        // Click the image button for the first gallery item
        const viewButton = screen.getByRole('button', { name: /view full size: summer picnic/i });
        fireEvent.click(viewButton);

        // Lightbox dialog should appear
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('shows archive phone instructions when archivePhone is provided', () => {
        renderWithProviders(<GalleryView {...defaultProps} archivePhone="+1 555 123 4567" />);

        expect(screen.getByText(/text your memories/i)).toBeInTheDocument();
    });

    it('shows "how to add photos" when no archivePhone', () => {
        renderWithProviders(<GalleryView {...defaultProps} archivePhone={undefined} />);

        expect(screen.getByText(/want to add photos/i)).toBeInTheDocument();
    });
});
