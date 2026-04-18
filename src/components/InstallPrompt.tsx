import React, { useEffect, useState } from 'react';
import { hapticLight } from '../utils/haptics';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISSED_KEY = 'schafer_install_prompt_dismissed_at';
const SUPPRESS_DAYS = 14;

function isSuppressed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    if (Number.isNaN(ts)) return false;
    return Date.now() - ts < SUPPRESS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isSuppressed()) return;
    if (window.matchMedia?.('(display-mode: standalone)').matches) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!visible || !deferredPrompt) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch { /* noop */ }
    setVisible(false);
    setDeferredPrompt(null);
  };

  const install = async () => {
    hapticLight();
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome !== 'accepted') {
        try { localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch { /* noop */ }
      }
    } finally {
      setVisible(false);
      setDeferredPrompt(null);
    }
  };

  return (
    <div
      role="region"
      aria-label="Install Schafer Cookbook"
      className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] md:bottom-6 left-1/2 -translate-x-1/2 z-[120] max-w-sm w-[calc(100%-2rem)] bg-white border border-stone-200 rounded-3xl shadow-2xl p-4 flex items-center gap-3 animate-in slide-in-from-bottom-4 fade-in duration-300"
    >
      <span className="text-2xl shrink-0" aria-hidden>📲</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-serif italic text-[#2D4635]">Install the cookbook</p>
        <p className="text-[11px] text-stone-500">Quick access from your home screen — works offline.</p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="px-3 py-2 min-h-11 text-[10px] font-black uppercase tracking-widest text-stone-500 hover:text-stone-700"
        aria-label="Dismiss install prompt"
      >
        Not now
      </button>
      <button
        type="button"
        onClick={install}
        className="px-4 py-2 min-h-11 text-[10px] font-black uppercase tracking-widest text-white bg-[#2D4635] rounded-full hover:bg-[#24382b] transition-colors"
      >
        Install
      </button>
    </div>
  );
};
