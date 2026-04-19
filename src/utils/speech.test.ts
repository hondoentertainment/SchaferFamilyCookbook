import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isSpeechSupported, speak, cancelSpeech } from './speech';

describe('speech utility (Web Speech API)', () => {
    let speakMock: ReturnType<typeof vi.fn>;
    let cancelMock: ReturnType<typeof vi.fn>;
    let utteranceCtorCalls: string[];
    let originalSynthesis: PropertyDescriptor | undefined;
    let originalUtterance: PropertyDescriptor | undefined;

    beforeEach(() => {
        originalSynthesis = Object.getOwnPropertyDescriptor(window, 'speechSynthesis');
        originalUtterance = Object.getOwnPropertyDescriptor(window, 'SpeechSynthesisUtterance');

        speakMock = vi.fn();
        cancelMock = vi.fn();
        utteranceCtorCalls = [];

        Object.defineProperty(window, 'speechSynthesis', {
            configurable: true,
            writable: true,
            value: {
                speak: speakMock,
                cancel: cancelMock,
                pause: vi.fn(),
                resume: vi.fn(),
                getVoices: vi.fn(() => []),
                speaking: false,
                pending: false,
                paused: false,
            },
        });

        // Use a real function declaration so `new` works as a constructor.
        function UtteranceCtorMock(this: Record<string, unknown>, text: string) {
            utteranceCtorCalls.push(text);
            this.text = text;
            this.rate = 1;
            this.pitch = 1;
            this.lang = '';
            this.onstart = null;
            this.onend = null;
            this.onerror = null;
        }
        Object.defineProperty(window, 'SpeechSynthesisUtterance', {
            configurable: true,
            writable: true,
            value: UtteranceCtorMock,
        });
    });

    afterEach(() => {
        if (originalSynthesis) {
            Object.defineProperty(window, 'speechSynthesis', originalSynthesis);
        } else {
            
            delete window.speechSynthesis;
        }
        if (originalUtterance) {
            Object.defineProperty(window, 'SpeechSynthesisUtterance', originalUtterance);
        } else {
            
            delete window.SpeechSynthesisUtterance;
        }
        vi.restoreAllMocks();
    });

    describe('isSpeechSupported', () => {
        it('returns true when window.speechSynthesis and SpeechSynthesisUtterance exist', () => {
            expect(isSpeechSupported()).toBe(true);
        });

        it('returns false when speechSynthesis is missing', () => {
            
            delete window.speechSynthesis;
            expect(isSpeechSupported()).toBe(false);
        });

        it('returns false when SpeechSynthesisUtterance is missing', () => {
            
            delete window.SpeechSynthesisUtterance;
            expect(isSpeechSupported()).toBe(false);
        });
    });

    describe('speak', () => {
        it('cancels any prior utterance and queues a new one', () => {
            const utterance = speak('Mix the flour');
            expect(cancelMock).toHaveBeenCalledTimes(1);
            expect(speakMock).toHaveBeenCalledTimes(1);
            expect(speakMock).toHaveBeenCalledWith(utterance);
            expect(utteranceCtorCalls).toEqual(['Mix the flour']);
        });

        it('returns the utterance so callers can attach handlers', () => {
            const utterance = speak('Stir');
            expect(utterance).not.toBeNull();
            // The utterance should accept the lang we set internally.
            expect(utterance?.lang).toBe('en-US');
        });

        it('respects rate / pitch / lang options', () => {
            const utterance = speak('Whisk', { rate: 1.5, pitch: 0.8, lang: 'fr-FR' });
            expect(utterance?.rate).toBe(1.5);
            expect(utterance?.pitch).toBe(0.8);
            expect(utterance?.lang).toBe('fr-FR');
        });

        it('returns null when text is empty', () => {
            const utterance = speak('');
            expect(utterance).toBeNull();
            expect(speakMock).not.toHaveBeenCalled();
        });

        it('returns null when speech synthesis is unsupported', () => {
            
            delete window.speechSynthesis;
            const utterance = speak('Bake');
            expect(utterance).toBeNull();
        });

        it('cancels the prior in-flight utterance when called again', () => {
            speak('First step');
            speak('Second step');
            // cancel called once per speak invocation
            expect(cancelMock).toHaveBeenCalledTimes(2);
            expect(speakMock).toHaveBeenCalledTimes(2);
        });
    });

    describe('cancelSpeech', () => {
        it('calls speechSynthesis.cancel when supported', () => {
            cancelSpeech();
            expect(cancelMock).toHaveBeenCalledTimes(1);
        });

        it('is a no-op when unsupported', () => {
            
            delete window.speechSynthesis;
            expect(() => cancelSpeech()).not.toThrow();
        });
    });
});
