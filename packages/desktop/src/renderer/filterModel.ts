/**
 * Filtering rules shared by every list view.
 *
 * Kept free of React so the matching and capping can be tested directly, and
 * so a view that only needs the predicate can import it without pulling in the
 * component layer.
 */

/**
 * Matching is a case-insensitive substring test where underscores and hyphens
 * count as spaces, which is what makes "search ansible plugins" find
 * `search_ansible_plugins`.
 *
 * Rows are capped after matching. The Galaxy catalog is a few thousand entries
 * and painting all of them is the expensive part; a filter makes one findable,
 * the cap keeps the view responsive.
 */

/** Most rows a list will render, however many matches there are. */
export const ROW_LIMIT = 200;

/**
 * Fold a string into the form matching compares.
 * @param value - Text to normalise.
 * @returns Lowercase text with separators turned into spaces.
 */
export function normalizeText(value: string): string {
    return value.toLowerCase().replace(/[_-]+/g, ' ');
}

/**
 * Test one row against the filter.
 * @param haystack - Searchable text for the row.
 * @param query - What the user typed.
 * @returns True when the query is empty or appears in the haystack.
 */
export function matchesQuery(haystack: string, query: string): boolean {
    const needle = normalizeText(query).trim();
    if (needle.length === 0) {
        return true;
    }
    return normalizeText(haystack).includes(needle);
}

export interface FilterResult<T> {
    /** Rows matching the query, before the render cap. */
    readonly matches: number;
    /** Rows the caller supplied. */
    readonly total: number;
    /** Matched rows, capped at ROW_LIMIT. */
    readonly items: readonly T[];
}

/**
 * Match rows against a query and cap what is handed back.
 * @param items - Every row the view has.
 * @param toHaystack - Searchable text for one row.
 * @param query - What the user typed.
 * @returns Matched rows (capped) plus match and total counts.
 */
export function filterItems<T>(
    items: readonly T[],
    toHaystack: (item: T) => string,
    query: string,
): FilterResult<T> {
    const matched = items.filter((item) => matchesQuery(toHaystack(item), query));
    return { matches: matched.length, total: items.length, items: matched.slice(0, ROW_LIMIT) };
}

export interface FilteredGroup<G, T> {
    /** The group as the view supplied it. */
    readonly group: G;
    /** Rows of that group that survived the filter and the cap. */
    readonly items: readonly T[];
}

export interface GroupFilterResult<G, T> {
    /** Rows matching the query across all groups, before the render cap. */
    readonly matches: number;
    /** Rows the caller supplied, across all groups. */
    readonly total: number;
    /** Groups that still have rows, each with its visible rows. */
    readonly groups: readonly FilteredGroup<G, T>[];
}

/**
 * Match grouped rows, dropping groups that empty out.
 *
 * The cap is shared across groups, so a large first group cannot starve the
 * ones after it out of the render budget entirely.
 * @param groups - Groups in display order.
 * @param itemsOf - Rows belonging to one group.
 * @param toHaystack - Searchable text for one row.
 * @param query - What the user typed.
 * @returns Surviving groups plus match and total counts.
 */
export function filterGroups<G, T>(
    groups: readonly G[],
    itemsOf: (group: G) => readonly T[],
    toHaystack: (item: T) => string,
    query: string,
): GroupFilterResult<G, T> {
    let budget = ROW_LIMIT;
    let matches = 0;
    let total = 0;
    const visible: FilteredGroup<G, T>[] = [];
    for (const group of groups) {
        const rows = itemsOf(group);
        total += rows.length;
        const hits = rows.filter((item) => matchesQuery(toHaystack(item), query));
        matches += hits.length;
        const capped = hits.slice(0, Math.max(budget, 0));
        budget -= capped.length;
        if (capped.length > 0) {
            visible.push({ group, items: capped });
        }
    }
    return { matches, total, groups: visible };
}
