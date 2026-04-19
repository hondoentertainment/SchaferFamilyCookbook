import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { AdminView } from './AdminView';
import {
    renderWithProviders,
    createMockRecipe,
    createMockTrivia,
    createMockContributor,
    createMockGalleryItem,
    waitFor
} from '../test/utils';
import * as featuredService from '../services/featured';

describe('AdminView', () => {
    const mockOnAddRecipe = vi.fn();
    const mockOnAddGallery = vi.fn();
    const mockOnAddTrivia = vi.fn();
    const mockOnDeleteTrivia = vi.fn();
    const mockOnDeleteRecipe = vi.fn();
    const mockOnUpdateContributor = vi.fn();
    const mockOnUpdateArchivePhone = vi.fn();
    const mockOnEditRecipe = vi.fn();
    const mockClearEditing = vi.fn();

    const defaultProps = {
        editingRecipe: null,
        clearEditing: mockClearEditing,
        recipes: [createMockRecipe({ id: 'r1', title: 'Apple Pie' }), createMockRecipe({ id: 'r2', title: 'Banana Bread' })],
        trivia: [createMockTrivia({ id: 't1', question: 'Test?' })],
        contributors: [createMockContributor({ name: 'Alice' })],
        currentUser: {
            id: 'u1',
            name: 'Admin User',
            picture: 'https://example.com/avatar.jpg',
            role: 'admin' as const,
            email: 'admin@test.com',
        },
        dbStats: {
            recipeCount: 2,
            galleryCount: 0,
            triviaCount: 1,
            isCloudActive: false,
            activeProvider: 'local' as const,
            archivePhone: '',
        },
        onAddRecipe: mockOnAddRecipe,
        onAddGallery: mockOnAddGallery,
        onAddTrivia: mockOnAddTrivia,
        onDeleteTrivia: mockOnDeleteTrivia,
        onDeleteRecipe: mockOnDeleteRecipe,
        onUpdateContributor: mockOnUpdateContributor,
        onUpdateArchivePhone: mockOnUpdateArchivePhone,
        onEditRecipe: mockOnEditRecipe,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('alert', vi.fn());
        vi.stubGlobal('confirm', vi.fn(() => true));
        vi.stubGlobal('URL', {
            createObjectURL: vi.fn(() => 'blob:mock'),
            revokeObjectURL: vi.fn(),
        });
    });

    it('should render Records tab by default with Manage Recipes', () => {
        renderWithProviders(<AdminView {...defaultProps} />);
        expect(screen.getAllByText('Manage Recipes').length).toBeGreaterThan(0);
        expect(screen.getByText('Manage Recipes (2)')).toBeInTheDocument();
    });

    it('should render subtabs for Recipes, Gallery, Trivia, Directory', () => {
        renderWithProviders(<AdminView {...defaultProps} />);
        expect(screen.getByText('📖 Recipes')).toBeInTheDocument();
        expect(screen.getByText('🖼️ Gallery')).toBeInTheDocument();
        expect(screen.getByText('💡 Trivia')).toBeInTheDocument();
        expect(screen.getByText('👥 Directory')).toBeInTheDocument();
    });

    it('should filter recipes by search', () => {
        renderWithProviders(<AdminView {...defaultProps} />);
        const searchInput = screen.getByPlaceholderText('Search recipes...');
        fireEvent.change(searchInput, { target: { value: 'Apple' } });
        expect(screen.getByText('Apple Pie')).toBeInTheDocument();
        expect(screen.queryByText('Banana Bread')).not.toBeInTheDocument();
        expect(screen.getByText(/Manage Recipes \(1 of 2\)/)).toBeInTheDocument();
    });

    it('should show empty state when search has no matches', () => {
        renderWithProviders(<AdminView {...defaultProps} />);
        fireEvent.change(screen.getByPlaceholderText('Search recipes...'), { target: { value: 'xyz' } });
        expect(screen.getByText(/No recipes match "xyz"/)).toBeInTheDocument();
    });

    it('should switch to Gallery tab', () => {
        renderWithProviders(<AdminView {...defaultProps} />);
        fireEvent.click(screen.getByText('🖼️ Gallery'));
        expect(screen.getAllByText('Family Archive').length).toBeGreaterThan(0);
    });

    it('should switch to Trivia tab', () => {
        renderWithProviders(<AdminView {...defaultProps} />);
        fireEvent.click(screen.getByText('💡 Trivia'));
        expect(screen.getAllByText('Family Trivia').length).toBeGreaterThan(0);
    });

    it('should switch to Directory tab', () => {
        renderWithProviders(<AdminView {...defaultProps} />);
        fireEvent.click(screen.getByText('👥 Directory'));
        expect(screen.getByText('Family Directory & Avatars')).toBeInTheDocument();
    });

    it('should show recipe form with title and ingredients inputs when editing', () => {
        const editingRecipe = createMockRecipe({ id: 'r1', title: 'Apple Pie' });
        renderWithProviders(<AdminView {...defaultProps} editingRecipe={editingRecipe} />);
        expect(screen.getByPlaceholderText('Recipe Title')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Ingredients (one per line)')).toBeInTheDocument();
    });

    it('should call onEditRecipe when Edit is clicked on a recipe', () => {
        renderWithProviders(<AdminView {...defaultProps} />);
        const editButtons = screen.getAllByText('Edit');
        fireEvent.click(editButtons[0]);
        expect(mockOnEditRecipe).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'Apple Pie' })
        );
    });

    it('should show editing banner when editingRecipe is set', () => {
        const editingRecipe = createMockRecipe({ id: 'r1', title: 'Apple Pie' });
        renderWithProviders(<AdminView {...defaultProps} editingRecipe={editingRecipe} />);
        expect(screen.getByText('Editing: Apple Pie')).toBeInTheDocument();
        expect(screen.getByText('Cancel Edit')).toBeInTheDocument();
    });

    it('should call clearEditing when Cancel Edit is clicked', () => {
        const editingRecipe = createMockRecipe({ id: 'r1', title: 'Apple Pie' });
        renderWithProviders(<AdminView {...defaultProps} editingRecipe={editingRecipe} />);
        fireEvent.click(screen.getByText('Cancel Edit'));
        expect(mockClearEditing).toHaveBeenCalled();
    });

    it('should show bulk image buttons', () => {
        renderWithProviders(<AdminView {...defaultProps} />);
        expect(screen.getByText('🖼️ Fill Missing (Imagen)')).toBeInTheDocument();
        expect(screen.getByText('🔄 Regenerate All (Imagen)')).toBeInTheDocument();
    });

    it('should render the Import from Photo (OCR) button on the Records subtab', () => {
        renderWithProviders(<AdminView {...defaultProps} />);
        expect(screen.getByRole('button', { name: /Import from Photo/i })).toBeInTheDocument();
        // The hint copy should also appear so admins know what this does.
        expect(screen.getByText(/Gemini Vision/i)).toBeInTheDocument();
    });

    it('should show Recipe images progress when recipes are passed', () => {
        const recipesWithMixedImages = [
            createMockRecipe({ id: 'r1', title: 'With Image', image: 'https://example.com/a.jpg', imageSource: 'upload' }),
            createMockRecipe({ id: 'r2', title: 'No Image', image: '', imageSource: undefined }),
            createMockRecipe({ id: 'r3', title: 'With Imagen', image: 'https://example.com/b.jpg', imageSource: 'nano-banana' }),
        ];
        renderWithProviders(<AdminView {...defaultProps} recipes={recipesWithMixedImages} />);
        expect(screen.getByText('Recipe images')).toBeInTheDocument();
        const recipeImagesSection = screen.getByText('Recipe images').closest('div');
        expect(recipeImagesSection).toHaveTextContent(/2 of 3 recipes have images/);
    });

    it('should call onAddRecipe when the recipe form is submitted', async () => {
        const editingRecipe = createMockRecipe({ id: 'r1', title: 'Editing Pie' });
        renderWithProviders(<AdminView {...defaultProps} editingRecipe={editingRecipe} />);

        fireEvent.change(screen.getByPlaceholderText('Recipe Title'), { target: { value: 'New Test Recipe' } });
        fireEvent.change(screen.getByPlaceholderText('Ingredients (one per line)'), { target: { value: 'Apple\nSugar' } });
        fireEvent.change(screen.getByPlaceholderText('Instructions (one per line)'), { target: { value: 'Bake it' } });

        fireEvent.click(screen.getByRole('button', { name: /Update Record/i }));

        expect(mockOnAddRecipe).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'New Test Recipe',
                ingredients: ['Apple', 'Sugar'],
                instructions: ['Bake it']
            }),
            undefined
        );
    });

    it('should call onDeleteRecipe when delete is confirmed', async () => {
        renderWithProviders(<AdminView {...defaultProps} />);
        const deleteButtons = screen.getAllByRole('button', { name: /Delete/i });
        fireEvent.click(deleteButtons[0]);

        const confirmDialogBtn = await screen.findByRole('button', { name: 'Delete' });
        fireEvent.click(confirmDialogBtn);

        await waitFor(() => {
            expect(mockOnDeleteRecipe).toHaveBeenCalledWith('r1');
        });
    });

    it('should call onAddGallery when gallery form is submitted', async () => {
        renderWithProviders(<AdminView {...defaultProps} />);
        fireEvent.click(screen.getByText('🖼️ Gallery'));

        const file = new File(['dummy content'], 'test.png', { type: 'image/png' });
        const input = screen.getByLabelText(/Choose family photo or video to upload/i);
        fireEvent.change(input, { target: { files: [file] } });

        fireEvent.change(screen.getByPlaceholderText(/Caption/i), { target: { value: 'Test Photo' } });
        fireEvent.click(screen.getByRole('button', { name: /Upload Memory/i }));

        expect(mockOnAddGallery).toHaveBeenCalledWith(
            expect.objectContaining({ caption: 'Test Photo' }),
            file
        );
    });

    it('should call onAddTrivia when trivia form is submitted', async () => {
        renderWithProviders(<AdminView {...defaultProps} />);
        fireEvent.click(screen.getByText('💡 Trivia'));

        fireEvent.change(screen.getByPlaceholderText(/e\.g\. Who grew up/i), { target: { value: 'Test Question?' } });
        fireEvent.change(screen.getByPlaceholderText('Option 1'), { target: { value: 'A' } });
        fireEvent.change(screen.getByPlaceholderText('Option 2'), { target: { value: 'B' } });
        fireEvent.change(screen.getByPlaceholderText('Correct Answer'), { target: { value: 'A' } });

        fireEvent.click(screen.getByRole('button', { name: /Add Question/i }));

        expect(mockOnAddTrivia).toHaveBeenCalledWith(
            expect.objectContaining({ question: 'Test Question?', options: ['A', 'B', '', ''], answer: 'A' })
        );
    });

    it('should open gallery edit modal, update caption, and call onUpdateGalleryItem', async () => {
        const mockOnUpdateGalleryItem = vi.fn().mockResolvedValue(undefined);
        const mockOnDeleteGalleryItem = vi.fn().mockResolvedValue(undefined);
        const galleryItem = createMockGalleryItem({
            id: 'g1',
            caption: 'Old Caption',
            created_at: '2020-01-15T00:00:00.000Z'
        });
        renderWithProviders(
            <AdminView
                {...defaultProps}
                gallery={[galleryItem]}
                onUpdateGalleryItem={mockOnUpdateGalleryItem}
                onDeleteGalleryItem={mockOnDeleteGalleryItem}
            />
        );
        fireEvent.click(screen.getByText('🖼️ Gallery'));

        // Edit button appears for existing items
        const editBtn = screen.getByRole('button', { name: /Edit "Old Caption"/i });
        fireEvent.click(editBtn);

        // Modal with caption + date inputs
        const dialog = await screen.findByRole('dialog', { name: /Edit Gallery Item/i });
        expect(dialog).toBeInTheDocument();

        const captionInput = screen.getByLabelText(/^Caption$/) as HTMLInputElement;
        expect(captionInput.value).toBe('Old Caption');
        fireEvent.change(captionInput, { target: { value: 'New Caption' } });

        const dateInput = screen.getByLabelText(/^Date$/) as HTMLInputElement;
        expect(dateInput.value).toBe('2020-01-15');

        fireEvent.click(within(dialog).getByRole('button', { name: /^Save$/i }));

        await waitFor(() => {
            expect(mockOnUpdateGalleryItem).toHaveBeenCalledWith(
                'g1',
                expect.objectContaining({ caption: 'New Caption' })
            );
        });
    });

    it('should show Delete button in gallery subtab list and call onDeleteGalleryItem after confirm', async () => {
        const mockOnUpdateGalleryItem = vi.fn().mockResolvedValue(undefined);
        const mockOnDeleteGalleryItem = vi.fn().mockResolvedValue(undefined);
        const galleryItem = createMockGalleryItem({ id: 'g1', caption: 'Bye' });
        renderWithProviders(
            <AdminView
                {...defaultProps}
                gallery={[galleryItem]}
                onUpdateGalleryItem={mockOnUpdateGalleryItem}
                onDeleteGalleryItem={mockOnDeleteGalleryItem}
            />
        );
        fireEvent.click(screen.getByText('🖼️ Gallery'));

        const deleteBtn = screen.getByRole('button', { name: /Delete "Bye"/i });
        fireEvent.click(deleteBtn);

        const confirmBtn = await screen.findByRole('button', { name: 'Delete' });
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(mockOnDeleteGalleryItem).toHaveBeenCalledWith('g1');
        });
    });

    it('should render Export buttons and trigger a download when JSON is clicked', () => {
        const createObjectURLMock = vi.fn(() => 'blob:mock');
        const revokeObjectURLMock = vi.fn();
        vi.stubGlobal('URL', {
            createObjectURL: createObjectURLMock,
            revokeObjectURL: revokeObjectURLMock,
        });

        const anchorClicks: HTMLAnchorElement[] = [];
        const originalCreateElement = document.createElement.bind(document);
        const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
            const el = originalCreateElement(tag);
            if (tag === 'a') {
                (el as HTMLAnchorElement).click = vi.fn(() => {
                    anchorClicks.push(el as HTMLAnchorElement);
                }) as unknown as () => void;
            }
            return el;
        }) as typeof document.createElement);

        try {
            renderWithProviders(<AdminView {...defaultProps} />);

            const jsonBtn = screen.getByRole('button', { name: /Download all recipes as JSON/i });
            const csvBtn = screen.getByRole('button', { name: /Download all recipes as CSV/i });
            expect(jsonBtn).toBeInTheDocument();
            expect(csvBtn).toBeInTheDocument();

            fireEvent.click(jsonBtn);

            expect(createObjectURLMock).toHaveBeenCalledTimes(1);
            expect(anchorClicks).toHaveLength(1);
            expect(anchorClicks[0].download).toMatch(/^schafer-recipes-\d{4}-\d{2}-\d{2}\.json$/);
        } finally {
            createElementSpy.mockRestore();
        }
    });

    describe('Featured Recipes curation', () => {
        let getFeaturedIdsSpy: ReturnType<typeof vi.spyOn>;
        let setFeaturedIdsSpy: ReturnType<typeof vi.spyOn>;

        beforeEach(() => {
            getFeaturedIdsSpy = vi.spyOn(featuredService, 'getFeaturedIds').mockResolvedValue([]);
            setFeaturedIdsSpy = vi.spyOn(featuredService, 'setFeaturedIds').mockResolvedValue();
        });

        it('renders the Featured Recipes panel with current entries', async () => {
            getFeaturedIdsSpy.mockResolvedValue(['r1']);
            renderWithProviders(<AdminView {...defaultProps} />);
            await screen.findByText(/1 \/ 8/);
            // The featured list should show the resolved recipe title.
            expect(screen.getAllByText('Apple Pie').length).toBeGreaterThan(0);
        });

        it('adds a recipe via the Add featured button', async () => {
            renderWithProviders(<AdminView {...defaultProps} />);
            await screen.findByText(/0 \/ 8/);

            const select = screen.getByLabelText(/Add featured recipe/i);
            fireEvent.change(select, { target: { value: 'r1' } });
            fireEvent.click(screen.getByRole('button', { name: /Add featured/i }));

            expect(screen.getByText(/1 \/ 8/)).toBeInTheDocument();
            expect(screen.getByText(/Unsaved changes/i)).toBeInTheDocument();
        });

        it('removes a featured recipe via the × button', async () => {
            getFeaturedIdsSpy.mockResolvedValue(['r1']);
            renderWithProviders(<AdminView {...defaultProps} />);
            await screen.findByText(/1 \/ 8/);

            const removeBtn = screen.getByRole('button', { name: /Remove Apple Pie from featured/i });
            fireEvent.click(removeBtn);
            expect(screen.getByText(/0 \/ 8/)).toBeInTheDocument();
            expect(screen.getByText(/No featured recipes yet/i)).toBeInTheDocument();
        });

        it('calls setFeaturedIds on save and clears dirty state', async () => {
            renderWithProviders(<AdminView {...defaultProps} />);
            await screen.findByText(/0 \/ 8/);

            fireEvent.change(screen.getByLabelText(/Add featured recipe/i), { target: { value: 'r1' } });
            fireEvent.click(screen.getByRole('button', { name: /Add featured/i }));

            fireEvent.click(screen.getByRole('button', { name: /Save featured/i }));

            await waitFor(() => {
                expect(setFeaturedIdsSpy).toHaveBeenCalledWith(['r1']);
            });
            await waitFor(() => {
                expect(screen.getByText(/All changes saved/i)).toBeInTheDocument();
            });
        });
    });

    it('should trigger merge contributors if superadmin', async () => {
        const superAdminUser = { ...defaultProps.currentUser!, name: 'Kyle' };
        renderWithProviders(<AdminView {...defaultProps} currentUser={superAdminUser} />);
        fireEvent.click(screen.getByText('👥 Directory'));

        fireEvent.change(screen.getByPlaceholderText('e.g. Dawn Schafer Tessmer'), { target: { value: 'Test User' } });
        fireEvent.change(screen.getByPlaceholderText('e.g. Dawn'), { target: { value: 'New User' } });

        fireEvent.click(screen.getByRole('button', { name: /🔀 Merge/i }));

        const confirmDialogBtn = await screen.findByRole('button', { name: 'Merge' });
        fireEvent.click(confirmDialogBtn);
        // Expect onAddRecipe to be called to update "Test User" recipes to "New User"
        // Wait for the re-save
        await screen.findByText(/Successfully merged 2 recipes/i).catch(() => { });
        expect(mockOnAddRecipe).toHaveBeenCalledWith(
            expect.objectContaining({ contributor: 'New User' })
        );
    });
});
