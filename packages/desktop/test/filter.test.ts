import { describe, expect, it } from 'vitest';

import {
    filterGroups,
    filterItems,
    matchesQuery,
    normalizeText,
    ROW_LIMIT,
} from '../src/renderer/filterModel';

/**
 * Build fake rows with a searchable name.
 * @param count - How many rows to build.
 * @param prefix - Name prefix, so a test can pick a subset.
 * @returns Rows numbered from zero.
 */
function rows(count: number, prefix = 'row'): { name: string }[] {
    return Array.from({ length: count }, (_unused, index) => ({
        name: `${prefix}-${String(index)}`,
    }));
}

const nameOf = (row: { name: string }): string => row.name;

describe('normalizeText', () => {
    it('folds case and treats separators as spaces', () => {
        expect(normalizeText('Search_Ansible-Plugins')).toBe('search ansible plugins');
    });
});

describe('matchesQuery', () => {
    it('matches an empty query against everything', () => {
        expect(matchesQuery('anything', '')).toBe(true);
        expect(matchesQuery('anything', '   ')).toBe(true);
    });

    it('finds underscored names typed with spaces', () => {
        expect(matchesQuery('search_ansible_plugins', 'search ansible')).toBe(true);
        expect(matchesQuery('search_ansible_plugins', 'ansible plugins')).toBe(true);
    });

    it('finds spaced names typed with underscores', () => {
        expect(matchesQuery('Ansible Dev Tools', 'dev_tools')).toBe(true);
    });

    it('is case insensitive and rejects misses', () => {
        expect(matchesQuery('Ansible Lint', 'LINT')).toBe(true);
        expect(matchesQuery('Ansible Lint', 'molecule')).toBe(false);
    });
});

describe('filterItems', () => {
    it('returns every row for a blank query', () => {
        const result = filterItems(rows(5), nameOf, '');
        expect(result.total).toBe(5);
        expect(result.matches).toBe(5);
        expect(result.items).toHaveLength(5);
    });

    it('counts matches but caps what it returns', () => {
        const items = rows(ROW_LIMIT + 25);
        const result = filterItems(items, nameOf, 'row');
        expect(result.total).toBe(ROW_LIMIT + 25);
        expect(result.matches).toBe(ROW_LIMIT + 25);
        expect(result.items).toHaveLength(ROW_LIMIT);
    });

    it('narrows the match count with a query', () => {
        const items = [...rows(3, 'alpha'), ...rows(2, 'beta')];
        const result = filterItems(items, nameOf, 'beta');
        expect(result.matches).toBe(2);
        expect(result.total).toBe(5);
        expect(result.items.map(nameOf)).toEqual(['beta-0', 'beta-1']);
    });
});

describe('filterGroups', () => {
    const groups = [
        { id: 'a', items: rows(3, 'alpha') },
        { id: 'b', items: rows(2, 'beta') },
    ];
    const itemsOf = (group: { items: { name: string }[] }): { name: string }[] => group.items;

    it('keeps every group for a blank query', () => {
        const result = filterGroups(groups, itemsOf, nameOf, '');
        expect(result.groups.map((entry) => entry.group.id)).toEqual(['a', 'b']);
        expect(result.total).toBe(5);
    });

    it('drops groups that empty out', () => {
        const result = filterGroups(groups, itemsOf, nameOf, 'beta');
        expect(result.groups.map((entry) => entry.group.id)).toEqual(['b']);
        expect(result.matches).toBe(2);
    });

    it('shares the render budget across groups', () => {
        const big = [
            { id: 'big', items: rows(ROW_LIMIT, 'big') },
            { id: 'small', items: rows(10, 'small') },
        ];
        const result = filterGroups(big, itemsOf, nameOf, '');
        const shown = result.groups.reduce((count, entry) => count + entry.items.length, 0);
        expect(result.matches).toBe(ROW_LIMIT + 10);
        expect(shown).toBe(ROW_LIMIT);
        expect(result.groups.map((entry) => entry.group.id)).toEqual(['big']);
    });

    it('reports a total even when nothing matches', () => {
        const result = filterGroups(groups, itemsOf, nameOf, 'zzz');
        expect(result.groups).toHaveLength(0);
        expect(result.matches).toBe(0);
        expect(result.total).toBe(5);
    });
});
