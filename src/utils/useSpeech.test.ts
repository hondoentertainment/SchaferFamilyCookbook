import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSpeech } from './useSpeech';

interface MockUtterance {
    text: string;
    rate: number;
    pitch: number;
    lang: string;
    onstart: (() => void) | null;
    onend: (() => void) | null;
    onerror: (() => void) | null;
}

describe('useSpeech hook', () => {
    let speakMock: ReturnType<typeof vi.fn>;
    let cancelMock: ReturnType<typeof vi.fn>;
    let lastUtterance: MockUtterance | null;
    let originalSynthesis: PropertyDescriptor | undefined;
    let originalUtterance: PropertyDescriptor | undefined;

    beforeEach(() => {
        originalSynthesis = Object.getOwnPropertyDescriptor(window, 'speechSynthesis');
        originalUtterance = Object.getOwnPropertyDescriptor(window, 'SpeechSynthesisUtterance');

        speakMock = vi.fn();
        cancelMock = vi.fn();
        lastUtterance = null;

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

        function UtteranceCtor(this: MockUtterance, text: string) {
            Object.assign(this, {
                text,
                rate: 1,
                pitch: 1,
                lang: '',
                onstart: null,
                onend: null,
                onerror: null,
            });
            lastUtterance = this as MockUtterance;
        }
        Object.defineProperty(window, 'SpeechSynthesisUtterance', {
            configurable: true,
            writable: true,
            value: UtteranceCtor,
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

    it('reports supported=true when Web Speech API is available', () => {
        const { result } = renderHook(() => useSpeech());
        expect(result.current.supported).toBe(true);
        expect(result.current.speaking).toBe(false);
    });

    it('flips speaking to true on onstart and back on onend', () => {
        const { result } = renderHook(() => useSpeech());

        act(() => {
            result.current.speak('Mix the flour');
        });
        expect(speakMock).toHaveBeenCalledTimes(1);
        expect(lastUtterance).not.toBeNull();

        act(() => {
            lastUtterance?.onstart?.();
        });
        expect(result.current.speaking).toBe(true);

        act(() => {
            lastUtterance?.onend?.();
        });
        expect(result.current.speaking).toBe(false);
    });

    it('resets speaking on onerror', () => {
        const { result } = renderHook(() => useSpeech());

        act(() => {
            result.current.speak('Stir');
        });
        act(() => {
            lastUtterance?.onstart?.();
        });
        expect(result.current.speaking).toBe(true);

        act(() => {
            lastUtterance?.onerror?.();
        });
        expect(result.current.speaking).toBe(false);
    });

    it('cancel() resets speaking and calls speechSynthesis.cancel', () => {
        const { result } = renderHook(() => useSpeech());

        act(() => {
            result.current.speak('Whisk');
        });
        act(() => {
            lastUtterance?.onstart?.();
        });
        expect(result.current.speaking).toBe(true);

        act(() => {
            result.current.cancel();
        });
        expect(result.current.speaking).toBe(false);
        expect(cancelMock).toHaveBeenCalled();
    });

    it('cancels in-flight utterance on unmount', () => {
        const { result, unmount } = renderHook(() => useSpeech());

        act(() => {
            result.current.speak('Bake at 350');
        });
        cancelMock.mockClear();

        unmount();
        expect(cancelMock).toHaveBeenCalled();
    });

    it('reports supported=false when Web Speech API is missing', () => {
        
        delete window.speechSynthesis;
        const { result } = renderHook(() => useSpeech());
        expect(result.current.supported).toBe(false);

        act(() => {
            result.current.speak('No-op');
        });
        // Should not have crashed; speaking stays false.
        expect(result.current.speaking).toBe(false);
    });
});
