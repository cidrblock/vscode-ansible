/**
 * Typed wrapper around window.navitaAPI exposed by the preload script.
 * All renderer code should import from here rather than accessing window directly.
 */

import type { NavitaAPI } from '../main/preload';

declare global {
    interface Window {
        navitaAPI: NavitaAPI;
    }
}

export const api: NavitaAPI = window.navitaAPI;
