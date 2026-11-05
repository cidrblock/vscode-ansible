#!/usr/bin/env node
// @ts-check
/**
 * Headless check: prove the bundled stdio servers work without a display.
 * Exits non-zero if either handshake fails.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(here, '..', 'dist');
const MCP = path.join(DIST, 'servers', 'mcp-server.js');
const LSP = path.join(DIST, 'servers', 'language-server.js');
const WORKSPACE = process.cwd();
const PKG = path.resolve(here, '..');
const REPO = path.resolve(PKG, '..', '..');

/**
 * Find a virtual environment with the ansible tools that is not on PATH.
 * @returns Absolute environment directory, or undefined when none is available.
 */
function findUnactivatedVenv() {
    const candidates = [
        process.env.NAVITA_TEST_VENV,
        path.join(REPO, '..', 'tools', 'venv'),
        path.join(REPO, '.venv'),
    ];
    return candidates.find(
        (candidate) =>
            typeof candidate === 'string' && fs.existsSync(path.join(candidate, 'bin', 'ansible-doc')),
    );
}

const TOOL_VENV = findUnactivatedVenv();
const onPath = (tool) =>
    (process.env.PATH ?? '')
        .split(path.delimiter)
        .some((directory) => directory !== '' && fs.existsSync(path.join(directory, tool)));
// The views read the Ansible tools off PATH, so make the check reproducible
// without a manual activation, without overriding a real one.
if (!onPath('ansible-doc') && TOOL_VENV !== undefined) {
    process.env.PATH = [path.join(TOOL_VENV, 'bin'), process.env.PATH ?? '']
        .filter((entry) => entry !== '')
        .join(path.delimiter);
}

function fail(message) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
}

function probeMcp() {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [MCP], {
            cwd: WORKSPACE,
            env: { ...process.env, ANSIBLE_ENV_WORKSPACE: WORKSPACE },
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        let buffer = '';
        const timer = setTimeout(() => {
            child.kill();
            reject(new Error('MCP server timed out'));
        }, 20000);
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', (chunk) => {
            buffer += chunk;
            let index = buffer.indexOf('\n');
            while (index >= 0) {
                const line = buffer.slice(0, index).trim();
                buffer = buffer.slice(index + 1);
                index = buffer.indexOf('\n');
                if (line === '') continue;
                let message;
                try {
                    message = JSON.parse(line);
                } catch {
                    continue;
                }
                if (message.id === 1) {
                    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
                    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' })}\n`);
                } else if (message.id === 2) {
                    clearTimeout(timer);
                    child.kill();
                    resolve(message.result?.tools?.map((tool) => tool.name) ?? []);
                    return;
                }
            }
        });
        child.on('error', reject);
        child.stdin.write(
            `${JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'initialize',
                params: {
                    protocolVersion: '2024-11-05',
                    capabilities: {},
                    clientInfo: { name: 'navita-verify', version: '0.0.1' },
                },
            })}\n`,
        );
    });
}

function probeLsp() {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [LSP, '--stdio'], {
            cwd: WORKSPACE,
            env: { ...process.env, ANSIBLE_ENV_WORKSPACE: WORKSPACE },
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        const timer = setTimeout(() => {
            child.kill();
            reject(new Error('language server timed out'));
        }, 20000);
        let buffer = '';
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', (chunk) => {
            buffer += chunk;
            const separator = buffer.indexOf('\r\n\r\n');
            if (separator < 0) return;
            const length = Number(/Content-Length:\s*(\d+)/i.exec(buffer.slice(0, separator))?.[1] ?? 0);
            const start = separator + 4;
            if (buffer.length - start < length) return;
            const message = JSON.parse(buffer.slice(start, start + length));
            if (message.id !== 1) return;
            clearTimeout(timer);
            child.kill();
            resolve(message.result ?? {});
        });
        child.on('error', reject);
        const body = JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
                processId: process.pid,
                rootUri: `file://${WORKSPACE}`,
                workspaceFolders: [{ uri: `file://${WORKSPACE}`, name: path.basename(WORKSPACE) }],
                capabilities: { workspace: { workspaceFolders: true } },
            },
        });
        child.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
    });
}


