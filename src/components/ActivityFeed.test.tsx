import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { ActivityFeed } from './ActivityFeed';
import { renderWithProviders } from '../test/utils';
import type { ActivityEvent } from '../utils/activityFeed';

vi.mock('../utils/activityFeed', () => ({
    getActivityFeed: vi.fn(() => [] as ActivityEvent[]),
    formatTimeAgo: vi.fn(() => 'just now'),
    getActivityIcon: vi.fn(() => '⭐'),
}));

import { getActivityFeed } from '../utils/activityFeed';

const mockGetFeed = getActivityFeed as ReturnType<typeof vi.fn>;

const makeEvent = (overrides: Partial<ActivityEvent> = {}): ActivityEvent =>
    ({
        id: 'evt-1',
        type: 'recipe_rated',
        userName: 'Alice',
        summary: 'rated "Pie" 5 stars',
        timestamp: new Date().toISOString(),
        ...overrides,
    }) as ActivityEvent;

describe('ActivityFeed', () => {
    beforeEach(() => {
        mockGetFeed.mockReturnValue([]);
    });

    it('renders the empty state when there is no activity', () => {
        renderWithProviders(<ActivityFeed />);
        expect(screen.getByText(/no activity yet/i)).toBeInTheDocument();
    });

    it('renders a list of activity events', () => {
        mockGetFeed.mockReturnValue([
            makeEvent({ id: 'e1', summary: 'rated "Pie" 5 stars' }),
            makeEvent({ id: 'e2', summary: 'left a note on "Fudge"' }),
        ]);
        renderWithProviders(<ActivityFeed />);
        expect(screen.getByRole('list', { name: /family activity feed/i })).toBeInTheDocument();
        expect(screen.getAllByRole('listitem')).toHaveLength(2);
    });

    it('caps the feed at maxItems', () => {
        mockGetFeed.mockReturnValue(
            Array.from({ length: 10 }, (_, i) => makeEvent({ id: `e${i}` })),
        );
        renderWithProviders(<ActivityFeed maxItems={3} />);
        expect(screen.getAllByRole('listitem')).toHaveLength(3);
    });
});
