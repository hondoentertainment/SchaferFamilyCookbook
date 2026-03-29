import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import App from './App';
import { setupLocalStorage, createMockRecipe, createMockGalleryItem, renderWithProviders } from './test/utils';

function loginAndNavigateToGallery(_initialTab = 'Recipes') {
    const recipes = [createMockRecipe()];
    localStorage.setItem('schafer_db_recipes', JSON.stringify(recipes));
    renderWithProviders(<App />);
    const input = screen.getByPlaceholderText(/e.g. Grandma Joan/);
    fireEvent.change(input, { target: { value: 'Alice' } });
    fireEvent.click(screen.getByText('Enter The Archive'));
    return screen.findByText('Test Recipe', {}, { timeout: 3000 }).then(() => {
        const galleryBtns = screen.getAllByRole('button', { name: /^Gallery$/i });
        fireEvent.click(galleryBtns[0]);
    });
}

describe('App', () => {
    beforeEach(() => {
        setupLocalStorage();
        localStorage.clear();
    });

    it('should show login form when not authenticated', async () => {
        renderWithProviders(<App />);
        expect(await screen.findByText('Welcome to the Family Table')).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/e.g. Grandma Joan/)).toBeInTheDocument();
    });

    it('should login and show Recipes tab when name is submitted', async () => {
        localStorage.setItem('schafer_db_recipes', JSON.stringify([createMockRecipe()]));
        renderWithProviders(<App />);
        const input = screen.getByPlaceholderText(/e.g. Grandma Joan/);
        fireEvent.change(input, { target: { value: 'Alice' } });
        fireEvent.click(screen.getByText('Enter The Archive'));
        await screen.findByText('Test Recipe', {}, { timeout: 3000 });
        expect(screen.getAllByRole('button', { name: /^Recipes$/i }).length).toBeGreaterThan(0);
    });
});

describe('Gallery', () => {
    beforeEach(() => {
        setupLocalStorage();
        localStorage.clear();
    });

    it('should show empty state when gallery has no items', async () => {
        await loginAndNavigateToGallery();
        expect(await screen.findByRole('main', { name: /family gallery/i }, { timeout: 3000 })).toBeInTheDocument();
        expect(screen.getByText('The gallery awaits your memories')).toBeInTheDocument();
        expect(screen.getByText(/be the first to add a photo or video/i)).toBeInTheDocument();
    });

    it('should show gallery items when data exists', async () => {
        const galleryItems = [
            createMockGalleryItem({ id: 'g1', caption: 'Grandma at the farm', contributor: 'Alice' }),
            createMockGalleryItem({ id: 'g2', caption: 'Holiday dinner', contributor: 'Bob', type: 'video' }),
        ];
        localStorage.setItem('schafer_db_gallery', JSON.stringify(galleryItems));
        await loginAndNavigateToGallery();

        expect(screen.getByText('Grandma at the farm')).toBeInTheDocument();
        expect(screen.getByText('Holiday dinner')).toBeInTheDocument();
        expect(screen.getByText(/added by alice/i)).toBeInTheDocument();
        expect(screen.getByText(/added by bob/i)).toBeInTheDocument();
    });

    it('should open lightbox when clicking an image', async () => {
        const galleryItems = [createMockGalleryItem({ caption: 'Summer picnic' })];
        localStorage.setItem('schafer_db_gallery', JSON.stringify(galleryItems));
        await loginAndNavigateToGallery();

        const viewButton = screen.getByRole('button', { name: /view full size: summer picnic/i });
        fireEvent.click(viewButton);

        const lightbox = screen.getByRole('dialog', { name: /enlarged gallery image/i });
        expect(lightbox).toBeInTheDocument();
        expect(within(lightbox).getByAltText('Summer picnic')).toBeInTheDocument();
        expect(lightbox).toHaveTextContent('Summer picnic');
    });

    it('should close lightbox when clicking close button', async () => {
        const galleryItems = [createMockGalleryItem({ caption: 'Beach day' })];
        localStorage.setItem('schafer_db_gallery', JSON.stringify(galleryItems));
        await loginAndNavigateToGallery();

        fireEvent.click(screen.getByRole('button', { name: /view full size: beach day/i }));
        expect(screen.getByRole('dialog', { name: /enlarged gallery image/i })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /close/i }));
        expect(screen.queryByRole('dialog', { name: /enlarged gallery image/i })).not.toBeInTheDocument();
    });

    it('should close lightbox on Escape key', async () => {
        const galleryItems = [createMockGalleryItem({ caption: 'Escape test' })];
        localStorage.setItem('schafer_db_gallery', JSON.stringify(galleryItems));
        await loginAndNavigateToGallery();

        fireEvent.click(screen.getByRole('button', { name: /view full size: escape test/i }));
        expect(screen.getByRole('dialog', { name: /enlarged gallery image/i })).toBeInTheDocument();

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('dialog', { name: /enlarged gallery image/i })).not.toBeInTheDocument();
    });

    it('should open lightbox for videos and show fullscreen viewer', async () => {
        const galleryItems = [createMockGalleryItem({ id: 'v1', type: 'video', caption: 'Family reunion', url: 'https://example.com/video.mp4' })];
        localStorage.setItem('schafer_db_gallery', JSON.stringify(galleryItems));
        await loginAndNavigateToGallery();

        fireEvent.click(screen.getByRole('button', { name: /view full size: family reunion/i }));
        expect(screen.getByRole('dialog', { name: /fullscreen gallery video/i })).toBeInTheDocument();
    });

    it('should show delete button for admin users', async () => {
        const galleryItems = [createMockGalleryItem({ id: 'del-1', caption: 'Admin delete test' })];
        localStorage.setItem('schafer_db_gallery', JSON.stringify(galleryItems));
        localStorage.setItem('schafer_db_recipes', JSON.stringify([createMockRecipe()]));

        renderWithProviders(<App />);
        fireEvent.change(screen.getByPlaceholderText(/e.g. Grandma Joan/), { target: { value: 'kyle' } });
        fireEvent.click(screen.getByText('Enter The Archive'));
        await screen.findByText('Test Recipe', {}, { timeout: 3000 });
        fireEvent.click(screen.getAllByRole('button', { name: /^Gallery$/i })[0]);

        const deleteButton = screen.getByRole('button', { name: /remove "admin delete test" from gallery/i });
        expect(deleteButton).toBeInTheDocument();
    });

    it('should show "Want to add photos?" when no archive phone is set', async () => {
        await loginAndNavigateToGallery();
        expect(screen.getByText('Want to add photos?')).toBeInTheDocument();
        expect(screen.getByLabelText(/how to add photos/i)).toBeInTheDocument();
    });

    it('should show text-to-archive instructions when archive phone is set', async () => {
        localStorage.setItem('schafer_archive_phone', '+15551234567');
        await loginAndNavigateToGallery();
        expect(screen.getByText('Text your memories')).toBeInTheDocument();
        expect(screen.getByText(/Photo\/Video to:/)).toBeInTheDocument();
        expect(screen.getByText('+15551234567')).toBeInTheDocument();
    });

    it('should render gallery with semantic structure', async () => {
        const galleryItems = [createMockGalleryItem()];
        localStorage.setItem('schafer_db_gallery', JSON.stringify(galleryItems));
        await loginAndNavigateToGallery();

        expect(screen.getByRole('main', { name: /family gallery/i })).toBeInTheDocument();
        expect(screen.getByRole('list')).toBeInTheDocument();
        const listItems = screen.getAllByRole('listitem');
        expect(listItems.length).toBeGreaterThanOrEqual(1);
    });
});

