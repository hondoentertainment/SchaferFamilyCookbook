import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { TriviaView } from './TriviaView';
import { renderWithProviders, createMockTrivia, createMockContributor } from '../test/utils';

describe('TriviaView', () => {
    const mockOnAddTrivia = vi.fn();
    const mockOnDeleteTrivia = vi.fn();
    const mockUser = createMockContributor();
    const mockTrivia = [
        createMockTrivia({
            id: 't1',
            question: 'What is Grandma\'s secret ingredient?',
            options: ['Love', 'Sugar', 'Cinnamon', 'Butter'],
            answer: 'Love',
            explanation: 'She always says love is the most important ingredient.'
        }),
        createMockTrivia({
            id: 't2',
            question: 'How long do you bake the bread?',
            options: ['30 min', '45 min', '1 hour', '2 hours'],
            answer: '45 min'
        })
    ];

    const defaultProps = {
        trivia: mockTrivia,
        currentUser: {
            id: mockUser.id,
            name: mockUser.name,
            picture: mockUser.avatar,
            role: mockUser.role,
            email: mockUser.email
        },
        onAddTrivia: mockOnAddTrivia,
        onDeleteTrivia: mockOnDeleteTrivia,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.removeItem('schafer_trivia_scores');
    });

    it('should render start screen when quiz has not started', () => {
        renderWithProviders(<TriviaView {...defaultProps} />);

        expect(screen.getByText('Family Heritage Quiz')).toBeInTheDocument();
        expect(screen.getByText(/Test your knowledge/)).toBeInTheDocument();
        expect(screen.getByText('Begin The Challenge')).toBeInTheDocument();
    });

    it('should show empty state when no trivia exists', () => {
        renderWithProviders(<TriviaView {...defaultProps} trivia={[]} />);

        expect(screen.getByText('The Quiz Archive is Empty')).toBeInTheDocument();
    });

    it('should start quiz when button is clicked', () => {
        renderWithProviders(<TriviaView {...defaultProps} />);

        fireEvent.click(screen.getByText('Begin The Challenge'));

        expect(screen.getByText('Question 1 of 2')).toBeInTheDocument();
        expect(screen.getByText('What is Grandma\'s secret ingredient?')).toBeInTheDocument();
    });

    it('should handle correct answer selection', () => {
        renderWithProviders(<TriviaView {...defaultProps} />);
        fireEvent.click(screen.getByText('Begin The Challenge'));

        fireEvent.click(screen.getByText('Love'));

        expect(screen.getByText('Correct')).toBeInTheDocument();
        expect(screen.getByText('Score: 1')).toBeInTheDocument();
        expect(screen.getByText(mockTrivia[0].explanation!)).toBeInTheDocument();
    });

    it('should handle incorrect answer selection', () => {
        renderWithProviders(<TriviaView {...defaultProps} />);
        fireEvent.click(screen.getByText('Begin The Challenge'));

        fireEvent.click(screen.getByText('Sugar'));

        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent('Incorrect');
        expect(alert).toHaveTextContent('The correct answer was:');
        expect(alert).toHaveTextContent('Love');
        expect(screen.getByText('Score: 0')).toBeInTheDocument();
    });

    it('should navigate through all questions and show results', () => {
        renderWithProviders(<TriviaView {...defaultProps} />);
        fireEvent.click(screen.getByText('Begin The Challenge'));

        // Question 1
        fireEvent.click(screen.getByText('Love'));
        fireEvent.click(screen.getByText('Next Archival Record'));

        // Question 2
        expect(screen.getByText('Question 2 of 2')).toBeInTheDocument();
        fireEvent.click(screen.getByText('45 min'));
        fireEvent.click(screen.getByText('Finish Archive Challenge'));

        // Results (multiple elements contain "You scored" - sr-only and visible)
        expect(screen.getByText('Legacy Challenge Complete')).toBeInTheDocument();
        expect(screen.getAllByText(/You scored/).length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText(/100%/).length).toBeGreaterThanOrEqual(1);
    });

    it('should allow restarting the quiz', () => {
        renderWithProviders(<TriviaView {...defaultProps} />);
        fireEvent.click(screen.getByText('Begin The Challenge'));

        // Answer and finish
        fireEvent.click(screen.getByText('Love'));
        fireEvent.click(screen.getByText('Next Archival Record'));
        fireEvent.click(screen.getByText('45 min'));
        fireEvent.click(screen.getByText('Finish Archive Challenge'));

        // Restart
        fireEvent.click(screen.getByText('Try Again'));

        expect(screen.getByText('Question 1 of 2')).toBeInTheDocument();
    });

    it('should show scoreboard on results screen after completing quiz', () => {
        renderWithProviders(<TriviaView {...defaultProps} />);
        fireEvent.click(screen.getByText('Begin The Challenge'));

        fireEvent.click(screen.getByText('Love'));
        fireEvent.click(screen.getByText('Next Archival Record'));
        fireEvent.click(screen.getByText('45 min'));
        fireEvent.click(screen.getByText('Finish Archive Challenge'));

        expect(screen.getByText(/Legacy Scoreboard/)).toBeInTheDocument();
        expect(screen.getByText(/Scores saved to the family scoreboard/)).toBeInTheDocument();
    });
});
