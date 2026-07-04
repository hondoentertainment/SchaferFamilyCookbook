import React, { useState } from 'react';
import { STORAGE_KEYS, SESSION_KEYS } from '../constants/storage';
import { hapticLight } from '../utils/haptics';

const STEPS = [
  {
    icon: '🏠',
    title: 'Your home dashboard',
    description:
      'Home picks up where you left off — favorites, recently viewed, and seasonal ideas. Use Recipes when you want to search the full archive.',
  },
  {
    icon: '📖',
    title: 'Find recipes',
    description:
      'Search and filter from Recipes, or jump to A–Z. Tap any card for ingredients, notes, and step-by-step cooking when you are ready.',
  },
  {
    icon: '🍳',
    title: 'Cook mode',
    description:
      'Open a recipe and tap “Start cooking” for a focused, step-by-step flow. Your screen can stay awake so you never lose your place.',
  },
  {
    icon: '📅',
    title: 'Plan & shop',
    description:
      'Meal Plan under Groceries lines up your week. Add ingredients to your grocery list in one tap from any recipe, then check them off at the store.',
  },
  {
    icon: '👨‍👩‍👧',
    title: 'Family hub',
    description:
      'Gallery, trivia, family story, and contributors live under Family — shortcuts to memories beyond the kitchen.',
  },
];

interface OnboardingWalkthroughProps {
  onComplete: () => void;
}

export const OnboardingWalkthrough: React.FC<OnboardingWalkthroughProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const isLastStep = step === STEPS.length - 1;
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true);

  const handleNext = () => {
    hapticLight();
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      localStorage.setItem(STORAGE_KEYS.onboardingDone, 'true');
      onComplete();
    }
  };

  const handleSkip = () => {
    hapticLight();
    localStorage.setItem(STORAGE_KEYS.onboardingDone, 'true');
    onComplete();
  };

  const handleResumeLater = () => {
    hapticLight();
    try {
      sessionStorage.setItem(SESSION_KEYS.onboardingDefer, '1');
    } catch {
      /* sessionStorage blocked — fall through and just close */
    }
    onComplete();
  };

  const current = STEPS[step];
  const chapterLabel = `Chapter ${step + 1} of ${STEPS.length}`;

  return (
    <div className="fixed inset-0 z-[400] bg-[#2D4635]/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-500">
      <div className="bg-white dark:bg-[var(--card-bg)] rounded-[3rem] p-8 md:p-12 max-w-lg w-full shadow-2xl text-center space-y-8 animate-in zoom-in-95 duration-500">
        <div className="flex justify-center gap-2 mb-4">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-8 bg-[#2D4635]' : i < step ? 'w-3 bg-[#2D4635]/40' : 'w-3 bg-stone-200 dark:bg-stone-600'
              }`}
            />
          ))}
        </div>

        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#7A3F22] dark:text-orange-200/90">{chapterLabel}</p>

        <div className="space-y-4 animate-fade-slide-in" key={step}>
          <span className="text-6xl block">{current.icon}</span>
          <h2 className="text-2xl font-serif italic text-[#2D4635] dark:text-emerald-400">
            {current.title}
          </h2>
          <p className="text-stone-600 dark:text-stone-400 font-serif italic leading-relaxed">
            {current.description}
          </p>
          {isLastStep && !isStandalone && (
            <p className="rounded-2xl border border-[#E8DCCB] bg-stone-50 px-4 py-3 text-sm text-stone-600 dark:border-stone-700 dark:bg-stone-900/60 dark:text-stone-400">
              <span aria-hidden>📲 </span>
              Tip: Add this cookbook to your home screen for quick access — use your browser&apos;s <strong className="font-bold">Share → Add to Home Screen</strong> (or install prompt).
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center sm:items-center">
          <button
            type="button"
            onClick={handleResumeLater}
            className="order-2 sm:order-1 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-stone-500 hover:text-stone-700 transition-colors"
          >
            Resume later
          </button>
          <button
            type="button"
            onClick={handleSkip}
            className="order-3 sm:order-2 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-stone-500 hover:text-stone-700 transition-colors"
          >
            Skip tour
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="order-1 sm:order-3 px-8 py-3 bg-[#2D4635] text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-[#1e2f23] active:scale-95 transition-all w-full sm:w-auto"
          >
            {step < STEPS.length - 1 ? 'Next' : "Let's cook!"}
          </button>
        </div>
      </div>
    </div>
  );
};
