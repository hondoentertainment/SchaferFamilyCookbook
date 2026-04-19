import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

vi.mock('@sentry/react', () => ({
    init: vi.fn(),
    captureException: vi.fn(),
    browserTracingIntegration: vi.fn(() => ({})),
}));

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
    addDoc: vi.fn(() => Promise.resolve({ id: 'mock-doc-id' })),
    getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
    doc: vi.fn(),
    getDoc: vi.fn(() => Promise.resolve({ exists: () => false, data: () => undefined })),
    deleteDoc: vi.fn(),
    updateDoc: vi.fn(),
    query: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    serverTimestamp: vi.fn(() => ({ __type: 'serverTimestamp' })),
    Timestamp: class MockTimestamp {
        seconds: number;
        nanoseconds: number;
        constructor(seconds: number, nanoseconds: number) {
            this.seconds = seconds;
            this.nanoseconds = nanoseconds;
        }
        toDate() {
            return new Date(this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6));
        }
        static fromDate(d: Date) {
            return new (this as unknown as { new (s: number, n: number): unknown })(
                Math.floor(d.getTime() / 1000),
                0
            );
        }
    },
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

// Minimal firebase/auth mock. The default behavior returns a stable anonymous
// user from signInAnonymously and immediately fires onAuthStateChanged with
// null (no persisted user) so individual tests can override as needed via
// vi.mocked(...).mockImplementationOnce(...).
vi.mock('firebase/auth', () => {
    const mockUser = { uid: 'anon-test-uid', isAnonymous: true };
    return {
        getAuth: vi.fn(() => ({ currentUser: null })),
        signInAnonymously: vi.fn(() => Promise.resolve({ user: mockUser })),
        onAuthStateChanged: vi.fn((_auth, cb) => {
            // Fire asynchronously with no user; tests can override.
            Promise.resolve().then(() => cb(null));
            return () => {};
        }),
        GoogleAuthProvider: vi.fn(),
        signInWithPopup: vi.fn(() => Promise.resolve({ user: mockUser })),
        signOut: vi.fn(() => Promise.resolve()),
    };
});

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
