import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within, waitFor } from '@testing-library/react';
import { RecipeModal } from './RecipeModal';
import { createMockRecipe, renderWithProviders, setupLocalStorage } from '../test/utils';
import { STORAGE_KEYS } from '../constants/storage';

describe('RecipeModal', () => {
    const mockOnClose = vi.fn();
    const defaultProps = {
        recipe: createMockRecipe(),
        onClose: mockOnClose,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('should render recipe details correctly', () => {
        renderWithProviders(<RecipeModal {...defaultProps} />);

        expect(screen.getByRole('heading', { level: 2, name: 'Test Recipe' })).toBeInTheDocument();
        expect(screen.getAllByText('Main').length).toBeGreaterThan(0);
        expect(screen.getByText(/By Test User/i)).toBeInTheDocument();
    });

    it('should display ingredients', () => {
        renderWithProviders(<RecipeModal {...defaultProps} />);

        expect(screen.getByText('Ingredients')).toBeInTheDocument();
        expect(screen.getByText('1 cup flour')).toBeInTheDocument();
        expect(screen.getByText('2 eggs')).toBeInTheDocument();
    });

    it('should display instructions', () => {
        renderWithProviders(<RecipeModal {...defaultProps} />);

        expect(screen.getByText('Instructions')).toBeInTheDocument();
        expect(screen.getByText('Mix ingredients')).toBeInTheDocument();
        expect(screen.getByText('Bake at 350°F')).toBeInTheDocument();
    });

    it('should display prep time, cook time, and calories', () => {
        renderWithProviders(<RecipeModal {...defaultProps} />);

        expect(screen.getByText(/Prep: 15 min/i)).toBeInTheDocument();
        expect(screen.getByText(/Cook: 30 min/i)).toBeInTheDocument();
        expect(screen.getByText(/~250 kcal/i)).toBeInTheDocument();
    });

    it('should display notes when available', () => {
        renderWithProviders(<RecipeModal {...defaultProps} />);

        expect(screen.getByText('Heirloom Notes')).toBeInTheDocument();
        expect(screen.getByText('Test notes')).toBeInTheDocument();
    });

    it('should not display notes section when notes are undefined', () => {
        const recipeWithoutNotes = createMockRecipe({ notes: undefined });
        renderWithProviders(
            <RecipeModal {...defaultProps} recipe={recipeWithoutNotes} />
        );

        expect(screen.queryByText('Heirloom Notes')).not.toBeInTheDocument();
    });

    it('should call onClose when close button is clicked', () => {
        renderWithProviders(<RecipeModal {...defaultProps} />);

        const closeButton = screen.getByRole('button', { name: /close recipe/i });
        fireEvent.click(closeButton);

        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when backdrop is clicked', () => {
        renderWithProviders(<RecipeModal {...defaultProps} />);

        const backdrop = document.querySelector('.bg-stone-900\\/60');
        if (backdrop) {
            fireEvent.click(backdrop);
            expect(mockOnClose).toHaveBeenCalledTimes(1);
        }
    });

    it('should render recipe image with correct src and alt', () => {
        const recipeWithLocalImage = createMockRecipe({ image: '/recipe-images/test-recipe.jpg' });
        renderWithProviders(<RecipeModal {...defaultProps} recipe={recipeWithLocalImage} />);

        const image = screen.getByAltText('Test Recipe');
        expect(image).toBeInTheDocument();
        expect(image).toHaveAttribute('src', '/recipe-images/test-recipe.jpg');
    });

    it('should return null when recipe is null', () => {
        renderWithProviders(
            <RecipeModal {...defaultProps} recipe={null as any} />
        );

        expect(screen.queryByText('Test Recipe')).not.toBeInTheDocument();
    });

    it('should display category badge', () => {
        renderWithProviders(<RecipeModal {...defaultProps} />);

        const categoryBadges = screen.getAllByText('Main');
        const badge = categoryBadges.find(el => el.classList.contains('uppercase'));
        expect(badge).toBeInTheDocument();
    });

    it('should number instructions correctly', () => {
        renderWithProviders(<RecipeModal {...defaultProps} />);

        // Instructions should be numbered 01, 02, etc.
        const container = screen.getByText('Mix ingredients').closest('.flex');
        expect(container?.textContent).toContain('01');
    });

    it('should open lightbox when image is clicked', () => {
        const recipeWithLocalImage = createMockRecipe({ image: '/recipe-images/test-recipe.jpg' });
        renderWithProviders(<RecipeModal {...defaultProps} recipe={recipeWithLocalImage} />);
        const image = screen.getByAltText('Test Recipe');
        fireEvent.click(image);
        expect(screen.getByText('Click anywhere to close')).toBeInTheDocument();
    });

    it('should close lightbox when close button is clicked', () => {
        const recipeWithLocalImage = createMockRecipe({ image: '/recipe-images/test-recipe.jpg' });
        renderWithProviders(<RecipeModal {...defaultProps} recipe={recipeWithLocalImage} />);
        fireEvent.click(screen.getByAltText('Test Recipe'));
        expect(screen.getByText('Click anywhere to close')).toBeInTheDocument();
        const lightboxClose = screen.getByRole('button', { name: /close enlarged image/i });
        fireEvent.click(lightboxClose);
        expect(screen.queryByText('Click anywhere to close')).not.toBeInTheDocument();
    });

    it('should show fallback in lightbox when enlarged image fails to load', () => {
        const recipeWithLocalImage = createMockRecipe({ image: '/recipe-images/test-recipe.jpg' });
        renderWithProviders(<RecipeModal {...defaultProps} recipe={recipeWithLocalImage} />);
        fireEvent.click(screen.getByAltText('Test Recipe'));
        const lightbox = screen.getByRole('dialog', { name: 'Enlarged recipe image' });
        const enlarged = within(lightbox).getByAltText('Test Recipe');
        fireEvent.error(enlarged);
        expect(within(lightbox).getByText('Preview unavailable')).toBeInTheDocument();
        expect(
            within(lightbox).getByRole('img', { name: /Image unavailable for Test Recipe/i })
        ).toBeInTheDocument();
    });

    it('should expose share recipe action with accessible label containing recipe title', () => {
        renderWithProviders(<RecipeModal {...defaultProps} />);
        // Share now lives in the bottom action bar's overflow menu — open it first.
        fireEvent.click(screen.getByRole('button', { name: /more actions/i }));
        const shareBtn = screen.getByRole('menuitem', { name: /Share recipe: Open in .*: Test Recipe/i });
        expect(shareBtn).toBeInTheDocument();
        expect(shareBtn).toHaveAttribute('aria-label');
        expect(shareBtn.getAttribute('aria-label')).toMatch(/Open in .*: Test Recipe/);
    });

    it('adds recipe to a collection from the overflow menu and shows a success toast', async () => {
        setupLocalStorage();
        localStorage.setItem(
            STORAGE_KEYS.collections,
            JSON.stringify([
                {
                    id: 'col-test-1',
                    name: 'Weeknight Dinners',
                    recipeIds: [],
                    createdBy: 'Test User',
                    icon: '🍳',
                    timestamp: new Date().toISOString(),
                },
            ]),
        );

        renderWithProviders(<RecipeModal {...defaultProps} />);

        fireEvent.click(screen.getByRole('button', { name: /more actions/i }));
        fireEvent.click(screen.getByRole('menuitem', { name: /save to collection/i }));
        fireEvent.click(screen.getByRole('button', { name: /Weeknight Dinners/i }));

        await waitFor(() => {
            expect(screen.getByTestId('toast-stack')).toHaveTextContent(/Added to "Weeknight Dinners"/i);
        });
    });

    it('shows You might also like and navigates when a suggestion is clicked', () => {
        const mockNavigate = vi.fn();
        const r1 = createMockRecipe({ id: 'recipe-a', title: 'Alpha Dish' });
        const r2 = createMockRecipe({ id: 'recipe-b', title: 'Beta Dish' });
        renderWithProviders(
            <RecipeModal {...defaultProps} recipe={r1} recipeList={[r1, r2]} onNavigate={mockNavigate} />
        );
        expect(screen.getByRole('button', { name: /You might also like/i })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /You might also like/i }));
        fireEvent.click(screen.getAllByRole('button', { name: /Beta Dish/i })[0]!);
        expect(mockNavigate).toHaveBeenCalledWith(r2);
    });

    it('shows prev/next recipe navigation when browsing a list', () => {
        const mockNavigate = vi.fn();
        const r1 = createMockRecipe({ id: 'recipe-a', title: 'Alpha Dish' });
        const r2 = createMockRecipe({ id: 'recipe-b', title: 'Beta Dish' });
        const r3 = createMockRecipe({ id: 'recipe-c', title: 'Gamma Dish' });
        renderWithProviders(
            <RecipeModal {...defaultProps} recipe={r2} recipeList={[r1, r2, r3]} onNavigate={mockNavigate} />
        );
        fireEvent.click(screen.getByTestId('recipe-nav-previous'));
        expect(mockNavigate).toHaveBeenCalledWith(r1);
        fireEvent.click(screen.getByTestId('recipe-nav-next'));
        expect(mockNavigate).toHaveBeenCalledWith(r3);
    });

    it('Cook tab shows step progress and cook mode CTA', () => {
        const mockStartCook = vi.fn();
        renderWithProviders(
            <RecipeModal {...defaultProps} onStartCook={mockStartCook} />
        );
        fireEvent.click(screen.getByRole('tab', { name: 'Cook' }));
        expect(screen.getByRole('progressbar', { name: /0 of 2 steps completed/i })).toBeInTheDocument();
        expect(screen.getByTestId('recipe-cook-tab-start')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('recipe-cook-tab-start'));
        expect(mockStartCook).toHaveBeenCalledTimes(1);
    });

    it('clears ingredient checkmarks when Clear checks is clicked', () => {
        renderWithProviders(<RecipeModal {...defaultProps} />);
        fireEvent.click(screen.getByRole('button', { name: /Ingredients \(2\)/i }));
        fireEvent.click(screen.getAllByRole('checkbox')[0]);
        expect(screen.getAllByRole('button', { name: /Clear ingredient checkmarks/i }).length).toBeGreaterThan(0);
        fireEvent.click(screen.getAllByRole('button', { name: /Clear ingredient checkmarks/i })[0]!);
        expect(screen.queryAllByRole('button', { name: /Clear ingredient checkmarks/i })).toHaveLength(0);
    });

    it('shows total time when prep and cook durations are parseable', () => {
        renderWithProviders(<RecipeModal {...defaultProps} />);
        expect(screen.getByText(/Total: 45 min/i)).toBeInTheDocument();
    });

    it('browse contributor button calls handler with contributor name', () => {
        const onBrowseContributor = vi.fn();
        renderWithProviders(
            <RecipeModal {...defaultProps} onBrowseContributor={onBrowseContributor} />
        );
        fireEvent.click(screen.getByTestId('recipe-modal-browse-contributor'));
        expect(onBrowseContributor).toHaveBeenCalledWith('Test User');
    });

    it('restores ingredient checkmarks from session storage when reopened', () => {
        sessionStorage.setItem(
            'schafer_recipe_cook_session',
            JSON.stringify({ 'recipe-1': { ingredients: [0], steps: [] } }),
        );
        renderWithProviders(<RecipeModal {...defaultProps} />);
        fireEvent.click(screen.getByRole('button', { name: /Ingredients \(2\)/i }));
        const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
        expect(checkboxes[0]?.checked).toBe(true);
    });
});
