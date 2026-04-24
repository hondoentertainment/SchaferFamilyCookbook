import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { StarRating } from './StarRating';
import { renderWithProviders } from '../test/utils';

// hapticLight is called on click; mock so it doesn't throw in jsdom
vi.mock('../utils/haptics', () => ({ hapticLight: vi.fn() }));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('StarRating', () => {
    // -----------------------------------------------------------------------
    // Star count
    // -----------------------------------------------------------------------
    it('renders exactly 5 star buttons', () => {
        renderWithProviders(<StarRating rating={3} />);
        const stars = screen.getAllByRole('button');
        expect(stars).toHaveLength(5);
    });

    // -----------------------------------------------------------------------
    // Highlighted stars match the rating
    // -----------------------------------------------------------------------
    it('fills stars up to the rounded rating value', () => {
        renderWithProviders(<StarRating rating={3} />);
        const stars = screen.getAllByRole('button');
        // First 3 should show a filled star (★), last 2 empty (☆)
        expect(stars[0].textContent).toBe('★');
        expect(stars[1].textContent).toBe('★');
        expect(stars[2].textContent).toBe('★');
        expect(stars[3].textContent).toBe('☆');
        expect(stars[4].textContent).toBe('☆');
    });

    // -----------------------------------------------------------------------
    // Zero rating – no stars highlighted
    // -----------------------------------------------------------------------
    it('shows no highlighted stars for a zero rating', () => {
        renderWithProviders(<StarRating rating={0} />);
        const stars = screen.getAllByRole('button');
        stars.forEach((star) => expect(star.textContent).toBe('☆'));
    });

    // -----------------------------------------------------------------------
    // Clicking calls onChange with correct value
    // -----------------------------------------------------------------------
    it('calls onRate with the clicked star value', () => {
        const onRate = vi.fn();
        renderWithProviders(<StarRating rating={2} onRate={onRate} />);

        const stars = screen.getAllByRole('button');
        fireEvent.click(stars[4]); // 5th star → value 5

        expect(onRate).toHaveBeenCalledTimes(1);
        expect(onRate).toHaveBeenCalledWith(5);
    });

    it('calls onRate with value 1 when the first star is clicked', () => {
        const onRate = vi.fn();
        renderWithProviders(<StarRating rating={0} onRate={onRate} />);

        fireEvent.click(screen.getAllByRole('button')[0]);

        expect(onRate).toHaveBeenCalledWith(1);
    });

    // -----------------------------------------------------------------------
    // Read-only mode – buttons disabled, onChange not called
    // -----------------------------------------------------------------------
    it('disables all star buttons in read-only mode', () => {
        renderWithProviders(<StarRating rating={4} readOnly />);
        const stars = screen.getAllByRole('button');
        stars.forEach((star) => expect(star).toBeDisabled());
    });

    it('does not call onRate when clicked in read-only mode', () => {
        const onRate = vi.fn();
        renderWithProviders(<StarRating rating={3} onRate={onRate} readOnly />);

        fireEvent.click(screen.getAllByRole('button')[2]);

        expect(onRate).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // Accessibility
    // -----------------------------------------------------------------------
    it('wraps stars in a group with an accessible label describing the rating', () => {
        renderWithProviders(<StarRating rating={3.7} />);
        // Component uses role="group" and aria-label="Rating: X.X out of 5"
        const group = screen.getByRole('group');
        expect(group).toHaveAttribute('aria-label', 'Rating: 3.7 out of 5');
    });

    it('each star button has an aria-label identifying its numeric value', () => {
        renderWithProviders(<StarRating rating={2} />);
        expect(screen.getByRole('button', { name: '1 star' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '2 stars' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '3 stars' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '4 stars' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '5 stars' })).toBeInTheDocument();
    });

    // -----------------------------------------------------------------------
    // Optional count display
    // -----------------------------------------------------------------------
    it('shows the review count when showCount is provided', () => {
        renderWithProviders(<StarRating rating={4} showCount={42} />);
        expect(screen.getByText('(42)')).toBeInTheDocument();
    });

    it('does not render a count when showCount is omitted', () => {
        renderWithProviders(<StarRating rating={4} />);
        expect(screen.queryByText(/\(\d+\)/)).not.toBeInTheDocument();
    });
});
