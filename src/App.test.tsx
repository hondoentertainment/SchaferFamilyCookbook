import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import App from './App';
import { setupLocalStorage, createMockRecipe, renderWithProviders } from './test/utils';

describe('App', () => {
    beforeEach(() => {
        setupLocalStorage();
        localStorage.clear();
    });

    it('should show login form when not authenticated', async () => {
        renderWithProviders(<App />);
        expect(await screen.findByText('Identify Yourself')).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/e.g. Grandma Joan/)).toBeInTheDocument();
    });

    it('should login and show Recipes tab when name is submitted', async () => {
        localStorage.setItem('schafer_db_recipes', JSON.stringify([createMockRecipe()]));
        renderWithProviders(<App />);
        const input = screen.getByPlaceholderText(/e.g. Grandma Joan/);
        fireEvent.change(input, { target: { value: 'Alice' } });
        fireEvent.click(screen.getByText('Enter The Archive'));
        await screen.findByText('Test Recipe', {}, { timeout: 3000 });
        expect(screen.getByText('Recipes')).toBeInTheDocument();
    });
});
