/**
 * Installing ansible-dev-tools into the interpreter navita resolved.
 *
 * pip is the only backend today. When navita grows a uv/pip preference, the
 * branch belongs in `installCommand` — uv environments would use
 * `uv pip install --python <interpreter>` — and everything else here (running,
 * refreshing, reporting) stays the same.
 */

import { CommandService, DevToolsService } from '@ansible/developer-services';

import type { DevToolsInstallResult } from '../shared/ipc';

/** The package that brings the whole Ansible toolchain. */
export const DEV_TOOLS_PACKAGE = 'ansible-dev-tools';

export interface InstallCommand {
    readonly command: string;
    readonly args: readonly string[];
}

/**
 * Build the command that installs Ansible Dev Tools into an interpreter.
 * @param pythonPath - Interpreter of the environment navita runs commands in.
 * @param packages - Packages to install; defaults to ansible-dev-tools.
 * @returns Executable and arguments.
 */
export function installCommand(
    pythonPath: string,
    packages: readonly string[] = [DEV_TOOLS_PACKAGE],
): InstallCommand {
    return { command: pythonPath, args: ['-m', 'pip', 'install', ...packages] };
}

/**
 * Install ansible-dev-tools through DevToolsService's installer seam.
 *
 * The service runs the injected installer and then refreshes its package list,
 * so navita gets the same install semantics the extension has, backed by pip
 * instead of the Python Environments API.
 * @param pythonPath - Interpreter to install into.
 * @returns Exit code, combined output and the packages found afterwards.
 */
export async function installDevTools(pythonPath: string): Promise<DevToolsInstallResult> {
    const service = DevToolsService.getInstance();
    const { command, args } = installCommand(pythonPath);
    let exitCode = 0;
    let output = '';

    service.setPackageInstaller(async () => {
        const result = await CommandService.getInstance().runCommandArgs(command, [...args]);
        exitCode = result.exitCode;
        output = [result.stdout, result.stderr].filter(Boolean).join('\n');
        if (result.exitCode !== 0) {
            throw new Error(output || 'pip install failed');
        }
    });

    try {
        await service.install();
    } catch (error: unknown) {
        return {
            state: 'error',
            exitCode: exitCode === 0 ? 1 : exitCode,
            output:
                output.length > 0 ? output : error instanceof Error ? error.message : String(error),
            packageCount: service.getPackages().length,
        };
    }

    const packageCount = service.getPackages().length;
    if (packageCount === 0) {
        return {
            state: 'error',
            exitCode,
            output:
                output.length > 0
                    ? output
                    : 'ansible-dev-tools installed, but adt was not found afterwards.',
            packageCount,
        };
    }
    return { state: 'ready', exitCode, output, packageCount };
}

/**
 * Build the command that upgrades Ansible Dev Tools in an interpreter.
 * @param pythonPath - Interpreter of the environment navita runs commands in.
 * @returns Executable and arguments.
 */
export function upgradeCommand(pythonPath: string): InstallCommand {
    return {
        command: pythonPath,
        args: [
            '-m',
            'pip',
            'install',
            '--upgrade',
            '--upgrade-strategy',
            'eager',
            DEV_TOOLS_PACKAGE,
        ],
    };
}

/**
 * Upgrade ansible-dev-tools and re-read the packages that came with it.
 *
 * `DevToolsService.upgrade()` is VS Code only — it drives a terminal that the
 * extension host owns — so navita runs the same pip command itself and then
 * asks the service to refresh, leaving the service's own semantics alone.
 * @param pythonPath - Interpreter to upgrade in.
 * @returns Exit code, combined output and the packages found afterwards.
 */
export async function upgradeDevTools(pythonPath: string): Promise<DevToolsInstallResult> {
    const service = DevToolsService.getInstance();
    const { command, args } = upgradeCommand(pythonPath);
    let exitCode: number;
    let stdout = '';
    let stderr = '';
    let failure: string | undefined;

    try {
        const result = await CommandService.getInstance().runCommandArgs(command, [...args]);
        exitCode = result.exitCode;
        stdout = result.stdout;
        stderr = result.stderr;
    } catch (error: unknown) {
        exitCode = 1;
        failure = error instanceof Error ? error.message : String(error);
    }

    try {
        await service.refresh();
    } catch {
        // The command output is the useful diagnostic; package count covers the rest.
    }

    const packageCount = service.getPackages().length;
    const output = [stdout, stderr, failure].filter(Boolean).join('\n');
    return exitCode === 0
        ? { state: 'ready', exitCode, output, packageCount }
        : { state: 'error', exitCode, output, packageCount };
}
