/**
 * Typed wrapper around window.studioAPI exposed by the preload script.
 * All renderer code should import from here rather than accessing window directly.
 */

import type { StudioAPI } from '../main/preload';

declare global {
    interface Window {
        studioAPI: StudioAPI;
    }
}

export const api: StudioAPI = window.studioAPI;
