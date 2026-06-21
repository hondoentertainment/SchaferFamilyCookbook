import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HistoryView } from './HistoryView';
import { renderWithProviders } from '../test/utils';
import { CloudArchive } from '../services/db';

describe('HistoryView', () => {
    it('should render family history header', () => {
        renderWithProviders(<HistoryView />);
        expect(screen.getByText('Schafer / Oehler')).toBeInTheDocument();
        expect(screen.getByText('Family Food History')).toBeInTheDocument();
    });

    it('should render Legacy & Heritage badge', () => {
        renderWithProviders(<HistoryView />);
        expect(screen.getByText('Legacy & Heritage')).toBeInTheDocument();
    });

    it('should render The Oehler Family section', () => {
        renderWithProviders(<HistoryView />);
        expect(screen.getByRole('heading', { name: 'The Oehler Family', level: 2 })).toBeInTheDocument();
    });

    it('should render The Schafer Family section', () => {
        renderWithProviders(<HistoryView />);
        expect(screen.getByRole('heading', { name: 'The Schafer Family', level: 2 })).toBeInTheDocument();
    });

    it('should render Harriet and Oliver section', () => {
        renderWithProviders(<HistoryView />);
        expect(screen.getByRole('heading', { name: 'Harriet and Oliver', level: 2 })).toBeInTheDocument();
    });

    it('should render A Legacy of Food section', () => {
        renderWithProviders(<HistoryView />);
        expect(screen.getByRole('heading', { name: 'A Legacy of Food', level: 2 })).toBeInTheDocument();
    });

    it('should render table of contents with section links', () => {
        renderWithProviders(<HistoryView />);
        expect(screen.getByRole('navigation', { name: /table of contents/i })).toBeInTheDocument();
        expect(screen.getByText('In this story')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /jump to introduction/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /jump to the oehler family/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /jump to the schafer family/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /jump to harriet and oliver/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /jump to a legacy of food/i })).toBeInTheDocument();
    });

    it('should render print button', () => {
        renderWithProviders(<HistoryView />);
        expect(screen.getByRole('button', { name: /print family story/i })).toBeInTheDocument();
    });

    it('should render skip link for accessibility', () => {
        renderWithProviders(<HistoryView />);
        const skipLink = screen.getByText('Skip to main content');
        expect(skipLink).toBeInTheDocument();
        expect(skipLink).toHaveAttribute('href', '#history-article');
    });

    it('should have section IDs for deep linking', () => {
        const { container } = renderWithProviders(<HistoryView />);
        expect(container.querySelector('#intro')).toBeInTheDocument();
        expect(container.querySelector('#oehler')).toBeInTheDocument();
        expect(container.querySelector('#schafer')).toBeInTheDocument();
        expect(container.querySelector('#harriet-oliver')).toBeInTheDocument();
        expect(container.querySelector('#legacy')).toBeInTheDocument();
    });

    it('should scroll to section when TOC link is clicked', async () => {
        const user = userEvent.setup();
        const scrollIntoViewSpy = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
        renderWithProviders(<HistoryView />);
        const schaferButton = screen.getByRole('button', { name: /jump to the schafer family/i });

        await user.click(schaferButton);

        expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
        scrollIntoViewSpy.mockRestore();
    });

    it('renders CMS story sections when saved content exists', async () => {
        vi.spyOn(CloudArchive, 'getStoryContent').mockResolvedValueOnce([
            {
                id: 'custom-2',
                heading: 'Second Memory',
                body: 'Second custom paragraph.',
                order: 2,
            },
            {
                id: 'custom-1',
                heading: 'First Memory',
                body: 'First paragraph.\n\nSecond paragraph.',
                order: 1,
            },
        ]);

        const { container } = renderWithProviders(<HistoryView />);

        expect(await screen.findByRole('heading', { name: 'First Memory', level: 2 })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Second Memory', level: 2 })).toBeInTheDocument();
        expect(screen.getByText('Second paragraph.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /jump to first memory/i })).toBeInTheDocument();
        expect(container.querySelector('#first-memory')).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'The Oehler Family', level: 2 })).not.toBeInTheDocument();
    });

    it('falls back to the built-in story when CMS sections are empty', async () => {
        vi.spyOn(CloudArchive, 'getStoryContent').mockResolvedValueOnce([
            {
                id: 'blank',
                heading: '   ',
                body: '   ',
                order: 0,
            },
        ]);

        renderWithProviders(<HistoryView />);

        expect(await screen.findByRole('heading', { name: 'The Oehler Family', level: 2 })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /jump to the oehler family/i })).toBeInTheDocument();
    });
});
