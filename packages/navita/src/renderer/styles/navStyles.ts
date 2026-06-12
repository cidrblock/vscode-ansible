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
    fontSize: 'var(--navita-font-size-sm)',
    color: 'var(--navita-text-secondary)',
    textAlign: 'left' as const,
    transition: 'var(--navita-transition)',
    borderBottom: '1px solid var(--navita-border)',
    borderLeftWidth: '2px',
    borderLeftStyle: 'solid',
    borderLeftColor: 'transparent',
};

export const navItemActive: CSSProperties = {
    background: 'var(--navita-accent-subtle)',
    color: 'var(--navita-text-primary)',
    fontWeight: 500,
    borderLeftColor: 'var(--navita-text-primary)',
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
    color: 'var(--navita-text-primary)',
    fontSize: 'var(--navita-font-size-sm)',
};

export const navMeta: CSSProperties = {
    fontSize: 'var(--navita-font-size-xs)',
    color: 'var(--navita-text-tertiary)',
    fontFamily: 'var(--navita-font-mono)',
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
    color: 'var(--navita-text-tertiary)',
    fontSize: 'var(--navita-font-size-sm)',
};

export const navSearchRow: CSSProperties = {
    display: 'flex',
    gap: '4px',
    padding: '8px 10px',
    borderBottom: '1px solid var(--navita-border)',
};
