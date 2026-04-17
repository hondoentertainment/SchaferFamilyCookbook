import { TriviaScore } from '../types';
import { CloudArchive } from '../services/db';

const STORAGE_KEY = 'schafer_trivia_scores';
const MAX_ENTRIES = 25;

export function getTriviaScores(): TriviaScore[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TriviaScore[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function sortScores(scores: TriviaScore[]): TriviaScore[] {
  return [...scores].sort((a, b) => {
    if (b.percentage !== a.percentage) return b.percentage - a.percentage;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
}

export function addTriviaScore(entry: Omit<TriviaScore, 'id'>): { scores: TriviaScore[]; newId: string } {
  const full: TriviaScore = {
    ...entry,
    id: `score_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
  };
  const current = getTriviaScores();
  const trimmed = sortScores([...current, full]).slice(0, MAX_ENTRIES);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));

  // Best-effort cloud write when Firebase is active. Failures are silent — local save already succeeded.
  if (CloudArchive.getProvider() === 'firebase') {
    CloudArchive.addTriviaScoreCloud(full).catch((err) => {
      console.warn('Trivia cloud score write failed:', err);
    });
  }

  return { scores: trimmed, newId: full.id };
}

export { MAX_ENTRIES };
