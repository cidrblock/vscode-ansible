import { app, BrowserWindow, Menu, nativeTheme, dialog } from 'electron';
import * as path from 'path';
import { initializeCoreBridge, disposeCoreBridge } from './coreBridge';
import { registerAbbenayHandlers } from './abbenayBridge';
import { disposeAbbenayClient } from './abbenayClient';
import { loadSettings } from './settingsStore';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
    Menu.setApplicationMenu(null);

    const settings = loadSettings();
    if (settings.colorScheme === 'light' || settings.colorScheme === 'dark') {
        nativeTheme.themeSource = settings.colorScheme;
    } else {
        nativeTheme.themeSource = 'system';
    }
    const isDark = settings.colorScheme === 'dark'
        || (settings.colorScheme === 'auto' && nativeTheme.shouldUseDarkColors);

    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 900,
        minHeight: 600,
        title: 'Ansible Navita',
        backgroundColor: isDark ? '#111111' : '#ffffff',
        frame: false,
        titleBarStyle: 'hidden',
        titleBarOverlay: false,
        webPreferences: {
            preload: path.join(__dirname, 'navita-preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });

    initializeCoreBridge(mainWindow);
    registerAbbenayHandlers();

    const rendererPath = path.join(__dirname, 'renderer', 'index.html');
    void mainWindow.loadFile(rendererPath);

    if (!app.isPackaged) {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady()
    .then(() => {
        createWindow();

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });
    })
    .catch((err: unknown) => {
        console.error('Failed to start Ansible Navita:', err);
        void dialog.showErrorBox(
            'Startup Error',
            `Failed to start Ansible Navita: ${err instanceof Error ? err.message : String(err)}`,
        );
    });

app.on('window-all-closed', () => {
    disposeCoreBridge();
    disposeAbbenayClient();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
