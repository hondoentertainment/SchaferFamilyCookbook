import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { HelpView } from './HelpView';
import { renderWithProviders } from '../test/utils';

vi.mock('../utils/haptics', () => ({ hapticLight: vi.fn() }));

describe('HelpView', () => {
    it('renders the help landmark with heading and keyboard shortcuts panel', () => {
        renderWithProviders(<HelpView />);
        expect(screen.getByRole('main', { name: /help and shortcuts/i })).toBeInTheDocument();
        expect(screen.getByText(/help & shortcuts/i)).toBeInTheDocument();
        expect(screen.getAllByText(/keyboard shortcuts/i).length).toBeGreaterThan(0);
    });

    it('opens every collapsible panel and clicks all actions without crashing', () => {
        renderWithProviders(<HelpView />);
        // First pass toggles the collapsed panels open; second pass reaches
        // the action buttons revealed inside them.
        for (let pass = 0; pass < 2; pass++) {
            for (const btn of screen.getAllByRole('button')) {
                fireEvent.click(btn);
            }
        }
        expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
    });
});
