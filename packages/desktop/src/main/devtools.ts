/**
 * Dev Tools view: the Ansible developer packages installed in the Python
 * environment navita resolves from PATH.
 *
 * Wraps DevToolsService from packages/services, which already runs outside
 * VS Code, and flattens the result into a payload the renderer can hold.
 */

import { DevToolsService } from '@ansible/developer-services';
import type { DevToolPackage } from '@ansible/developer-services';

import type { DevToolEntry, DevToolsResult } from '../shared/ipc';

/**
 * Flatten discovered packages into the IPC shape.
 * @param packages - Packages reported by DevToolsService.
 * @returns Entries with the serialisable fields the renderer needs.
 */
export function toDevToolEntries(packages: readonly DevToolPackage[]): DevToolEntry[] {
    return packages.map((entry) =>
        entry.location === undefined
            ? { name: entry.name, version: entry.version }
            : { name: entry.name, version: entry.version, location: entry.location },
    );
}

/**
 * Refresh and read the dev tool packages of the active environment.
 * @returns Packages plus any failure detail; never throws.
 */
export async function loadDevTools(): Promise<DevToolsResult> {
    const service = DevToolsService.getInstance();
    try {
        await service.refresh();
    } catch (error: unknown) {
        return {
            state: 'error',
            packages: toDevToolEntries(service.getPackages()),
            detail: error instanceof Error ? error.message : String(error),
        };
    }
    return { state: 'ready', packages: toDevToolEntries(service.getPackages()) };
}
