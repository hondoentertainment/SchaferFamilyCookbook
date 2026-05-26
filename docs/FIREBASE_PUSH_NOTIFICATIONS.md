# Firebase Push Notifications (FCM)

This app uses Firebase Cloud Messaging (FCM) to deliver "new recipe added"
push notifications to subscribers. This document covers the operator setup
required to make pushes work end-to-end in production.

> Audience: site operators / deployers. Application code lives in
> `src/services/pushNotifications.ts` and the background SW lives in
> `public/firebase-messaging-sw.js` (template) / `dist/firebase-messaging-sw.js`
> (built). For Firestore rules see `docs/FIREBASE_SECURITY.md`.

## How it works

1. `vite build` copies `public/firebase-messaging-sw.js` into `dist/` as a
   templated file containing a `@inject-firebase-config` marker.
2. The `schafer:inject-firebase-messaging-sw-config` Vite plugin (defined in
   `vite.config.ts`) runs in a post-order `writeBundle` hook (after
   `vite-plugin-pwa` copies public assets) and invokes
   `scripts/sync-firebase-sw-config.mjs`, which:
   - Reads the six `VITE_FIREBASE_*` env vars.
   - Substitutes them into the SW source.
   - Writes the result back to `dist/firebase-messaging-sw.js`.
3. The browser registers `/firebase-messaging-sw.js` automatically when the
   app calls `subscribeToPushNotifications(...)`. The SW initialises Firebase
   with the embedded config and handles background `onBackgroundMessage`
   payloads (showing the system notification with the recipe title).

If any required field is missing at build time, the SW still installs but
short-circuits initialisation and prints a console warning. The app keeps
running; only background push is disabled.

## Required environment variables

Set all six on the Vercel project (Production + Preview + any other
environments that need push). These come from
**Firebase Console → Project settings → General → Your apps → SDK setup and
configuration** (use the `npm` snippet view).

| Variable                              | Firebase config field | Example                              |
| ------------------------------------- | --------------------- | ------------------------------------ |
| `VITE_FIREBASE_API_KEY`               | `apiKey`              | `AIzaSyA…`                           |
| `VITE_FIREBASE_AUTH_DOMAIN`           | `authDomain`          | `schafer-cookbook.firebaseapp.com`   |
| `VITE_FIREBASE_PROJECT_ID`            | `projectId`           | `schafer-cookbook`                   |
| `VITE_FIREBASE_STORAGE_BUCKET`        | `storageBucket`       | `schafer-cookbook.appspot.com`       |
| `VITE_FIREBASE_MESSAGING_SENDER_ID`   | `messagingSenderId`   | `123456789012`                       |
| `VITE_FIREBASE_APP_ID`                | `appId`               | `1:123456789012:web:abcdef0123…`     |

### Optional: VAPID web push key

`src/services/pushNotifications.ts` reads `VITE_FCM_VAPID_KEY` and passes it
to `getToken({ vapidKey })`. Generate one in **Firebase Console → Project
settings → Cloud Messaging → Web Push certificates → Generate key pair**.

| Variable               | Purpose                                                  |
| ---------------------- | -------------------------------------------------------- |
| `VITE_FCM_VAPID_KEY`   | Web Push certificate; required for token issuance.       |

Without `VITE_FCM_VAPID_KEY` the call to `getToken(...)` fails and no token
is returned, so subscribers won't be persisted to Firestore.

## Setting the env vars

### Vercel (recommended)

```sh
vercel env add VITE_FIREBASE_API_KEY production
vercel env add VITE_FIREBASE_AUTH_DOMAIN production
vercel env add VITE_FIREBASE_PROJECT_ID production
vercel env add VITE_FIREBASE_STORAGE_BUCKET production
vercel env add VITE_FIREBASE_MESSAGING_SENDER_ID production
vercel env add VITE_FIREBASE_APP_ID production
vercel env add VITE_FCM_VAPID_KEY production
```

Repeat with `preview` (and `development` if you want push to work in preview
deployments). Then trigger a fresh build — `vercel --prod` or push a commit.

### Local builds

Drop the same keys into a `.env.local` (or `.env.production` for prod-like
builds) at the repo root. Vite's `loadEnv` picks them up automatically.

### PowerShell (one-off local production build)

```powershell
$env:VITE_FIREBASE_API_KEY = 'AIzaSy...'
$env:VITE_FIREBASE_AUTH_DOMAIN = 'schafer-cookbook.firebaseapp.com'
$env:VITE_FIREBASE_PROJECT_ID = 'schafer-cookbook'
$env:VITE_FIREBASE_STORAGE_BUCKET = 'schafer-cookbook.appspot.com'
$env:VITE_FIREBASE_MESSAGING_SENDER_ID = '123456789012'
$env:VITE_FIREBASE_APP_ID = '1:123456789012:web:abcdef0123'
npm run build
```

## Verifying that push works

1. Deploy with all env vars populated.
2. Open the site, sign in, go to **Profile → Notifications**, and click
   *Enable push notifications*.
3. Grant the browser permission. The flow calls
   `subscribeToPushNotifications(...)` which:
   - Asks for `Notification.requestPermission()`.
   - Calls `getToken(messaging, { vapidKey })`.
   - Writes the token to Firestore at `fcm_tokens/{token}`.
4. Confirm the token landed in the Firebase Console → Firestore →
   `fcm_tokens` collection. Each document has `{ token, userName, createdAt }`.
5. Trigger a test notification via the existing `/api/notify` endpoint (or
   `firebase-admin` from a script). All tokens in `fcm_tokens` receive the
   payload; the SW's `onBackgroundMessage` handler displays it.

If notifications don't appear:

- Open the browser DevTools → Application → Service Workers and confirm
  `firebase-messaging-sw.js` is registered and **activated**.
- Open the page's console and search for
  `[firebase-messaging-sw] Firebase Cloud Messaging config is missing` — if
  you see it, the build did not pick up the env vars; check Vercel project
  settings and rebuild.
- Check the Network tab for the request to
  `https://fcmregistrations.googleapis.com/...`. A 401/403 usually means a
  bad `VITE_FCM_VAPID_KEY` or `apiKey`.

## Troubleshooting the build

- `npm run build` prints
  `[sync-firebase-sw-config] Missing env vars: VITE_FIREBASE_…` —
  set those env vars and rebuild. The build itself still succeeds and ships
  the SW with the `null` placeholder; FCM stays disabled at runtime until
  the env vars are present.
- For a CI gate that **fails** the pipeline when env vars are missing, invoke
  the script directly with `NODE_ENV=production`:
  ```sh
  NODE_ENV=production node scripts/sync-firebase-sw-config.mjs
  ```
  This exits 1 when any of the six required vars is empty. Run it after
  `vite build` (or before, on a throwaway out dir) as a guard step.
- The injector reports `Could not find the @inject-firebase-config
  placeholder` — someone edited `public/firebase-messaging-sw.js` without
  preserving the marker comment + `const FIREBASE_CONFIG = null;` line.
  Restore the template structure (see the source file's header comment).

## Files involved

- `public/firebase-messaging-sw.js` — SW template with injection marker.
- `scripts/sync-firebase-sw-config.mjs` — pure `injectConfig` + CLI runner.
- `scripts/sync-firebase-sw-config.test.mjs` — unit tests.
- `vite.config.ts` — `schafer:inject-firebase-messaging-sw-config` plugin.
- `src/services/pushNotifications.ts` — main-thread subscribe / listen API.
