import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { PreferencesPanel } from './PreferencesPanel';
import { renderWithProviders, setupLocalStorage } from '../test/utils';

// Mock haptics so we don't worry about vibration API in tests
vi.mock('../utils/haptics', () => ({
    hapticLight: vi.fn(),
}));

describe('PreferencesPanel', () => {
    beforeEach(() => {
        setupLocalStorage();
        vi.clearAllMocks();
    });

    // --- Rendering ---

    it('renders the "Display Preferences" heading', () => {
        renderWithProviders(<PreferencesPanel />);
        expect(screen.getByText(/display preferences/i)).toBeInTheDocument();
    });

    it('renders theme section label', () => {
        renderWithProviders(<PreferencesPanel />);
        expect(screen.getByText('Theme')).toBeInTheDocument();
    });

    it('renders all three theme options (Light, Dark, Auto)', () => {
        renderWithProviders(<PreferencesPanel />);
        expect(screen.getByRole('button', { name: /light/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /dark/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /auto/i })).toBeInTheDocument();
    });

    it('renders text size section label', () => {
        renderWithProviders(<PreferencesPanel />);
        expect(screen.getByText('Text Size')).toBeInTheDocument();
    });

    it('renders all three font size buttons', () => {
        renderWithProviders(<PreferencesPanel />);
        expect(screen.getByRole('button', { name: /small text size/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /medium text size/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /large text size/i })).toBeInTheDocument();
    });

    it('renders the High Contrast toggle', () => {
        renderWithProviders(<PreferencesPanel />);
        expect(screen.getByRole('switch')).toBeInTheDocument();
        expect(screen.getByText('High Contrast')).toBeInTheDocument();
    });

    it('section has aria-label "Display preferences"', () => {
        renderWithProviders(<PreferencesPanel />);
        expect(screen.getByRole('region', { name: /display preferences/i })).toBeInTheDocument();
    });

    // --- Default state ---

    it('defaults to "system" theme (Auto button is pressed)', () => {
        renderWithProviders(<PreferencesPanel />);
        const autoBtn = screen.getByRole('button', { name: /auto/i });
        expect(autoBtn).toHaveAttribute('aria-pressed', 'true');
    });

    it('defaults to "medium" font size (medium button is pressed)', () => {
        renderWithProviders(<PreferencesPanel />);
        const medBtn = screen.getByRole('button', { name: /medium text size/i });
        expect(medBtn).toHaveAttribute('aria-pressed', 'true');
    });

    it('defaults High Contrast to off (aria-checked false)', () => {
        renderWithProviders(<PreferencesPanel />);
        expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    });

    // --- Stored preferences are loaded ---

    it('reads stored theme from localStorage on mount', () => {
        localStorage.setItem('schafer_theme', 'dark');
        renderWithProviders(<PreferencesPanel />);
        expect(screen.getByRole('button', { name: /dark/i })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: /light/i })).toHaveAttribute('aria-pressed', 'false');
    });

    it('reads stored font size from localStorage on mount', () => {
        localStorage.setItem('schafer_font_size', 'large');
        renderWithProviders(<PreferencesPanel />);
        expect(screen.getByRole('button', { name: /large text size/i })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: /medium text size/i })).toHaveAttribute('aria-pressed', 'false');
    });

    it('reads stored high contrast setting from localStorage on mount', () => {
        localStorage.setItem('schafer_high_contrast', 'true');
        renderWithProviders(<PreferencesPanel />);
        expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    });

    // --- Theme selection ---

    it('clicking Light theme marks it as pressed and deselects Auto', () => {
        renderWithProviders(<PreferencesPanel />);
        fireEvent.click(screen.getByRole('button', { name: /light/i }));
        expect(screen.getByRole('button', { name: /light/i })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: /auto/i })).toHaveAttribute('aria-pressed', 'false');
    });

    it('clicking Dark theme marks it as pressed', () => {
        renderWithProviders(<PreferencesPanel />);
        fireEvent.click(screen.getByRole('button', { name: /dark/i }));
        expect(screen.getByRole('button', { name: /dark/i })).toHaveAttribute('aria-pressed', 'true');
    });

    it('persists selected theme to localStorage', () => {
        renderWithProviders(<PreferencesPanel />);
        fireEvent.click(screen.getByRole('button', { name: /light/i }));
        expect(localStorage.getItem('schafer_theme')).toBe('light');
    });

    it('only one theme button is pressed at a time', () => {
        renderWithProviders(<PreferencesPanel />);
        fireEvent.click(screen.getByRole('button', { name: /light/i }));

        const pressedButtons = screen
            .getAllByRole('button')
            .filter((btn) => ['light', 'dark', 'auto'].some((t) => btn.textContent?.toLowerCase().includes(t)))
            .filter((btn) => btn.getAttribute('aria-pressed') === 'true');

        expect(pressedButtons).toHaveLength(1);
    });

    // --- Font size selection ---

    it('clicking small font size marks it as pressed', () => {
        renderWithProviders(<PreferencesPanel />);
        fireEvent.click(screen.getByRole('button', { name: /small text size/i }));
        expect(screen.getByRole('button', { name: /small text size/i })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: /medium text size/i })).toHaveAttribute('aria-pressed', 'false');
    });

    it('clicking large font size marks it as pressed', () => {
        renderWithProviders(<PreferencesPanel />);
        fireEvent.click(screen.getByRole('button', { name: /large text size/i }));
        expect(screen.getByRole('button', { name: /large text size/i })).toHaveAttribute('aria-pressed', 'true');
    });

    it('persists selected font size to localStorage', () => {
        renderWithProviders(<PreferencesPanel />);
        fireEvent.click(screen.getByRole('button', { name: /large text size/i }));
        expect(localStorage.getItem('schafer_font_size')).toBe('large');
    });

    // --- High Contrast toggle ---

    it('clicking the High Contrast toggle turns it on', () => {
        renderWithProviders(<PreferencesPanel />);
        fireEvent.click(screen.getByRole('switch'));
        expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    });

    it('clicking the High Contrast toggle twice returns it to off', () => {
        renderWithProviders(<PreferencesPanel />);
        const toggle = screen.getByRole('switch');
        fireEvent.click(toggle);
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-checked', 'false');
    });

    it('persists high contrast setting to localStorage', () => {
        renderWithProviders(<PreferencesPanel />);
        fireEvent.click(screen.getByRole('switch'));
        expect(localStorage.getItem('schafer_high_contrast')).toBe('true');
    });

    it('persists high contrast off value when toggled back', () => {
        localStorage.setItem('schafer_high_contrast', 'true');
        renderWithProviders(<PreferencesPanel />);
        fireEvent.click(screen.getByRole('switch'));
        expect(localStorage.getItem('schafer_high_contrast')).toBe('false');
    });
});
