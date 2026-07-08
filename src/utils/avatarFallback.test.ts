import { describe, it, expect } from 'vitest';
import type React from 'react';
import { avatarOnError } from './avatarFallback';
import { PLACEHOLDER_AVATAR } from '../constants';

function makeEvent(src: string) {
    const img = { src } as HTMLImageElement;
    return { currentTarget: img } as React.SyntheticEvent<HTMLImageElement>;
}

describe('avatarOnError', () => {
    it('swaps a broken avatar src to the placeholder', () => {
        const e = makeEvent('https://example.com/broken.jpg');
        avatarOnError(e);
        expect(e.currentTarget.src).toBe(PLACEHOLDER_AVATAR);
    });

    it('does not rewrite src when already showing the placeholder (no error loop)', () => {
        const e = makeEvent(PLACEHOLDER_AVATAR);
        avatarOnError(e);
        expect(e.currentTarget.src).toBe(PLACEHOLDER_AVATAR);
    });
});
