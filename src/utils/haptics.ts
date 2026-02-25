/**
 * Lightweight haptic feedback for mobile. Respects reduced-motion and
 * only runs when Vibration API is available.
 */
export function hapticSuccess(): void {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  navigator.vibrate(100);
}

export function hapticError(): void {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  navigator.vibrate([50, 50, 50]);
}

export function hapticLight(): void {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  navigator.vibrate(50);
}
