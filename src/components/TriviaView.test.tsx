import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { TriviaView } from './TriviaView';
import { renderWithProviders, createMockTrivia, createMockContributor } from '../test/utils';
import * as leaderboard from '../services/leaderboard';

vi.mock('../services/leaderboard', async () => {
    const actual = await vi.importActual<typeof import('../services/leaderboard')>(
        '../services/leaderboard'
    );
    return {
        ...actual,
        submitScore: vi.fn(async () => undefined),
        getTopScores: vi.fn(async () => []),
        isLeaderboardAvailable: vi.fn(() => false),
    };
});

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
        vi.mocked(leaderboard.isLeaderboardAvailable).mockReturnValue(false);
        vi.mocked(leaderboard.getTopScores).mockResolvedValue([]);
        vi.mocked(leaderboard.submitScore).mockResolvedValue(undefined);
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

    it('renders leaderboard panel shell on the start screen', () => {
        renderWithProviders(<TriviaView {...defaultProps} />);
        expect(screen.getByTestId('family-leaderboard')).toBeInTheDocument();
        expect(screen.getByText(/Family Leaderboard/)).toBeInTheDocument();
    });

    it('shows offline/unavailable message when Firebase is not configured', async () => {
        vi.mocked(leaderboard.isLeaderboardAvailable).mockReturnValue(false);
        renderWithProviders(<TriviaView {...defaultProps} />);
        await waitFor(() =>
            expect(screen.getByText(/Leaderboard unavailable offline/i)).toBeInTheDocument()
        );
        expect(leaderboard.getTopScores).not.toHaveBeenCalled();
    });

    it('renders top scores from the mock leaderboard', async () => {
        vi.mocked(leaderboard.isLeaderboardAvailable).mockReturnValue(true);
        vi.mocked(leaderboard.getTopScores).mockResolvedValueOnce([
            {
                id: 's1',
                userId: 'u1',
                displayName: 'Grandma Joan',
                score: 5,
                total: 5,
                percentage: 100,
                completedAt: '2026-04-17T10:00:00.000Z',
            },
            {
                id: 's2',
                userId: 'u2',
                displayName: 'Cousin Alex',
                score: 3,
                total: 5,
                percentage: 60,
                completedAt: '2026-04-17T10:05:00.000Z',
            },
        ]);
        renderWithProviders(<TriviaView {...defaultProps} />);
        await waitFor(() => expect(screen.getByText('Grandma Joan')).toBeInTheDocument());
        expect(screen.getByText('Cousin Alex')).toBeInTheDocument();
        expect(screen.getByText('5/5')).toBeInTheDocument();
    });

    it('submits to the leaderboard when the quiz completes and Firebase is available', async () => {
        vi.mocked(leaderboard.isLeaderboardAvailable).mockReturnValue(true);
        renderWithProviders(<TriviaView {...defaultProps} />);
        fireEvent.click(screen.getByText('Begin The Challenge'));

        fireEvent.click(screen.getByText('Love'));
        fireEvent.click(screen.getByText('Next Archival Record'));
        fireEvent.click(screen.getByText('45 min'));
        fireEvent.click(screen.getByText('Finish Archive Challenge'));

        await waitFor(() => expect(leaderboard.submitScore).toHaveBeenCalledTimes(1));
        const call = vi.mocked(leaderboard.submitScore).mock.calls[0][0];
        expect(call.displayName).toBe(mockUser.name);
        expect(call.userId).toBe(mockUser.id);
        expect(call.score).toBe(2);
        expect(call.total).toBe(2);
    });

    it('shows an error state when leaderboard submit fails', async () => {
        vi.mocked(leaderboard.isLeaderboardAvailable).mockReturnValue(true);
        vi.mocked(leaderboard.submitScore).mockRejectedValueOnce(new Error('permission-denied'));
        renderWithProviders(<TriviaView {...defaultProps} />);
        fireEvent.click(screen.getByText('Begin The Challenge'));

        fireEvent.click(screen.getByText('Love'));
        fireEvent.click(screen.getByText('Next Archival Record'));
        fireEvent.click(screen.getByText('45 min'));
        fireEvent.click(screen.getByText('Finish Archive Challenge'));

        await waitFor(() => expect(screen.getByText(/permission-denied/)).toBeInTheDocument());
    });

    it('should end with score 0 when all questions are answered incorrectly', () => {
        renderWithProviders(<TriviaView {...defaultProps} />);
        fireEvent.click(screen.getByText('Begin The Challenge'));

        // Question 1 – wrong answer
        fireEvent.click(screen.getByText('Sugar'));
        fireEvent.click(screen.getByText('Next Archival Record'));

        // Question 2 – wrong answer
        fireEvent.click(screen.getByText('30 min'));
        fireEvent.click(screen.getByText('Finish Archive Challenge'));

        expect(screen.getByText('Legacy Challenge Complete')).toBeInTheDocument();
        expect(screen.getAllByText(/0%/).length).toBeGreaterThanOrEqual(1);
        // Score display should reflect 0 out of 2
        expect(screen.getAllByText(/You scored/).length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText(/0 out of 2/).length).toBeGreaterThanOrEqual(1);
    });

    it('should show a toast error when leaderboard submit throws (Firestore permission denied)', async () => {
        vi.mocked(leaderboard.isLeaderboardAvailable).mockReturnValue(true);
        vi.mocked(leaderboard.submitScore).mockRejectedValueOnce(
            Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' })
        );
        renderWithProviders(<TriviaView {...defaultProps} />);
        fireEvent.click(screen.getByText('Begin The Challenge'));

        fireEvent.click(screen.getByText('Love'));
        fireEvent.click(screen.getByText('Next Archival Record'));
        fireEvent.click(screen.getByText('45 min'));
        fireEvent.click(screen.getByText('Finish Archive Challenge'));

        // The results screen is shown and the error message is surfaced somewhere on screen
        await waitFor(() =>
            expect(screen.getByText('Legacy Challenge Complete')).toBeInTheDocument()
        );
        await waitFor(() =>
            expect(
                screen.getByText(/Missing or insufficient permissions\./i)
            ).toBeInTheDocument()
        );
    });

    it('should select the corresponding answer when keyboard keys 1–4 are pressed', () => {
        renderWithProviders(<TriviaView {...defaultProps} />);
        fireEvent.click(screen.getByText('Begin The Challenge'));

        // Press "1" – should select the first option ("Love", which is the correct answer)
        fireEvent.keyDown(window, { key: '1' });

        expect(screen.getByText('Correct')).toBeInTheDocument();
        expect(screen.getByText('Score: 1')).toBeInTheDocument();
    });

    it('should render an empty state gracefully when trivia list is empty', () => {
        renderWithProviders(<TriviaView {...defaultProps} trivia={[]} />);

        expect(screen.getByText('The Quiz Archive is Empty')).toBeInTheDocument();
        // Start button must NOT be present – quiz can't run without questions
        expect(screen.queryByText('Begin The Challenge')).not.toBeInTheDocument();
    });

    it('renders score breakdown with semantic ul/li list markup', () => {
        renderWithProviders(<TriviaView {...defaultProps} />);
        fireEvent.click(screen.getByText('Begin The Challenge'));

        fireEvent.click(screen.getByText('Love'));
        fireEvent.click(screen.getByText('Next Archival Record'));
        fireEvent.click(screen.getByText('45 min'));
        fireEvent.click(screen.getByText('Finish Archive Challenge'));

        const breakdown = screen.getByLabelText('Question results');
        expect(breakdown.tagName).toBe('UL');
        expect(breakdown.querySelectorAll('li').length).toBe(2);
        expect(breakdown.querySelector('[role="listitem"]')).not.toBeInTheDocument();
    });
});
