import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
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
        expect(screen.getByText('The Oehler Family')).toBeInTheDocument();
    });

    it('should render The Schafer Family section', () => {
        renderWithProviders(<HistoryView />);
        expect(screen.getByText('The Schafer Family')).toBeInTheDocument();
    });

    it('should render Harriet and Oliver section', () => {
        renderWithProviders(<HistoryView />);
        expect(screen.getByText('Harriet and Oliver')).toBeInTheDocument();
    });

    it('should render A Legacy of Food section', () => {
        renderWithProviders(<HistoryView />);
        expect(screen.getByText('A Legacy of Food')).toBeInTheDocument();
    });
});
