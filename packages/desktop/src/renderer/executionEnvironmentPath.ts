/**
 * Trail ids for the Execution Environments drill-down.
 *
 * Kept free of React so the parses can be tested directly. Image names contain
 * `:` (tag) and `/` (registry path), so a crumb carries the whole name as its
 * label and the id is built around a prefix and a separator those names cannot
 * contain.
 */

import type { Crumb } from './navigation';

const IMAGE_PREFIX = 'ee:';
const PACKAGES_PREFIX = 'ee#';
const KIND_SEPARATOR = '|';

/** Package inventories an image reports, each with its own page. */
export type ExecutionEnvironmentPackageKind = 'collections' | 'python' | 'system';

/** Where the Execution Environments trail currently is. */
export type ExecutionEnvironmentPlace =
    | { readonly level: 'image'; readonly fullName: string }
    | {
          readonly level: 'packages';
          readonly fullName: string;
          readonly kind: ExecutionEnvironmentPackageKind;
      };

const KINDS: readonly ExecutionEnvironmentPackageKind[] = ['collections', 'python', 'system'];

const LABELS: Readonly<Record<ExecutionEnvironmentPackageKind, string>> = {
    collections: 'Ansible collections',
    python: 'Python packages',
    system: 'System packages',
};

/**
 * Crumb for one execution environment.
 * @param fullName - Image name, for example `quay.io/ansible/ansible-runner:latest`.
 * @returns The crumb to push.
 */
export function executionEnvironmentCrumb(fullName: string): Crumb {
    return { id: `${IMAGE_PREFIX}${fullName}`, label: fullName };
}

/**
 * Crumb for one package inventory of an image.
 * @param fullName - Image the inventory belongs to.
 * @param kind - Which inventory is being opened.
 * @returns The crumb to push.
 */
export function executionEnvironmentPackagesCrumb(
    fullName: string,
    kind: ExecutionEnvironmentPackageKind,
): Crumb {
    return {
        id: `${PACKAGES_PREFIX}${kind}${KIND_SEPARATOR}${fullName}`,
        label: LABELS[kind],
    };
}

/**
 * Heading for one package inventory.
 * @param kind - Which inventory.
 * @returns Its display name.
 */
export function executionEnvironmentPackageLabel(kind: ExecutionEnvironmentPackageKind): string {
    return LABELS[kind];
}

/**
 * Where the trail is, or undefined at the image list.
 * @param trail - Crumbs for the execution environments section.
 * @returns The image and, when drilled further, the inventory being shown.
 */
export function parseExecutionEnvironmentTrail(
    trail: readonly Crumb[],
): ExecutionEnvironmentPlace | undefined {
    const deepest = trail.at(-1);
    if (deepest === undefined) {
        return undefined;
    }

    if (deepest.id.startsWith(PACKAGES_PREFIX)) {
        const rest = deepest.id.slice(PACKAGES_PREFIX.length);
        const separator = rest.indexOf(KIND_SEPARATOR);
        if (separator <= 0) {
            return undefined;
        }
        const kind = rest.slice(0, separator);
        if (!KINDS.includes(kind as ExecutionEnvironmentPackageKind)) {
            return undefined;
        }
        return {
            level: 'packages',
            fullName: rest.slice(separator + 1),
            kind: kind as ExecutionEnvironmentPackageKind,
        };
    }

    if (deepest.id.startsWith(IMAGE_PREFIX)) {
        return { level: 'image', fullName: deepest.id.slice(IMAGE_PREFIX.length) };
    }

    return undefined;
}
