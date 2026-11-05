/**
 * The filter control and the hooks the views bind to it.
 *
 * Matching and capping live in `filterModel` so they can be tested without a
 * renderer; this file is the React half — one input and two hooks.
 */

import { useEffect, useMemo, useRef, useState, type JSX } from 'react';

import { filterGroups, filterItems, type GroupFilterResult } from './filterModel';

export {
    filterGroups,
    filterItems,
    matchesQuery,
    normalizeText,
    ROW_LIMIT,
    type FilteredGroup,
    type FilterResult,
    type GroupFilterResult,
} from './filterModel';

export interface ListFilter<T> {
    /** Current query text. */
    readonly query: string;
    /** Replace the query text. */
    readonly setQuery: (value: string) => void;
    /** True when a non-blank query is in effect. */
    readonly active: boolean;
    /** Matched rows, capped at ROW_LIMIT. */
    readonly items: readonly T[];
    /** Rows matching the query, before the render cap. */
    readonly matches: number;
    /** Rows the view was given. */
    readonly total: number;
}

/**
 * Filter a flat list of rows.
 * @param items - Every row the view has.
 * @param toHaystack - Searchable text for one row.
 * @returns Query state plus the visible rows and counts.
 */
export function useListFilter<T>(
    items: readonly T[],
    toHaystack: (item: T) => string,
): ListFilter<T> {
    const [query, setQuery] = useState('');
    const result = useMemo(() => filterItems(items, toHaystack, query), [items, toHaystack, query]);
    return { query, setQuery, active: query.trim().length > 0, ...result };
}

export interface GroupFilter<G, T> extends GroupFilterResult<G, T> {
    /** Current query text. */
    readonly query: string;
    /** Replace the query text. */
    readonly setQuery: (value: string) => void;
    /** True when a non-blank query is in effect. */
    readonly active: boolean;
}

/**
 * Filter rows that the view already groups.
 * @param groups - Groups in display order.
 * @param itemsOf - Rows belonging to one group.
 * @param toHaystack - Searchable text for one row.
 * @returns Query state plus surviving groups and counts.
 */
export function useGroupedFilter<G, T>(
    groups: readonly G[],
    itemsOf: (group: G) => readonly T[],
    toHaystack: (item: T) => string,
): GroupFilter<G, T> {
    const [query, setQuery] = useState('');
    const result = useMemo(
        () => filterGroups(groups, itemsOf, toHaystack, query),
        [groups, itemsOf, toHaystack, query],
    );
    return { query, setQuery, active: query.trim().length > 0, ...result };
}

export interface FilterBoxProps {
    /** Current query text. */
    readonly value: string;
    /** Called on every keystroke, and with an empty string on Escape. */
    readonly onChange: (value: string) => void;
    /** Placeholder and accessible name, e.g. "Filter tools". */
    readonly label: string;
}

/**
 * The one filter control: a search input that takes Escape and Ctrl/Cmd+F.
 * @param props - Component properties.
 * @returns The filter input.
 */
export function FilterBox(props: FilterBoxProps): JSX.Element {
    const { value, onChange, label } = props;
    const input = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent): void => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
                event.preventDefault();
                input.current?.focus();
                input.current?.select();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
        };
    }, []);

    return (
        <input
            ref={input}
            type="search"
            className="filter-box"
            value={value}
            placeholder={label}
            aria-label={label}
            onChange={(event) => {
                onChange(event.target.value);
            }}
            onKeyDown={(event) => {
                if (event.key === 'Escape' && value.length > 0) {
                    event.stopPropagation();
                    onChange('');
                }
            }}
        />
    );
}

export interface CapNoticeProps {
    /** Rows actually rendered. */
    readonly shown: number;
    /** Rows that matched the query. */
    readonly matches: number;
}

/**
 * Say so when the render cap hid matches, rather than looking truncated.
 * @param props - Component properties.
 * @returns The notice, or null when everything matched is on screen.
 */
export function CapNotice(props: CapNoticeProps): JSX.Element | null {
    const { shown, matches } = props;
    if (shown >= matches) {
        return null;
    }
    return (
        <p className="muted">
            Showing the first {String(shown)} of {String(matches)} matches — refine the filter to
            narrow further.
        </p>
    );
}
