import React from 'react';

interface PageHeaderProps {
    /** Small uppercase label above the title (e.g. "Cook · Plan · Shop") */
    eyebrow?: string;
    title: string;
    description?: React.ReactNode;
    /** Heading id for aria-labelledby */
    id?: string;
    className?: string;
    /** Semantic heading level — default 2 for in-app views */
    titleLevel?: 1 | 2;
    /** Right-aligned actions (toolbar buttons) on md+ */
    actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
    eyebrow,
    title,
    description,
    id,
    className = '',
    titleLevel = 2,
    actions,
}) => {
    const headerContent = (
        <header className={`space-y-2 ${className}`.trim()}>
            {eyebrow && (
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#A0522D] dark:text-orange-200">
                    {eyebrow}
                </p>
            )}
            {titleLevel === 1 ? (
                <h1
                    id={id}
                    className="text-2xl md:text-4xl font-serif italic text-[var(--color-brand)] dark:text-emerald-300 leading-tight"
                >
                    {title}
                </h1>
            ) : (
                <h2
                    id={id}
                    className="text-2xl md:text-4xl font-serif italic text-[var(--color-brand)] dark:text-emerald-300 leading-tight"
                >
                    {title}
                </h2>
            )}
            {description && (
                <p className="text-sm text-stone-500 dark:text-stone-400">{description}</p>
            )}
        </header>
    );

    if (!actions) return headerContent;

    return (
        <div className="page-header-row">
            <div className="page-header-row__main">{headerContent}</div>
            <div className="page-header-row__actions">{actions}</div>
        </div>
    );
};
