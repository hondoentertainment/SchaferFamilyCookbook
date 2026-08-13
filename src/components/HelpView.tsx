import React from 'react';
import { KEYBOARD_SHORTCUT_ROWS } from '../constants/keyboardShortcuts';
import { siteConfig } from '../config/site';
import { hapticLight } from '../utils/haptics';
import { PageHeader } from './PageHeader';
import { CollapsiblePanel } from './CollapsiblePanel';
import { useUI } from '../context/UIContext';
import { isSentryConfigured, sendSentryTestEvent } from '../monitoring/sentry';

export const HelpView: React.FC = () => {
    const { toast } = useUI();
    const openPrivacy = () => {
        hapticLight();
        window.dispatchEvent(new CustomEvent('schafer:navigate', { detail: 'Privacy' }));
    };

    const replayTour = () => {
        hapticLight();
        window.dispatchEvent(new CustomEvent('schafer:replay-onboarding'));
    };

    return (
        <main
            id="main-content-help"
            tabIndex={-1}
            role="main"
            aria-label="Help and shortcuts"
            className="view-shell view-stack animate-in fade-in slide-in-from-bottom-8 duration-500 motion-reduce:animate-none"
        >
            <PageHeader
                id="help-page-heading"
                titleLevel={1}
                eyebrow={siteConfig.siteName}
                title="Help & shortcuts"
                description="Quick answers for navigating the cookbook and sharing recipes with family."
            />

            <CollapsiblePanel id="help-shortcuts" title="Keyboard shortcuts" defaultOpen>
                <ul className="space-y-2">
                    {KEYBOARD_SHORTCUT_ROWS.map((row) => (
                        <li key={row.keys} className="flex gap-3 rounded-2xl border border-stone-100 px-3 py-2.5 dark:border-[var(--border-color)]">
                            <kbd className="shrink-0 rounded-lg bg-stone-100 px-2 py-1 font-mono text-xs font-bold text-stone-700 dark:bg-stone-800 dark:text-stone-200">
                                {row.keys}
                            </kbd>
                            <span className="text-sm text-stone-700 dark:text-stone-300">{row.description}</span>
                        </li>
                    ))}
                </ul>
            </CollapsiblePanel>

            <CollapsiblePanel id="help-tips" title="Tips" defaultOpen>
                <ul className="list-disc pl-5 space-y-2 text-sm text-stone-700 dark:text-stone-300">
                    <li>
                        <strong className="font-bold">Home</strong> picks up favorites, tonight&apos;s meal plan, and seasonal ideas. Use <strong className="font-bold">Recipes</strong> to search the full archive.
                    </li>
                    <li>
                        The pill bar under the header switches sub-sections — e.g. Groceries → Meal Plan or Collections without losing your place.
                    </li>
                    <li>
                        Use the <strong className="font-bold">Read / Cook / Share</strong> modes at the top of a recipe to focus on story, cooking, or sending a link.
                    </li>
                    <li>
                        <strong className="font-bold">Cook mode</strong> keeps your screen awake. Steps and ingredients work offline once you&apos;ve opened the recipe while online. Recipe cards show an <strong className="font-bold">Offline</strong> badge after they&apos;re saved locally. Tap the <strong className="font-bold">🔊 Listen</strong> button to read the current step aloud (Safari on iOS may require tapping Listen each step; speech does not auto-advance). On timed steps, use <strong className="font-bold">Start N-min timer</strong> for a countdown toast.
                    </li>
                    <li>
                        <strong className="font-bold">Print the family cookbook</strong> from the Recipes hero opens a printable cover, table of contents, and category chapters — use your browser&apos;s print dialog for PDF.
                    </li>
                    <li>
                        <strong className="font-bold">Family notes &amp; ratings</strong> on a recipe reflect everyone who has synced prefs — not just this device. Sign in with your name so notes attribute correctly.
                    </li>
                    <li>
                        <strong className="font-bold">Collections</strong> under Groceries let you group recipes — start from a template or build your own shelf.
                    </li>
                    <li>Copy or share your grocery list from the list header when you head to the store.</li>
                    <li>Offline? Your edits may queue until you reconnect; check the banner at the top when something is pending.</li>
                </ul>
                <button
                    type="button"
                    onClick={replayTour}
                    className="mt-4 btn btn-secondary btn-body"
                >
                    Replay the welcome tour
                </button>
            </CollapsiblePanel>

            <CollapsiblePanel id="help-troubleshooting" title="Troubleshooting">
                <ul className="list-disc pl-5 space-y-2 text-sm text-stone-700 dark:text-stone-300 mb-4">
                    <li>Favorites, ratings, and grocery lists sync across devices when the family cloud (Firebase) is configured. Without it, those prefs stay on this device only — see Profile for details.</li>
                    <li>If Cook mode shows a yellow &quot;saved copy&quot; banner, you&apos;re viewing a recipe cached for offline use. Reconnect to refresh from the archive.</li>
                </ul>
                <button
                    type="button"
                    onClick={() => {
                        hapticLight();
                        if (sendSentryTestEvent()) {
                            toast('Sent a test event to Sentry — check your project dashboard.', 'success');
                        } else if (isSentryConfigured()) {
                            toast('Could not send test event — try again.', 'error');
                        } else {
                            toast('Error monitoring is not configured on this deployment yet.', 'info');
                        }
                    }}
                    className="btn btn-secondary btn-body"
                >
                    Send Sentry test event
                </button>
            </CollapsiblePanel>

            <CollapsiblePanel id="help-custodian-ops" title="Custodian ops checklist">
                <p className="text-sm text-stone-600 dark:text-stone-400 mb-3 font-serif italic">
                    These steps need Vercel or Firebase console access — they cannot be done from the app alone.
                </p>
                <ol className="list-decimal pl-5 space-y-2 text-sm text-stone-700 dark:text-stone-300">
                    <li>
                        <strong className="font-bold">Launch finalize</strong> — run{' '}
                        <code className="text-xs">npm run finalize</code> for ops audit, smoke test, and CI coverage
                        check. With credentials in <code className="text-xs">.env.local</code>, add{' '}
                        <code className="text-xs">--apply --deploy</code> (and <code className="text-xs">--migrate --yes</code>{' '}
                        when <code className="text-xs">FIREBASE_SERVICE_ACCOUNT</code> is set). Use{' '}
                        <code className="text-xs">npm run bootstrap:credentials</code> for a guided secret checklist, or{' '}
                        <code className="text-xs">npm run custodian:runbook</code> for the full launch walkthrough.
                    </li>
                    <li>
                        <strong className="font-bold">Firestore rules (family notes)</strong> — after changing{' '}
                        <code className="text-xs">firebase/firestore.rules</code>, run{' '}
                        <code className="text-xs">npm run deploy:firebase-rules</code> so{' '}
                        <code className="text-xs">notes</code> / <code className="text-xs">displayName</code> sync.
                        Verify: family member adds a note → second browser sees it under Family Notes.
                    </li>
                    <li>
                        <strong className="font-bold">Text-to-gallery (Twilio MMS)</strong> — set{' '}
                        <code className="text-xs">FIREBASE_SERVICE_ACCOUNT</code>,{' '}
                        <code className="text-xs">TWILIO_AUTH_TOKEN</code>, and{' '}
                        <code className="text-xs">TWILIO_ACCOUNT_SID</code> on Vercel; point your Twilio number&apos;s
                        webhook to <code className="text-xs">/api/webhook</code>. Enable Firebase Storage, then set{' '}
                        <code className="text-xs">VITE_ARCHIVE_PHONE</code> (E.164) or save the number in Admin → Gallery.
                        Run <code className="text-xs">npm run configure:text-to-gallery</code> for a checklist.
                    </li>
                    <li>
                        <strong className="font-bold">Gallery community uploads</strong> — run{' '}
                        <code className="text-xs">npm run deploy:firebase-rules</code> after merging gallery
                        changes (Firestore + Storage rules).{' '}
                        <strong className="font-bold">Enable Firebase Storage</strong> in the console first if deploy
                        reports Storage is not set up — uploads need both Firestore metadata and Storage files. Then
                        sign in as a non-custodian family member, upload a test photo on the Gallery tab, confirm
                        it shows as pending, then approve or decline it in Admin → Gallery.
                    </li>
                    <li>
                        <strong className="font-bold">Ops audit</strong> — run{' '}
                        <code className="text-xs">npm run verify:ops</code> (Vercel env names + Storage readiness) after
                        console changes.
                    </li>
                    <li>
                        <strong className="font-bold">Recipe catalog</strong> — run <code className="text-xs">npm run seed:recipes</code> (with <code className="text-xs">FIREBASE_SERVICE_ACCOUNT</code>) to upsert all bundled recipes into Firestore. The app also merges missing defaults from <code className="text-xs">recipes.json</code> for visitors automatically.
                    </li>
                    <li>
                        <strong className="font-bold">Sentry</strong> — set <code className="text-xs">VITE_SENTRY_DSN</code> on Vercel Production, then use the test button above. Optional build vars: <code className="text-xs">SENTRY_AUTH_TOKEN</code>, <code className="text-xs">SENTRY_ORG</code>, <code className="text-xs">SENTRY_PROJECT</code>.
                    </li>
                    <li>
                        <strong className="font-bold">Env audit</strong> — run <code className="text-xs">npm run verify:vercel-env</code> or <code className="text-xs">npm run verify:ops</code> locally after changing Vercel variables.
                    </li>
                    <li>
                        <strong className="font-bold">App Check (optional)</strong> — register reCAPTCHA v3 in Firebase Console → App Check; set <code className="text-xs">VITE_FIREBASE_APP_CHECK_SITE_KEY</code> on Vercel Production.
                    </li>
                    <li>
                        <strong className="font-bold">Lighthouse</strong> — download the mobile + desktop artifact from the monthly GitHub Actions Lighthouse job.
                    </li>
                    <li>
                        <strong className="font-bold">Recipe images</strong> — run <code className="text-xs">npm run images:batch</code> (requires <code className="text-xs">GEMINI_API_KEY</code>) for fallback card covers.
                    </li>
                    <li>
                        <strong className="font-bold">Push (optional)</strong> — see <code className="text-xs">docs/FIREBASE_PUSH_NOTIFICATIONS.md</code> for FCM env vars.
                    </li>
                </ol>
            </CollapsiblePanel>

            <CollapsiblePanel id="help-privacy" title="Privacy & data">
                <p className="text-sm text-stone-600 dark:text-stone-400 mb-4 font-serif italic leading-relaxed">
                    See what stays on your device versus the family cloud in Privacy &amp; Data.
                </p>
                <div className="empty-state-actions">
                <button
                    type="button"
                    onClick={openPrivacy}
                    className="btn btn-primary"
                >
                    Open Privacy &amp; Data →
                </button>
                </div>
            </CollapsiblePanel>
        </main>
    );
};
