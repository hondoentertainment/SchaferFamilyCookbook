import { describe, it, expect, beforeEach } from 'vitest';
import { CloudArchive } from './db';
import { createMockRecipe, createMockTrivia, createMockGalleryItem, setupLocalStorage } from '../test/utils';

describe('CloudArchive', () => {
    beforeEach(() => {
        setupLocalStorage();
        localStorage.clear();
    });

    describe('getProvider', () => {
        it('should return "local" as default provider', () => {
            expect(CloudArchive.getProvider()).toBe('local');
        });

        it('should return stored provider from localStorage', () => {
            localStorage.setItem('schafer_active_provider', 'firebase');
            expect(CloudArchive.getProvider()).toBe('firebase');
        });
    });

    describe('Recipe Management', () => {
        it('should get recipes from localStorage', async () => {
            const mockRecipes = [createMockRecipe()];
            localStorage.setItem('schafer_db_recipes', JSON.stringify(mockRecipes));

            const recipes = await CloudArchive.getRecipes();
            expect(recipes).toHaveLength(1);
            expect(recipes[0].title).toBe('Test Recipe');
        });

        it('should return default recipes if localStorage is empty', async () => {
            const recipes = await CloudArchive.getRecipes();
            expect(Array.isArray(recipes)).toBe(true);
        });

        it('should upsert a new recipe', async () => {
            const newRecipe = createMockRecipe({ id: 'recipe-new' });
            await CloudArchive.upsertRecipe(newRecipe);

            const recipes = await CloudArchive.getRecipes();
            const foundRecipe = recipes.find(r => r.id === 'recipe-new');
            expect(foundRecipe).toBeDefined();
            expect(foundRecipe?.title).toBe('Test Recipe');
        });

        it('should update an existing recipe', async () => {
            const recipe = createMockRecipe({ id: 'recipe-1', title: 'Original' });
            await CloudArchive.upsertRecipe(recipe);

            const updatedRecipe = createMockRecipe({ id: 'recipe-1', title: 'Updated' });
            await CloudArchive.upsertRecipe(updatedRecipe);

            const recipes = await CloudArchive.getRecipes();
            const foundRecipe = recipes.find(r => r.id === 'recipe-1');
            expect(foundRecipe?.title).toBe('Updated');
        });

        it('should delete a recipe', async () => {
            const recipe = createMockRecipe({ id: 'recipe-to-delete' });
            await CloudArchive.upsertRecipe(recipe);

            await CloudArchive.deleteRecipe('recipe-to-delete');

            const recipes = await CloudArchive.getRecipes();
            const foundRecipe = recipes.find(r => r.id === 'recipe-to-delete');
            expect(foundRecipe).toBeUndefined();
        });
    });

    describe('Trivia Management', () => {
        it('should get trivia from localStorage', async () => {
            const mockTrivia = [createMockTrivia()];
            localStorage.setItem('schafer_db_trivia', JSON.stringify(mockTrivia));

            const trivia = await CloudArchive.getTrivia();
            expect(trivia).toHaveLength(1);
            expect(trivia[0].question).toBe('Test Question?');
        });

        it('should return empty array if no trivia exists', async () => {
            const trivia = await CloudArchive.getTrivia();
            expect(trivia).toEqual([]);
        });

        it('should upsert trivia', async () => {
            const newTrivia = createMockTrivia({ id: 'trivia-new' });
            await CloudArchive.upsertTrivia(newTrivia);

            const trivia = await CloudArchive.getTrivia();
            const foundTrivia = trivia.find(t => t.id === 'trivia-new');
            expect(foundTrivia).toBeDefined();
        });

        it('should delete trivia', async () => {
            const trivia = createMockTrivia({ id: 'trivia-to-delete' });
            await CloudArchive.upsertTrivia(trivia);

            await CloudArchive.deleteTrivia('trivia-to-delete');

            const allTrivia = await CloudArchive.getTrivia();
            const foundTrivia = allTrivia.find(t => t.id === 'trivia-to-delete');
            expect(foundTrivia).toBeUndefined();
        });
    });

    describe('Gallery Management', () => {
        it('should get gallery items from localStorage', async () => {
            const mockGallery = [createMockGalleryItem()];
            localStorage.setItem('schafer_db_gallery', JSON.stringify(mockGallery));

            const gallery = await CloudArchive.getGallery();
            expect(gallery).toHaveLength(1);
            expect(gallery[0].caption).toBe('Test Caption');
        });

        it('should return empty array if no gallery items exist', async () => {
            const gallery = await CloudArchive.getGallery();
            expect(gallery).toEqual([]);
        });

        it('should upsert gallery item', async () => {
            const newItem = createMockGalleryItem({ id: 'gallery-new' });
            await CloudArchive.upsertGalleryItem(newItem);

            const gallery = await CloudArchive.getGallery();
            const foundItem = gallery.find(g => g.id === 'gallery-new');
            expect(foundItem).toBeDefined();
        });

        it('should delete gallery item', async () => {
            const item = createMockGalleryItem({ id: 'gallery-to-delete' });
            await CloudArchive.upsertGalleryItem(item);

            await CloudArchive.deleteGalleryItem('gallery-to-delete');

            const gallery = await CloudArchive.getGallery();
            const foundItem = gallery.find(g => g.id === 'gallery-to-delete');
            expect(foundItem).toBeUndefined();
        });
    });

    describe('History Management', () => {
        it('should add history entry', async () => {
            const entry = {
                id: 'h1',
                contributor: 'Test User',
                action: 'added' as const,
                type: 'recipe' as const,
                itemName: 'Test Recipe',
                timestamp: new Date().toISOString(),
            };

            await CloudArchive.addHistoryEntry(entry);

            const history = await CloudArchive.getHistory();
            expect(history).toHaveLength(1);
            expect(history[0].itemName).toBe('Test Recipe');
        });

        it('should get recipes from default seed when localStorage is empty', async () => {
            const recipes = await CloudArchive.getRecipes();
            expect(recipes.length).toBeGreaterThan(0);
            expect(recipes[0]).toHaveProperty('title');
            expect(recipes[0]).toHaveProperty('ingredients');
        });

        it('should limit history to 100 entries', async () => {
            // Add 105 entries
            for (let i = 0; i < 105; i++) {
                await CloudArchive.addHistoryEntry({
                    id: `h${i}`,
                    contributor: 'Test User',
                    action: 'added',
                    type: 'recipe',
                    itemName: `Recipe ${i}`,
                    timestamp: new Date().toISOString(),
                });
            }

            const history = await CloudArchive.getHistory();
            expect(history.length).toBeLessThanOrEqual(100);
        });
    });
});
