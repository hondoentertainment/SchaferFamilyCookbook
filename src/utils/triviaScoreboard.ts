import { TriviaScore } from '../types';

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

export function addTriviaScore(entry: Omit<TriviaScore, 'id'>): { scores: TriviaScore[]; newId: string } {
  const full: TriviaScore = {
    ...entry,
    id: `score_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
  };
  const current = getTriviaScores();
  const updated = [...current, full].sort((a, b) => {
    if (b.percentage !== a.percentage) return b.percentage - a.percentage;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
  const trimmed = updated.slice(0, MAX_ENTRIES);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  return { scores: trimmed, newId: full.id };
}
