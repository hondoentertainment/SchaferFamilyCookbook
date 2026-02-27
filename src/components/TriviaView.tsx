import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Trivia, UserProfile } from '../types';
import { getTriviaScores, addTriviaScore } from '../utils/triviaScoreboard';
import { hapticSuccess, hapticError } from '../utils/haptics';
import type { TriviaScore } from '../types';

const FEEDBACK_DELAY_MS = 1500;

interface TriviaViewProps {
    trivia: Trivia[];
    currentUser: UserProfile;
    isDataLoading?: boolean;
    onAddTrivia: (t: Trivia) => void;
    onDeleteTrivia: (id: string) => void;
}

function Scoreboard({ scores, highlightId }: { scores: TriviaScore[]; highlightId?: string }) {
    if (scores.length === 0) return null;
    return (
        <div className="bg-white/80 backdrop-blur-sm rounded-[2rem] p-6 border border-stone-100 shadow-lg">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4">🏆 Legacy Scoreboard</h4>
            <ol className="space-y-2 max-h-48 overflow-y-auto">
                {scores.map((s, i) => (
                    <li
                        key={s.id}
                        className={`flex justify-between items-center py-2 px-3 rounded-xl text-sm ${
                            s.id === highlightId ? 'bg-[#2D4635]/10 border border-[#2D4635]/30 font-medium' : ''
                        }`}
                    >
                        <span className="flex items-center gap-3">
                            <span className="text-stone-400 w-6 text-right font-mono">{i + 1}.</span>
                            <span className="font-serif">{s.playerName}</span>
                            {s.id === highlightId && (
                                <span className="text-[10px] uppercase tracking-widest text-[#A0522D]">(You)</span>
                            )}
                        </span>
                        <span className="font-mono font-bold text-[#2D4635]">{s.percentage}%</span>
                    </li>
                ))}
            </ol>
        </div>
    );
}

const TriviaSkeleton: React.FC = () => (
    <div className="max-w-3xl mx-auto py-20 px-6 space-y-12 animate-pulse">
        <div className="h-4 bg-stone-200 rounded w-1/3" />
        <div className="h-1.5 bg-stone-100 rounded-full" />
        <div className="bg-white rounded-[3rem] p-8 md:p-16 border border-stone-100 space-y-6">
            <div className="h-8 bg-stone-200 rounded w-4/5" />
            <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-16 bg-stone-100 rounded-2xl" />
                ))}
            </div>
        </div>
    </div>
);

