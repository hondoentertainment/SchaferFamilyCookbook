/**
 * Lightweight wrapper around the Web Speech API's speechSynthesis.
 *
 * Used by Cook Mode to read the current step out loud for hands-free cooking.
 * All functions are safe no-ops in environments where speechSynthesis is
 * unavailable (e.g. SSR, older browsers, some test runners).
 */

export interface SpeakOptions {
    rate?: number;
    pitch?: number;
    volume?: number;
}

/** Returns true if the current environment supports the Web Speech Synthesis API. */
export function isSpeechSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Speak the given text using the platform's default voice. Cancels any
 * in-flight utterance before queuing the new one. No-op if unsupported or
 * if `text` is empty.
 */
export function speak(text: string, opts: SpeakOptions = {}): void {
    if (!isSpeechSupported()) return;
    if (!text || !text.trim()) return;

    const synth = window.speechSynthesis;
    // Always cancel anything currently queued or speaking so we don't
    // pile up utterances when the step changes rapidly.
    synth.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    if (typeof opts.rate === 'number') utter.rate = opts.rate;
    if (typeof opts.pitch === 'number') utter.pitch = opts.pitch;
    if (typeof opts.volume === 'number') utter.volume = opts.volume;

    synth.speak(utter);
}

/** Cancel any currently queued or speaking utterances. No-op if unsupported. */
export function cancelSpeech(): void {
    if (!isSpeechSupported()) return;
    window.speechSynthesis.cancel();
}
