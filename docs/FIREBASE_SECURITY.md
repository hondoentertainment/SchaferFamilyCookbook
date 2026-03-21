# Firebase security (production hardening)

## Current architecture

The web app can use the Firebase **client SDK** with a project `apiKey` stored in the browser (`localStorage`). There is **no Firebase Authentication** today—family members are identified by name in the app only.

Firestore rules in `firebase/firestore.rules` and Storage rules in `firebase/storage.rules` are permissive so existing behavior works. **Anyone with your Firebase config can read/write** if they replicate requests. Mitigations:

1. **Do not** commit real Firebase API keys to public repos; rotate keys if exposed.
2. **App Check** — Register the web app and enforce App Check in Firebase Console to reduce scripted abuse.
3. **Authentication** — Add Firebase Auth and tighten rules to `request.auth != null`; use custom claims for `admin` to restrict deletes and contributor merges.

## Deploy rules

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules,storage:rules --project YOUR_PROJECT_ID
```

## Recommended rule pattern (after Auth)

```javascript
function isSignedIn() {
  return request.auth != null;
}
function isAdmin() {
  return request.auth.token.admin == true;
}
match /recipes/{id} {
  allow read: if true;
  allow write: if isSignedIn() && (isAdmin() || /* contributor match */);
}
```

## Related

- `api/gemini.ts` — Rate limiting per IP for `/api/gemini` (Vercel).
- `api/webhook.ts` — Twilio signature validation when `TWILIO_AUTH_TOKEN` is set.
