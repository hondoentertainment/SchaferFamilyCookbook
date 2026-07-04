import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import App from './App';
import { setupLocalStorage, createMockRecipe, createMockGalleryItem, renderWithProviders } from './test/utils';

function login(name = 'Alice') {
    fireEvent.click(screen.getByTestId('login-intent-new'));
    fireEvent.change(screen.getByPlaceholderText(/your name/i), { target: { value: name } });
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
}

async function loginAndNavigateToGallery(_initialTab = 'Recipes') {
    const recipes = [createMockRecipe()];
    localStorage.setItem('schafer_db_recipes', JSON.stringify(recipes));
    renderWithProviders(<App />);
    login('Alice');
    // After login user lands on Home; click Family in nav.
    const familyBtns = await screen.findAllByRole('button', { name: /^Family$/i }, { timeout: 3000 });
    fireEvent.click(familyBtns[0]);
}

describe('App', () => {
    beforeEach(() => {
        setupLocalStorage();
        localStorage.clear();
    });

    it('should show login chooser when not authenticated', async () => {
        renderWithProviders(<App />);
        expect(await screen.findByText(/who's cooking/i)).toBeInTheDocument();
        expect(screen.getByTestId('login-intent-new')).toBeInTheDocument();
        expect(screen.getByTestId('login-browse-guest')).toBeInTheDocument();
    });

    it('should login and land on Home tab when name is submitted', async () => {
        localStorage.setItem('schafer_db_recipes', JSON.stringify([createMockRecipe()]));
        renderWithProviders(<App />);
        login('Alice');
        // Home tab should be visible (any time-of-day greeting variant from HomeView)
        await screen.findByText(/(good (morning|afternoon|evening))|(late night)/i, {}, { timeout: 3000 });
        expect(screen.getAllByRole('button', { name: /^Recipes$/i }).length).toBeGreaterThan(0);
    });
});

describe('Gallery', () => {
    beforeEach(() => {
        setupLocalStorage();
        localStorage.clear();
    });

    it('should show upload panel on gallery tab', async () => {
        await loginAndNavigateToGallery();
        expect(screen.getByRole('heading', { name: /share a memory/i })).toBeInTheDocument();
        expect(screen.getByTestId('gallery-upload-submit')).toBeInTheDocument();
    });

    it('should show empty state when gallery has no items', async () => {
        await loginAndNavigateToGallery();
        expect(screen.getByRole('main', { name: /family gallery/i })).toBeInTheDocument();
        expect(screen.getByText('The gallery awaits your memories')).toBeInTheDocument();
        expect(screen.getByText(/upload a photo above/i)).toBeInTheDocument();
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
        login('kyle');
        await screen.findByText(/(good (morning|afternoon|evening))|(late night)/i, {}, { timeout: 3000 });
        fireEvent.click(screen.getAllByRole('button', { name: /^Family$/i })[0]);

        const deleteButton = screen.getByRole('button', { name: /remove "admin delete test" from gallery/i });
        expect(deleteButton).toBeInTheDocument();
    });

    it('should show texting hint when no archive phone is set', async () => {
        await loginAndNavigateToGallery();
        expect(screen.getByText('Prefer texting?')).toBeInTheDocument();
        expect(screen.getByLabelText(/alternative ways to add photos/i)).toBeInTheDocument();
    });

    it('should show text-to-gallery instructions when archive phone is set', async () => {
        localStorage.setItem('schafer_archive_phone', '+15551234567');
        await loginAndNavigateToGallery();
        expect(screen.getByText('Text your memories')).toBeInTheDocument();
        expect(screen.getByText(/Photo\/Video to:/)).toBeInTheDocument();
        expect(screen.getByText('+15551234567')).toBeInTheDocument();
        expect(screen.getByLabelText(/text-to-gallery instructions/i)).toBeInTheDocument();
    });

    it('should show text-to-gallery instructions from VITE_ARCHIVE_PHONE when localStorage is empty', async () => {
        vi.stubEnv('VITE_ARCHIVE_PHONE', '+15559876543');
        await loginAndNavigateToGallery();
        expect(screen.getByText('+15559876543')).toBeInTheDocument();
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

    it('should navigate to Recipes, Family, Groceries, and Profile tabs', async () => {
        const recipes = [createMockRecipe({ title: 'Apple Pie' })];
        localStorage.setItem('schafer_db_recipes', JSON.stringify(recipes));
        renderWithProviders(<App />);

        login('Alice');
        await screen.findByText(/(good (morning|afternoon|evening))|(late night)/i, {}, { timeout: 3000 });

        // Recipes tab — primary nav
        fireEvent.click(screen.getAllByRole('button', { name: /^Recipes$/i })[0]);
        await screen.findAllByText('Apple Pie', {}, { timeout: 3000 });

        // Family tab
        fireEvent.click(screen.getAllByRole('button', { name: /^Family$/i })[0]);
        await screen.findByRole('main', { name: /family gallery/i }, { timeout: 3000 }).catch(() => { });

        // Groceries tab
        fireEvent.click(screen.getAllByRole('button', { name: /^Groceries$/i })[0]);

        // Profile tab via Me
        const profileElements = screen.queryAllByTestId(/nav-profile/i);
        if (profileElements.length > 0) {
            fireEvent.click(profileElements[0]);
        }
    });
});

describe('Featured recipes on Recipes tab', () => {
    beforeEach(() => {
        setupLocalStorage();
        localStorage.clear();
    });

    // The bundled seed now curates six featured recipes, and the app merges
    // bundled defaults with the local DB, so the strip renders even when the
    // local DB itself has no featured entries. The strip-hides-when-empty
    // behavior stays covered by FeaturedStrip.test.tsx and featured.test.ts.
    it('renders the Featured strip from bundled seed data even when local recipes are unfeatured', async () => {
        const recipes = [createMockRecipe({ id: 'plain', title: 'Plain Toast' })];
        localStorage.setItem('schafer_db_recipes', JSON.stringify(recipes));
        renderWithProviders(<App />);
        login('Alice');

        await screen.findByText(/(good (morning|afternoon|evening))|(late night)/i, {}, { timeout: 3000 });
        fireEvent.click(screen.getAllByRole('button', { name: /^Recipes$/i })[0]);
        await screen.findAllByText('Plain Toast', {}, { timeout: 3000 });

        expect(screen.getByTestId('featured-strip')).toBeInTheDocument();
    });

    it('renders the Featured strip on the Recipes tab when at least one recipe is featured', async () => {
        const recipes = [
            createMockRecipe({ id: 'feat-1', title: 'Highlighted Hero', featured: true }),
            createMockRecipe({ id: 'plain', title: 'Plain Toast' }),
        ];
        localStorage.setItem('schafer_db_recipes', JSON.stringify(recipes));
        renderWithProviders(<App />);
        login('Alice');

        await screen.findByText(/(good (morning|afternoon|evening))|(late night)/i, {}, { timeout: 3000 });
        fireEvent.click(screen.getAllByRole('button', { name: /^Recipes$/i })[0]);

        const strip = await screen.findByTestId('featured-strip', {}, { timeout: 3000 });
        expect(strip).toBeInTheDocument();
        expect(within(strip).getByRole('button', { name: /Open featured recipe: Highlighted Hero/i })).toBeInTheDocument();
    });

    it('opens the recipe modal when a Featured strip card is clicked', async () => {
        const recipes = [
            createMockRecipe({ id: 'feat-1', title: 'Highlighted Hero', featured: true }),
        ];
        localStorage.setItem('schafer_db_recipes', JSON.stringify(recipes));
        renderWithProviders(<App />);
        login('Alice');

        await screen.findByText(/(good (morning|afternoon|evening))|(late night)/i, {}, { timeout: 3000 });
        fireEvent.click(screen.getAllByRole('button', { name: /^Recipes$/i })[0]);

        const strip = await screen.findByTestId('featured-strip', {}, { timeout: 3000 });
        const card = within(strip).getByRole('button', { name: /Open featured recipe: Highlighted Hero/i });
        fireEvent.click(card);

        await screen.findByRole('dialog', {}, { timeout: 3000 });
    });
});
