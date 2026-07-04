import React from 'react';

interface ViewActionBarProps {
    children: React.ReactNode;
    /** Optional trailing meta (e.g. item count) — hidden on small screens */
    meta?: React.ReactNode;
    className?: string;
    /** Sticky above bottom nav on mobile; default true */
    sticky?: boolean;
}

/** Primary actions row — same sticky position and button layout across views. */
export const ViewActionBar: React.FC<ViewActionBarProps> = ({
    children,
    meta,
    className = '',
    sticky = true,
}) => (
    <div
        className={`view-action-bar ${sticky ? 'view-action-bar--sticky' : ''} ${className}`.trim()}
        role="group"
    >
        <div className="view-action-bar__actions">{children}</div>
        {meta ? <div className="view-action-bar__meta">{meta}</div> : null}
    </div>
);
