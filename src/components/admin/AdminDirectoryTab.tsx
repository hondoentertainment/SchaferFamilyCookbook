import React, { useState } from 'react';
import { Recipe, Trivia, UserProfile, ContributorProfile } from '../../types';
import { AvatarPicker } from '../AvatarPicker';
import { useUI } from '../../context/UIContext';
import { avatarOnError } from '../../utils/avatarFallback';

export interface AdminDirectoryTabProps {
    recipes: Recipe[];
    trivia: Trivia[];
    contributors: ContributorProfile[];
    currentUser: UserProfile | null;
    isSuperAdmin: boolean;
    onUpdateContributor: (c: ContributorProfile) => Promise<void>;
    onAddRecipe: (r: Recipe, file?: File) => Promise<void>;
}

export const AdminDirectoryTab: React.FC<AdminDirectoryTabProps> = ({
    recipes, trivia, contributors, isSuperAdmin,
    onUpdateContributor, onAddRecipe,
}) => {
    const { toast, confirm } = useUI();

    const [pickerTarget, setPickerTarget] = useState<{ name: string; avatar: string; id: string; role: 'admin' | 'user' } | null>(null);
    const [mergeFrom, setMergeFrom] = useState('');
    const [mergeTo, setMergeTo] = useState('');
    const [isMerging, setIsMerging] = useState(false);

    const handleMergeContributors = async () => {
        if (!mergeFrom.trim() || !mergeTo.trim()) { toast('Please enter both contributor names.', 'error'); return; }
        if (mergeFrom.trim().toLowerCase() === mergeTo.trim().toLowerCase()) { toast('Cannot merge a contributor into themselves.', 'error'); return; }
        const fromName = mergeFrom.trim();
        const toName = mergeTo.trim();
        const recipesToUpdate = recipes.filter(r => r.contributor === fromName);
        if (recipesToUpdate.length === 0) { toast(`No recipes found for "${fromName}".`, 'error'); return; }
        const ok = await confirm(`Are you sure you want to merge ${recipesToUpdate.length} recipes from "${fromName}" into "${toName}"? This cannot be undone.`, { title: 'Confirm Merge', variant: 'danger', confirmLabel: 'Merge', cancelLabel: 'Cancel' });
        if (!ok) return;
        setIsMerging(true);
        try {
            for (const recipe of recipesToUpdate) {
                await onAddRecipe({ ...recipe, contributor: toName });
            }
            setMergeFrom('');
            setMergeTo('');
            toast(`Successfully merged ${recipesToUpdate.length} recipes from "${fromName}" to "${toName}"!`, 'success');
        } catch (e: unknown) {
            toast(`Merge failed: ${(e as Error).message}`, 'error');
        } finally { setIsMerging(false); }
    };

    return (
        <>
            <section id="admin-panel-directory" role="tabpanel" aria-labelledby="admin-tab-directory" className="bg-white rounded-[2rem] md:rounded-[3rem] p-6 md:p-16 border border-stone-200 shadow-xl animate-in fade-in slide-in-from-bottom-4">
                <h2 className="text-3xl font-serif italic text-[#2D4635] mb-8 flex items-center gap-4">
                    <span className="w-12 h-12 rounded-full bg-[#2D4635]/5 flex items-center justify-center not-italic text-2xl">{'\ud83d\udc65'}</span>
                    Family Directory & Avatars
                </h2>
                {isSuperAdmin && (
                    <div className="mb-10 p-6 bg-orange-50/50 rounded-[2rem] border border-orange-200">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-[#A0522D] mb-4 flex items-center gap-2">
                            <span>{'\ud83d\udd00'}</span> Merge Contributors
                        </h4>
                        <p className="text-xs text-stone-500 mb-4">Combine two contributor accounts by moving all recipes from one contributor to another.</p>
                        <div className="flex flex-col md:flex-row gap-3 items-start md:items-end">
                            <div className="flex-1 w-full">
                                <label htmlFor="admin-merge-from" className="text-[9px] font-black uppercase tracking-widest text-stone-400 mb-1 block">Merge From (will be removed)</label>
                                <input id="admin-merge-from" type="text" placeholder="e.g. Dawn Schafer Tessmer" value={mergeFrom} onChange={e => setMergeFrom(e.target.value)} className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-base outline-none focus:ring-2 focus:ring-[#A0522D]/20" />
                            </div>
                            <span className="text-stone-300 text-xl hidden md:block">{'\u2192'}</span>
                            <div className="flex-1 w-full">
                                <label htmlFor="admin-merge-to" className="text-[9px] font-black uppercase tracking-widest text-stone-400 mb-1 block">Merge Into (will keep)</label>
                                <input id="admin-merge-to" type="text" placeholder="e.g. Dawn" value={mergeTo} onChange={e => setMergeTo(e.target.value)} className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-base outline-none focus:ring-2 focus:ring-[#A0522D]/20" />
                            </div>
                            <button onClick={handleMergeContributors} disabled={isMerging || !mergeFrom.trim() || !mergeTo.trim()} aria-busy={isMerging} className="px-6 py-3 bg-[#A0522D] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-md hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap">
                                {isMerging ? 'Merging...' : '\ud83d\udd00 Merge'}
                            </button>
                        </div>
                    </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                    {Array.from(new Set([
                        ...(recipes || []).map(r => r.contributor),
                        ...(trivia || []).map(t => t.contributor),
                        ...(contributors || []).map(c => c.name)
                    ].filter(Boolean))).sort().map(name => {
                        const profile = contributors.find(c => c.name === name);
                        const avatar = profile?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;
                        const role = profile?.role || 'user';
                        return (
                            <div key={name} className="flex flex-col items-center gap-3 p-4 bg-stone-50 rounded-[2rem] border border-stone-200 hover:shadow-lg transition-all cursor-pointer group relative">
                                <img src={avatar} className="w-20 h-20 rounded-full bg-white shadow-sm object-cover" alt={name} />
                                <span className="text-xs font-bold text-stone-600 text-center">{name}</span>
                                <div className="flex gap-2">
                                    <button type="button" onClick={async (e) => { e.stopPropagation(); const phone = prompt(`Enter phone number for ${name} (e.g. +1234567890):`, profile?.phone || ''); if (phone !== null) { const updatedProfile = profile ? { ...profile, phone } : { id: 'c_' + Date.now(), name, avatar, role: 'user' as const, phone }; await onUpdateContributor(updatedProfile as ContributorProfile); toast('Contributor updated', 'success'); } }} className="text-[9px] uppercase tracking-widest text-[#2D4635] hover:font-bold bg-transparent border-0 cursor-pointer p-0">Phone</button>
                                    <button type="button" onClick={async (e) => { e.stopPropagation(); if (isSuperAdmin) { setPickerTarget({ name, avatar, id: profile?.id || 'c_' + Date.now(), role }); } else { const url = prompt(`Enter new avatar URL for ${name}:`, avatar); if (url) { await onUpdateContributor({ id: profile?.id || 'c_' + Date.now(), name, avatar: url, role }); toast('Avatar updated', 'success'); } } }} className="text-[9px] uppercase tracking-widest text-[#2D4635] hover:font-bold bg-transparent border-0 cursor-pointer p-0">Avatar</button>
                                    {role === 'admin' ? (
                                        <button type="button" onClick={async (e) => { e.stopPropagation(); if (!isSuperAdmin) { toast("Only Super Admins (Kyle) can modify roles.", 'error'); return; } if (await confirm(`Revoke admin access for ${name}?`, { variant: 'danger', confirmLabel: 'Revoke' })) { await onUpdateContributor({ id: profile?.id || 'c_' + Date.now(), name, avatar, role: 'user' }); toast('Admin access revoked', 'success'); } }} className="text-[9px] uppercase tracking-widest text-orange-500 font-bold hover:text-orange-600 bg-transparent border-0 cursor-pointer p-0">
                                            Admin {'\u2713'}
                                        </button>
                                    ) : (
                                        <button type="button" onClick={async (e) => { e.stopPropagation(); if (!isSuperAdmin) { toast("Only Super Admins (Kyle) can modify roles.", 'error'); return; } if (await confirm(`Promote ${name} to Administrator?`, { confirmLabel: 'Promote' })) { await onUpdateContributor({ id: profile?.id || 'c_' + Date.now(), name, avatar, role: 'admin' }); toast('Contributor promoted', 'success'); } }} className="text-[9px] uppercase tracking-widest text-stone-400 hover:text-[#2D4635] hover:font-bold bg-transparent border-0 cursor-pointer p-0">Grant Admin</button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>
            {pickerTarget && isSuperAdmin && (
                <AvatarPicker
                    currentAvatar={pickerTarget.avatar}
                    onSelect={async (url) => { await onUpdateContributor({ ...pickerTarget, avatar: url }); toast('Avatar updated', 'success'); setPickerTarget(null); }}
                    onClose={() => setPickerTarget(null)}
                />
            )}
        </>
    );
};

export interface AdminPermissionsTabProps {
    contributors: ContributorProfile[];
    onUpdateContributor: (c: ContributorProfile) => Promise<void>;
}

export const AdminPermissionsTab: React.FC<AdminPermissionsTabProps> = ({
    contributors, onUpdateContributor,
}) => {
    const { toast, confirm } = useUI();

    const [newAdminName, setNewAdminName] = useState('');
    const [isPromotingAdmin, setIsPromotingAdmin] = useState(false);

    return (
        <section id="admin-panel-permissions" role="tabpanel" aria-labelledby="admin-tab-permissions" className="bg-white rounded-[2rem] md:rounded-[3rem] p-6 md:p-16 border border-stone-200 shadow-xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-4">
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-50 rounded-full -mr-32 -mt-32 blur-3xl opacity-50" />
            <div className="relative z-10">
                <h2 className="text-3xl font-serif italic text-[#2D4635] mb-8 flex items-center gap-4">
                    <span className="w-12 h-12 rounded-full bg-[#2D4635]/5 flex items-center justify-center not-italic text-2xl">{'\ud83d\udd10'}</span>
                    Admin & Permissions
                </h2>
                <div className="grid md:grid-cols-2 gap-12">
                    <div className="space-y-6">
                        <p className="text-stone-500 text-sm leading-relaxed">Promote family members to admin status by their legacy name.</p>
                        <div className="flex gap-4">
                            <label htmlFor="admin-promote-name" className="sr-only">Enter name to promote</label>
                            <input id="admin-promote-name" type="text" placeholder="Enter name (e.g. Aunt Mary)" className="flex-1 px-6 py-4 bg-stone-50 border border-stone-100 rounded-2xl text-base font-serif outline-none focus:ring-2 focus:ring-[#2D4635]/10" value={newAdminName} onChange={e => setNewAdminName(e.target.value)} />
                            <button
                                onClick={async () => {
                                    if (!newAdminName.trim()) return;
                                    const name = newAdminName.trim();
                                    if (isPromotingAdmin) return;
                                    setIsPromotingAdmin(true);
                                    try {
                                        const profile = contributors.find(c => c.name.toLowerCase() === name.toLowerCase());
                                        await onUpdateContributor({
                                            id: profile?.id || 'c_' + Date.now(),
                                            name: profile?.name || name,
                                            avatar: profile?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
                                            role: 'admin'
                                        });
                                        setNewAdminName('');
                                        toast(`${name} has been promoted.`, 'success');
                                    } finally { setIsPromotingAdmin(false); }
                                }}
                                disabled={isPromotingAdmin}
                                aria-busy={isPromotingAdmin}
                                className="px-8 py-4 bg-[#2D4635] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isPromotingAdmin ? 'Saving...' : 'Grant Access'}
                            </button>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-[#A0522D]">Current Administrators</h4>
                        <div className="flex flex-wrap gap-3">
                            {contributors.filter(c => c.role === 'admin').map(admin => (
                                <div key={admin.id} className="flex items-center gap-2 px-3 py-2 bg-stone-50 rounded-full border border-stone-100 group">
                                    <img src={admin.avatar} className="w-6 h-6 rounded-full border border-white object-cover" alt={admin.name} onError={avatarOnError} />
                                    <span className="text-xs font-bold text-stone-600">{admin.name}</span>
                                    {admin.name.toLowerCase() !== 'admin' && (
                                        <button
                                            onClick={async () => { if (await confirm(`Revoke admin access for ${admin.name}?`, { variant: 'danger', confirmLabel: 'Revoke' })) onUpdateContributor({ ...admin, role: 'user' }); }}
                                            className="w-11 h-11 min-w-[2.75rem] min-h-[2.75rem] rounded-full bg-stone-200 text-stone-500 flex items-center justify-center text-[8px] hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                                            aria-label={`Revoke admin access for ${admin.name}`}
                                            title={`Revoke admin access for ${admin.name}`}
                                        >
                                            {'\u2715'}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
