import { render, screen, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import App from './App';
import { CloudArchive } from './services/db';
import { ContributorProfile, Recipe } from './types';

// Mock CloudArchive
vi.mock('./services/db', () => ({
    CloudArchive: {
        getProvider: vi.fn(() => 'local'),
        getRecipes: vi.fn(),
        getTrivia: vi.fn(() => Promise.resolve([])),
        getGallery: vi.fn(() => Promise.resolve([])),
        getContributors: vi.fn(),
        getHistory: vi.fn(() => Promise.resolve([])),
        subscribeRecipes: vi.fn(() => () => {}),
        subscribeTrivia: vi.fn(() => () => {}),
        subscribeGallery: vi.fn(() => () => {}),
        subscribeContributors: vi.fn(() => () => {}),
        subscribeHistory: vi.fn(() => () => {}),
        getFirebase: vi.fn(() => null),
        upsertTrivia: vi.fn(() => Promise.resolve()),
        upsertRecipe: vi.fn(() => Promise.resolve()),
    }
}));

describe('App Performance Optimization', () => {
    const mockContributors: ContributorProfile[] = [
        { id: '1', name: 'Alice', role: 'user', avatar: 'https://example.com/alice.jpg' },
        { id: '2', name: 'Bob', role: 'user', avatar: 'https://example.com/bob.jpg' }
    ];

    const mockRecipes: Recipe[] = [
        {
            id: 'r1',
            title: 'Alice Recipe',
            contributor: 'Alice',
            category: 'Main',
            ingredients: [],
            instructions: [],
            image: ''
        },
        {
            id: 'r2',
            title: 'Bob Recipe',
            contributor: 'Bob',
            category: 'Dessert',
            ingredients: [],
            instructions: [],
            image: ''
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock CloudArchive responses
        (CloudArchive.getRecipes as any).mockResolvedValue(mockRecipes);
        (CloudArchive.getContributors as any).mockResolvedValue(mockContributors);

        // Setup working LocalStorage mock
        const store: Record<string, string> = {};
        const localStorageMock = {
            getItem: vi.fn((key: string) => store[key] || null),
            setItem: vi.fn((key: string, value: string) => {
                store[key] = value.toString();
            }),
            removeItem: vi.fn((key: string) => {
                delete store[key];
            }),
            clear: vi.fn(() => {
                Object.keys(store).forEach(key => delete store[key]);
            }),
        };
        Object.defineProperty(window, 'localStorage', { value: localStorageMock });

        // Set logged in user
        const user = { name: 'Alice', role: 'user', id: '1', picture: 'https://example.com/alice.jpg' };
        window.localStorage.setItem('schafer_user', JSON.stringify(user));
    });

    it('renders recipes with correct contributor avatars', async () => {
        await act(async () => {
            render(<App />);
        });

        // Wait for recipes to load and check if title appears
        await waitFor(() => {
            expect(screen.getByText('Alice Recipe')).toBeInTheDocument();
        });

        // Verify avatars are present by querying images with specific src
        const aliceAvatar = document.querySelector('img[src="https://example.com/alice.jpg"]');
        const bobAvatar = document.querySelector('img[src="https://example.com/bob.jpg"]');

        expect(aliceAvatar).toBeInTheDocument();
        expect(bobAvatar).toBeInTheDocument();
    });
});
