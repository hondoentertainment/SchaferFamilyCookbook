import React, { useState } from 'react';
import { Trivia, UserProfile } from '../../types';
import { useUI } from '../../context/UIContext';
import { useDebounceAction } from '../../hooks';

export interface TriviaFormProps {
    trivia: Trivia[];
    currentUser: UserProfile | null;
    onSave: (t: Trivia) => Promise<void>;
    onDelete: (id: string) => void | Promise<void>;
}

export const TriviaForm: React.FC<TriviaFormProps> = ({
    trivia,
    currentUser,
    onSave,
    onDelete,
}) => {
    const { toast, confirm } = useUI();

    const [triviaForm, setTriviaForm] = useState<Partial<Trivia>>({ question: '', options: ['', '', '', ''], answer: '' });
    const [editingTrivia, setEditingTrivia] = useState<Trivia | null>(null);
    const [isTriviaSubmitting, setIsTriviaSubmitting] = useState(false);

    const debouncedSave = useDebounceAction(async () => {
        setIsTriviaSubmitting(true);
        try {
            await onSave({
                ...(triviaForm as Trivia),
                id: editingTrivia?.id || 't_' + Date.now(),
                contributor: editingTrivia?.contributor || currentUser?.name || 'Unknown'
            });
            toast(editingTrivia ? 'Trivia updated' : 'Trivia added', 'success');
            setTriviaForm({ question: '', options: ['', '', '', ''], answer: '' });
            setEditingTrivia(null);
        } finally { setIsTriviaSubmitting(false); }
    });

    return (
        <section className="space-y-6 animate-in fade-in">
            <h3 className="text-xl font-serif italic text-[#A0522D] flex items-center gap-3">
                <span className="w-10 h-10 rounded-full bg-[#A0522D]/5 flex items-center justify-center not-italic">💡</span>
                Family Trivia
            </h3>
            <form onSubmit={async (e) => {
                e.preventDefault();
                if (!triviaForm.question?.trim()) {
                    toast('Question is required.', 'error');
                    return;
                }
                await debouncedSave();
            }} className="space-y-4">
                <div>
                    <label htmlFor="admin-trivia-question" className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2 block mb-1">Question</label>
                    <input id="admin-trivia-question" placeholder="e.g. Who grew up on the Schafer farm?" className="w-full p-4 border border-stone-200 rounded-2xl text-base outline-none focus:ring-2 focus:ring-[#2D4635]/20" value={triviaForm.question} onChange={e => setTriviaForm({ ...triviaForm, question: e.target.value })} aria-required="true" />
                </div>
                <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2 block mb-2">Options (2–4)</span>
                    <div className="grid grid-cols-2 gap-3">
                    {triviaForm.options?.map((opt, i) => (
                        <div key={i}>
                            <label htmlFor={`admin-trivia-opt-${i}`} className="sr-only">Option {i + 1}</label>
                            <input id={`admin-trivia-opt-${i}`} placeholder={`Option ${i + 1}`} className="p-3 border border-stone-200 rounded-xl text-base min-h-[2.75rem] focus:ring-2 focus:ring-[#2D4635]/20 outline-none w-full" value={opt} onChange={e => { const n = [...(triviaForm.options || [])]; n[i] = e.target.value; setTriviaForm({ ...triviaForm, options: n }) }} />
                        </div>
                    ))}
                    </div>
                </div>
                <div>
                    <label htmlFor="admin-trivia-answer" className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2 block mb-1">Correct Answer</label>
                    <input id="admin-trivia-answer" placeholder="Correct Answer" className="w-full p-4 border border-stone-200 rounded-2xl text-base font-bold bg-stone-50 focus:ring-2 focus:ring-[#2D4635]/20 outline-none" value={triviaForm.answer} onChange={e => setTriviaForm({ ...triviaForm, answer: e.target.value })} />
                </div>
                <div className="flex gap-4">
                    <button type="submit" disabled={isTriviaSubmitting} aria-busy={isTriviaSubmitting} className="flex-1 py-4 bg-[#2D4635] text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-md disabled:opacity-70 disabled:cursor-not-allowed">
                        {isTriviaSubmitting ? 'Saving...' : editingTrivia ? 'Update Question' : 'Add Question'}
                    </button>
                    {editingTrivia && <button type="button" onClick={() => { setEditingTrivia(null); setTriviaForm({ question: '', options: ['', '', '', ''], answer: '' }); }} disabled={isTriviaSubmitting} className="flex-1 py-4 border border-stone-200 rounded-full text-[10px] font-black uppercase text-stone-400 disabled:opacity-70">Cancel</button>}
                </div>
            </form>
            <div className="pt-8 border-t border-stone-200 max-h-96 overflow-y-auto custom-scrollbar rounded-[2rem] p-4 bg-stone-50/50 border border-stone-100">
                <h4 className="text-[10px] font-black uppercase text-stone-500 mb-4">Current Questions</h4>
                {trivia.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-3 bg-white rounded-2xl mb-2 group border border-stone-100 shadow-sm">
                        <div
                            className="flex flex-col truncate flex-1 cursor-pointer"
                            role="button"
                            tabIndex={0}
                            onClick={() => { setEditingTrivia(t); setTriviaForm(t); }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setEditingTrivia(t);
                                    setTriviaForm(t);
                                }
                            }}
                            aria-label={`Edit question: ${t.question}`}
                        >
                            <span className="text-xs truncate font-bold text-[#2D4635]">{t.question}</span>
                            <span className="text-[9px] uppercase tracking-widest text-stone-400">Click to edit</span>
                        </div>
                        <button
                            onClick={async () => {
                                const ok = await confirm(`Are you sure you want to delete "${t.question}"?`, { title: 'Confirm Delete', variant: 'danger', confirmLabel: 'Delete', cancelLabel: 'Keep' });
                                if (ok) {
                                    await onDelete(t.id);
                                    toast('Trivia deleted', 'success');
                                }
                            }}
                            className="min-w-[2.75rem] min-h-[2.75rem] flex items-center justify-center text-stone-300 hover:text-red-500 transition-all ml-4 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                            aria-label={`Delete question: ${t.question}`}
                        >
                            ✕
                        </button>
                    </div>
                ))}
            </div>
        </section>
    );
};
