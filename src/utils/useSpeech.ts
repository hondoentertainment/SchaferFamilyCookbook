import { useCallback, useEffect, useRef, useState } from 'react';
import {
    cancelSpeech,
    isSpeechSupported,
    speak as speakRaw,
    SpeakOptions,
} from './speech';

export interface UseSpeechResult {
    speak: (text: string, opts?: SpeakOptions) => void;
    cancel: () => void;
    speaking: boolean;
    supported: boolean;
}

/**
 * React hook around the Web Speech API. Tracks `speaking` state via the
 * utterance's `onstart` / `onend` / `onerror` handlers and cancels any
 * in-flight utterance on unmount so audio doesn't leak across mounts.
 */
export function useSpeech(): UseSpeechResult {
    const [speaking, setSpeaking] = useState(false);
    const supportedRef = useRef<boolean>(isSpeechSupported());
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

    const cancel = useCallback(() => {
        cancelSpeech();
        utteranceRef.current = null;
        setSpeaking(false);
    }, []);

    const speak = useCallback((text: string, opts?: SpeakOptions) => {
        const utterance = speakRaw(text, opts);
        utteranceRef.current = utterance;
        if (!utterance) {
            setSpeaking(false);
            return;
        }
        utterance.onstart = () => setSpeaking(true);
        utterance.onend = () => {
            if (utteranceRef.current === utterance) {
                utteranceRef.current = null;
            }
            setSpeaking(false);
        };
        utterance.onerror = () => {
            if (utteranceRef.current === utterance) {
                utteranceRef.current = null;
            }
            setSpeaking(false);
        };
    }, []);

    useEffect(() => {
        return () => {
            cancelSpeech();
            utteranceRef.current = null;
        };
    }, []);

    return {
        speak,
        cancel,
        speaking,
        supported: supportedRef.current,
    };
}
