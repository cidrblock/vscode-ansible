/**
 * Depth model shared by every view.
 *
 * Each section keeps its own trail of crumbs, so switching sections and
 * coming back restores where the user was, while Back always means "one level
 * up in the view I am looking at". Views push a crumb when they drill in and
 * render from the trail instead of keeping their own open/closed state.
 */

import { createContext, useContext, useMemo, type JSX, type ReactNode } from 'react';

import { SECTIONS, type SectionId } from '../shared/ipc';

/** One level of depth inside a view. */
export interface Crumb {
    /** Identifier the view uses to rebuild its state, for example a command path. */
    readonly id: string;
    /** Text shown in the breadcrumb trail. */
    readonly label: string;
}

/** Per-section depth, so each view remembers how deep the user went. */
export type Trails = Readonly<Record<SectionId, readonly Crumb[]>>;

/**
 * Build the empty trail set.
 * @returns Every section at depth zero.
 */
export function emptyTrails(): Trails {
    const trails: Record<string, readonly Crumb[]> = {};
    for (const section of SECTIONS) {
        trails[section.id] = [];
    }
    return trails as Trails;
}

/**
 * The trail for one section.
 * @param trails - All section trails.
 * @param section - Section to read.
 * @returns Its crumbs, newest last; empty at the root.
 */
export function trailFor(trails: Trails, section: SectionId): readonly Crumb[] {
    return trails[section];
}

/**
 * Go one level deeper.
 * @param trails - All section trails.
 * @param section - Section being drilled into.
 * @param crumb - Level to add.
 * @returns Updated trails.
 */
export function pushCrumb(trails: Trails, section: SectionId, crumb: Crumb): Trails {
    return { ...trails, [section]: [...trailFor(trails, section), crumb] };
}

/**
 * Go one level up.
 * @param trails - All section trails.
 * @param section - Section to back out of.
 * @returns Updated trails, unchanged at the root.
 */
export function popCrumb(trails: Trails, section: SectionId): Trails {
    const current = trailFor(trails, section);
    if (current.length === 0) {
        return trails;
    }
    return { ...trails, [section]: current.slice(0, -1) };
}

/**
 * Cut a trail back to a given depth, for breadcrumb clicks.
 * @param trails - All section trails.
 * @param section - Section to trim.
 * @param depth - Number of crumbs to keep.
 * @returns Updated trails.
 */
export function truncateTrail(trails: Trails, section: SectionId, depth: number): Trails {
    return { ...trails, [section]: trailFor(trails, section).slice(0, Math.max(0, depth)) };
}

export interface NavigationContextValue {
    readonly trails: Trails;
    /** Apply a change; the provider owns the state. */
    readonly update: (change: (trails: Trails) => Trails) => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

/**
 * Provide the trail state to the views.
 * @param props - Component properties.
 * @param props.value - Trails and the updater owned by the app shell.
 * @param props.children - Views that read or write the trail.
 * @returns The provider element.
 */
export function NavigationProvider(props: {
    value: NavigationContextValue;
    children: ReactNode;
}): JSX.Element {
    return (
        <NavigationContext.Provider value={props.value}>
            {props.children}
        </NavigationContext.Provider>
    );
}

/**
 * Read the navigation context.
 * @returns Trails and updater from the nearest provider.
 */
export function useNavigation(): NavigationContextValue {
    const value = useContext(NavigationContext);
    if (value === null) {
        throw new Error('useNavigation must be used within a NavigationProvider');
    }
    return value;
}

export interface SectionTrail {
    readonly trail: readonly Crumb[];
    readonly push: (crumb: Crumb) => void;
    readonly pop: () => void;
    readonly reset: () => void;
}

/**
 * Trail helpers bound to one section.
 * @param section - Section the calling view belongs to.
 * @returns Its crumbs plus push/pop/reset.
 */
export function useTrail(section: SectionId): SectionTrail {
    const { trails, update } = useNavigation();
    return useMemo(
        () => ({
            trail: trailFor(trails, section),
            push: (crumb: Crumb) => {
                update((current) => pushCrumb(current, section, crumb));
            },
            pop: () => {
                update((current) => popCrumb(current, section));
            },
            reset: () => {
                update((current) => truncateTrail(current, section, 0));
            },
        }),
        [trails, update, section],
    );
}
