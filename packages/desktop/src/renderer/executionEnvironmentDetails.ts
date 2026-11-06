/**
 * One introspection run, shared by every level of the Execution Environments
 * view.
 *
 * Opening an image inspects it in a container. The image page and each of its
 * three package pages need that same answer, so the pending call is cached by
 * image name; without it, drilling from Python packages to system packages
 * would start the container again and flash an empty page in between.
 */

import type { ExecutionEnvironmentDetailsResult } from '../shared/ipc';

const pending = new Map<string, Promise<ExecutionEnvironmentDetailsResult>>();

/**
 * Inspect an image, reusing the result already fetched in this session.
 * @param fullName - Image name exactly as the list reported it.
 * @returns Details, or the failure; never rejects.
 */
export async function loadExecutionEnvironmentDetails(
    fullName: string,
): Promise<ExecutionEnvironmentDetailsResult> {
    const cached = pending.get(fullName);
    if (cached !== undefined) {
        return cached;
    }

    const request = window.navita
        .getExecutionEnvironmentDetails(fullName)
        .then((result) => {
            if (result.state === 'error') {
                pending.delete(fullName);
            }
            return result;
        })
        .catch((error: unknown) => {
            pending.delete(fullName);
            return {
                state: 'error' as const,
                detail: error instanceof Error ? error.message : String(error),
            };
        });

    pending.set(fullName, request);
    return request;
}

/**
 * Drop every cached inspection, for when the image list is refreshed.
 */
export function forgetExecutionEnvironmentDetails(): void {
    pending.clear();
}
