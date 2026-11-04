import type { NavitaBridge } from '../shared/ipc';

declare global {
    interface Window {
        navita: NavitaBridge;
    }
}

export {};
