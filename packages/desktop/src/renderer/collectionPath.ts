/**
 * Trail ids for the Installed Collections drill-down.
 *
 * Kept free of React so the parsing can be tested directly, and so the view can
 * rebuild its level from the shared trail rather than keeping its own state.
 *
 * Names cannot contain `/` — collection names, plugin types and fully qualified
 * plugin names are all dot- or dash-separated — so it is safe as the separator.
 */

import type { Crumb } from './navigation';

const COLLECTION_PREFIX = 'collection:';
const PLUGIN_PREFIX = 'plugin:';

/** Level the trail describes, from the deepest crumb. */
export interface CollectionTrail {
    /** Collection being viewed, for example `ansible.builtin`. */
    readonly collection?: string;
    /** Plugin type opened inside that collection, for example `module`. */
    readonly pluginType?: string;
    /** Fully qualified plugin whose documentation is open. */
    readonly plugin?: string;
}

/**
 * Crumb for one collection.
 * @param name - Fully qualified collection name.
 * @returns The crumb to push.
 */
export function collectionCrumb(name: string): Crumb {
    return { id: `${COLLECTION_PREFIX}${name}`, label: name };
}

/**
 * Crumb for one plugin type inside a collection.
 * @param collection - Fully qualified collection name.
 * @param pluginType - Plugin type, as `module`.
 * @returns The crumb to push.
 */
export function pluginTypeCrumb(collection: string, pluginType: string): Crumb {
    return {
        id: `${COLLECTION_PREFIX}${collection}/${pluginType}`,
        label: pluginType,
    };
}

/**
 * Crumb for one plugin's documentation page.
 * @param fqcn - Fully qualified plugin name.
 * @param pluginType - Plugin type, as `module`.
 * @returns The crumb to push.
 */
export function pluginCrumb(fqcn: string, pluginType: string): Crumb {
    return { id: `${PLUGIN_PREFIX}${fqcn}/${pluginType}`, label: fqcn.split('.').pop() ?? fqcn };
}

/**
 * Read the collection trail into the level it describes.
 *
 * Only the deepest crumb of each kind matters: breadcrumb clicks truncate the
 * trail, so the deepest collection crumb is always the one on screen.
 * @param crumbs - Crumbs for the installed-collections section.
 * @returns Whatever levels the trail has reached.
 */
export function parseCollectionTrail(crumbs: readonly Crumb[]): CollectionTrail {
    let collection: string | undefined;
    let pluginType: string | undefined;
    let plugin: string | undefined;

    for (const crumb of crumbs) {
        const split = (id: string, prefix: string): [string, string | undefined] => {
            const payload = id.slice(prefix.length);
            const separator = payload.indexOf('/');
            return separator === -1
                ? [payload, undefined]
                : [payload.slice(0, separator), payload.slice(separator + 1)];
        };

        if (crumb.id.startsWith(COLLECTION_PREFIX)) {
            const [name, type] = split(crumb.id, COLLECTION_PREFIX);
            collection = name;
            pluginType = type;
        } else if (crumb.id.startsWith(PLUGIN_PREFIX)) {
            const [fqcn, type] = split(crumb.id, PLUGIN_PREFIX);
            plugin = fqcn;
            pluginType = type;
        }
    }

    return {
        ...(collection === undefined ? {} : { collection }),
        ...(pluginType === undefined ? {} : { pluginType }),
        ...(plugin === undefined ? {} : { plugin }),
    };
}
