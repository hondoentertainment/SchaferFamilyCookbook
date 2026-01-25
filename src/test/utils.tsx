import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';
import { Recipe, GalleryItem, Trivia, ContributorProfile, HistoryEntry } from '../types';

// Test data factories
export const createMockRecipe = (overrides?: Partial<Recipe>): Recipe => ({
    id: 'recipe-1',
    title: 'Test Recipe',
    contributor: 'Test User',
    category: 'Main',
    ingredients: ['1 cup flour', '2 eggs'],
    instructions: ['Mix ingredients', 'Bake at 350°F'],
    notes: 'Test notes',
    image: 'https://example.com/recipe.jpg',
    prepTime: '15 min',
    cookTime: '30 min',
    calories: 250,
    created_at: new Date().toISOString(),
    ...overrides,
});

export const createMockTrivia = (overrides?: Partial<Trivia>): Trivia => ({
    id: 'trivia-1',
    question: 'Test Question?',
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    answer: 'Option A',
    explanation: 'This is the correct answer because...',
    contributor: 'Test User',
    created_at: new Date().toISOString(),
    ...overrides,
});

export const createMockGalleryItem = (overrides?: Partial<GalleryItem>): GalleryItem => ({
    id: 'gallery-1',
    type: 'image',
    url: 'https://example.com/photo.jpg',
    caption: 'Test Caption',
    contributor: 'Test User',
    created_at: new Date().toISOString(),
    ...overrides,
});

export const createMockContributor = (overrides?: Partial<ContributorProfile>): ContributorProfile => ({
    id: 'contributor-1',
    name: 'Test User',
    avatar: 'https://example.com/avatar.jpg',
    role: 'user',
    email: 'test@example.com',
    ...overrides,
});

export const createMockHistoryEntry = (overrides?: Partial<HistoryEntry>): HistoryEntry => ({
    id: 'history-1',
    contributor: 'Test User',
    action: 'added',
    type: 'recipe',
    itemName: 'Test Recipe',
    timestamp: new Date().toISOString(),
    ...overrides,
});

// Setup localStorage mock helpers
export const setupLocalStorage = () => {
    const store: Record<string, string> = {};

    global.localStorage = {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => {
            store[key] = value;
        },
        removeItem: (key: string) => {
            delete store[key];
        },
        clear: () => {
            Object.keys(store).forEach(key => delete store[key]);
        },
        length: Object.keys(store).length,
        key: (index: number) => Object.keys(store)[index] || null,
    };
};

// Custom render with providers if needed
export const renderWithProviders = (
    ui: ReactElement,
    options?: Omit<RenderOptions, 'wrapper'>
) => {
    return render(ui, { ...options });
};

export * from '@testing-library/react';
