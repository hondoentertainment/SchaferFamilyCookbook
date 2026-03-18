import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { CloudArchive } from './services/db';

// Mock the CloudArchive service
vi.mock('./services/db', () => ({
    CloudArchive: {
        getProvider: vi.fn(() => 'local'),
        getFirebase: vi.fn(() => null),
        getRecipes: vi.fn(() => Promise.resolve([])),
        getTrivia: vi.fn(() => Promise.resolve([])),
        getGallery: vi.fn(() => Promise.resolve([])),
        getContributors: vi.fn(() => Promise.resolve([])),
        getHistory: vi.fn(() => Promise.resolve([])),
        subscribeRecipes: vi.fn(() => () => {}),
        subscribeTrivia: vi.fn(() => () => {}),
        subscribeGallery: vi.fn(() => () => {}),
        subscribeContributors: vi.fn(() => () => {}),
        subscribeHistory: vi.fn(() => () => {}),
        upsertRecipe: vi.fn().mockResolvedValue(undefined),
        upsertTrivia: vi.fn().mockResolvedValue(undefined),
        upsertGalleryItem: vi.fn().mockResolvedValue(undefined),
        upsertContributor: vi.fn().mockResolvedValue(undefined),
        deleteRecipe: vi.fn().mockResolvedValue(undefined),
        deleteTrivia: vi.fn().mockResolvedValue(undefined),
        deleteGalleryItem: vi.fn().mockResolvedValue(undefined),
        deleteContributor: vi.fn().mockResolvedValue(undefined),
        addHistoryEntry: vi.fn().mockResolvedValue(undefined),
        uploadFile: vi.fn().mockResolvedValue('https://example.com/file.jpg'),
    },
}));

// Mock GoogleGenAI to prevent errors
vi.mock('@google/genai', () => ({
    GoogleGenAI: vi.fn().mockImplementation(() => ({
        models: {
            generateContent: vi.fn().mockResolvedValue({ text: 'Mock description' }),
        },
    })),
}));

describe('App', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Mock localStorage implementation
        const store: Record<string, string> = {};

        vi.mocked(localStorage.getItem).mockImplementation((key) => store[key] || null);
        vi.mocked(localStorage.setItem).mockImplementation((key, value) => {
            store[key] = value.toString();
        });
        vi.mocked(localStorage.removeItem).mockImplementation((key) => {
            delete store[key];
        });
        vi.mocked(localStorage.clear).mockImplementation(() => {
            for (const key in store) delete store[key];
        });

        // Mock a logged-in user
        const user = {
            id: 'u1',
            name: 'Test User',
            picture: 'https://example.com/avatar.jpg',
            role: 'user',
            email: 'test@example.com'
        };
        localStorage.setItem('schafer_user', JSON.stringify(user));
    });

    it('should render the recipe list and contributors correctly', async () => {
        const mockRecipes = [
            {
                id: 'r1',
                title: 'Test Recipe 1',
                category: 'Main',
                contributor: 'Contributor A',
                image: 'https://example.com/r1.jpg',
                ingredients: [],
                instructions: [],
                created_at: new Date().toISOString()
            },
            {
                id: 'r2',
                title: 'Test Recipe 2',
                category: 'Dessert',
                contributor: 'Contributor B',
                image: 'https://example.com/r2.jpg',
                ingredients: [],
                instructions: [],
                created_at: new Date().toISOString()
            }
        ];

        const mockContributors = [
            { id: 'c1', name: 'Contributor A', avatar: 'https://example.com/a.jpg', role: 'user' },
            { id: 'c2', name: 'Contributor B', avatar: 'https://example.com/b.jpg', role: 'user' }
        ];

        // Setup mock returns
        (CloudArchive.getRecipes as any).mockResolvedValue(mockRecipes);
        (CloudArchive.getContributors as any).mockResolvedValue(mockContributors);

        render(<App />);

        // Wait for recipes to load
        await waitFor(() => {
            expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
            expect(screen.getByText('Test Recipe 2')).toBeInTheDocument();
        });

        // Verify contributors are displayed
        expect(screen.getAllByText(/Contributor A/)[0]).toBeInTheDocument();
        expect(screen.getAllByText(/Contributor B/)[0]).toBeInTheDocument();

        // Check if images are rendered with correct src (checking HTML string as alt="" hides them from getByRole('img'))
        expect(document.body.innerHTML).toContain('https://example.com/a.jpg');
        expect(document.body.innerHTML).toContain('https://example.com/b.jpg');
    });
});
