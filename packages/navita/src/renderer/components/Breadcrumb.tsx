import React from 'react';

export interface BreadcrumbCrumb {
    label: string;
    columnIndex: number;
}

interface BreadcrumbProps {
    crumbs: BreadcrumbCrumb[];
    onClick: (columnIndex: number) => void;
}

export function Breadcrumb({ crumbs, onClick }: BreadcrumbProps): React.JSX.Element | null {
    if (crumbs.length === 0) return null;

    return (
        <nav style={styles.bar} aria-label="Breadcrumb">
            {crumbs.map((crumb, i) => (
                <React.Fragment key={crumb.columnIndex}>
                    {i > 0 && <span style={styles.separator} aria-hidden="true">/</span>}
                    <button
                        style={styles.crumb}
                        onClick={() => onClick(crumb.columnIndex)}
                        title={crumb.label}
                    >
                        {crumb.label}
                    </button>
                </React.Fragment>
            ))}
        </nav>
    );
}

const styles: Record<string, React.CSSProperties> = {
    bar: {
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        padding: '5px 12px',
        borderBottom: '1px solid var(--navita-border)',
        background: 'var(--navita-bg-secondary)',
        flexShrink: 0,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        minHeight: '28px',
    },
    crumb: {
        fontSize: 'var(--navita-font-size-xs)',
        color: 'var(--navita-text-secondary)',
        background: 'none',
        border: 'none',
        padding: '2px 6px',
        borderRadius: '3px',
        cursor: 'pointer',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: '180px',
        transition: 'var(--navita-transition)',
        flexShrink: 0,
    },
    separator: {
        color: 'var(--navita-text-tertiary)',
        fontSize: 'var(--navita-font-size-xs)',
        flexShrink: 0,
        userSelect: 'none',
    },
};
