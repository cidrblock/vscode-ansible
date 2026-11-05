import { describe, expect, it } from 'vitest';

import {
    emptyTrails,
    popCrumb,
    pushCrumb,
    trailFor,
    truncateTrail,
} from '../src/renderer/navigation';

const command = { id: 'init collection', label: 'init collection' };
const play = { id: 'site.yml', label: 'site.yml' };

describe('navigation trails', () => {
    it('starts every section at the root', () => {
        const trails = emptyTrails();
        expect(trailFor(trails, 'creator')).toEqual([]);
        expect(trailFor(trails, 'execution-environments')).toEqual([]);
    });

    it('keeps depth per section', () => {
        const trails = pushCrumb(emptyTrails(), 'creator', command);
        expect(trailFor(trails, 'creator')).toEqual([command]);
        expect(trailFor(trails, 'playbooks')).toEqual([]);
    });

    it('pops one level and stops at the root', () => {
        const pushed = pushCrumb(pushCrumb(emptyTrails(), 'creator', command), 'creator', play);
        const popped = popCrumb(pushed, 'creator');
        expect(trailFor(popped, 'creator')).toEqual([command]);
        expect(popCrumb(popped, 'creator')).toEqual(emptyTrails());
    });

    it('truncates to a breadcrumb depth', () => {
        const pushed = pushCrumb(pushCrumb(emptyTrails(), 'creator', command), 'creator', play);
        expect(trailFor(truncateTrail(pushed, 'creator', 1), 'creator')).toEqual([command]);
        expect(trailFor(truncateTrail(pushed, 'creator', 0), 'creator')).toEqual([]);
    });
});