const SERVICE_ALIASES = {
    '@ansible/common': path.join(REPO, 'packages', 'common', 'src', 'index.ts'),
    '@ansible/developer-services': path.join(REPO, 'packages', 'services', 'src', 'index.ts'),
};

/**
 * Bundle a main-process view module for Node and report what it discovers.
 * Bundling keeps the check honest: it exercises the same code the main
 * process runs, without needing an Electron display.
 * @returns Package count and state.
 */
async function bundleModule(entry, name) {
    return bundleSource(path.join(PKG, 'src', 'main', entry), name);
}

/**
 * Bundle any workspace source file the way the main process build does.
 * @param entryPath - Absolute path to the TypeScript entry.
 * @param name - Base name for the generated CommonJS file.
 * @returns The bundled module.
 */
async function bundleSource(entryPath, name) {
    const esbuild = await import('esbuild');
    const outfile = path.join(DIST, 'verify', `${name}.cjs`);
    fs.mkdirSync(path.dirname(outfile), { recursive: true });
    await esbuild.build({
        entryPoints: [entryPath],
        outfile,
        bundle: true,
        platform: 'node',
        format: 'cjs',
        logLevel: 'silent',
        external: ['vscode'],
        alias: SERVICE_ALIASES,
    });
    return createRequire(import.meta.url)(outfile);
}

/**
 * Bundle several main-process modules into one file, so they share a single
 * copy of the services package the way the real main process does.
 * @param entries - Map of exported name to module file in src/main.
 * @param name - Base name for the generated entry and output files.
 * @returns The bundled module namespaces.
 */
async function bundleTogether(entries, name) {
    const esbuild = await import('esbuild');
    const directory = path.join(DIST, 'verify');
    fs.mkdirSync(directory, { recursive: true });
    const entry = path.join(directory, `${name}-entry.ts`);
    fs.writeFileSync(
        entry,
        Object.entries(entries)
            .map(
                ([exportName, moduleFile]) =>
                    `export * as ${exportName} from ${JSON.stringify(path.join(PKG, 'src', 'main', moduleFile))};`,
            )
            .join('\n') + '\n',
    );
    const outfile = path.join(directory, `${name}.cjs`);
    await esbuild.build({
        entryPoints: [entry],
        outfile,
        bundle: true,
        platform: 'node',
        format: 'cjs',
        logLevel: 'silent',
        external: ['vscode'],
        alias: SERVICE_ALIASES,
    });
    return createRequire(import.meta.url)(outfile);
}

/**
 * Prove the environment resolver reaches the services: a workspace virtual
 * environment that is not on PATH must still answer the collections view.
 */
