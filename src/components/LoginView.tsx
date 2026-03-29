import React, { useState, useMemo } from 'react';
import { UserProfile, ContributorProfile } from '../types';
import { PLACEHOLDER_AVATAR } from '../constants';
import { avatarOnError } from '../utils/avatarFallback';
import { isSuperAdmin } from '../config/site';

interface LoginViewProps {
    onLogin: (user: UserProfile) => void;
    contributors: ContributorProfile[];
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin, contributors }) => {
    const [loginName, setLoginName] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const matchedContributor = useMemo(
        () => contributors.find(c => c.name.toLowerCase() === loginName.trim().toLowerCase()) ?? null,
        [contributors, loginName]
    );

    const handleLoginSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!loginName.trim() || isLoggingIn) return;

        setIsLoggingIn(true);

        const name = loginName.trim();
        const existing = contributors.find(c => c.name.toLowerCase() === name.toLowerCase());

        // Super Admin Detection
        const isSuper = isSuperAdmin(name);
        const email = isSuper && name.includes('@') ? name : (existing?.email);

        const u: UserProfile = {
            id: existing?.id || 'u' + Date.now(),
            name: existing?.name || name,
            picture: existing?.avatar ?? PLACEHOLDER_AVATAR,
            role: isSuper ? 'admin' : ((existing?.role as any) || (name.toLowerCase() === 'admin' ? 'admin' : 'user')),
            email: email
        };
        localStorage.setItem('schafer_user', JSON.stringify(u));
        onLogin(u);
        setIsLoggingIn(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#2D4635] p-6">
            <a href="#main-content-login" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-white focus:text-[#2D4635] focus:rounded-lg focus:font-bold focus:outline-none focus:ring-2 focus:ring-white">
                Skip to main content
            </a>
            <div id="main-content-login" className="bg-white rounded-[4rem] p-10 md:p-16 w-full max-w-xl shadow-2xl relative overflow-hidden text-center animate-in zoom-in duration-700 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))]" tabIndex={-1}>
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-800 via-orange-300 to-emerald-800" />

                <div className="relative mb-12">
                    <div className="w-24 h-24 bg-stone-100 rounded-full mx-auto relative overflow-hidden border-4 border-white shadow-2xl group transition-all">
                        {loginName ? (
                            <img
                                src={matchedContributor?.avatar ?? PLACEHOLDER_AVATAR}
                                className="w-full h-full object-cover animate-in fade-in zoom-in"
                                alt="Identity"
                                onError={avatarOnError}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-stone-300 text-3xl font-serif">?</div>
                        )}
                    </div>
                    <div className="mt-8 space-y-3">
                        <h1 className="text-4xl font-serif italic text-[#2D4635] mb-2">Welcome to the Family Table</h1>
                        <p className="text-stone-600 italic font-serif text-sm md:text-base max-w-md mx-auto">
                            Step into the Schafer Family Archive to browse treasured recipes, revisit family memories, and keep the story cooking for the next generation.
                        </p>
                        <div className="flex flex-wrap justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-stone-500">
                            <span className="px-3 py-1.5 rounded-full bg-stone-50 border border-stone-100">Recipes</span>
                            <span className="px-3 py-1.5 rounded-full bg-stone-50 border border-stone-100">Gallery</span>
                            <span className="px-3 py-1.5 rounded-full bg-stone-50 border border-stone-100">Trivia</span>
                            <span className="px-3 py-1.5 rounded-full bg-stone-50 border border-stone-100">Family Story</span>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleLoginSubmit} className="space-y-8 relative z-10">
                    <div className="space-y-2">
                        <label htmlFor="login-name" className="text-[10px] font-black uppercase tracking-[0.3em] text-[#A0522D] ml-2">Legacy Contributor Name</label>
                        <p className="text-sm text-stone-500 font-serif italic -mt-1">Enter a family name to continue. If we recognize it, we&apos;ll bring in the saved avatar and profile.</p>
                        <input
                            id="login-name"
                            type="text"
                            placeholder="e.g. Grandma Joan"
                            autoComplete="name"
                            disabled={isLoggingIn}
                            aria-busy={isLoggingIn}
                            className="w-full p-6 bg-stone-50 border border-stone-100 rounded-3xl text-center text-xl font-serif outline-none focus:ring-2 focus:ring-[#2D4635]/10 focus:bg-white transition-all shadow-inner text-base disabled:opacity-70 disabled:cursor-not-allowed"
                            value={loginName}
                            onChange={e => setLoginName(e.target.value)}
                        />
                        {loginName.trim() && (
                            <div className={`mt-3 rounded-2xl border px-4 py-3 text-left ${matchedContributor ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-stone-50 border-stone-100 text-stone-600'}`}>
                                <p className="text-[10px] font-black uppercase tracking-widest">
                                    {matchedContributor ? 'Known family profile found' : 'New archive guest'}
                                </p>
                                <p className="mt-1 text-sm font-serif italic">
                                    {matchedContributor
                                        ? `You'll enter as ${matchedContributor.name} with your saved identity.`
                                        : 'You can still explore the archive now, and an administrator can personalize this profile later.'}
                                </p>
                            </div>
                        )}
                    </div>
                    <button
                        type="submit"
                        disabled={isLoggingIn}
                        aria-busy={isLoggingIn}
                        className="w-full py-5 bg-[#2D4635] text-white rounded-full text-xs font-black uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                        {isLoggingIn ? 'Entering\u2026' : 'Enter The Archive'}
                    </button>
                    <p className="text-stone-500 text-xs italic pt-4">
                        <a href="mailto:?subject=Schafer%20Family%20Cookbook%20Access%20Request" className="underline hover:text-[#2D4635] focus:outline-none focus:ring-2 focus:ring-[#2D4635] focus:ring-offset-2 rounded">Need access? Contact an administrator.</a>
                    </p>
                </form>
            </div>
        </div>
    );
};
