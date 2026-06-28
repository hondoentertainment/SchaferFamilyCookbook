import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { UserProfile, Recipe, HistoryEntry, GalleryItem, Trivia, DBStats, ContributorProfile } from '../types';
import { CATEGORY_IMAGES } from '../constants';
import { AvatarPicker } from './AvatarPicker';
import type { FirebaseCustodianProps } from './AdminView';
import { CloudArchive } from '../services/db';
import { useUI } from '../context/UIContext';
import { avatarOnError } from '../utils/avatarFallback';
import { PreferencesPanel } from './PreferencesPanel';
import { CollectionsView } from './CollectionsView';
import { ActivityFeed } from './ActivityFeed';
import { CollapsiblePanel } from './CollapsiblePanel';
import { hapticLight } from '../utils/haptics';
import { subscribeToPushNotifications } from '../services/pushNotifications';
import type { UserPrefsSyncStatus } from '../services/useUserPrefsSync';
import { addActivity, getActivityFeed, formatTimeAgo } from '../utils/activityFeed';
import { getFavoriteIds } from '../utils/favorites';
import { getRecentlyViewedEntries } from '../utils/recentlyViewed';
import { isSuperAdmin } from '../config/site';

const PUSH_ENABLED_KEY = 'schafer_push_enabled';
const SECTION_HEADING_CLASS =
    'text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-[var(--color-warmth)] mb-3';
const SECTION_DIVIDER_CLASS = 'border-t border-stone-100 dark:border-[var(--border-color)]';

type ActivityShelfTab = 'favorites' | 'recent' | 'shared' | 'log';

const ACTIVITY_TABS: { id: ActivityShelfTab; label: string; icon: string }[] = [
    { id: 'favorites', label: 'Favorites', icon: '❤️' },
    { id: 'recent', label: 'Recent', icon: '👁' },
    { id: 'shared', label: 'My recipes', icon: '📖' },
    { id: 'log', label: 'Log', icon: '⏲️' },
];
const AdminView = lazy(() => import('./AdminView').then(m => ({ default: m.AdminView })));

