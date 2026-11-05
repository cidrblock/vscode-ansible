/**
 * Environment Managers view: the Python interpreters navita can find without
 * a VS Code extension, grouped the way the extension's tree groups them.
 */

import {
    describeEnvironment,
    discoverLocalEnvironments,
    type LocalEnvironment,
} from '@ansible/developer-services';

import { pickEnvironment } from './environment';

import type {
    EnvironmentGroup,
    EnvironmentGroupsResult,
    LocalEnvironmentEntry,
} from '../shared/ipc';

const GROUP_LABELS: Readonly<Record<LocalEnvironment['kind'], string>> = {
    system: 'Global',
    venv: 'venv',
    virtualenv: 'virtualenv',
    uv: 'uv',
    pyenv: 'Pyenv',
    pipenv: 'Pipenv',
    conda: 'Conda',
};

/**
 * Group environments by the manager that would own them.
 * @param environments - Discovered environments, active one typically first.
 * @returns Groups in discovery order, with the active environment first inside its group.
 */
export function groupEnvironments(environments: readonly LocalEnvironment[]): EnvironmentGroup[] {
    const order: LocalEnvironment['kind'][] = [];
    const grouped = new Map<LocalEnvironment['kind'], LocalEnvironmentEntry[]>();

    for (const environment of environments) {
        const entry: LocalEnvironmentEntry = {
            name: environment.name,
            pythonPath: environment.pythonPath,
            active: environment.active,
            ...(environment.version === undefined ? {} : { version: environment.version }),
        };
        const existing = grouped.get(environment.kind);
        if (existing === undefined) {
            order.push(environment.kind);
            grouped.set(environment.kind, [entry]);
        } else {
            existing.push(entry);
        }
    }

    return order.map((kind) => ({
        id: kind,
        label: GROUP_LABELS[kind],
        environments: grouped.get(kind) ?? [],
    }));
}

/**
 * Discover the Python environments available to the open workspace.
 *
 * A pinned interpreter is described from its own path and listed first, so a
 * venv outside the scanned layouts still appears in the view that selected it.
 *
 * @param workspacePath - Workspace to scan for local virtual environments.
 * @param selection - Interpreter the user pinned, or null for automatic choice.
 * @returns Grouped environments, or the failure detail; never throws.
 */
export async function loadEnvironments(
    workspacePath: string | null,
    selection: string | null = null,
): Promise<EnvironmentGroupsResult> {
    try {
        const environments = await discoverLocalEnvironments({ workspacePath });
        const pinned = selection === null ? undefined : await describeEnvironment(selection);
        const listed =
            pinned === undefined
                ? environments
                : [
                      pinned,
                      ...environments.filter(
                          (environment) => environment.pythonPath !== pinned.pythonPath,
                      ),
                  ];
        const chosen = pinned ?? pickEnvironment(environments);
        // Discovery marks whatever is on PATH as active; the view is more useful
        // when it marks the environment navita will actually run commands in.
        const marked = listed.map((environment) => ({
            ...environment,
            active: environment === chosen,
        }));
        return {
            state: 'ready',
            groups: groupEnvironments(marked),
            selection: pinned?.pythonPath ?? null,
        };
    } catch (error: unknown) {
        return {
            state: 'error',
            groups: [],
            detail: error instanceof Error ? error.message : String(error),
        };
    }
}
