import React, { useState } from 'react';
import { STORAGE_KEYS } from '../constants/storage';
import { hapticLight } from '../utils/haptics';

const STEPS = [
  {
    icon: '📖',
    title: 'Browse Family Recipes',
    description: 'Search and filter through the family collection. Tap any recipe card to see the full details, ingredients, and instructions.',
  },
  {
    icon: '🍳',
    title: 'Cook Mode',
    description: 'Open a recipe and tap "Cook Mode" for a hands-free, step-by-step cooking experience. The screen stays awake so you never lose your place.',
  },
  {
    icon: '❤️',
    title: 'Favorites & Collections',
    description: 'Heart recipes to save them as favorites. Create custom collections like "Holiday Baking" or "Weeknight Dinners" to stay organized.',
  },
  {
    icon: '⭐',
    title: 'Rate & Comment',
    description: 'Rate recipes and leave family notes like "Kids loved this!" or "Use less salt." When 3+ people rate a recipe 4+ stars, it earns the Family Approved badge.',
  },
];

interface OnboardingWalkthroughProps {
  onComplete: () => void;
}

export const OnboardingWalkthrough: React.FC<OnboardingWalkthroughProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);

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

  const current = STEPS[step];

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

        <div className="space-y-4 animate-fade-slide-in" key={step}>
          <span className="text-6xl block">{current.icon}</span>
          <h2 className="text-2xl font-serif italic text-[#2D4635] dark:text-emerald-400">
            {current.title}
          </h2>
          <p className="text-stone-600 dark:text-stone-400 font-serif italic leading-relaxed">
            {current.description}
          </p>
        </div>

        <div className="flex gap-3 justify-center">
          <button
            type="button"
            onClick={handleSkip}
            className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-stone-500 hover:text-stone-700 transition-colors"
          >
            Skip Tour
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="px-8 py-3 bg-[#2D4635] text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-[#1e2f23] active:scale-95 transition-all"
          >
            {step < STEPS.length - 1 ? 'Next' : "Let's Cook!"}
          </button>
        </div>
      </div>
    </div>
  );
};
