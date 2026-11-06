import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { planPlaybookRun, resolvePlaybookPath } from '../src/main/playbookRun';
import { commandLine } from '../src/main/terminal';

let workspace: string;

beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'navita-playbook-run-'));
    fs.mkdirSync(path.join(workspace, 'playbooks'));
    fs.writeFileSync(path.join(workspace, 'playbooks', 'site.yml'), '- hosts: all\n');
});

afterEach(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
});

describe('resolvePlaybookPath', () => {
    it('answers with the workspace-relative path', () => {
        expect(resolvePlaybookPath(workspace, 'playbooks/site.yml')).toEqual({
            relativePath: 'playbooks/site.yml',
        });
    });

    it('accepts an absolute path inside the workspace', () => {
        const absolute = path.join(workspace, 'playbooks', 'site.yml');
        expect(resolvePlaybookPath(workspace, absolute)).toEqual({
            relativePath: 'playbooks/site.yml',
        });
    });

    it('refuses to leave the workspace', () => {
        const outside = resolvePlaybookPath(workspace, '../outside.yml');
        expect(outside).toHaveProperty('error');
    });

    it('reports a playbook that has gone', () => {
        const missing = resolvePlaybookPath(workspace, 'playbooks/gone.yml');
        expect(missing).toHaveProperty('error');
    });
});

describe('planPlaybookRun', () => {
    it('builds the ansible-playbook command relative to the workspace', () => {
        const plan = planPlaybookRun({
            workspacePath: workspace,
            playbookPath: 'playbooks/site.yml',
            executor: 'ansible-playbook',
            navigatorConfig: '',
        });
        expect(plan).toEqual({ argv: ['ansible-playbook', 'playbooks/site.yml'] });
    });

    it('builds the ansible-navigator command when that executor is chosen', () => {
        const plan = planPlaybookRun({
            workspacePath: workspace,
            playbookPath: 'playbooks/site.yml',
            executor: 'ansible-navigator',
            navigatorConfig: '',
        });
        expect(plan).toEqual({
            argv: ['ansible-navigator', 'run', 'playbooks/site.yml', '--mode', 'stdout'],
        });
    });

    it('passes the navigator config through the environment', () => {
        const plan = planPlaybookRun({
            workspacePath: workspace,
            playbookPath: 'playbooks/site.yml',
            executor: 'ansible-navigator',
            navigatorConfig: '/etc/ansible-navigator.yml',
        });
        expect('argv' in plan && plan.argv).toEqual([
            'env',
            'ANSIBLE_NAVIGATOR_CONFIG=/etc/ansible-navigator.yml',
            'ansible-navigator',
            'run',
            'playbooks/site.yml',
            '--mode',
            'stdout',
        ]);
    });

    it('ignores a navigator config for the plain executor', () => {
        const plan = planPlaybookRun({
            workspacePath: workspace,
            playbookPath: 'playbooks/site.yml',
            executor: 'ansible-playbook',
            navigatorConfig: '/etc/ansible-navigator.yml',
        });
        expect(plan).toEqual({ argv: ['ansible-playbook', 'playbooks/site.yml'] });
    });

    it('puts the resolved environment first on PATH', () => {
        const plan = planPlaybookRun({
            workspacePath: workspace,
            playbookPath: 'playbooks/site.yml',
            executor: 'ansible-playbook',
            navigatorConfig: '',
            binDir: '/opt/venv/bin',
            currentPath: '/usr/bin:/bin',
        });
        expect('argv' in plan && plan.argv).toEqual([
            'env',
            'PATH=/opt/venv/bin:/usr/bin:/bin',
            'ansible-playbook',
            'playbooks/site.yml',
        ]);
    });

    it('produces a command line a shell would run as one command', () => {
        const plan = planPlaybookRun({
            workspacePath: workspace,
            playbookPath: 'playbooks/site.yml',
            executor: 'ansible-playbook',
            navigatorConfig: '',
        });
        expect('argv' in plan && commandLine(plan.argv)).toBe(
            'ansible-playbook playbooks/site.yml',
        );
    });

    it('refuses a playbook outside the workspace', () => {
        const plan = planPlaybookRun({
            workspacePath: workspace,
            playbookPath: '../../etc/passwd',
            executor: 'ansible-playbook',
            navigatorConfig: '',
        });
        expect(plan).toHaveProperty('error');
    });
});
