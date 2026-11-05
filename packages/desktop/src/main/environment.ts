/**
 * The Python environment navita's services run commands in.
 *
 * Inside VS Code the extension injects a bin dir resolver that delegates to the
 * Python extension, so every service runs in the interpreter the user selected.
 * Standalone there is only the environment cache and PATH, which misses the
 * common case of a project virtual environment that is not activated. This
 * module fills that gap with the extension-free discovery in
 * packages/services, so ansible-doc, ade and dev tools all agree on one
 * environment.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { CommandService, discoverLocalEnvironments } from '@ansible/developer-services';
import type { LocalEnvironment } from '@ansible/developer-services';

/** Tools whose presence marks an environment as the Ansible one. */
const ANSIBLE_TOOLS = ['ansible-doc', 'ansible-playbook'] as const;

/**
 * Whether an environment ships the Ansible command line tools.
 * @param environment - Discovered environment to inspect.
 * @returns True when the environment's bin dir has ansible-doc or ansible-playbook.
 */
export function hasAnsibleTools(environment: LocalEnvironment): boolean {
    return ANSIBLE_TOOLS.some((tool) => fs.existsSync(path.join(environment.binDir, tool)));
}

/**
 * Choose the environment navita should run commands in.
 *
 * An environment with the Ansible tools wins, the active one first: without a
 * selection UI that is the one most likely to be the user's intent. Falling
 * back to the active interpreter keeps "nothing installed yet" honest instead
 * of pointing at an unrelated environment.
 *
 * @param environments - Discovered environments, active one normally first.
 * @param hasTools - Predicate for an environment that can run Ansible.
 * @returns The chosen environment, or undefined when none was discovered.
 */
export function pickEnvironment(
    environments: readonly LocalEnvironment[],
    hasTools: (environment: LocalEnvironment) => boolean = hasAnsibleTools,
): LocalEnvironment | undefined {
    const capables = environments.filter(hasTools);
    return (
        capables.find((environment) => environment.active) ??
        capables.at(0) ??
        environments.find((environment) => environment.active) ??
        environments.at(0)
    );
}

/**
 * Resolve the bin dir of the environment for a workspace.
 *
 * Discovery walks the home directory, so the answer is memoised per workspace
 * and only recomputed when the workspace changes.
 *
 * @param workspacePath - Open workspace, used to find project environments.
 * @returns Bin dir to prepend to PATH, or null when nothing usable was found.
 */
export async function resolveBinDir(workspacePath: string | null): Promise<string | null> {
    return (await resolveEnvironment(workspacePath))?.binDir ?? null;
}

const environmentCache = new Map<string, LocalEnvironment | undefined>();

/**
 * Discover and pick the environment for a workspace, memoised.
 * @param workspacePath - Open workspace, or null when none is open.
 * @returns The chosen environment, or undefined when none was discovered.
 */
async function resolveEnvironment(
    workspacePath: string | null,
): Promise<LocalEnvironment | undefined> {
    const key = workspacePath ?? '';
    if (environmentCache.has(key)) {
        return environmentCache.get(key);
    }
    let picked: LocalEnvironment | undefined;
    try {
        picked = pickEnvironment(await discoverLocalEnvironments({ workspacePath }));
    } catch (error: unknown) {
        console.error(
            `navita: environment discovery failed: ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
    }
    environmentCache.set(key, picked);
    return picked;
}

/**
 * Drop memoised discovery, for example after a workspace is reopened.
 */
export function resetEnvironmentCache(): void {
    environmentCache.clear();
}

/**
 * Install the resolver CommandService consults before the environment cache.
 * @param getWorkspacePath - Reads the workspace navita currently has open.
 */
export function installEnvironmentResolver(getWorkspacePath: () => string | null): void {
    CommandService.getInstance().setBinDirResolver(() => resolveBinDir(getWorkspacePath()));
}
