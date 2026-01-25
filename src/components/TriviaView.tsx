import React, { useState } from 'react';
import { Trivia, UserProfile } from '../types';

interface TriviaViewProps {
    trivia: Trivia[];
    currentUser: UserProfile;
    onAddTrivia: (t: Trivia) => void;
    onDeleteTrivia: (id: string) => void;
}

export const TriviaView: React.FC<TriviaViewProps> = ({ trivia, currentUser }) => {
    const [quizStarted, setQuizStarted] = useState(false);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [showResults, setShowResults] = useState(false);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [isAnswered, setIsAnswered] = useState(false);

    const questions = trivia;

    const startQuiz = () => {
        setQuizStarted(true);
        setCurrentQuestionIndex(0);
        setScore(0);
        setShowResults(false);
        setSelectedOption(null);
        setIsAnswered(false);
    };

    const handleOptionSelect = (option: string) => {
        if (isAnswered) return;
        setSelectedOption(option);
        setIsAnswered(true);
        if (option === questions[currentQuestionIndex].answer) {
            setScore(prev => prev + 1);
        }
    };

    const nextQuestion = () => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
            setSelectedOption(null);
            setIsAnswered(false);
        } else {
            setShowResults(true);
        }
    };

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
            </div>
        );
    }

    if (showResults) {
        const percentage = Math.round((score / questions.length) * 100);
        return (
            <div className="max-w-3xl mx-auto py-20 px-6 text-center space-y-12 animate-in zoom-in duration-700">
                <div className="space-y-6">
                    <div className="w-32 h-32 bg-[#2D4635] text-white rounded-full mx-auto flex items-center justify-center text-4xl shadow-2xl ring-8 ring-stone-50">
                        {percentage}%
                    </div>
                    <h2 className="text-5xl font-serif italic text-[#2D4635]">Legacy Challenge Complete</h2>
                    <p className="text-stone-500 font-serif italic text-xl">
                        You scored <span className="text-[#A0522D] font-bold">{score}</span> out of <span className="font-bold">{questions.length}</span> questions.
                    </p>
                </div>

                <div className="bg-white rounded-[3rem] p-10 border border-stone-100 shadow-xl space-y-6">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-400">Archives Evaluated</h4>
                    <p className="text-stone-800 font-serif italic leading-relaxed">
                        {percentage >= 90 ? "A true historian of the Schafer line! Your knowledge is unmatched." :
                            percentage >= 70 ? "Well done! You have a strong grasp of our family's flavor and history." :
                                "Practical experience is the best teacher—keep exploring the archive!"}
                    </p>
                </div>

                <div className="flex flex-col items-center gap-6">
                    <button
                        onClick={startQuiz}
                        className="px-10 py-4 bg-stone-100 text-[#2D4635] rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-[#2D4635] hover:text-white transition-all shadow-md"
                    >
                        Try Again
                    </button>
                    <p className="text-[10px] text-stone-300 italic">Total completion tracked for your current session.</p>
                </div>
            </div>
        );
    }

    const currentQuestion = questions[currentQuestionIndex];

    return (
        <div className="max-w-3xl mx-auto py-20 px-6 space-y-12 animate-in slide-in-from-bottom-8 duration-500">
            <div className="flex justify-between items-end">
                <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#A0522D]">Question {currentQuestionIndex + 1} of {questions.length}</span>
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

            <div className="bg-white rounded-[4rem] p-10 md:p-16 border border-stone-100 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-800 via-[#F4A460] to-emerald-800 opacity-50" />

                <h3 className="text-3xl font-serif text-[#2D4635] mb-12 leading-snug">
                    {currentQuestion.question}
                </h3>

                <div className="grid gap-4">
                    {currentQuestion.options.map((opt, i) => {
                        const isCorrect = opt === currentQuestion.answer;
                        const isSelected = selectedOption === opt;

                        let buttonStyles = "bg-stone-50 hover:bg-stone-100 text-stone-700";
                        if (isAnswered) {
                            if (isCorrect) buttonStyles = "bg-emerald-500 text-white shadow-lg ring-4 ring-emerald-100";
                            else if (isSelected) buttonStyles = "bg-red-500 text-white opacity-90 scale-95";
                            else buttonStyles = "bg-stone-50 text-stone-300 opacity-50";
                        }

                        return (
                            <button
                                key={i}
                                disabled={isAnswered}
                                onClick={() => handleOptionSelect(opt)}
                                className={`p-6 text-left rounded-3xl transition-all font-serif text-lg flex justify-between items-center group/btn relative overflow-hidden ${buttonStyles}`}
                            >
                                <span className="relative z-10">{opt}</span>
                                {isAnswered && isCorrect && <span className="text-xs font-black uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full">Correct</span>}
                                {isAnswered && isSelected && !isCorrect && <span className="text-xs font-black uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full">Incorrect</span>}
                            </button>
                        );
                    })}
                </div>

                {isAnswered && (
                    <div className="mt-12 pt-10 border-t border-stone-50 animate-in fade-in slide-in-from-top-4 duration-500 text-center space-y-8">
                        {currentQuestion.explanation && (
                            <div className="p-6 bg-orange-50/50 rounded-[2rem] text-sm italic text-[#A0522D] font-serif leading-relaxed">
                                {currentQuestion.explanation}
                            </div>
                        )}
                        <button
                            onClick={nextQuestion}
                            className="px-12 py-4 bg-[#2D4635] text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all"
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
