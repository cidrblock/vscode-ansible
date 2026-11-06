/**
 * Execution Environments view: container images built with ansible-builder.
 *
 * Wraps ExecutionEnvService, which asks podman or docker for images and keeps
 * only the ones carrying execution-environment labels.
 */

import { ExecutionEnvService } from '@ansible/developer-services';
import type { ExecutionEnvironment } from '@ansible/developer-services';

import type {
    ExecutionEnvironmentDetailsResult,
    ExecutionEnvironmentEntry,
    ExecutionEnvironmentsResult,
} from '../shared/ipc';

/**
 * Flatten container images into sorted IPC entries.
 * @param environments - Execution environments reported by the service.
 * @returns Entries ordered by image name.
 */
export function toEnvironmentEntries(
    environments: readonly ExecutionEnvironment[],
): ExecutionEnvironmentEntry[] {
    return environments
        .map((environment) => ({
            fullName: environment.full_name,
            imageId: environment.image_id,
            created: environment.created,
        }))
        .sort((left, right) => left.fullName.localeCompare(right.fullName));
}

/**
 * Force a reload and read the execution environments.
 * @returns Environments plus any failure detail; never throws.
 */
export async function loadExecutionEnvironments(): Promise<ExecutionEnvironmentsResult> {
    const service = ExecutionEnvService.getInstance();
    try {
        service.forceRefresh();
        const environments = await service.loadExecutionEnvironments();
        const entries = toEnvironmentEntries(environments);
        return { state: 'ready', environments: entries };
    } catch (error: unknown) {
        return {
            state: 'error',
            environments: [],
            detail: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Inspect one image and read everything the detail page shows.
 *
 * `loadDetails` runs a container, so it is awaited before the typed getters:
 * they read the same service cache, which means one introspection run rather
 * than four parallel ones.
 * @param fullName - Image name exactly as the list reported it.
 * @returns Details plus any failure detail; never throws.
 */
export async function loadExecutionEnvironmentDetails(
    fullName: string,
): Promise<ExecutionEnvironmentDetailsResult> {
    const service = ExecutionEnvService.getInstance();
    try {
        const details = await service.loadDetails(fullName);
        if (details === null) {
            return { state: 'error', detail: 'The image did not report any details.' };
        }

        const [collections, pythonPackages, systemPackages, info] = await Promise.all([
            service.getCollections(fullName),
            service.getPythonPackages(fullName),
            service.getSystemPackages(fullName),
            service.getInfo(fullName),
        ]);
        const environment = service.getExecutionEnvironment(fullName);

        return {
            state: 'ready',
            details: {
                fullName,
                ...(environment === undefined ? {} : { created: environment.created }),
                ...(environment === undefined ? {} : { imageId: environment.image_id }),
                info,
                collections,
                pythonPackages,
                systemPackages,
            },
        };
    } catch (error: unknown) {
        return {
            state: 'error',
            detail: error instanceof Error ? error.message : String(error),
        };
    }
}
