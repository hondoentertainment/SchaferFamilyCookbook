import { STORAGE_KEYS } from '../constants/storage';
import type { ThemeMode, FontSize } from '../types';

export function getStoredTheme(): ThemeMode {
  return (localStorage.getItem(STORAGE_KEYS.theme) as ThemeMode) || 'system';
}

export function setStoredTheme(mode: ThemeMode): void {
  localStorage.setItem(STORAGE_KEYS.theme, mode);
  applyTheme(mode);
}

export function getStoredFontSize(): FontSize {
  return (localStorage.getItem(STORAGE_KEYS.fontSize) as FontSize) || 'medium';
}

export function setStoredFontSize(size: FontSize): void {
  localStorage.setItem(STORAGE_KEYS.fontSize, size);
  applyFontSize(size);
}

export function getStoredHighContrast(): boolean {
  return localStorage.getItem(STORAGE_KEYS.highContrast) === 'true';
}

export function setStoredHighContrast(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEYS.highContrast, String(enabled));
  applyHighContrast(enabled);
}

export function getResolvedTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

export function applyTheme(mode: ThemeMode): void {
  const resolved = getResolvedTheme(mode);
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

export function applyFontSize(size: FontSize): void {
  document.documentElement.dataset.fontSize = size;
}

export function applyHighContrast(enabled: boolean): void {
  document.documentElement.classList.toggle('high-contrast', enabled);
}

/** Apply all stored preferences on app startup */
export function initializeTheme(): void {
  applyTheme(getStoredTheme());
  applyFontSize(getStoredFontSize());
  applyHighContrast(getStoredHighContrast());

  // Listen for system theme changes
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', () => {
    if (getStoredTheme() === 'system') {
      applyTheme('system');
    }
  });
}
