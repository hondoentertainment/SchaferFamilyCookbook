# Firebase security (production)

## Model: public read, custodian write

The hosted app uses Firestore and Storage with:

- **Read:** public (`allow read: if true`) — anyone with the site URL can view recipes, gallery, trivia, contributors, history, and config used by the client (e.g. archive phone display).
- **Write:** only Firebase Authentication users with **custom claim** `admin: true` (set via Admin SDK).

The **name-based “login”** in the app is **not** Firebase Auth. It only controls UI (tabs, admin screens). **Cloud writes** require the custodian to use **Sign in with Google** under **Profile → Admin tools** so requests carry a valid ID token with the `admin` claim.

**Twilio MMS → gallery** and other **server** code using the **Firebase Admin SDK** bypass Security Rules and continue to work.

## One-time setup (project owner)

1. **Firebase Console → Authentication → Sign-in method:** enable **Google**. Add **authorized domains** (e.g. `localhost`, your Vercel domain, `*.github.io` if using GitHub Pages).
2. **Deploy rules** (from repo root):

   ```bash
   firebase deploy --only firestore:rules,storage:rules --project YOUR_PROJECT_ID
   ```

3. Custodian signs in on the site with **Sign in with Google (custodian)** once.
4. In **Authentication → Users**, copy their **User UID**.
5. Grant the claim (same service account JSON you use for Vercel webhook / Admin):

   ```bash
   FIREBASE_SERVICE_ACCOUNT='<paste-json-one-line>' npm run admin:set-claim -- <UID>
   ```

6. Ask the custodian to **sign out** of Google (Admin tools) and **sign in again** (or wait up to ~1 hour for token refresh) so the new claim appears in the ID token.

## Optional hardening

- **App Check** — reduce abuse of your client Firebase config.
- **Tighter read** — e.g. hide `config/settings` from anonymous users (would require app changes to load phone another way).

## Related

- `firebase/firestore.rules`, `firebase/storage.rules`
- `api/gemini.ts` — rate limiting per IP on Vercel
- `api/webhook.ts` — Twilio signature when `TWILIO_AUTH_TOKEN` is set
