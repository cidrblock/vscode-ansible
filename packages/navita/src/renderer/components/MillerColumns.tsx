import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { Breadcrumb } from './Breadcrumb';
import type { BreadcrumbCrumb } from './Breadcrumb';

export interface ColumnDef {
    node: React.ReactNode;
    flex?: boolean;
    /** Breadcrumb label shown for this column. */
    label?: string;
}

interface MillerColumnsProps {
    columns: ColumnDef[];
    onBreadcrumbClick?: (columnIndex: number) => void;
}

const HOME_INDEX = -1;
const DEFAULT_NAV_WIDTH = 280;
const MIN_NAV_WIDTH = 180;
const MAX_SOLO_NAV_WIDTH = 360;
const TRANSITION_MS = 250;

const ANIM_CSS = `
@keyframes navita-slide-in {
  from { opacity: 0; transform: translateX(40px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes navita-slide-out {
  from { opacity: 1; transform: translateX(0); }
  to   { opacity: 0; transform: translateX(-40px); }
}
`;

export function MillerColumns({ columns, onBreadcrumbClick }: MillerColumnsProps): React.JSX.Element {
    const [navWidth, setNavWidth] = useState(DEFAULT_NAV_WIDTH);
    const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
    const [navAnimKey, setNavAnimKey] = useState(0);
    const [contentAnimKey, setContentAnimKey] = useState(0);
    const prevNavIdx = useRef(-1);
    const prevHadContent = useRef(false);

    const lastNavIdx = useMemo(() => {
        const flexIdx = columns.findIndex((c) => c.flex);
        if (flexIdx > 0) return flexIdx - 1;
        return columns.length - 1;
    }, [columns]);

    const contentCol = useMemo(
        () => columns.find((c) => c.flex) ?? null,
        [columns],
    );

    const hasContent = contentCol !== null;

    useEffect(() => {
        if (lastNavIdx !== prevNavIdx.current) {
            setNavAnimKey((k) => k + 1);
            prevNavIdx.current = lastNavIdx;
        }
        if (hasContent && !prevHadContent.current) {
            setContentAnimKey((k) => k + 1);
        }
        prevHadContent.current = hasContent;
    }, [lastNavIdx, hasContent]);

    const breadcrumbCrumbs = useMemo((): BreadcrumbCrumb[] => {
        const crumbs: BreadcrumbCrumb[] = [{ label: 'Home', columnIndex: HOME_INDEX }];
        for (let i = 0; i < columns.length; i++) {
            if (columns[i].flex) continue;
            const label = columns[i].label;
            if (label) crumbs.push({ label, columnIndex: i });
        }
        return crumbs;
    }, [columns]);

    const showBreadcrumb = breadcrumbCrumbs.length > 1;

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        dragRef.current = { startX: e.clientX, startWidth: navWidth };

        const onMouseMove = (ev: MouseEvent) => {
            if (!dragRef.current) return;
            const delta = ev.clientX - dragRef.current.startX;
            setNavWidth(Math.max(MIN_NAV_WIDTH, dragRef.current.startWidth + delta));
        };
        const onMouseUp = () => {
            dragRef.current = null;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }, [navWidth]);

    const lastNavCol = lastNavIdx >= 0 ? columns[lastNavIdx] : null;

    const navStyle: React.CSSProperties = {
        ...styles.column,
        width: `${navWidth}px`,
        minWidth: `${MIN_NAV_WIDTH}px`,
        borderRight: '1px solid var(--navita-border)',
    };

    const animStyle: React.CSSProperties = {
        animation: `navita-slide-in ${TRANSITION_MS}ms ease-out`,
    };

    return (
        <div style={styles.outer}>
            <style>{ANIM_CSS}</style>
            {showBreadcrumb && onBreadcrumbClick && (
                <Breadcrumb crumbs={breadcrumbCrumbs} onClick={onBreadcrumbClick} />
            )}
            <div style={styles.container}>
                {lastNavCol && (
                    <div key={`nav-${navAnimKey}`} style={{ ...navStyle, ...animStyle }}>
                        {lastNavCol.node}
                    </div>
                )}
                {hasContent && (
                    <>
                        <div style={styles.handle} onMouseDown={onMouseDown} />
                        <div key={`content-${contentAnimKey}`} style={{ ...styles.column, flex: 1, minWidth: '200px', ...animStyle }}>
                            {contentCol!.node}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    outer: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
    },
    container: {
        display: 'flex',
        flex: 1,
        overflowX: 'hidden',
        overflowY: 'hidden',
    },
    column: {
        overflowY: 'auto',
        overflowX: 'hidden',
        flexShrink: 0,
    },
    handle: {
        width: '4px',
        minWidth: '4px',
        cursor: 'col-resize',
        background: 'var(--navita-border)',
        flexShrink: 0,
        transition: 'background 150ms',
    },
};