const NotificationsSection: React.FC<{ userName: string }> = ({ userName }) => {
    const { toast } = useUI();
    const [enabled, setEnabled] = useState(() => localStorage.getItem(PUSH_ENABLED_KEY) === 'true');
    const [loading, setLoading] = useState(false);
    const notificationsSupported =
        typeof window !== 'undefined' &&
        'Notification' in window &&
        'serviceWorker' in navigator &&
        'PushManager' in window;

    const handleSubscribe = async () => {
        if (enabled || loading) return;
        setLoading(true);
        hapticLight();
        try {
            const success = await subscribeToPushNotifications(userName);
            if (success) {
                localStorage.setItem(PUSH_ENABLED_KEY, 'true');
                setEnabled(true);
                toast('Notifications enabled!', 'success');
            } else {
                toast('Could not enable notifications. Please check your browser settings.', 'error');
            }
        } catch {
            toast('Something went wrong enabling notifications.', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (!notificationsSupported) {
        return (
            <p className="text-stone-500 dark:text-stone-400 font-serif italic text-sm">
                Push notifications aren't supported in this browser.
            </p>
        );
    }

    return (
        <div className="bg-white dark:bg-[var(--card-bg)] rounded-[2rem] border border-stone-100 dark:border-[var(--border-color)] shadow-sm p-6 space-y-4">
            <p className="text-sm text-stone-600 dark:text-stone-400 font-serif italic">
                You'll receive a notification when a new recipe is added to the cookbook.
            </p>

            {enabled ? (
                <div className="flex items-center gap-2 px-6 py-3 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100 w-fit">
                    <span className="text-lg" aria-hidden="true">✓</span>
                    <span className="text-[10px] font-black uppercase tracking-widest">Notifications enabled</span>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={handleSubscribe}
                    disabled={loading}
                    className="px-8 py-4 min-h-11 bg-[#2D4635] text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-md hover:scale-105 active:scale-95 transition-all disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#2D4635] motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100"
                    aria-busy={loading}
                >
                    {loading ? 'Enabling…' : 'Get notified when new recipes are added'}
                </button>
            )}
        </div>
    );
};

export interface AdminSectionProps {
    editingRecipe: Recipe | null;
    clearEditing: () => void;
    recipes: Recipe[];
    trivia: Trivia[];
    contributors: ContributorProfile[];
    dbStats: DBStats;
    gallery?: GalleryItem[];
    onAddRecipe: (r: Recipe, file?: File) => Promise<void>;
    onAddGallery: (g: GalleryItem, file?: File) => Promise<void>;
    onAddTrivia: (t: Trivia) => Promise<void>;
    onDeleteTrivia: (id: string) => void | Promise<void>;
    onDeleteRecipe: (id: string) => void;
    onDeleteGalleryItem?: (id: string) => void | Promise<void>;
    onUpdateGalleryItem?: (id: string, patch: { caption?: string; date?: Date; status?: GalleryItem['status'] }) => Promise<void>;
    onUpdateContributor: (c: ContributorProfile) => Promise<void>;
    onUpdateArchivePhone: (p: string) => void | Promise<void>;
    onEditRecipe: (recipe: Recipe) => void;
    defaultRecipeIds: string[];
    firebaseCustodian?: FirebaseCustodianProps;
}

interface ProfileViewProps {
    currentUser: UserProfile;
    prefsSyncStatus?: UserPrefsSyncStatus;
    userRecipes: Recipe[];
    userHistory: HistoryEntry[];
    favoriteRecipes: Recipe[];
    recentRecipes: Recipe[];
    allRecipes: Recipe[];
    onViewRecipe: (recipe: Recipe) => void;
    onUpdateProfile: (name: string, avatar: string) => Promise<void>;
    onEditRecipe: (recipe: Recipe) => void;
    /** For admin users: admin props */
    adminSectionProps?: AdminSectionProps;
    contributors?: ContributorProfile[];
}

interface UserProfileWithJoined extends UserProfile {
    joinedAt?: string;
    createdAt?: string;
}

interface ActivityStats {
    cookedThisMonth: number;
    favoritesCount: number;
    streakDays: number;
    lastActiveLabel: string | null;
}

function computeActivityStats(userName: string): ActivityStats {
    const now = Date.now();
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    const feed = getActivityFeed();
    const userFeed = feed.filter(
        (event) => event.userName?.toLowerCase() === userName.toLowerCase(),
    );

    const cookedThisMonth = userFeed.filter(
        (event) => event.type === 'recipe_cooked' && now - new Date(event.timestamp).getTime() <= THIRTY_DAYS,
    ).length;

    const favoritesCount = (() => {
        try {
            return getFavoriteIds().size;
        } catch {
            return 0;
        }
    })();

    // Build set of YYYY-MM-DD days the user did anything
    const dayKeys = new Set<string>();
    const dayKey = (ms: number) => {
        const d = new Date(ms);
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    };
    for (const event of userFeed) {
        const ts = new Date(event.timestamp).getTime();
        if (Number.isFinite(ts)) dayKeys.add(dayKey(ts));
    }
    try {
        for (const entry of getRecentlyViewedEntries()) {
            if (entry?.viewedAt) dayKeys.add(dayKey(entry.viewedAt));
        }
    } catch {
        // ignore
    }

    let streakDays = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    while (dayKeys.has(`${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`)) {
        streakDays += 1;
        cursor.setDate(cursor.getDate() - 1);
    }

    const allTimestamps: number[] = [];
    for (const event of userFeed) {
        const ts = new Date(event.timestamp).getTime();
        if (Number.isFinite(ts)) allTimestamps.push(ts);
    }
    try {
        for (const entry of getRecentlyViewedEntries()) {
            if (entry?.viewedAt && Number.isFinite(entry.viewedAt)) allTimestamps.push(entry.viewedAt);
        }
    } catch {
        // ignore
    }
    const lastActiveLabel =
        allTimestamps.length > 0
            ? `Last active ${formatTimeAgo(new Date(Math.max(...allTimestamps)).toISOString())}`
            : null;

    return { cookedThisMonth, favoritesCount, streakDays, lastActiveLabel };
}

const StatCard: React.FC<{ value: React.ReactNode; label: string; hint?: string }> = ({ value, label, hint }) => (
    <div className="bg-cream dark:bg-[var(--card-bg)] rounded-3xl p-6 border border-stone-100 dark:border-[var(--border-color)] shadow-sm flex flex-col items-center text-center gap-2">
        <span className="text-4xl md:text-5xl font-serif italic text-brand dark:text-emerald-300 leading-none">{value}</span>
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-ink-soft dark:text-stone-400">
            {label}
        </span>
        {hint && (
            <span className="text-[10px] font-serif italic text-stone-400 dark:text-stone-500">{hint}</span>
        )}
    </div>
);

const SectionHeading: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => (
    <h3 id={id} className={SECTION_HEADING_CLASS}>
        {children}
    </h3>
);

const RecipeRow: React.FC<{ recipe: Recipe; onView?: (r: Recipe) => void; rightSlot?: React.ReactNode }> = ({
    recipe,
    onView,
    rightSlot,
}) => {
    const inner = (
        <>
            <img
                src={recipe.image}
                className="w-16 h-16 md:w-20 md:h-20 rounded-2xl object-cover shadow-sm"
                alt={recipe.title}
                loading="lazy"
                decoding="async"
                onError={(e) => {
                    (e.target as HTMLImageElement).src = CATEGORY_IMAGES[recipe.category] || CATEGORY_IMAGES.Generic;
                }}
            />
            <div className="flex-1 min-w-0">
                <h4 className="font-serif italic text-[#2D4635] dark:text-emerald-200 text-lg md:text-xl truncate">
                    {recipe.title}
                </h4>
                <span className="text-[9px] font-black uppercase tracking-widest text-stone-400">
                    {recipe.category}
                </span>
            </div>
            {rightSlot ?? (
                <span className="text-stone-400 group-hover:text-[#2D4635] transition-colors">→</span>
            )}
        </>
    );

    if (onView) {
        return (
            <button
                key={recipe.id}
                type="button"
                onClick={() => onView(recipe)}
                className="w-full text-left bg-white dark:bg-[var(--card-bg)] p-4 md:p-6 rounded-[2rem] md:rounded-[2.5rem] border border-stone-100 dark:border-[var(--border-color)] shadow-sm flex items-center gap-4 md:gap-6 group hover:shadow-md transition-all"
            >
                {inner}
            </button>
        );
    }

    return (
        <div className="bg-white dark:bg-[var(--card-bg)] p-4 md:p-6 rounded-[2rem] md:rounded-[2.5rem] border border-stone-100 dark:border-[var(--border-color)] shadow-sm flex items-center gap-4 md:gap-6 group hover:shadow-md transition-all">
            {inner}
        </div>
    );
};

export const ProfileView: React.FC<ProfileViewProps> = (props) => {
    const {
        currentUser,
        prefsSyncStatus = 'local',
        userRecipes,
        userHistory,
        favoriteRecipes,
        recentRecipes,
        allRecipes,
        onViewRecipe,
        onUpdateProfile,
        onEditRecipe,
        adminSectionProps,
        contributors = [],
    } = props;
    const profileWithJoined = currentUser as UserProfileWithJoined;
    const { toast } = useUI();
    const [name, setName] = useState(currentUser.name);
    const [avatar, setAvatar] = useState(currentUser.picture);
    const [isEditingName, setIsEditingName] = useState(false);
    const [draftName, setDraftName] = useState(currentUser.name);
    const [isSaving, setIsSaving] = useState(false);
    const [saveAnnouncement, setSaveAnnouncement] = useState('');
    const [showPicker, setShowPicker] = useState(false);
    const [activityTab, setActivityTab] = useState<ActivityShelfTab>('favorites');
    const nameInputRef = useRef<HTMLInputElement>(null);
    const activityFeedSectionRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setName(currentUser.name);
        setDraftName(currentUser.name);
        setAvatar(currentUser.picture);
    }, [currentUser.name, currentUser.picture]);

    useEffect(() => {
        if (isEditingName && nameInputRef.current) {
            nameInputRef.current.focus();
            nameInputRef.current.select();
        }
    }, [isEditingName]);

    const memberSinceLabel = useMemo(() => {
        const raw = profileWithJoined.joinedAt ?? profileWithJoined.createdAt;
        if (!raw) return null;
        const date = new Date(raw);
        if (Number.isNaN(date.getTime())) return null;
        return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }, [profileWithJoined.joinedAt, profileWithJoined.createdAt]);

    const stats = useMemo(() => computeActivityStats(currentUser.name), [currentUser.name, userHistory.length]);

    const persistProfile = async (nextName: string, nextAvatar: string) => {
        try {
            await onUpdateProfile(nextName, nextAvatar);
            return true;
        } catch (err) {
            // Fallback persistence to the same localStorage key the app initializes from
            try {
                const raw = localStorage.getItem('schafer_user');
                const parsed = raw ? (JSON.parse(raw) as UserProfile) : (currentUser as UserProfile);
                localStorage.setItem(
                    'schafer_user',
                    JSON.stringify({ ...parsed, name: nextName, picture: nextAvatar }),
                );
            } catch {
                // best effort
            }
            const message = err instanceof Error ? err.message : 'Failed to save profile';
            toast(message, 'error');
            return false;
        }
    };

    const startNameEdit = () => {
        hapticLight();
        setDraftName(name);
        setIsEditingName(true);
    };

    const cancelNameEdit = () => {
        setDraftName(name);
        setIsEditingName(false);
    };

    const commitNameEdit = async () => {
        const trimmed = draftName.trim();
        if (!trimmed || trimmed === name) {
            setDraftName(name);
            setIsEditingName(false);
            return;
        }
        setIsSaving(true);
        const ok = await persistProfile(trimmed, avatar);
        if (ok) {
            setName(trimmed);
            try {
                addActivity('profile_updated', trimmed, 'updated their display name');
            } catch {
                // ignore
            }
            toast('Display name updated', 'success');
            setSaveAnnouncement('Display name updated');
            setIsEditingName(false);
        }
        setIsSaving(false);
    };

    const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            void commitNameEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelNameEdit();
        }
    };

    const handleAvatarSelect = async (url: string) => {
        setShowPicker(false);
        const previous = avatar;
        setAvatar(url);
        setIsSaving(true);
        const ok = await persistProfile(name, url);
        if (!ok) {
            setAvatar(previous);
        } else {
            toast('Avatar updated', 'success');
            setSaveAnnouncement('Avatar updated');
        }
        setIsSaving(false);
    };

    const handleNavigateToPrivacy = () => {
        hapticLight();
        try {
            window.dispatchEvent(new CustomEvent('schafer:navigate', { detail: 'Privacy' }));
        } catch {
            // ignore
        }
    };

    const handleNavigateToHelp = () => {
        hapticLight();
        try {
            window.dispatchEvent(new CustomEvent('schafer:navigate', { detail: 'Help' }));
        } catch {
            // ignore
        }
    };

    const archiveProvider = useMemo(() => CloudArchive.getProvider(), []);

    const isAdmin = currentUser.role === 'admin';
    const isSuperAdminUser =
        isSuperAdmin(currentUser.email) || isSuperAdmin(currentUser.name);
    const showAdminSection = (isAdmin || isSuperAdminUser) && !!adminSectionProps;

    const scrollToAdminSection = () => {
        document.getElementById('admin-tools-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    React.useEffect(() => {
        if (!showAdminSection || !adminSectionProps?.editingRecipe) return;
        const timer = window.setTimeout(scrollToAdminSection, 0);
        return () => window.clearTimeout(timer);
    }, [showAdminSection, adminSectionProps?.editingRecipe]);

    const roleBadge = (
        <span
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest ${
                isAdmin
                    ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300 border-orange-100 dark:border-orange-700'
                    : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-700'
            }`}
            aria-label={isAdmin ? 'Legacy Custodian' : 'Family Member'}
        >
            <span aria-hidden="true">{isAdmin ? '🏆' : '👤'}</span>
            {isAdmin ? 'Legacy Custodian' : 'Family Member'}
        </span>
    );

    return (
        <div className="view-shell-wide view-stack max-w-6xl animate-in fade-in slide-in-from-bottom-8 duration-700 motion-reduce:animate-none">
            <div aria-live="polite" aria-atomic="true" className="sr-only" data-testid="profile-save-announcement">
                {saveAnnouncement}
            </div>
            {/* ── Identity ─────────────────────────────────────────────── */}
            <section aria-labelledby="profile-identity-heading">
                <SectionHeading id="profile-identity-heading">Identity</SectionHeading>
                <div className="bg-white dark:bg-[var(--card-bg)] rounded-[2.5rem] md:rounded-[3rem] p-6 md:p-10 border border-stone-100 dark:border-[var(--border-color)] shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-56 h-56 bg-emerald-50 dark:bg-emerald-950/30 rounded-full -mr-28 -mt-28 blur-3xl opacity-50 pointer-events-none" />
                    <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-6 md:gap-8">
                        <div className="relative">
                            <img
                                src={avatar}
                                className="w-24 h-24 rounded-full border-4 border-white dark:border-[var(--border-color)] shadow-xl object-cover bg-stone-100"
                                alt={name}
                                onError={avatarOnError}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPicker(true)}
                                className="absolute -bottom-1 -right-1 w-11 h-11 min-w-11 min-h-11 bg-[#2D4635] text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all text-base focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100"
                                aria-label="Change avatar"
                            >
                                🎭
                            </button>
                        </div>

                        <div className="flex-1 w-full space-y-3 text-center sm:text-left">
                            {!isEditingName ? (
                                <div className="flex items-center justify-center sm:justify-start gap-3 flex-wrap">
                                    <h2
                                        className="text-2xl md:text-3xl font-serif italic text-[#2D4635] dark:text-emerald-200 leading-tight"
                                        data-testid="profile-display-name"
                                    >
                                        {name}
                                    </h2>
                                    <button
                                        type="button"
                                        onClick={startNameEdit}
                                        className="inline-flex items-center justify-center w-11 h-11 min-w-11 min-h-11 rounded-full text-stone-500 hover:text-[#2D4635] hover:bg-stone-50 dark:hover:bg-[var(--bg-tertiary)] dark:text-stone-400 dark:hover:text-emerald-200 transition-colors focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2 motion-reduce:transition-none"
                                        aria-label="Edit display name"
                                    >
                                        <span aria-hidden="true">✎</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                    <label htmlFor="profile-display-name-input" className="sr-only">
                                        Display name
                                    </label>
                                    <input
                                        id="profile-display-name-input"
                                        ref={nameInputRef}
                                        type="text"
                                        value={draftName}
                                        onChange={(e) => setDraftName(e.target.value)}
                                        onKeyDown={handleNameKeyDown}
                                        disabled={isSaving}
                                        aria-label="Display name"
                                        aria-busy={isSaving}
                                        className="flex-1 min-w-0 px-4 py-3 min-h-11 bg-stone-50 dark:bg-[var(--bg-tertiary)] border border-stone-200 dark:border-[var(--border-color)] rounded-2xl text-2xl md:text-3xl font-serif italic text-[#2D4635] dark:text-emerald-200 outline-none focus:ring-2 focus:ring-[#2D4635]/30 focus:bg-white dark:focus:bg-[var(--card-bg)] transition-all"
                                    />
                                    <div className="flex gap-2 justify-center sm:justify-start">
                                        <button
                                            type="button"
                                            onClick={() => void commitNameEdit()}
                                            disabled={isSaving}
                                            className="inline-flex items-center justify-center min-w-11 min-h-11 px-4 py-2 rounded-full bg-emerald-600 text-white text-sm font-bold shadow-md hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:active:scale-100"
                                            aria-label="Save display name"
                                        >
                                            <span aria-hidden="true">✓</span>
                                            <span className="ml-1.5">{isSaving ? 'Saving…' : 'Save'}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={cancelNameEdit}
                                            disabled={isSaving}
                                            className="inline-flex items-center justify-center min-w-11 min-h-11 px-4 py-2 rounded-full bg-stone-100 dark:bg-[var(--bg-tertiary)] text-stone-600 dark:text-stone-300 text-sm font-bold hover:bg-stone-200 dark:hover:bg-stone-700 active:scale-95 transition-all disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:active:scale-100"
                                            aria-label="Cancel editing display name"
                                        >
                                            <span aria-hidden="true">✕</span>
                                            <span className="ml-1.5">Cancel</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="text-sm text-stone-500 dark:text-stone-400 font-serif italic">
                                {memberSinceLabel ? (
                                    <span>Member since {memberSinceLabel}</span>
                                ) : (
                                    <span>{isAdmin ? 'Legacy Custodian' : 'Family Member'}</span>
                                )}
                            </div>

                            <div className="flex items-center justify-center sm:justify-start gap-3 flex-wrap pt-1">
                                {roleBadge}
                                <span
                                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest ${
                                        archiveProvider === 'firebase'
                                            ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-200 border-sky-200 dark:border-sky-800'
                                            : 'bg-stone-50 dark:bg-stone-900/50 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-stone-700'
                                    }`}
                                    title={
                                        archiveProvider === 'firebase'
                                            ? 'Recipes and gallery sync with the shared family archive when online.'
                                            : 'Running from bundled data on this device — sync may be unavailable offline.'
                                    }
                                >
                                    <span aria-hidden="true">{archiveProvider === 'firebase' ? '☁️' : '💾'}</span>
                                    {archiveProvider === 'firebase' ? 'Family cloud sync' : 'On this device'}
                                </span>
                                {currentUser.email && (
                                    <span className="text-xs text-stone-400 dark:text-stone-500 font-serif italic truncate max-w-full">
                                        {currentUser.email}
                                    </span>
                                )}
                            </div>

                            {showAdminSection && (
                                <div className="pt-3">
                                    <button
                                        type="button"
                                        onClick={scrollToAdminSection}
                                        className="inline-flex items-center min-h-11 px-6 py-3 bg-[#2D4635] text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-[#24382b] transition-colors focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2 motion-reduce:transition-none"
                                    >
                                        Open Admin Tools →
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Activity ─────────────────────────────────────────────── */}
            <section aria-labelledby="profile-activity-heading" className={`pt-6 md:pt-8 ${SECTION_DIVIDER_CLASS}`}>
                <SectionHeading id="profile-activity-heading">Activity</SectionHeading>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                    <StatCard
                        value={stats.cookedThisMonth}
                        label="Recipes Cooked This Month"
                    />
                    <StatCard
                        value={stats.favoritesCount}
                        label="Favorites"
                    />
                    {stats.streakDays > 0 ? (
                        <StatCard value={`${stats.streakDays}`} label="Day Streak" />
                    ) : (
                        <StatCard
                            value={stats.lastActiveLabel ? '·' : '—'}
                            label={stats.lastActiveLabel ?? 'No activity yet'}
                        />
                    )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                    <div className="scroll-strip -mx-1 px-1 flex-1 min-w-0" role="tablist" aria-label="Your recipe shelves">
                        {ACTIVITY_TABS.map((tab) => {
                            const active = activityTab === tab.id;
                            const count =
                                tab.id === 'favorites'
                                    ? favoriteRecipes.length
                                    : tab.id === 'recent'
                                      ? recentRecipes.length
                                      : tab.id === 'shared'
                                        ? userRecipes.length
                                        : userHistory.length;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={active}
                                    onClick={() => {
                                        hapticLight();
                                        setActivityTab(tab.id);
                                    }}
                                    className={`min-h-11 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all ${
                                        active
                                            ? 'bg-[#2D4635] text-white shadow-sm'
                                            : 'bg-white dark:bg-[var(--card-bg)] text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-[var(--border-color)]'
                                    }`}
                                >
                                    <span aria-hidden>{tab.icon} </span>
                                    {tab.label}
                                    {count > 0 && <span className="ml-1 opacity-80">({count})</span>}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="mt-4 space-y-3" role="tabpanel">
                    {activityTab === 'favorites' && (
                        <div className="space-y-3" aria-label="My favorites">
                            {favoriteRecipes.map((recipe) => (
                                <RecipeRow key={recipe.id} recipe={recipe} onView={onViewRecipe} />
                            ))}
                            {favoriteRecipes.length === 0 && (
                                <div className="py-8 text-center border-2 border-dashed border-stone-100 dark:border-[var(--border-color)] rounded-[2rem] space-y-2">
                                    <span className="text-4xl block">🤍</span>
                                    <p className="text-stone-400 font-serif italic text-base">No favorites yet</p>
                                    <p className="text-xs text-stone-400 max-w-xs mx-auto">
                                        Tap the heart on any recipe card to save it here for quick access.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {activityTab === 'recent' && (
                        <div className="space-y-3" aria-label="Recently viewed">
                            {recentRecipes.map((recipe) => (
                                <RecipeRow key={recipe.id} recipe={recipe} onView={onViewRecipe} />
                            ))}
                            {recentRecipes.length === 0 && (
                                <div className="py-8 text-center border-2 border-dashed border-stone-100 dark:border-[var(--border-color)] rounded-[2rem]">
                                    <p className="text-stone-400 font-serif italic text-base">
                                        The recipes you open most recently will gather here.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {activityTab === 'shared' && (
                        <div className="space-y-3" aria-label="My shared recipes">
                            {userRecipes.map((recipe) => (
                                <RecipeRow
                                    key={recipe.id}
                                    recipe={recipe}
                                    onView={onViewRecipe}
                                    rightSlot={
                                        currentUser.role === 'admin' ? (
                                            <button
                                                type="button"
                                                onClick={() => onEditRecipe(recipe)}
                                                className="p-3 min-w-11 min-h-11 bg-stone-50 dark:bg-[var(--bg-tertiary)] text-stone-400 rounded-2xl hover:bg-[#2D4635] hover:text-white transition-all text-sm shadow-inner shrink-0 focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2 motion-reduce:transition-none"
                                                title="Edit recipe"
                                                aria-label="Edit recipe"
                                            >
                                                ✏️
                                            </button>
                                        ) : (
                                            <span
                                                className="p-3 text-stone-300 text-xs italic shrink-0"
                                                title="Contact an administrator to request edits"
                                            >
                                                View only
                                            </span>
                                        )
                                    }
                                />
                            ))}
                            {userRecipes.length === 0 && (
                                <div className="py-8 text-center border-2 border-dashed border-stone-100 dark:border-[var(--border-color)] rounded-[2rem]">
                                    <p className="text-stone-400 font-serif italic text-base">
                                        When you contribute a recipe, it will be added to your family shelf here.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {activityTab === 'log' && (
                        <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar" aria-label="My contribution log">
                            {userHistory.map((entry) => (
                                <div
                                    key={entry.id}
                                    className="flex gap-4 p-4 bg-stone-50/50 dark:bg-[var(--bg-tertiary)] rounded-2xl border border-stone-100 dark:border-[var(--border-color)] items-start"
                                >
                                    <div className="w-9 h-9 rounded-full bg-white dark:bg-[var(--card-bg)] flex items-center justify-center shadow-sm text-base mt-0.5 shrink-0">
                                        {entry.type === 'recipe' ? '🍲' : entry.type === 'gallery' ? '🖼️' : '💡'}
                                    </div>
                                    <div className="flex-1 space-y-1 min-w-0">
                                        <p className="text-xs md:text-sm text-stone-600 dark:text-stone-300">
                                            <span className="font-bold text-[#2D4635] dark:text-emerald-200 capitalize">
                                                {entry.action}
                                            </span>{' '}
                                            {entry.type}{' '}
                                            <span className="italic font-serif">"{entry.itemName}"</span>
                                        </p>
                                        <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-stone-300">
                                            {new Date(entry.timestamp).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            {userHistory.length === 0 && (
                                <div className="py-8 text-center border-2 border-dashed border-stone-100 dark:border-[var(--border-color)] rounded-[2rem]">
                                    <p className="text-stone-400 font-serif italic text-base">
                                        Your contributions and updates will appear here as the archive grows.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div ref={activityFeedSectionRef} className="mt-6">
                    <CollapsiblePanel
                        id="profile-family-activity"
                        title="Family activity feed"
                        defaultOpen={false}
                    >
                        <ActivityFeed maxItems={8} />
                    </CollapsiblePanel>
                </div>
            </section>

            {/* ── Preferences ──────────────────────────────────────────── */}
            <section aria-labelledby="profile-preferences-heading" className={`pt-6 md:pt-8 ${SECTION_DIVIDER_CLASS}`}>
                <SectionHeading id="profile-preferences-heading">Preferences</SectionHeading>
                {CloudArchive.getProvider() === 'local' && (
                    <p
                        role="status"
                        className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
                    >
                        Favorites, ratings, grocery lists, and meal plans on this device are stored locally until the family cloud is connected. They won&apos;t follow you to other phones or browsers yet.
                    </p>
                )}
                {CloudArchive.getProvider() === 'firebase' && prefsSyncStatus === 'synced' && (
                    <p
                        role="status"
                        className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"
                    >
                        Your favorites, grocery lists, meal plans, and collections sync to the family cloud for <strong>{currentUser.name}</strong> on this device.
                    </p>
                )}
                {CloudArchive.getProvider() === 'firebase' && prefsSyncStatus === 'syncing' && (
                    <p
                        role="status"
                        className="mb-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 dark:border-stone-700 dark:bg-stone-900/60 dark:text-stone-300"
                    >
                        Syncing your preferences with the family cloud…
                    </p>
                )}
                {CloudArchive.getProvider() === 'firebase' && prefsSyncStatus === 'error' && (
                    <p
                        role="status"
                        className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
                    >
                        Couldn&apos;t reach the family cloud to sync prefs right now. Your changes stay on this device until you reconnect.
                    </p>
                )}
                <div className="grid lg:grid-cols-2 gap-8">
                    <div className="bg-white dark:bg-[var(--card-bg)] rounded-3xl p-6 border border-stone-100 dark:border-[var(--border-color)] shadow-sm">
                        <PreferencesPanel />
                    </div>
                    <div className="space-y-4">
                        <h4 className="text-xl md:text-2xl font-serif italic text-[#2D4635] dark:text-emerald-200 flex items-center gap-3">
                            <span className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center not-italic text-lg md:text-xl">📚</span>
                            Collections
                        </h4>
                        <CollectionsView
                            recipes={allRecipes}
                            currentUserName={currentUser.name}
                            onViewRecipe={onViewRecipe}
                        />
                    </div>
                </div>
            </section>

            {/* ── Notifications ────────────────────────────────────────── */}
            <section aria-labelledby="profile-notifications-heading" className={`pt-6 md:pt-8 ${SECTION_DIVIDER_CLASS}`}>
                <SectionHeading id="profile-notifications-heading">Notifications</SectionHeading>
                <NotificationsSection userName={currentUser.name} />
            </section>

            {/* ── Help ───────────────────────────────────────────────── */}
            <section aria-labelledby="profile-help-heading" className={`pt-6 md:pt-8 ${SECTION_DIVIDER_CLASS}`}>
                <SectionHeading id="profile-help-heading">Help</SectionHeading>
                <div className="bg-white dark:bg-[var(--card-bg)] rounded-3xl p-6 border border-stone-100 dark:border-[var(--border-color)] shadow-sm space-y-4">
                    <p className="text-sm text-stone-600 dark:text-stone-400 font-serif italic leading-relaxed">
                        Shortcuts, tips, and a link to privacy — press <kbd className="rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5 font-mono text-xs dark:border-stone-600 dark:bg-stone-800">?</kbd> anytime
                        (when you are not typing) to open the shortcut sheet.
                    </p>
                    <button
                        type="button"
                        onClick={handleNavigateToHelp}
                        className="inline-flex items-center min-h-11 px-6 py-3 bg-[#2D4635] text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-[#24382b] transition-colors focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2 motion-reduce:transition-none"
                        aria-label="Open Help and shortcuts"
                    >
                        Open Help &amp; shortcuts →
                    </button>
                </div>
            </section>

            {/* ── Privacy & Data ───────────────────────────────────────── */}
            <section aria-labelledby="profile-privacy-heading" className={`pt-6 md:pt-8 ${SECTION_DIVIDER_CLASS}`}>
                <SectionHeading id="profile-privacy-heading">Privacy &amp; Data</SectionHeading>
                <div className="bg-white dark:bg-[var(--card-bg)] rounded-3xl p-6 border border-stone-100 dark:border-[var(--border-color)] shadow-sm space-y-4">
                    <p className="text-sm text-stone-600 dark:text-stone-400 font-serif italic">
                        Review what the cookbook stores on your device and in the family cloud, and how it is shared.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={handleNavigateToPrivacy}
                            className="inline-flex items-center min-h-11 px-6 py-3 bg-[#2D4635] text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-[#24382b] transition-colors focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2 motion-reduce:transition-none"
                            aria-label="Open Privacy and Data view"
                        >
                            Open Privacy &amp; Data →
                        </button>
                    </div>
                </div>
            </section>

            {/* ── Admin (super-admin / custodian only) ─────────────────── */}
            {showAdminSection && adminSectionProps && (
                <section
                    aria-labelledby="profile-admin-heading"
                    className={`pt-6 md:pt-8 ${SECTION_DIVIDER_CLASS}`}
                >
                    <CollapsiblePanel
                        id="profile-admin-panel"
                        title="Admin — archive control room"
                        defaultOpen={!!adminSectionProps.editingRecipe}
                        className="rounded-[2rem] md:rounded-[2.5rem] border-orange-100 dark:border-orange-700/40 bg-gradient-to-br from-orange-50 via-white to-amber-50 dark:from-orange-950/30 dark:via-[var(--card-bg)] dark:to-amber-950/20 shadow-xl"
                        panelClassName="pt-2"
                    >
                    <div
                        id="admin-tools-section"
                        className="space-y-6 scroll-mt-24"
                        aria-label="Admin tools"
                    >
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div className="space-y-2">
                                <p className="text-[10px] font-black uppercase tracking-widest text-orange-500">
                                    Admin tools
                                </p>
                                <h3 id="profile-admin-heading" className="text-2xl md:text-3xl font-serif italic text-[#2D4635] dark:text-emerald-200">
                                    Archive control room
                                </h3>
                                <p className="max-w-2xl text-sm text-stone-600 dark:text-stone-400 font-serif italic">
                                    Add and update recipes, manage gallery and trivia records, and keep contributor
                                    access current without leaving the profile page.
                                </p>
                            </div>
                            {adminSectionProps.editingRecipe && (
                                <div className="rounded-full border border-orange-200 dark:border-orange-700 bg-white/90 dark:bg-[var(--card-bg)]/90 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-orange-600 dark:text-orange-300 shadow-sm">
                                    Editing: {adminSectionProps.editingRecipe.title}
                                </div>
                            )}
                        </div>

                        <div className="rounded-[1.5rem] md:rounded-[2rem] bg-white/80 dark:bg-[var(--card-bg)]/60 p-2 md:p-4 shadow-inner ring-1 ring-white/60 dark:ring-[var(--border-color)]">
                            <Suspense fallback={<div className="p-8 text-sm text-stone-600 dark:text-stone-300">Loading admin tools...</div>}>
                                <AdminView
                                    editingRecipe={adminSectionProps.editingRecipe}
                                    clearEditing={adminSectionProps.clearEditing}
                                    recipes={adminSectionProps.recipes}
                                    trivia={adminSectionProps.trivia}
                                    contributors={adminSectionProps.contributors}
                                    currentUser={currentUser}
                                    dbStats={adminSectionProps.dbStats}
                                    gallery={adminSectionProps.gallery}
                                    onAddRecipe={adminSectionProps.onAddRecipe}
                                    onAddGallery={adminSectionProps.onAddGallery}
                                    onAddTrivia={adminSectionProps.onAddTrivia}
                                    onDeleteTrivia={adminSectionProps.onDeleteTrivia}
                                    onDeleteRecipe={adminSectionProps.onDeleteRecipe}
                                    onDeleteGalleryItem={adminSectionProps.onDeleteGalleryItem}
                                    onUpdateGalleryItem={adminSectionProps.onUpdateGalleryItem}
                                    onUpdateContributor={adminSectionProps.onUpdateContributor}
                                    onUpdateArchivePhone={adminSectionProps.onUpdateArchivePhone}
                                    onEditRecipe={adminSectionProps.onEditRecipe}
                                    defaultRecipeIds={adminSectionProps.defaultRecipeIds}
                                    firebaseCustodian={adminSectionProps.firebaseCustodian}
                                />
                            </Suspense>
                        </div>
                    </div>
                    </CollapsiblePanel>
                </section>
            )}

            {/* Meet your Administrators - for non-admin users */}
            {!isAdmin && contributors.filter((c) => c.role === 'admin').length > 0 && (
                <section
                    aria-labelledby="profile-administrators-heading"
                    className={`pt-6 md:pt-8 ${SECTION_DIVIDER_CLASS}`}
                >
                    <SectionHeading id="profile-administrators-heading">Meet your Administrators</SectionHeading>
                    <p className="text-stone-500 dark:text-stone-400 font-serif italic max-w-lg mb-6">
                        These family members help maintain the archive, organize heritage recipes, and verify
                        memories. Need administrative access? Contact one of the curators below to be promoted.
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                        {contributors
                            .filter((c) => c.role === 'admin')
                            .map((admin) => (
                                <div
                                    key={admin.id}
                                    className="bg-white dark:bg-[var(--card-bg)] p-6 rounded-[2rem] border border-stone-100 dark:border-[var(--border-color)] shadow-sm flex flex-col items-center gap-4 transition-all hover:shadow-md"
                                >
                                    <img
                                        src={admin.avatar}
                                        className="w-20 h-20 rounded-full border-4 border-white dark:border-[var(--border-color)] shadow-lg bg-stone-50 object-cover"
                                        alt={admin.name}
                                        onError={avatarOnError}
                                    />
                                    <div className="text-center">
                                        <h4 className="font-serif italic text-[#2D4635] dark:text-emerald-200 text-lg leading-none">
                                            {admin.name}
                                        </h4>
                                        <span className="text-[9px] font-black uppercase tracking-widest text-orange-500 mt-2 block">
                                            Legacy Custodian
                                        </span>
                                    </div>
                                </div>
                            ))}
                    </div>
                </section>
            )}

            {showPicker && (
                <AvatarPicker
                    currentAvatar={avatar}
                    onSelect={(url) => void handleAvatarSelect(url)}
                    onClose={() => setShowPicker(false)}
                />
            )}
        </div>
    );
};