async function probeResolver() {
    const venv = findUnactivatedVenv();
    if (venv === undefined) {
        console.log('SKIP  resolver        no unactivated venv with ansible-doc to test');
        return;
    }
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'navita-resolver-'));
    fs.symlinkSync(path.resolve(venv), path.join(workspace, '.venv'), 'dir');
    await bundleTogether({ environment: 'environment.ts', collections: 'collections.ts' }, 'resolver');
    const script = path.join(DIST, 'verify', 'resolver-check.cjs');
    fs.writeFileSync(
        script,
        [
            "const modules = require('./resolver.cjs');",
            'const workspace = process.env.NAVITA_CHECK_WORKSPACE;',
            'process.env.ANSIBLE_ENV_WORKSPACE = workspace;',
            'modules.environment.installEnvironmentResolver(() => process.env.ANSIBLE_ENV_WORKSPACE);',
            '(async () => {',
            '    const binDir = await modules.environment.resolveBinDir(workspace);',
            '    const result = await modules.collections.loadCollections();',
            '    process.stdout.write(JSON.stringify({ binDir, state: result.state, count: result.collections.length, detail: result.detail ?? null }));',
            '})().catch((error) => {',
            '    process.stdout.write(JSON.stringify({ binDir: null, state: "error", count: 0, detail: String(error) }));',
            '});',
            '',
        ].join('\n'),
    );
    const result = await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [script], {
            cwd: workspace,
            env: {
                ...process.env,
                // Deliberately without the venv: only the resolver can find it.
                PATH: '/usr/bin:/bin',
                NAVITA_CHECK_WORKSPACE: workspace,
            },
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let out = '';
        let err = '';
        child.stdout.on('data', (chunk) => (out += chunk));
        child.stderr.on('data', (chunk) => (err += chunk));
        child.on('error', reject);
        child.on('close', (code) => {
            // The services log to stdout as well, so take the JSON line.
            const payload = out
                .split('\n')
                .reverse()
                .find((line) => line.trim().startsWith('{'));
            try {
                resolve(JSON.parse(payload));
            } catch {
                reject(new Error(`resolver check exited ${code} without JSON: ${err.slice(-400)}`));
            }
        });
    });
    fs.rmSync(workspace, { recursive: true, force: true });
    if (result.state !== 'ready' || result.count < 1) {
        fail(`resolver: ${result.detail ?? `no collections via ${result.binDir}`}`);
    } else {
        console.log(
            `PASS  resolver        ${result.count} collection(s) from ${path.basename(path.dirname(path.dirname(result.binDir)))}/.venv off PATH`,
        );
    }
}

for (const script of [MCP, LSP]) {
    if (!fs.existsSync(script)) {
        fail(`missing build artifact ${path.relative(DIST, script)} — run pnpm build first`);
    }
}

