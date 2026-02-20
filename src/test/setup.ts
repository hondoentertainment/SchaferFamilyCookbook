import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.clearAllMocks();
});

// Mock Firebase
vi.mock('firebase/app', () => ({
    initializeApp: vi.fn(() => ({})),
    getApps: vi.fn(() => []),
    getApp: vi.fn(() => ({})),
}));

vi.mock('firebase/firestore', () => ({
    getFirestore: vi.fn(() => ({})),
    collection: vi.fn(),
    setDoc: vi.fn(),
    doc: vi.fn(),
    deleteDoc: vi.fn(),
    query: vi.fn(),
    orderBy: vi.fn(),
    onSnapshot: vi.fn((q, callback) => {
        callback({ docs: [] });
        return vi.fn(); // unsubscribe function
    }),
}));

vi.mock('firebase/storage', () => ({
    getStorage: vi.fn(() => ({})),
    ref: vi.fn(),
    uploadBytes: vi.fn(),
    getDownloadURL: vi.fn(() => Promise.resolve('https://example.com/image.jpg')),
}));

// Mock Google GenAI (package exports GoogleGenAI)
vi.mock('@google/genai', () => ({
    GoogleGenAI: vi.fn(() => ({
        models: {
            generateContent: vi.fn(() => Promise.resolve({ text: '{"title": "Test Recipe", "ingredients": [], "instructions": []}' })),
            generateImages: vi.fn(() => Promise.resolve({
                generatedImages: [{
                    image: { imageBytes: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' }
                }]
            })),
        },
    })),
    Type: {},
}));

// Setup global window mocks
global.localStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
};