export const TriviaView: React.FC<TriviaViewProps> = ({ trivia, currentUser, isDataLoading }) => {
    const [quizStarted, setQuizStarted] = useState(false);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [showResults, setShowResults] = useState(false);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [isAnswered, setIsAnswered] = useState(false);
    const [reviewMode, setReviewMode] = useState(false);
    const [reviewIndex, setReviewIndex] = useState(0);
    const [answerLog, setAnswerLog] = useState<Array<{ selectedOption: string; isCorrect: boolean }>>([]);
    const [scoreboard, setScoreboard] = useState<TriviaScore[]>(() => getTriviaScores());
    const [lastSavedScoreId, setLastSavedScoreId] = useState<string | undefined>();
    const [ariaAnnouncement, setAriaAnnouncement] = useState('');
    const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const scoreRef = useRef(score);
    const selectedOptionRef = useRef<string | null>(null);
    scoreRef.current = score;
    selectedOptionRef.current = selectedOption;

    const questions = trivia;

    const clearAutoAdvance = useCallback(() => {
        if (autoAdvanceTimerRef.current) {
            clearTimeout(autoAdvanceTimerRef.current);
            autoAdvanceTimerRef.current = null;
        }
    }, []);

    const startQuiz = () => {
        clearAutoAdvance();
        setQuizStarted(true);
        setCurrentQuestionIndex(0);
        setScore(0);
        setShowResults(false);
        setSelectedOption(null);
        setIsAnswered(false);
        setReviewMode(false);
        setReviewIndex(0);
        setAnswerLog([]);
        setLastSavedScoreId(undefined);
        setAriaAnnouncement('');
        setScoreboard(getTriviaScores());
    };

    const goBackToResults = () => {
        setReviewMode(false);
        setReviewIndex(0);
    };

    const handleOptionSelect = (option: string) => {
        if (isAnswered) return;
        clearAutoAdvance();
        setSelectedOption(option);
        setIsAnswered(true);
        const isCorrect = option === questions[currentQuestionIndex].answer;
        const correctAnswer = questions[currentQuestionIndex].answer;
        if (isCorrect) {
            setScore(prev => prev + 1);
            hapticSuccess();
            setAriaAnnouncement(`Correct! The answer was ${correctAnswer}.`);
        } else {
            hapticError();
            setAriaAnnouncement(`Incorrect. The correct answer was ${correctAnswer}.`);
        }
        autoAdvanceTimerRef.current = setTimeout(() => {
            autoAdvanceTimerRef.current = null;
            nextQuestion();
        }, FEEDBACK_DELAY_MS);
    };

    const nextQuestion = () => {
        clearAutoAdvance();
        const sel = selectedOptionRef.current;
        if (sel !== null) {
            setAnswerLog(prev => [...prev, {
                selectedOption: sel,
                isCorrect: sel === questions[currentQuestionIndex].answer,
            }]);
        }
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
            setSelectedOption(null);
            setIsAnswered(false);
            setAriaAnnouncement('');
        } else {
            const finalScore = scoreRef.current;
            const percentage = questions.length > 0 ? Math.round((finalScore / questions.length) * 100) : 0;
            const { scores: updated, newId } = addTriviaScore({
                playerName: currentUser.name,
                score: finalScore,
                totalQuestions: questions.length,
                percentage,
                timestamp: new Date().toISOString(),
            });
            setScoreboard(updated);
            setLastSavedScoreId(newId);
            setShowResults(true);
            const msg = percentage >= 90 ? 'You know the family well!' : percentage >= 70 ? 'Great job!' : 'Keep exploring the archive!';
            setAriaAnnouncement(`Quiz complete. You scored ${finalScore} out of ${questions.length}, ${percentage} percent. ${msg}`);
        }
    };

    useEffect(() => () => clearAutoAdvance(), [clearAutoAdvance]);

    // Keyboard navigation: 1-4 to select option, Enter to advance
    useEffect(() => {
        const currentQuestion = questions[currentQuestionIndex];
        if (!currentQuestion || !quizStarted || showResults) return;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (isAnswered) {
                if (e.key === 'Enter') nextQuestion();
            } else {
                const num = parseInt(e.key, 10);
                if (num >= 1 && num <= 4 && num <= currentQuestion.options.length) {
                    handleOptionSelect(currentQuestion.options[num - 1]);
                }
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [currentQuestionIndex, isAnswered, quizStarted, showResults, questions]);

    if (isDataLoading && questions.length === 0) {
        return <TriviaSkeleton />;
    }

    if (questions.length === 0) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-6">
                <span className="text-6xl">📖</span>
                <h2 className="text-3xl font-serif italic text-[#2D4635]">The Quiz Archive is Empty</h2>
                <p className="text-stone-400 max-w-md italic">Please add some trivia questions via the Admin panel to begin your family legacy challenge.</p>
            </div>
        );
    }

    if (!quizStarted) {
        return (
            <div className="max-w-4xl mx-auto py-20 px-6 space-y-12 animate-in fade-in zoom-in duration-1000">
                <div className="text-center space-y-6">
                    <div className="w-24 h-24 bg-orange-50 rounded-full mx-auto flex items-center justify-center text-4xl shadow-inner border border-stone-100 mb-8">🎓</div>
                    <h2 className="text-6xl font-serif italic text-[#2D4635]">Family Heritage Quiz</h2>
                    <p className="text-stone-400 font-serif max-w-lg mx-auto italic text-lg leading-relaxed">
                        Test your knowledge of the Schafer / Oehler legacy through {questions.length} questions curated from our history and recipes.
                    </p>
                    <button
                        onClick={startQuiz}
                        className="mt-8 px-12 py-5 bg-[#2D4635] text-white rounded-full text-xs font-black uppercase tracking-[0.3em] shadow-2xl hover:scale-105 active:scale-95 transition-all"
                    >
                        Begin The Challenge
                    </button>
                    <p className="text-[10px] text-stone-300 uppercase tracking-widest mt-8">Prove your status as a legacy keeper</p>
                </div>
                <div className="mt-12 max-w-md mx-auto">
                    <Scoreboard scores={scoreboard} />
                </div>
            </div>
        );
    }

    if (showResults && reviewMode) {
        const q = questions[reviewIndex];
        const log = answerLog[reviewIndex];
        return (
            <div className="max-w-3xl mx-auto py-20 px-6 space-y-10 animate-in slide-in-from-bottom-8 duration-500">
                <div className="flex justify-between items-center">
                    <button
                        onClick={goBackToResults}
                        className="text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-[#2D4635] transition-colors"
                    >
                        ← Back to results
                    </button>
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#A0522D]">
                        Review {reviewIndex + 1} of {questions.length}
                    </span>
                </div>

                <div className="bg-white rounded-[3rem] p-6 md:p-12 border border-stone-100 shadow-2xl space-y-6">
                    <h3 className="text-2xl font-serif text-[#2D4635] leading-snug">{q.question}</h3>
                    {log && (
                        <div className="space-y-4">
                            <div className={log.isCorrect ? 'p-4 rounded-2xl bg-[#2D4635]/10 border border-[#2D4635]/30' : 'p-4 rounded-2xl bg-stone-100 border border-stone-200'}>
                                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Your answer</p>
                                <p className="font-serif">{log.selectedOption}</p>
                                {log.isCorrect ? <p className="text-sm text-[#2D4635] font-medium mt-2">✓ Correct</p> : null}
                            </div>
                            {!log.isCorrect && (
                                <div className="p-4 rounded-2xl bg-[#2D4635]/5 border border-[#2D4635]/20">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Correct answer</p>
                                    <p className="font-serif text-[#2D4635] font-medium">{q.answer}</p>
                                </div>
                            )}
                            {q.explanation && (
                                <div className="p-4 bg-orange-50/50 rounded-2xl text-sm italic text-[#A0522D] font-serif">
                                    {q.explanation}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex justify-between items-center">
                    <button
                        onClick={() => setReviewIndex(i => Math.max(0, i - 1))}
                        disabled={reviewIndex === 0}
                        className="px-6 py-3 bg-stone-100 text-stone-600 rounded-full text-[10px] font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-200 transition-all"
                    >
                        Previous
                    </button>
                    <button
                        onClick={() => setReviewIndex(i => Math.min(questions.length - 1, i + 1))}
                        disabled={reviewIndex === questions.length - 1}
                        className="px-6 py-3 bg-[#2D4635] text-white rounded-full text-[10px] font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#3d5745] transition-all"
                    >
                        Next
                    </button>
                </div>
            </div>
        );
    }

    if (showResults) {
        const percentage = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
        const celebratoryMessage = percentage >= 90
            ? "You know the family well!"
            : percentage >= 70
                ? "Great job! You have a strong grasp of our family's flavor and history."
                : "Keep exploring the archive—every recipe tells a story.";
        return (
            <div className="max-w-3xl mx-auto py-20 px-6 text-center space-y-12 animate-in zoom-in duration-700">
                <div className="sr-only" aria-live="polite" aria-atomic="true" role="status">
                    {ariaAnnouncement}
                </div>
                <div className="space-y-6">
                    <div className="w-32 h-32 bg-[#2D4635] text-white rounded-full mx-auto flex flex-col items-center justify-center shadow-2xl ring-8 ring-[#F4A460]/20 animate-in zoom-in duration-500" role="img" aria-label={`Score: ${score} out of ${questions.length}, ${percentage} percent`}>
                        <span className="text-4xl font-black tabular-nums">{percentage}%</span>
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-80 mt-1">{score}/{questions.length}</span>
                    </div>
                    <h2 className="text-5xl font-serif italic text-[#2D4635] animate-in fade-in slide-in-from-bottom-2 duration-500">Legacy Challenge Complete</h2>
                    <p className="text-stone-500 font-serif italic text-xl">
                        You scored <span className="text-[#2D4635] font-bold">{score}</span> out of <span className="font-bold text-stone-700">{questions.length}</span> questions.
                    </p>
                    <p className="text-lg font-serif text-[#F4A460] font-medium animate-in fade-in duration-700 delay-300">
                        {celebratoryMessage}
                    </p>
                </div>

                {answerLog.length > 0 && (
                    <div className="bg-white rounded-[3rem] p-6 md:p-8 border border-stone-100 shadow-xl text-left">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4">Score breakdown</h4>
                        <div className="flex flex-wrap gap-2" role="list" aria-label="Question results">
                            {answerLog.map((log, i) => (
                                <span
                                    key={i}
                                    role="listitem"
                                    className={`inline-flex items-center justify-center w-10 h-10 rounded-xl text-sm font-bold ${
                                        log.isCorrect
                                            ? 'bg-[#2D4635]/15 text-[#2D4635] border border-[#2D4635]/30'
                                            : 'bg-stone-100 text-stone-500 border border-stone-200'
                                    }`}
                                    title={log.isCorrect ? `Question ${i + 1}: Correct` : `Question ${i + 1}: Incorrect`}
                                >
                                    {log.isCorrect ? '✓' : '✗'}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                <div className="max-w-md mx-auto">
                    <Scoreboard scores={scoreboard} highlightId={lastSavedScoreId} />
                </div>

                <div className="flex flex-col items-center gap-6">
                    <div className="flex flex-wrap justify-center gap-4">
                        <button
                            onClick={startQuiz}
                            className="px-10 py-4 bg-stone-100 text-[#2D4635] rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-[#2D4635] hover:text-white transition-all shadow-md"
                        >
                            Try Again
                        </button>
                        <button
                            onClick={() => setReviewMode(true)}
                            className="px-10 py-4 bg-white border-2 border-[#2D4635] text-[#2D4635] rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-[#2D4635] hover:text-white transition-all shadow-md"
                        >
                            Review answers
                        </button>
                    </div>
                    <p className="text-[10px] text-stone-300 italic">Scores saved to the family scoreboard.</p>
                </div>
            </div>
        );
    }

    const currentQuestion = questions[currentQuestionIndex];

    return (
        <div className="max-w-3xl mx-auto py-20 px-6 space-y-12 animate-in slide-in-from-bottom-8 duration-500">
            <div
                className="sr-only"
                aria-live="assertive"
                aria-atomic="true"
                role="status"
            >
                {ariaAnnouncement}
            </div>
            <div className="flex justify-between items-end">
                <div className="space-y-1">
                    <span className="text-xs font-black uppercase tracking-widest text-[#A0522D]" role="status" aria-live="polite">
                        Question {currentQuestionIndex + 1} of {questions.length}
                    </span>
                    <h2 className="text-sm font-serif italic text-stone-400">Archival Verification In Progress...</h2>
                </div>
                <div className="text-xs font-black text-stone-300">Score: {score}</div>
            </div>

            {/* Progress Bar */}
            <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden shadow-inner">
                <div
                    className="h-full bg-[#2D4635] transition-all duration-700 ease-out"
                    style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                />
            </div>

            <div className="bg-white rounded-[3rem] md:rounded-[4rem] p-6 md:p-16 border border-stone-100 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-800 via-[#F4A460] to-emerald-800 opacity-50" />

                <h3 className="text-2xl md:text-3xl font-serif text-[#2D4635] mb-8 md:mb-12 leading-snug">
                    {currentQuestion.question}
                </h3>

                {/* Correct/Incorrect feedback banner */}
                {isAnswered && (
                    <div
                        className={`mb-8 p-6 rounded-2xl border-2 animate-in fade-in slide-in-from-top-2 duration-300 ${
                            selectedOption === currentQuestion.answer
                                ? 'bg-[#2D4635]/10 border-[#2D4635]/40'
                                : 'bg-stone-100 border-stone-200'
                        }`}
                        role="alert"
                        aria-live="polite"
                    >
                        {selectedOption === currentQuestion.answer ? (
                            <div className="flex items-center gap-4">
                                <span className="text-4xl text-[#2D4635]">✓</span>
                                <div>
                                    <span className="text-lg font-serif italic font-bold text-[#2D4635]">Correct!</span>
                                    <p className="text-sm text-stone-600 mt-1">You know your family legacy well.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-start gap-4">
                                <span className="text-4xl text-stone-400">✗</span>
                                <div className="flex-1">
                                    <span className="text-lg font-serif italic font-bold text-stone-600">Incorrect</span>
                                    <p className="text-sm text-stone-600 mt-1">
                                        The correct answer was: <strong className="text-[#2D4635]">{currentQuestion.answer}</strong>
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="grid gap-3 md:gap-4" role="group" aria-label="Answer options">
                    {currentQuestion.options.map((opt, i) => {
                        const isCorrect = opt === currentQuestion.answer;
                        const isSelected = selectedOption === opt;

                        let buttonStyles = "bg-stone-50 hover:bg-stone-100 text-stone-700 focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2";
                        if (isAnswered) {
                            if (isCorrect) buttonStyles = "bg-[#2D4635] text-white shadow-lg ring-4 ring-[#2D4635]/20";
                            else if (isSelected) buttonStyles = "bg-stone-400 text-white opacity-90 scale-95";
                            else buttonStyles = "bg-stone-50 text-stone-300 opacity-50";
                        }

                        return (
                            <button
                                key={i}
                                ref={el => { optionRefs.current[i] = el; }}
                                disabled={isAnswered}
                                onClick={() => handleOptionSelect(opt)}
                                className={`p-4 md:p-6 text-left rounded-2xl md:rounded-3xl transition-all font-serif text-base md:text-lg flex justify-between items-center group/btn relative overflow-hidden ${buttonStyles}`}
                                aria-pressed={isSelected}
                                aria-label={`${String.fromCharCode(65 + i)}: ${opt}${isAnswered ? (isCorrect ? ' (Correct answer)' : isSelected ? ' (Your answer - incorrect)' : '') : ''}`}
                            >
                                <span className="relative z-10 flex items-center gap-3">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 shrink-0 w-6">
                                        {i + 1}.
                                    </span>
                                    {opt}
                                </span>
                                {isAnswered && isCorrect && <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full">Correct</span>}
                                {isAnswered && isSelected && !isCorrect && <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full">Incorrect</span>}
                            </button>
                        );
                    })}
                </div>

                {isAnswered && (
                    <div className="mt-12 pt-10 border-t border-stone-50 animate-in fade-in slide-in-from-top-4 duration-500 text-center space-y-8">
                        <p className="text-[10px] text-stone-400 uppercase tracking-widest">Advancing in 1.5s — or press Enter now</p>
                        {currentQuestion.explanation && (
                            <div className="p-6 bg-orange-50/50 rounded-[2rem] text-sm italic text-[#A0522D] font-serif leading-relaxed">
                                {currentQuestion.explanation}
                            </div>
                        )}
                        <button
                            onClick={nextQuestion}
                            className="px-12 py-4 bg-[#2D4635] text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#2D4635]"
                        >
                            {currentQuestionIndex === questions.length - 1 ? "Finish Archive Challenge" : "Next Archival Record"}
                        </button>
                    </div>
                )}
            </div>

            <div className="text-center">
                <p className="text-[10px] text-stone-300 uppercase tracking-[0.3em]">Knowledge is the ingredient of survival.</p>
            </div>
        </div>
    );
};
