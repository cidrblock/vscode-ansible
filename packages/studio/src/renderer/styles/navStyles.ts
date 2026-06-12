import type { CSSProperties } from 'react';

/**
 * Shared styles for all navigation column items (Col1 sections and Col2 lists).
 * Import and spread these into per-component style objects so every
 * navigation column looks and feels identical.
 */

export const navItem: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '7px 12px',
    fontSize: 'var(--studio-font-size-sm)',
    color: 'var(--studio-text-secondary)',
    textAlign: 'left' as const,
    transition: 'var(--studio-transition)',
    borderBottom: '1px solid var(--studio-border)',
    borderLeftWidth: '2px',
    borderLeftStyle: 'solid',
    borderLeftColor: 'transparent',
};

export const navItemActive: CSSProperties = {
    background: 'var(--studio-accent-subtle)',
    color: 'var(--studio-text-primary)',
    fontWeight: 500,
    borderLeftColor: 'var(--studio-text-primary)',
};

export const navItemStacked: CSSProperties = {
    ...navItem,
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: '1px',
};

export const navLabel: CSSProperties = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    color: 'var(--studio-text-primary)',
    fontSize: 'var(--studio-font-size-sm)',
};

export const navMeta: CSSProperties = {
    fontSize: 'var(--studio-font-size-xs)',
    color: 'var(--studio-text-tertiary)',
    fontFamily: 'var(--studio-font-mono)',
    flexShrink: 0,
};

export const navList: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflowY: 'auto' as const,
};

export const navMuted: CSSProperties = {
    padding: '12px',
    color: 'var(--studio-text-tertiary)',
    fontSize: 'var(--studio-font-size-sm)',
};

export const navSearchRow: CSSProperties = {
    display: 'flex',
    gap: '4px',
    padding: '8px 10px',
    borderBottom: '1px solid var(--studio-border)',
};
