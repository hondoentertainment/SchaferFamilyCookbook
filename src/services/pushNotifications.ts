/**
 * Firebase Cloud Messaging – push notification helpers.
 *
 * Prerequisites (before these functions will work end-to-end):
 *   1. Add your VAPID key to `.env`:
 *        VITE_FCM_VAPID_KEY=your_web_push_certificate_key_pair
 *      Generate it in Firebase console → Project settings → Cloud Messaging →
 *      Web Push certificates → Generate key pair.
 *   2. Fill in real Firebase config values in `public/firebase-messaging-sw.js`.
 *   3. Deploy a Cloud Function (or use the Admin SDK) to send notifications
 *      to the tokens stored in the `fcm_tokens` Firestore collection.
 */

import { getApps, getApp, initializeApp } from 'firebase/app';
import { getFirestore, setDoc, doc } from 'firebase/firestore';

// VITE_FCM_VAPID_KEY must be set in .env for token registration to succeed.
const VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY ?? '';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Returns true when the environment supports the FCM web SDK. */
function isMessagingSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

/**
 * Lazily imports firebase/messaging and returns `{ getMessaging, getToken,
 * onMessage }`.  Returns null when the module is unavailable (e.g. SSR,
 * very old browsers) so callers can degrade gracefully.
 */
async function getMessagingModule() {
  if (!isMessagingSupported()) return null;
  try {
    return await import('firebase/messaging');
  } catch {
    return null;
  }
}

/**
 * Returns the Firebase app that was already initialised by `db.ts`, or
 * attempts to initialise one from the config stored in localStorage.
 * Returns null when no valid config is available.
 */
function getFirebaseApp() {
  // Reuse an existing app instance if one is already initialised.
  if (getApps().length > 0) return getApp();

  const saved = localStorage.getItem('schafer_firebase_config');
  if (!saved) return null;
  try {
    const config = JSON.parse(saved);
    if (!config.apiKey || !config.projectId) return null;
    return initializeApp({
      apiKey: config.apiKey,
      projectId: config.projectId,
      authDomain: `${config.projectId}.firebaseapp.com`,
      storageBucket: `${config.projectId}.firebasestorage.app`,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
    });
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Requests browser notification permission and, if granted, retrieves the
 * FCM registration token tied to the current service worker.
 *
 * @returns The FCM token string, or `null` if permission was denied, the
 *          browser is unsupported, or an error occurred.
 */
export async function requestNotificationPermission(): Promise<string | null> {
  const mod = await getMessagingModule();
  if (!mod) return null;

  const app = getFirebaseApp();
  if (!app) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const registration = await navigator.serviceWorker.ready;
    const messaging = mod.getMessaging(app);
    const token = await mod.getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    return token ?? null;
  } catch (err) {
    console.warn('[pushNotifications] requestNotificationPermission failed:', err);
    return null;
  }
}

/**
 * Persists an FCM token to Firestore under `fcm_tokens/{token}`.
 * A Cloud Function or Admin SDK script can read this collection to fan out
 * notifications when a new recipe is added.
 */
export async function saveTokenToFirestore(token: string, userName: string): Promise<void> {
  const app = getFirebaseApp();
  if (!app) return;

  try {
    const db = getFirestore(app);
    await setDoc(doc(db, 'fcm_tokens', token), {
      token,
      userName,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[pushNotifications] saveTokenToFirestore failed:', err);
  }
}

/**
 * One-shot helper that:
 *   1. Asks for notification permission.
 *   2. Gets the FCM token.
 *   3. Saves the token to Firestore.
 *
 * @returns `true` when the subscription succeeded, `false` otherwise.
 */
export async function subscribeToPushNotifications(userName: string): Promise<boolean> {
  try {
    const token = await requestNotificationPermission();
    if (!token) return false;
    await saveTokenToFirestore(token, userName);
    return true;
  } catch (err) {
    console.warn('[pushNotifications] subscribeToPushNotifications failed:', err);
    return false;
  }
}

/**
 * Listens for FCM messages that arrive while the app is in the foreground.
 * Invokes `onRecipe(title)` for each incoming notification.
 *
 * @returns An unsubscribe function.  Call it to stop listening (e.g. in a
 *          `useEffect` cleanup).
 */
export function listenForForegroundMessages(onRecipe: (title: string) => void): () => void {
  let unsubscribe: (() => void) | undefined;

  (async () => {
    const mod = await getMessagingModule();
    if (!mod) return;

    const app = getFirebaseApp();
    if (!app) return;

    try {
      const messaging = mod.getMessaging(app);
      unsubscribe = mod.onMessage(messaging, (payload) => {
        const title = payload.notification?.title ?? 'New Recipe!';
        onRecipe(title);
      });
    } catch (err) {
      console.warn('[pushNotifications] listenForForegroundMessages failed:', err);
    }
  })();

  // Return a stable unsubscribe function that delegates to the real one once
  // the async setup above has resolved.
  return () => {
    if (unsubscribe) unsubscribe();
  };
}
