import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HistoryView } from './HistoryView';
import { renderWithProviders } from '../test/utils';

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
});
