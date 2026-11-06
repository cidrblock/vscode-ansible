/**
 * Trail id for the Execution Environments drill-down.
 *
 * Kept free of React so the parse can be tested directly. Image names contain
 * `:` (tag) and `/` (registry path), so the crumb carries the whole name as its
 * label and only prefixes the id to tell it apart from other sections.
 */

import type { Crumb } from './navigation';

const EE_PREFIX = 'ee:';

/**
 * Crumb for one execution environment.
 * @param fullName - Image name, for example `quay.io/ansible/ansible-runner:latest`.
 * @returns The crumb to push.
 */
export function executionEnvironmentCrumb(fullName: string): Crumb {
    return { id: `${EE_PREFIX}${fullName}`, label: fullName };
}

/**
 * Image name the trail is currently showing.
 * @param trail - Crumbs for the execution environments section.
 * @returns The image name, or undefined at the list level.
 */
export function parseExecutionEnvironmentTrail(trail: readonly Crumb[]): string | undefined {
    const deepest = trail.at(-1);
    if (deepest?.id.startsWith(EE_PREFIX) !== true) {
        return undefined;
    }
    return deepest.id.slice(EE_PREFIX.length);
}
