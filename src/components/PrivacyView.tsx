import React from 'react';
import { siteConfig } from '../config/site';
import { PageHeader } from './PageHeader';
import { CollapsiblePanel } from './CollapsiblePanel';

/**
 * Short privacy notice for family-facing production use.
 */
export const PrivacyView: React.FC = () => {
    return (
        <main
            className="view-shell view-stack text-stone-700"
            role="main"
            aria-labelledby="privacy-heading"
        >
            <PageHeader id="privacy-heading" title="Privacy & data" titleLevel={1} />

            <CollapsiblePanel id="privacy-what" title="What this site stores" defaultOpen>
                <ul className="list-disc pl-6 space-y-2 text-base leading-relaxed">
                        <li>
                            <strong>On your device:</strong> Your display name, avatar URL, favorites, recently viewed
                            recipes, star ratings, personal recipe notes, custom collections, grocery list, trivia scores,
                            activity feed (e.g. cook/favorite events), display preferences (theme, font size, contrast),
                            Cook Mode hints, optional push-notification nudge state, and the same recipe/gallery/trivia
                            copy you edit in <strong>local-only</strong> mode may be kept in browser storage
                            (localStorage). Firebase web client settings you paste into the app are also stored locally
                            so the browser can connect to your project.
                        </li>
                        <li>
                            <strong>Cloud preferences (optional):</strong> When Firebase is connected and you sign in as
                            a custodian, favorites and ratings may sync to Firestore under your family project as
                            described in the app&apos;s preferences sync (see code: user-scoped docs).
                        </li>
                        <li>
                            <strong>Family cloud (optional):</strong> If an administrator connects Firebase, recipes,
                            gallery items, trivia, contributors, and related metadata may sync to Google Firebase
                            (Firestore / Storage) under that project.
                        </li>
                        <li>
                            <strong>AI features:</strong> Recipe text or structured recipe data may be sent to Google
                            Gemini through our server when you use Magic Import or image generation (Vercel only).
                        </li>
                        <li>
                            <strong>Text-to-archive:</strong> If enabled, photos/videos sent via SMS are processed by
                            Twilio and stored per your family&apos;s configuration.
                        </li>
                    </ul>
            </CollapsiblePanel>

            <CollapsiblePanel id="privacy-who" title="Who can see it" defaultOpen>
                    <p className="text-base leading-relaxed">
                        {siteConfig.siteName} is intended for family use. When the family cloud is connected, the
                        cookbook is typically <strong>publicly readable</strong> (anyone with the link can browse
                        recipes and gallery). Only designated custodians—after signing in with Google and a server-side
                        admin grant—can change cloud data. Name-based “login” only personalizes your view; it does not
                        by itself authorize cloud writes. This is not a substitute for medical, legal, or financial
                        privacy requirements.
                    </p>
            </CollapsiblePanel>

            <CollapsiblePanel id="privacy-contact" title="Questions">
                    <p className="text-base leading-relaxed">
                        Contact your family archive administrators if you need something removed or have concerns
                        about how data is handled.
                    </p>
            </CollapsiblePanel>

            <p className="text-sm text-stone-500">Last updated for production deployment checklist.</p>
        </main>
    );
};
