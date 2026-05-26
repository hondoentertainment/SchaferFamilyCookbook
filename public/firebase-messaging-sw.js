// Firebase Cloud Messaging service worker.
//
// This file must live at /firebase-messaging-sw.js (served from the public root).
//
// Build pipeline:
//   The `null` after the `@inject-firebase-config` marker is replaced at
//   `vite build` time by scripts/sync-firebase-sw-config.mjs with a JSON
//   config object derived from the VITE_FIREBASE_* env vars. The source file
//   in public/ is left untouched; only dist/firebase-messaging-sw.js is
//   rewritten. See docs/FIREBASE_PUSH_NOTIFICATIONS.md for operator setup.
//
// Safe-by-default: if the placeholder remains (no env vars set, dev mode, or
// `vite preview` without configuration), the worker still installs but skips
// FCM initialisation and logs a single explanatory warning. This prevents
// dev/preview builds from crashing when push isn't configured yet.

importScripts('https://www.gstatic.com/firebasejs/12.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.8.0/firebase-messaging-compat.js');

/* @inject-firebase-config */
const FIREBASE_CONFIG = null;

const REQUIRED_FIELDS = ['apiKey', 'projectId', 'messagingSenderId', 'appId'];
const isUnconfigured =
  !FIREBASE_CONFIG ||
  typeof FIREBASE_CONFIG !== 'object' ||
  REQUIRED_FIELDS.some((field) => {
    const value = FIREBASE_CONFIG[field];
    return typeof value !== 'string' || value.length === 0;
  });

if (isUnconfigured) {
  console.warn(
    '[firebase-messaging-sw] Firebase Cloud Messaging config is missing or ' +
      'incomplete. Background push notifications are disabled. Set the ' +
      'VITE_FIREBASE_* env vars at build time. See ' +
      'docs/FIREBASE_PUSH_NOTIFICATIONS.md for operator setup.'
  );
} else {
  firebase.initializeApp(FIREBASE_CONFIG);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const { title, body } = payload.notification ?? {};
    self.registration.showNotification(title ?? 'New Recipe!', {
      body: body ?? 'A new recipe has been added to the Schafer Family Cookbook.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    });
  });
}
