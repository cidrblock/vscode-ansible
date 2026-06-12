import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { NavitaSettings } from '../shared/types';

const SETTINGS_FILE = path.join(
    os.homedir(),
    '.config',
    'ansible-navita',
    'settings.json',
);

const DEFAULT_SETTINGS: NavitaSettings = {
    colorScheme: 'auto',
    pythonPath: null,
    githubOrgs: [],
    llmProvider: null,
    llmModel: null,
    mcpAutoStart: true,
    mcpTransport: 'stdio',
    mcpPort: null,
    mcpSocketPath: null,
    mcpExposedTools: [],
    lspAutoStart: true,
    lspBinaryPath: null,
    controllerUrl: null,
    enableChat: false,
    abbenayAutoConnect: true,
    abbenayModel: null,
};

export function loadSettings(): NavitaSettings {
    try {
        const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) as Partial<NavitaSettings> };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

export function saveSettings(settings: NavitaSettings): void {
    const dir = path.dirname(SETTINGS_FILE);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}
