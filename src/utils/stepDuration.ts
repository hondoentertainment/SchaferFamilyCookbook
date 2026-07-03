/**
 * Parse a cooking duration out of an instruction step, e.g.
 * "Bake for 30 minutes" → 30, "simmer 10-12 mins" → 10.
 * Returns the first (lower-bound) minutes value, or null when the step
 * has no parseable duration.
 */
export function getStepMinutes(step: string | null | undefined): number | null {
    if (!step) return null;
    const match = /(\d+)\s*(?:-|–|to)?\s*(?:\d+)?\s*(?:minutes?|mins?)/i.exec(step);
    if (!match) return null;
    const minutes = parseInt(match[1]!, 10);
    return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
}

/** Format a countdown as m:ss (e.g. 90 → "1:30"). */
export function formatTimer(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
