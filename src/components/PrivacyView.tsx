import React from 'react';
import { siteConfig } from '../config/site';

/**
 * Short privacy notice for family-facing production use.
 */
export const PrivacyView: React.FC = () => {
    return (
        <main
            className="max-w-3xl mx-auto py-12 md:py-16 px-6 text-stone-700"
            role="main"
            aria-labelledby="privacy-heading"
        >
            <h1 id="privacy-heading" className="text-4xl font-serif italic text-[#2D4635] mb-8">
                Privacy &amp; data
            </h1>
            <div className="space-y-6 text-base leading-relaxed">
                <section aria-labelledby="privacy-what">
                    <h2 id="privacy-what" className="text-lg font-bold text-[#2D4635] mb-2">
                        What this site stores
                    </h2>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>
                            <strong>On your device:</strong> Your display name, avatar URL, favorites, recently viewed
                            recipes, grocery list, and trivia scores may be kept in browser storage (localStorage).
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
                </section>
                <section aria-labelledby="privacy-who">
                    <h2 id="privacy-who" className="text-lg font-bold text-[#2D4635] mb-2">
                        Who can see it
                    </h2>
                    <p>
                        {siteConfig.siteName} is intended for family use. When the family cloud is connected, the
                        cookbook is typically <strong>publicly readable</strong> (anyone with the link can browse
                        recipes and gallery). Only designated custodians—after signing in with Google and a server-side
                        admin grant—can change cloud data. Name-based “login” only personalizes your view; it does not
                        by itself authorize cloud writes. This is not a substitute for medical, legal, or financial
                        privacy requirements.
                    </p>
                </section>
                <section aria-labelledby="privacy-contact">
                    <h2 id="privacy-contact" className="text-lg font-bold text-[#2D4635] mb-2">
                        Questions
                    </h2>
                    <p>
                        Contact your family archive administrators if you need something removed or have concerns
                        about how data is handled.
                    </p>
                </section>
                <p className="text-sm text-stone-500 pt-4">Last updated for production deployment checklist.</p>
            </div>
        </main>
    );
};
