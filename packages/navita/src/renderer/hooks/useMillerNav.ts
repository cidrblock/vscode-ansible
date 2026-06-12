import { useState, useCallback } from 'react';

export interface NavSegment {
    columnType: string;
    selectedId: string;
}

export type NavPath = NavSegment[];

export interface MillerNav {
    path: NavPath;
    select: (depth: number, columnType: string, selectedId: string) => void;
    reset: () => void;
    pathLength: number;
}

/**
 * Navigation state for dynamic Miller columns.
 *
 * `select(depth, type, id)` — the column at index `depth` selected item `id`.
 * This sets path[depth] = {type, id} and truncates everything after it.
 */
export function useMillerNav(): MillerNav {
    const [path, setPath] = useState<NavPath>([]);

    const select = useCallback((depth: number, columnType: string, selectedId: string) => {
        setPath((prev) => {
            const current = prev[depth];
            if (current && current.columnType === columnType && current.selectedId === selectedId) {
                return prev.length === depth + 1 ? prev : prev.slice(0, depth + 1);
            }
            return [...prev.slice(0, depth), { columnType, selectedId }];
        });
    }, []);

    const reset = useCallback(() => setPath([]), []);

    return { path, select, reset, pathLength: path.length };
}
