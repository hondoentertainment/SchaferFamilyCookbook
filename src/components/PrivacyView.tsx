import React, { useState, useEffect } from 'react';
import { siteConfig } from '../config/site';

const SECTIONS = [
    { id: 'privacy-what', label: 'What this site stores' },
    { id: 'privacy-who', label: 'Who can see it' },
    { id: 'privacy-contact', label: 'Questions' },
] as const;

/**
 * Short privacy notice for family-facing production use.
 */
export const PrivacyView: React.FC = () => {
    const [activeSection, setActiveSection] = useState<string>(SECTIONS[0].id);
    const [tocOpen, setTocOpen] = useState(false);

    useEffect(() => {
        const onScroll = () => {
            const scrollTop = window.scrollY + 120;
            const sections = SECTIONS.map(({ id }) => ({ id, el: document.getElementById(id) })).filter(
                (s): s is { id: string; el: HTMLElement } => !!s.el
            );
            for (let i = sections.length - 1; i >= 0; i--) {
                const top = sections[i].el.getBoundingClientRect().top + window.scrollY;
                if (scrollTop >= top) {
                    setActiveSection(sections[i].id);
                    break;
                }
            }
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const getScrollBehavior = (): ScrollBehavior => {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        return prefersReducedMotion ? 'instant' as ScrollBehavior : 'smooth';
    };

    const scrollToSection = (id: string) => {
        document.getElementById(id)?.scrollIntoView({ behavior: getScrollBehavior(), block: 'start' });
        setTocOpen(false);
    };

    return (
        <div className="min-h-screen bg-[#FDFBF7]">
            {/* Mobile collapsible TOC */}
            <div className="md:hidden sticky top-0 z-30 bg-[#FDFBF7]/95 backdrop-blur-sm border-b border-stone-100">
                <button
                    type="button"
                    onClick={() => setTocOpen(!tocOpen)}
                    className="w-full px-6 py-3 flex items-center justify-between text-sm font-serif text-[#2D4635]"
                    aria-expanded={tocOpen}
                    aria-controls="mobile-toc"
                >
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">On this page</span>
                    <span className={`text-stone-400 transition-transform duration-200 ${tocOpen ? 'rotate-180' : ''}`}>&#9662;</span>
                </button>
                {tocOpen && (
                    <nav id="mobile-toc" aria-label="Table of contents" className="px-6 pb-4">
                        <ul className="space-y-1">
                            {SECTIONS.map(({ id, label }) => (
                                <li key={id}>
                                    <button
                                        type="button"
                                        onClick={() => scrollToSection(id)}
                                        aria-current={activeSection === id ? 'true' : undefined}
                                        className={`block w-full text-left py-2 px-4 rounded-xl text-sm font-serif transition-all focus:outline-none focus:ring-2 focus:ring-[#2D4635] focus:ring-offset-1 ${
                                            activeSection === id
                                                ? 'bg-[#2D4635] text-white italic'
                                                : 'text-stone-500 hover:bg-stone-100 hover:text-[#2D4635]'
                                        }`}
                                    >
                                        {label}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </nav>
                )}
            </div>

            <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-8 md:gap-12 py-12 md:py-16 px-6">
                {/* Desktop sticky sidebar TOC */}
                <nav
                    aria-label="Table of contents"
                    className="hidden md:block md:sticky md:top-28 md:self-start md:w-52 shrink-0"
                >
                    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400 mb-4">
                        On this page
                    </h2>
                    <ul className="space-y-1">
                        {SECTIONS.map(({ id, label }) => (
                            <li key={id}>
                                <button
                                    type="button"
                                    onClick={() => scrollToSection(id)}
                                    aria-current={activeSection === id ? 'true' : undefined}
                                    aria-label={`Jump to ${label}`}
                                    className={`block w-full text-left py-2 px-4 rounded-xl text-sm font-serif transition-all focus:outline-none focus:ring-2 focus:ring-[#2D4635] focus:ring-offset-1 focus:ring-offset-[#FDFBF7] ${
                                        activeSection === id
                                            ? 'bg-[#2D4635] text-white italic'
                                            : 'text-stone-500 hover:bg-stone-100 hover:text-[#2D4635]'
                                    }`}
                                >
                                    {label}
                                </button>
                            </li>
                        ))}
                    </ul>
                </nav>

                {/* Main content */}
                <main
                    className="flex-1 min-w-0 max-w-3xl text-stone-700"
                    role="main"
                    aria-labelledby="privacy-heading"
                >
                    <h1 id="privacy-heading" className="text-4xl font-serif italic text-[#2D4635] mb-8">
                        Privacy &amp; data
                    </h1>
                    <div className="space-y-6 text-base leading-relaxed">
                        <section aria-labelledby="privacy-what" className="scroll-mt-28">
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
                        <section aria-labelledby="privacy-who" className="scroll-mt-28">
                            <h2 id="privacy-who" className="text-lg font-bold text-[#2D4635] mb-2">
                                Who can see it
                            </h2>
                            <p>
                                {siteConfig.siteName} is intended for family use. When the family cloud is connected, the
                                cookbook is typically <strong>publicly readable</strong> (anyone with the link can browse
                                recipes and gallery). Only designated custodians—after signing in with Google and a server-side
                                admin grant—can change cloud data. Name-based "login" only personalizes your view; it does not
                                by itself authorize cloud writes. This is not a substitute for medical, legal, or financial
                                privacy requirements.
                            </p>
                        </section>
                        <section aria-labelledby="privacy-contact" className="scroll-mt-28">
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
            </div>
        </div>
    );
};
