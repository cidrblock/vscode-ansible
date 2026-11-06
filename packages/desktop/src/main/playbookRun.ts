/**
 * Planning a playbook run for the user's terminal.
 *
 * navita does not run playbooks itself: a run is interactive at least as often
 * as it is unattended (vault prompts, `--step`, become passwords), and the
 * terminal the user already owns is the one place those work.
 *
 * What is built here is the argument list only. The terminal helper quotes each
 * word on the way out, so a playbook whose name contains `$` or a quote cannot
 * escape into a second command.
 */

import { buildNavigatorArgs, buildPlaybookArgs, type PlaybookConfig } from '@ansible/common';
import * as fs from 'node:fs';
import * as path from 'node:path';

/** What a run needs to know, all of it already decided by the caller. */
export interface PlaybookRunRequest {
    /** Open workspace; the run happens relative to it. */
    readonly workspacePath: string;
    /** Playbook path as the view named it, absolute or workspace-relative. */
    readonly playbookPath: string;
    /** Executor the user chose under Settings › Playbooks. */
    readonly executor: 'ansible-navigator' | 'ansible-playbook';
    /** Navigator config file, when one is set. */
    readonly navigatorConfig: string;
    /** Interpreter bin dir to put first on PATH, when one was resolved. */
    readonly binDir?: string | null;
    /** Inherited PATH, so the resolved bin dir extends it instead of replacing it. */
    readonly currentPath?: string | undefined;
}

export type PlaybookRunPlan = { readonly argv: readonly string[] } | { readonly error: string };

/**
 * Check that a playbook path names a real file inside the workspace.
 * @param workspacePath - Open workspace.
 * @param playbookPath - Path as reported by the playbooks view.
 * @returns Workspace-relative path to run, or the reason it cannot be run.
 */
export function resolvePlaybookPath(
    workspacePath: string,
    playbookPath: string,
): { readonly relativePath: string } | { readonly error: string } {
    const absolute = path.resolve(workspacePath, playbookPath);
    const relativePath = path.relative(workspacePath, absolute);
    if (
        relativePath.length === 0 ||
        relativePath.startsWith('..') ||
        path.isAbsolute(relativePath)
    ) {
        return { error: 'That playbook is outside the open workspace.' };
    }
    try {
        if (!fs.statSync(absolute).isFile()) {
            return { error: `${relativePath} is not a file.` };
        }
    } catch {
        return { error: `${relativePath} no longer exists. Rescan the workspace.` };
    }
    return { relativePath };
}

/**
 * Build the command a terminal should run for one playbook.
 *
 * The command stays workspace-relative because the terminal opens in the
 * workspace, which keeps the line short and the same one a user would type.
 * `ANSIBLE_NAVIGATOR_CONFIG` and the resolved bin dir ride on `env` rather than
 * being prepended to the line, so each one is still a single argv word.
 * @param request - Workspace, playbook, executor and environment to use.
 * @returns The argument list, or why the run cannot be planned.
 */
export function planPlaybookRun(request: PlaybookRunRequest): PlaybookRunPlan {
    const resolved = resolvePlaybookPath(request.workspacePath, request.playbookPath);
    if ('error' in resolved) {
        return resolved;
    }

    // Nothing is configured per play yet, so the flags list is empty and the
    // command stays `ansible-playbook site.yml`. Playbook config UI will fill
    // this in without changing anything below it.
    const config: PlaybookConfig = {};
    const run =
        request.executor === 'ansible-navigator'
            ? buildNavigatorArgs(resolved.relativePath, config)
            : buildPlaybookArgs(resolved.relativePath, config);

    const assignments: string[] = [];
    const navigatorConfig = request.navigatorConfig.trim();
    if (navigatorConfig.length > 0 && request.executor === 'ansible-navigator') {
        assignments.push(`ANSIBLE_NAVIGATOR_CONFIG=${navigatorConfig}`);
    }
    const binDir = request.binDir ?? null;
    if (binDir !== null) {
        const inherited = request.currentPath ?? '';
        assignments.push(
            inherited.length === 0
                ? `PATH=${binDir}`
                : `PATH=${binDir}${path.delimiter}${inherited}`,
        );
    }

    return { argv: assignments.length === 0 ? run : ['env', ...assignments, ...run] };
}
