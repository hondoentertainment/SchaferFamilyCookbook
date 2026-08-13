import React, { useState, useEffect } from 'react';
import { getNotesForRecipe, addNote, deleteNote } from '../utils/ratings';
import { FAMILY_PREFS_UPDATED_EVENT } from '../utils/familyPrefsCache';
import { addActivity } from '../utils/activityFeed';
import { formatTimeAgo } from '../utils/activityFeed';
import { hapticLight } from '../utils/haptics';
import type { RecipeNote } from '../types';

interface RecipeNotesProps {
  recipeId: string;
  recipeTitle: string;
  currentUserName: string;
}

export const RecipeNotes: React.FC<RecipeNotesProps> = ({ recipeId, recipeTitle, currentUserName }) => {
  const [notes, setNotes] = useState<RecipeNote[]>(() => getNotesForRecipe(recipeId, currentUserName));
  const [newNote, setNewNote] = useState('');

  // Re-read when a fresh family aggregate arrives (other members' notes).
  useEffect(() => {
    setNotes(getNotesForRecipe(recipeId, currentUserName));
    const onFamilyUpdate = () => setNotes(getNotesForRecipe(recipeId, currentUserName));
    window.addEventListener(FAMILY_PREFS_UPDATED_EVENT, onFamilyUpdate);
    return () => window.removeEventListener(FAMILY_PREFS_UPDATED_EVENT, onFamilyUpdate);
  }, [recipeId, currentUserName]);

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    hapticLight();
    addNote(recipeId, currentUserName, newNote);
    addActivity('note_added', currentUserName, `commented on "${recipeTitle}"`);
    setNotes(getNotesForRecipe(recipeId, currentUserName));
    setNewNote('');
  };

  const handleDelete = (noteId: string) => {
    hapticLight();
    deleteNote(noteId);
    setNotes(getNotesForRecipe(recipeId, currentUserName));
  };

  return (
    <section className="space-y-4" aria-label="Family notes">
      <h4 className="label text-stone-500">
        Family Notes {notes.length > 0 && `(${notes.length})`}
      </h4>

      <div className="flex gap-2">
        <input
          type="text"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
          placeholder="Add a tip or note..."
          className="flex-1 px-4 py-3 bg-stone-50 dark:bg-[var(--input-bg)] border border-stone-200 dark:border-[var(--border-color)] rounded-2xl text-sm font-serif italic outline-none focus:ring-2 focus:ring-[var(--color-brand)]/10 transition-all"
          aria-label="Write a note"
        />
        <button
          type="button"
          onClick={handleAddNote}
          disabled={!newNote.trim()}
          className="px-4 py-3 bg-[var(--color-brand)] text-white rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-[#1e2f23] transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-h-11 min-w-11"
          aria-label="Post note"
        >
          Post
        </button>
      </div>

      {notes.length === 0 ? (
        <p className="text-sm text-stone-400 font-serif italic py-2">
          No notes yet. Be the first to share a tip!
        </p>
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <li
              key={note.id}
              className="flex gap-3 p-3 bg-stone-50 dark:bg-[var(--bg-tertiary)] rounded-2xl border border-stone-100 dark:border-[var(--border-color)] animate-fade-slide-in"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-[var(--color-brand)] dark:text-emerald-400">{note.userName}</span>
                  <span className="text-[10px] text-stone-400">{formatTimeAgo(note.timestamp)}</span>
                </div>
                <p className="text-sm text-stone-700 dark:text-stone-300 font-serif italic">{note.text}</p>
              </div>
              {note.userName === currentUserName && (
                <button
                  type="button"
                  onClick={() => handleDelete(note.id)}
                  className="text-stone-300 hover:text-red-500 transition-colors text-sm self-start min-w-[2rem] min-h-[2rem] flex items-center justify-center"
                  aria-label="Delete note"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