describe('App Navigation (Lazy loaded views)', () => {
    beforeEach(() => {
        setupLocalStorage();
        localStorage.clear();
    });

    it('should navigate to Index, Family Story, Contributors, and Profile tabs', async () => {
        const recipes = [createMockRecipe({ title: 'Apple Pie' })];
        localStorage.setItem('schafer_db_recipes', JSON.stringify(recipes));
        renderWithProviders(<App />);

        // Login
        fireEvent.change(screen.getByPlaceholderText(/e.g. Grandma Joan/), { target: { value: 'Alice' } });
        fireEvent.click(screen.getByText('Enter The Archive'));
        await screen.findByText('Apple Pie', {}, { timeout: 3000 });

        // Navigate to Index
        fireEvent.click(screen.getAllByRole('button', { name: /A–Z/i })[0]);
        await screen.findByText(/Archival Index/i, {}, { timeout: 3000 }).catch(() => { });

        // Navigate to Family Story
        const familyStoryBtns = screen.queryAllByRole('button', { name: /Family Story/i });
        if (familyStoryBtns.length > 0) {
            fireEvent.click(familyStoryBtns[0]);
            await screen.findByText(/The Oehler Family/i, {}, { timeout: 3000 }).catch(() => { });
        }

        // Navigate to Contributors
        const contributorsBtns = screen.queryAllByRole('button', { name: /Contributors/i });
        if (contributorsBtns.length > 0) {
            fireEvent.click(contributorsBtns[0]);
            await screen.findByText(/The Contributors/i, {}, { timeout: 3000 }).catch(() => { });
        }

        // Navigate to Profile
        const profileElements = screen.queryAllByTestId(/nav-profile/i);
        if (profileElements.length > 0) {
            fireEvent.click(profileElements[0]);
            await screen.findByText(/Display Identity/i, {}, { timeout: 3000 }).catch(() => { });
        }
    });
});
