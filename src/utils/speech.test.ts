import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isSpeechSupported, speak, cancelSpeech } from './speech';

describe('speech utility', () => {
    describe('when speechSynthesis is unsupported', () => {
        beforeEach(() => {
            // Remove speechSynthesis from the window so the support check
            // returns false. happy-dom does not provide it natively, but we
            // explicitly stub to undefined to be safe across envs.
            vi.stubGlobal('speechSynthesis', undefined);
            // Also remove from window if happy-dom added it.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (window as any).speechSynthesis;
        });

        afterEach(() => {
            vi.unstubAllGlobals();
        });

        it('isSpeechSupported returns false', () => {
            expect(isSpeechSupported()).toBe(false);
        });

        it('speak is a no-op and does not throw', () => {
            expect(() => speak('hello world')).not.toThrow();
        });

        it('cancelSpeech is a no-op and does not throw', () => {
            expect(() => cancelSpeech()).not.toThrow();
        });
    });

    describe('when speechSynthesis is supported', () => {
        let cancelMock: ReturnType<typeof vi.fn>;
        let speakMock: ReturnType<typeof vi.fn>;
        let utterCtor: ReturnType<typeof vi.fn>;

        beforeEach(() => {
            cancelMock = vi.fn();
            speakMock = vi.fn();

            const synthStub = {
                cancel: cancelMock,
                speak: speakMock,
            };

            // Install on window so the `'speechSynthesis' in window` check passes.
            Object.defineProperty(window, 'speechSynthesis', {
                configurable: true,
                writable: true,
                value: synthStub,
            });

            // Provide a SpeechSynthesisUtterance constructor that records the
            // text + assignments so we can assert on them.
            utterCtor = vi.fn().mockImplementation(function (this: Record<string, unknown>, text: string) {
                this.text = text;
            });
            vi.stubGlobal('SpeechSynthesisUtterance', utterCtor);
        });

        afterEach(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (window as any).speechSynthesis;
            vi.unstubAllGlobals();
        });

        it('isSpeechSupported returns true', () => {
            expect(isSpeechSupported()).toBe(true);
        });

        it('speak cancels any prior utterance before queuing the new one', () => {
            speak('Step one: chop onions.');

            expect(cancelMock).toHaveBeenCalledTimes(1);
            expect(speakMock).toHaveBeenCalledTimes(1);

            // Cancel must run before speak.
            const cancelOrder = cancelMock.mock.invocationCallOrder[0];
            const speakOrder = speakMock.mock.invocationCallOrder[0];
            expect(cancelOrder).toBeLessThan(speakOrder);
        });

        it('speak constructs an utterance with the provided text', () => {
            speak('Saute the garlic.');
            expect(utterCtor).toHaveBeenCalledWith('Saute the garlic.');
            const utter = speakMock.mock.calls[0][0];
            expect(utter.text).toBe('Saute the garlic.');
        });

        it('speak applies rate/pitch/volume when provided', () => {
            speak('Stir gently.', { rate: 1.2, pitch: 0.9, volume: 0.8 });
            const utter = speakMock.mock.calls[0][0];
            expect(utter.rate).toBe(1.2);
            expect(utter.pitch).toBe(0.9);
            expect(utter.volume).toBe(0.8);
        });

        it('speak no-ops on empty / whitespace text', () => {
            speak('');
            speak('   ');
            expect(speakMock).not.toHaveBeenCalled();
            expect(cancelMock).not.toHaveBeenCalled();
        });

        it('cancelSpeech invokes speechSynthesis.cancel', () => {
            cancelSpeech();
            expect(cancelMock).toHaveBeenCalledTimes(1);
        });
    });
});
