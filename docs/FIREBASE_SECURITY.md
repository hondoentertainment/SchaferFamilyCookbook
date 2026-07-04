# Firebase security (production)

## Model: public read, community append, custodian moderate

The hosted app uses Firestore and Storage with:

- **Read:** public (`allow read: if true`) — anyone with the site URL can view recipes, gallery, trivia, contributors, history, and config used by the client (e.g. archive phone display).
- **Gallery append:** family members signed in with a display name may **create** gallery items (Firestore + Storage `gallery/*`) with validated shape and size. Community web uploads are stored as **`status: 'pending'`** until a custodian approves; MMS and admin uploads may go live immediately as **`approved`**. They cannot edit or delete existing items.
- **Write (other collections + gallery moderation):** Firebase Authentication users with **custom claim** `admin: true` (set via Admin SDK) — full create/update/delete on recipes, gallery edits/deletes, trivia, etc.

The **name-based “login”** in the app is **not** Firebase Auth. It controls UI and attributes uploads to a contributor name. **Cloud writes** for recipes/trivia still require the custodian to use **Sign in with Google** under **Profile → Admin tools** so requests carry a valid ID token with the `admin` claim.

**Twilio MMS → gallery** and other **server** code using the **Firebase Admin SDK** bypass Security Rules and continue to work.

## One-time setup (project owner)

1. **Firebase Console → Authentication → Sign-in method:** enable **Google**. Add **authorized domains** (e.g. `localhost`, your Vercel domain, `*.github.io` if using GitHub Pages).
2. **Enable Firebase Storage** (if not already): [Console → Storage → Get started](https://console.firebase.google.com/project/schafer-cookbook/storage). Community gallery uploads store files under `gallery/*`.
3. **Deploy rules** (from repo root):

   ```bash
   npm run deploy:firebase-rules
   ```

   Or: `firebase deploy --only firestore:rules,storage:rules --project schafer-cookbook`

4. Custodian signs in on the site with **Sign in with Google (custodian)** once.
5. In **Authentication → Users**, copy their **User UID**.
6. Grant the claim (same service account JSON you use for Vercel webhook / Admin):

   ```bash
   FIREBASE_SERVICE_ACCOUNT='<paste-json-one-line>' npm run admin:set-claim -- <UID>
   ```

7. Ask the custodian to **sign out** of Google (Admin tools) and **sign in again** (or wait up to ~1 hour for token refresh) so the new claim appears in the ID token.

## Optional hardening

- **App Check** — reduce abuse of your client Firebase config. Set `VITE_FIREBASE_APP_CHECK_SITE_KEY` (reCAPTCHA v3 site key) on Vercel Production; the app initializes App Check only in production builds when this var is present.
- **Tighter read** — e.g. hide `config/settings` from anonymous users (would require app changes to load phone another way).

## Related

- `firebase/firestore.rules`, `firebase/storage.rules`
- `api/gemini.ts` — rate limiting per IP on Vercel
- `api/webhook.ts` — Twilio signature when `TWILIO_AUTH_TOKEN` is set

## CI / Emulator testing

- **Emulator-based rules tests in CI** — **shipped**. `.github/workflows/ci.yml` defines a dedicated `firestore-rules` job (after the main `ci` build) that boots the Firestore emulator via `firebase emulators:exec --only firestore --project demo-schafer` and runs `npm run test:rules` (Vitest config `vitest.rules.config.ts`) against it. Every push to `main`/`master` and every PR exercises the suite, so a rules change that breaks public-read / admin-write contracts will fail CI before merge.
- **Coverage today** — the `test:rules` suite covers the core read/write contract for `recipes`, `gallery`, `trivia`, `contributors`, `history`, and `triviaScores`: anonymous reads succeed, anonymous writes are denied where appropriate, validated gallery creates succeed, and admin-claim writes succeed.
- **Known gaps / room to grow** — collection-specific edge cases are still light, e.g.: rate-limited fields on `triviaScores`, deeper validation for nested `userPrefs` arrays such as collections and meal plans, tighter checks on `userPrefs` (per-UID isolation), and Storage rules (no emulator coverage yet — Storage tests rely on manual deploy verification). Add cases here when you change a rule.
- **Deploying Firestore rules** — Custodians should run `firebase deploy --only firestore:rules` (with the correct `--project`) deliberately: confirm the diff matches intent, avoid deploying from stale checkouts, and coordinate if multiple people touch rules. Storage rules: `firebase deploy --only storage:rules`.
- **Source of truth** — Review and edit `firebase/firestore.rules` (and `firebase/storage.rules`) in the repo before deploy; keep production aligned with what is merged. CI failure on the `firestore-rules` job is a hard block — fix the rule or the test before deploying.
