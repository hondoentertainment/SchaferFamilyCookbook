import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, fireEvent, cleanup } from '@testing-library/react';
import { InstallPrompt } from './InstallPrompt';

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  });
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function fireBeforeInstallPrompt() {
  const event = new Event('beforeinstallprompt') as Event & {
    prompt: ReturnType<typeof vi.fn>;
    userChoice: Promise<{ outcome: string; platform: string }>;
  };
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

describe('InstallPrompt', () => {
  it('renders nothing initially', () => {
    const { container } = render(<InstallPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows prompt when beforeinstallprompt fires', async () => {
    render(<InstallPrompt />);
    fireBeforeInstallPrompt();
    expect(await screen.findByRole('region', { name: /Install Schafer Cookbook/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Install$/ })).toBeInTheDocument();
  });

  it('hides and remembers dismiss', async () => {
    render(<InstallPrompt />);
    fireBeforeInstallPrompt();
    const dismissBtn = await screen.findByRole('button', { name: /Dismiss install prompt/i });
    fireEvent.click(dismissBtn);
    expect(screen.queryByRole('region', { name: /Install/i })).not.toBeInTheDocument();
    expect(localStorage.getItem('schafer_install_prompt_dismissed_at')).toBeTruthy();
  });

  it('suppresses subsequent prompts within suppression window', () => {
    localStorage.setItem('schafer_install_prompt_dismissed_at', String(Date.now()));
    const { container } = render(<InstallPrompt />);
    fireBeforeInstallPrompt();
    expect(container).toBeEmptyDOMElement();
  });
});
