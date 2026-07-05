import React, { useState } from 'react';
import {
  getStoredTheme,
  setStoredTheme,
  getStoredFontSize,
  setStoredFontSize,
  getStoredHighContrast,
  setStoredHighContrast,
} from '../utils/theme';
import { hapticLight } from '../utils/haptics';
import type { ThemeMode, FontSize } from '../types';

export const PreferencesPanel: React.FC = () => {
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme);
  const [fontSize, setFontSize] = useState<FontSize>(getStoredFontSize);
  const [highContrast, setHighContrast] = useState(getStoredHighContrast);

  const handleTheme = (mode: ThemeMode) => {
    hapticLight();
    setTheme(mode);
    setStoredTheme(mode);
  };

  const handleFontSize = (size: FontSize) => {
    hapticLight();
    setFontSize(size);
    setStoredFontSize(size);
  };

  const handleHighContrast = (enabled: boolean) => {
    hapticLight();
    setHighContrast(enabled);
    setStoredHighContrast(enabled);
  };

  const themeOptions: { value: ThemeMode; label: string; icon: string }[] = [
    { value: 'light', label: 'Light', icon: '☀️' },
    { value: 'dark', label: 'Dark', icon: '🌙' },
    { value: 'system', label: 'Auto', icon: '💻' },
  ];

  const fontOptions: { value: FontSize; label: string }[] = [
    { value: 'small', label: 'A' },
    { value: 'medium', label: 'A' },
    { value: 'large', label: 'A' },
  ];

  return (
    <section className="space-y-6" aria-label="Display preferences">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-500">
        Display Preferences
      </h3>

      {/* Theme */}
      <fieldset className="space-y-2">
        <legend className="text-xs font-bold text-stone-600 dark:text-stone-400">Theme</legend>
        <div className="flex gap-2">
          {themeOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleTheme(opt.value)}
              className={`flex-1 px-4 py-3 rounded-xl border text-sm font-bold transition-all ${
                theme === opt.value
                  ? 'bg-[var(--color-brand)] text-white border-[var(--color-brand)] shadow-md'
                  : 'bg-white dark:bg-[var(--card-bg)] border-stone-200 dark:border-[var(--border-color)] text-stone-600 dark:text-stone-400 hover:border-[var(--color-brand)]/30'
              }`}
              aria-pressed={theme === opt.value}
            >
              <span className="block text-lg mb-1">{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Font Size */}
      <fieldset className="space-y-2">
        <legend className="text-xs font-bold text-stone-600 dark:text-stone-400">Text Size</legend>
        <div className="flex gap-2">
          {fontOptions.map((opt, i) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleFontSize(opt.value)}
              className={`flex-1 py-3 rounded-xl border font-serif transition-all ${
                fontSize === opt.value
                  ? 'bg-[var(--color-brand)] text-white border-[var(--color-brand)] shadow-md'
                  : 'bg-white dark:bg-[var(--card-bg)] border-stone-200 dark:border-[var(--border-color)] text-stone-600 dark:text-stone-400 hover:border-[var(--color-brand)]/30'
              }`}
              style={{ fontSize: `${14 + i * 4}px` }}
              aria-pressed={fontSize === opt.value}
              aria-label={`${opt.value} text size`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* High Contrast */}
      <div className="flex items-center justify-between p-4 bg-stone-50 dark:bg-[var(--bg-tertiary)] rounded-xl border border-stone-200 dark:border-[var(--border-color)]">
        <div>
          <p className="text-sm font-bold text-stone-700 dark:text-stone-300">High Contrast</p>
          <p className="text-xs text-stone-500">Increases text and border contrast</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={highContrast}
          onClick={() => handleHighContrast(!highContrast)}
          className={`relative w-12 h-7 rounded-full transition-colors ${
            highContrast ? 'bg-[var(--color-brand)]' : 'bg-stone-300 dark:bg-stone-600'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
              highContrast ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    </section>
  );
};
