/**
 * Web Speech API helpers for text-to-speech read-aloud.
 *
 * Provides a thin, feature-detected wrapper over `window.speechSynthesis` so
 * callers can speak text without crashing on browsers that don't support it
 * (e.g., older Safari iOS).
 */

export interface SpeakOptions {
    rate?: number;
    pitch?: number;
    lang?: string;
}

/**
 * Returns true when the Web Speech Synthesis API is available in this
 * environment. Safe to call on the server (returns false).
 */
export function isSpeechSupported(): boolean {
    return (
        typeof window !== 'undefined' &&
        typeof window.speechSynthesis !== 'undefined' &&
        typeof window.SpeechSynthesisUtterance !== 'undefined'
    );
}

/**
 * Cancels any in-flight utterance and queues a new one.
 *
 * Returns the created `SpeechSynthesisUtterance` so callers can wire up
 * `onstart` / `onend` / `onerror`. Returns `null` when speech synthesis
 * isn't available.
 */
export function speak(
    text: string,
    opts: SpeakOptions = {}
): SpeechSynthesisUtterance | null {
    if (!isSpeechSupported()) return null;
    if (!text) return null;

    // Always cancel any prior queued/active utterance so step changes don't
    // stack up audio.
    window.speechSynthesis.cancel();

    const utterance = new window.SpeechSynthesisUtterance(text);
    if (typeof opts.rate === 'number') utterance.rate = opts.rate;
    if (typeof opts.pitch === 'number') utterance.pitch = opts.pitch;
    utterance.lang = opts.lang ?? 'en-US';

    window.speechSynthesis.speak(utterance);
    return utterance;
}

/**
 * Cancels any in-flight utterance. No-op when unsupported.
 */
export function cancelSpeech(): void {
    if (!isSpeechSupported()) return;
    window.speechSynthesis.cancel();
}
