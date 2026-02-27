import React from 'react';
import { PLACEHOLDER_AVATAR } from '../constants';

/**
 * onError handler for avatar <img> elements.
 * Swaps src to PLACEHOLDER_AVATAR on load failure.
 * Prevents infinite loops by checking if already set to placeholder.
 */
export function avatarOnError(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    if (img.src !== PLACEHOLDER_AVATAR) {
        img.src = PLACEHOLDER_AVATAR;
    }
}
