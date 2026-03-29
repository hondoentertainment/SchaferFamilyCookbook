import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { RecipeImage } from './RecipeImage';
import { renderWithProviders, createMockRecipe } from '../../test/utils';

vi.mock('../../utils/focusTrap', () => ({
    useFocusTrap: vi.fn(),
}));

vi.mock('../../utils/haptics', () => ({
    hapticLight: vi.fn(),
}));

describe('RecipeImage', () => {
    const recipe = createMockRecipe({
        image: 'https://example.com/recipe.jpg',
        title: 'Test Recipe',
        category: 'Main',
    });

    const defaultProps = {
        recipe,
        imageLoading: false,
        onImageLoad: vi.fn(),
        imageBroken: false,
        onImageError: vi.fn(),
        isAIGenerated: false,
        hasValidImage: true,
        lightboxOpen: false,
        onLightboxOpen: vi.fn(),
        onLightboxClose: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders image with correct src', () => {
        renderWithProviders(<RecipeImage {...defaultProps} />);

        const img = screen.getByAltText('Test Recipe');
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute('src', 'https://example.com/recipe.jpg');
    });

    it('shows placeholder when image is broken (hasValidImage false)', () => {
        renderWithProviders(
            <RecipeImage {...defaultProps} hasValidImage={false} />
        );

        // Should show the category icon fallback instead of an img tag
        expect(screen.queryByAltText('Test Recipe')).not.toBeInTheDocument();
        // Should show "Recipe Coming" placeholder text
        expect(screen.getByText(/recipe coming/i)).toBeInTheDocument();
    });

    it('shows AI badge when isAIGenerated is true', () => {
        renderWithProviders(
            <RecipeImage {...defaultProps} isAIGenerated={true} />
        );

        expect(screen.getByText(/ai/i)).toBeInTheDocument();
    });

    it('does not show AI badge when isAIGenerated is false', () => {
        renderWithProviders(<RecipeImage {...defaultProps} />);

        expect(screen.queryByText(/✨ AI/)).not.toBeInTheDocument();
    });

    it('shows loading pulse when imageLoading is true', () => {
        renderWithProviders(
            <RecipeImage {...defaultProps} imageLoading={true} />
        );

        const pulsingElements = document.querySelectorAll('.animate-pulse');
        expect(pulsingElements.length).toBeGreaterThan(0);
    });

    it('opens lightbox when image area is clicked', () => {
        renderWithProviders(<RecipeImage {...defaultProps} />);

        const button = screen.getByRole('button', { name: /enlarge recipe image/i });
        fireEvent.click(button);

        expect(defaultProps.onLightboxOpen).toHaveBeenCalledTimes(1);
    });

    it('renders lightbox dialog when lightboxOpen is true', () => {
        renderWithProviders(
            <RecipeImage {...defaultProps} lightboxOpen={true} />
        );

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByLabelText(/close enlarged image/i)).toBeInTheDocument();
    });

    it('shows category icon when no valid image', () => {
        renderWithProviders(
            <RecipeImage {...defaultProps} hasValidImage={false} />
        );

        // Main category icon
        expect(screen.getByText('Main')).toBeInTheDocument();
    });
});
