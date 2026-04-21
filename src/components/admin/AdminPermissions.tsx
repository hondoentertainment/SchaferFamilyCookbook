import React, { useState } from 'react';
import { ContributorProfile } from '../../types';
import { useUI } from '../../context/UIContext';
import { avatarOnError } from '../../utils/avatarFallback';

interface AdminPermissionsProps {
    contributors: ContributorProfile[];
    onUpdateContributor: (c: ContributorProfile) => Promise<void>;
}

export const AdminPermissions: React.FC<AdminPermissionsProps> = ({
    contributors,
    onUpdateContributor
}) => {
    const { toast, confirm } = useUI();
    const [newAdminName, setNewAdminName] = useState('');
    const [isPromotingAdmin, setIsPromotingAdmin] = useState(false);

    return (
        <section id="admin-panel-permissions" role="tabpanel" aria-labelledby="admin-tab-permissions" className="bg-white/70 backdrop-blur-xl rounded-[2rem] md:rounded-[3rem] p-6 md:p-16 border border-stone-200/50 shadow-[0_20px_40px_rgba(45,70,53,0.08)] relative overflow-hidden animate-in fade-in slide-in-from-bottom-4">
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-50 rounded-full -mr-32 -mt-32 blur-3xl opacity-50" />
            <div className="relative z-10">
                <h2 className="text-3xl font-serif italic text-[#2D4635] mb-8 flex items-center gap-4">
                    <span className="w-12 h-12 rounded-full bg-[#2D4635]/5 flex items-center justify-center not-italic text-2xl">🔐</span>
                    Admin & Permissions
                </h2>
                <div className="grid md:grid-cols-2 gap-12">
                    <div className="space-y-6">
                        <p className="text-stone-500 text-sm leading-relaxed">Promote family members to admin status by their legacy name.</p>
                        <div className="flex gap-4">
                            <label htmlFor="admin-promote-name" className="sr-only">Enter name to promote</label>
                            <input id="admin-promote-name" type="text" placeholder="Enter name (e.g. Aunt Mary)" className="flex-1 px-6 py-4 bg-white/50 border border-stone-200/50 rounded-2xl text-base font-serif outline-none focus:bg-white focus:ring-2 focus:ring-[#2D4635]/10 transition-colors" value={newAdminName} onChange={e => setNewAdminName(e.target.value)} />
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
                                className="px-8 py-4 bg-[#2D4635] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg disabled:opacity-70 disabled:cursor-not-allowed hover:bg-[#1e2f23] transition-colors"
                            >
                                {isPromotingAdmin ? 'Saving...' : 'Grant Access'}
                            </button>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-[#A0522D]">Current Administrators</h4>
                        <div className="flex flex-wrap gap-3">
                            {contributors.filter(c => c.role === 'admin').map(admin => (
                                <div key={admin.id} className="flex items-center gap-2 px-3 py-2 bg-white/80 rounded-full border border-stone-200/50 group shadow-sm transition-all hover:bg-white">
                                    <img src={admin.avatar} className="w-6 h-6 rounded-full border border-white object-cover" alt={admin.name} onError={avatarOnError} />
                                    <span className="text-xs font-bold text-stone-600">{admin.name}</span>
                                    {admin.name.toLowerCase() !== 'admin' && (
                                        <button
                                            onClick={async () => { if (await confirm(`Revoke admin access for ${admin.name}?`, { variant: 'danger', confirmLabel: 'Revoke' })) onUpdateContributor({ ...admin, role: 'user' }); }}
                                            className="w-11 h-11 min-w-[2.75rem] min-h-[2.75rem] rounded-full bg-stone-100 text-stone-400 flex items-center justify-center text-[8px] hover:bg-red-50 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                                            aria-label={`Revoke admin access for ${admin.name}`}
                                            title={`Revoke admin access for ${admin.name}`}
                                        >
                                            ✕
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