if (process.exitCode !== 1) {
    const [tools, lsp] = await Promise.all([probeMcp(), probeLsp()]);
    console.log(`PASS  mcp-server      ${tools.length} tools (${tools.slice(0, 3).join(', ')}…)`);
    const capabilities = Object.keys(lsp.capabilities ?? {});
    console.log(`PASS  language-server capabilities: ${capabilities.join(', ') || '(none)'}`);

    const devToolsModule = await bundleModule('devtools.ts', 'devtools');
    const devTools = await devToolsModule.loadDevTools();
    if (devTools.state === 'error') {
        fail(`dev-tools discovery: ${devTools.detail}`);
    } else if (devTools.packages.length === 0) {
        console.log('SKIP  dev-tools        no ansible-dev-tools on PATH');
    } else {
        const names = devTools.packages.slice(0, 3).map((entry) => entry.name);
        console.log(`PASS  dev-tools        ${devTools.packages.length} packages (${names.join(', ')}…)`);
    }

    const rendererAssets = path.join(DIST, 'renderer', 'assets');
    const cssText = fs
        .readdirSync(rendererAssets)
        .filter((name) => name.endsWith('.css'))
        .map((name) => fs.readFileSync(path.join(rendererAssets, name), 'utf8'))
        .join('\n');
    const themeIds = ['navita-light', 'navita-dark', 'rhdh-light', 'rhdh-dark'];
    const missingThemes = themeIds.filter((id) => !cssText.includes(id));
    const fontCount = fs.readdirSync(rendererAssets).filter((name) => name.endsWith('.woff2')).length;
    if (missingThemes.length === 0 && fontCount > 0) {
        console.log(`PASS  theme           ${themeIds.join(', ')} with ${fontCount} bundled font(s)`);
    } else {
        fail(
            `theme           missing ${missingThemes.join(', ') || '(palettes ok)'}; ${fontCount} bundled font(s)`,
        );
    }

    const installerModule = await bundleModule('installer.ts', 'installer');
    const install = installerModule.installCommand('/venv/bin/python3');
    console.log(
        `PASS  installer       ${install.command} ${install.args.join(' ')}`,
    );

    const toolsModule = await bundleModule('tools.ts', 'tools');
    const toolCatalog = await toolsModule.loadTools(
        {
            command: process.execPath,
            args: [MCP],
            env: { ...process.env, ANSIBLE_ENV_WORKSPACE: WORKSPACE },
        },
        WORKSPACE,
    );
    if (toolCatalog.state === 'error') {
        fail(`tool catalog: ${toolCatalog.detail}`);
    } else {
        const labels = toolCatalog.groups.map((group) => group.label);
        console.log(
            `PASS  ai-tools         ${toolCatalog.toolCount} tools in ${labels.join(', ')}`,
        );
    }

    const skillsModule = await bundleModule('skills.ts', 'skills');
    const skillCatalog = await skillsModule.loadSkills(path.join(DIST, 'skills'));
    if (skillCatalog.state === 'error') {
        fail(`skills: ${skillCatalog.detail}`);
    } else {
        const count = skillCatalog.groups.reduce((total, group) => total + group.skills.length, 0);
        console.log(
            `PASS  ai-skills        ${count} skills in ${skillCatalog.groups.length} source(s)`,
        );
    }

    const collectionsModule = await bundleModule('collections.ts', 'collections');
    const collections = await collectionsModule.loadCollections();
    if (collections.state === 'error') {
        fail(`collections: ${collections.detail}`);
    } else {
        const names = collections.collections.slice(0, 2).map((entry) => entry.name);
        console.log(
            `PASS  collections      ${collections.collections.length} installed (${names.join(', ')}…)`,
        );
    }

    if (collections.state !== 'error') {
        // Levels two to four of the collection drill-down: types, plugins, docs.
        const first = collections.collections.find((entry) => entry.pluginTypes.length > 0);
        if (first === undefined) {
            fail('collections: no collection reported any plugin type');
        } else {
            const typeEntry = first.pluginTypes.find((entry) => entry.type === 'module') ??
                first.pluginTypes[0];
            const pluginList = collectionsModule.loadCollectionPlugins(first.name, typeEntry.type);
            if (pluginList.state === 'error' || pluginList.plugins.length === 0) {
                fail(`collection plugins: ${pluginList.detail ?? 'no plugins listed'}`);
            } else {
                const sample = pluginList.plugins[0];
                const doc = await collectionsModule.loadPluginDoc(sample.fullName, typeEntry.type);
                if (doc.state === 'error') {
                    fail(`plugin doc: ${doc.detail}`);
                } else {
                    const optionCount = Object.keys(doc.data?.doc?.options ?? {}).length;
                    console.log(
                        `PASS  collections-tree  ${first.name} → ${typeEntry.type}(${String(typeEntry.count)}) → ${sample.fullName}, doc with ${String(optionCount)} option(s)`,
                    );
                }
            }
        }
    }

    const eeModule = await bundleModule('executionEnvironments.ts', 'execution-environments');
    const executionEnvironments = await eeModule.loadExecutionEnvironments();
    if (executionEnvironments.state === 'error') {
        fail(`execution environments: ${executionEnvironments.detail}`);
    } else {
        console.log(
            `PASS  exec-envs        ${executionEnvironments.environments.length} EE image(s) found`,
        );
    }

    const playbooksModule = await bundleModule('playbooks.ts', 'playbooks');
    const playbooks = await playbooksModule.loadPlaybooks(WORKSPACE);
    if (playbooks.state === 'error') {
        fail(`playbooks: ${playbooks.detail}`);
    } else {
        const plays = playbooks.playbooks.reduce((total, entry) => total + entry.plays.length, 0);
        const names = playbooks.playbooks.slice(0, 2).map((entry) => entry.relativePath);
        console.log(
            `PASS  playbooks       ${playbooks.playbooks.length} playbook(s), ${plays} plays (${names.join(', ') || 'none'})`,
        );
    }

    const creatorModule = await bundleModule('creator.ts', 'creator');
    const creator = await creatorModule.loadCreator();
    if (creator.state === 'error') {
        fail(`creator: ${creator.detail}`);
    } else {
        const groups = [...new Set(creator.commands.map((entry) => entry.group))];
        console.log(
            `PASS  creator         ${creator.commands.length} commands in ${groups.join(', ')}`,
        );
        const commonModule = await bundleSource(
            path.join(REPO, 'packages', 'common', 'src', 'index.ts'),
            'common',
        );
        const node = creatorModule.findSchemaNode(creator.schema, ['init', 'collection']);
        if (node === undefined) {
            fail('creator form: schema has no init collection node');
        } else {
            const args = commonModule.buildCommandArgs(['init', 'collection'], node, {
                collection: 'demo.collection',
            });
            console.log(
                `PASS  creator-form    ${String(node.parameters?.properties ? Object.keys(node.parameters.properties).length : 0)} fields, preview: ansible-creator ${args.join(' ')}`,
            );
        }
    }

    const sourcesModule = await bundleModule('collectionSources.ts', 'collection-sources');
    const storage = fs.mkdtempSync(path.join(os.tmpdir(), 'navita-sources-'));
    // A temporary HOME with one organization cache proves the read path carries
    // collection rows, not only counts, without touching the real cache.
    const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'navita-home-'));
    const ghCacheDir = path.join(fakeHome, '.cache', 'ansible-environments');
    fs.mkdirSync(ghCacheDir, { recursive: true });
    fs.writeFileSync(
        path.join(ghCacheDir, 'github-ansible-collections.json'),
        JSON.stringify({
            org: 'ansible-collections',
            lastUpdated: '2026-11-05T00:00:00.000Z',
            collections: [
                {
                    namespace: 'community',
                    name: 'general',
                    version: '14.1.0',
                    description: 'General purpose modules',
                    repository: 'ansible-collections/community.general',
                    org: 'ansible-collections',
                    htmlUrl: 'https://github.com/ansible-collections/community.general',
                    installUrl: 'git+https://github.com/ansible-collections/community.general.git',
                },
                {
                    namespace: 'cisco',
                    name: 'ios',
                    version: '11.6.0',
                    description: 'IOS modules',
                    repository: 'ansible-collections/cisco.ios',
                    org: 'ansible-collections',
                    htmlUrl: 'https://github.com/ansible-collections/cisco.ios',
                    installUrl: 'git+https://github.com/ansible-collections/cisco.ios.git',
                },
            ],
        }),
    );
    const realHome = process.env.HOME;
    process.env.HOME = fakeHome;
    let sources;
    try {
        sources = await sourcesModule.loadCollectionSources(storage, { startLoad: false });
    } finally {
        process.env.HOME = realHome;
        fs.rmSync(fakeHome, { recursive: true, force: true });
        fs.rmSync(storage, { recursive: true, force: true });
    }
    if (sources.state === 'error') {
        fail(`collection sources: ${sources.detail}`);
    } else {
        const org = sources.github.find((entry) => entry.org === 'ansible-collections');
        if (org === undefined || org.collections.length !== 2) {
            fail(
                `collection sources: expected 2 collection rows for ansible-collections, got ${String(org?.collections.length ?? 0)}`,
            );
        } else if (org.collections[0].prompt.length === 0) {
            fail('collection sources: GitHub collection rows have no prompt');
        } else {
            console.log(
                `PASS  sources         state=${sources.state}, Galaxy=${sources.total}, GitHub rows=${String(org.collections.length)} (${org.collections.map((entry) => entry.name).join(', ')})`,
            );
        }
    }

    const environmentsModule = await bundleModule('environments.ts', 'environments');
    const environments = await environmentsModule.loadEnvironments(WORKSPACE);
    if (environments.state === 'error') {
        fail(`environments discovery: ${environments.detail}`);
    } else {
        const count = environments.groups.reduce((total, group) => total + group.environments.length, 0);
        const labels = environments.groups.map((group) => group.label);
        console.log(`PASS  environments     ${count} across ${labels.join(', ') || '(none)'}`);
    }

    await probeResolver();
}
