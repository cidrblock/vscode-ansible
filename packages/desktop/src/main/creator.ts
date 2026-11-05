/**
 * Creator view: the ansible-creator commands, ready to paste.
 *
 * Reuses CreatorService from packages/services, which runs
 * `ansible-creator schema` through CommandService and so reports exactly the
 * commands the installed version supports. navita does not scaffold anything
 * itself; each row copies a command with its positional arguments left as
 * placeholders.
 */

import { CreatorService } from '@ansible/developer-services';
import type { SchemaNode } from '@ansible/common';

import type { CreatorCommandEntry, CreatorResult } from '../shared/ipc';

/** Schema subcommand that prints the schema, not a generation command. */
const SCHEMA_COMMAND = 'schema';

/**
 * Build the command template for a leaf command.
 * @param service - Loaded CreatorService.
 * @param path - Command path segments, for example ['init', 'collection'].
 * @returns Command with placeholders for its positional and required arguments.
 */
function commandTemplate(service: CreatorService, path: readonly string[]): string {
    const parameters = service.getCommandParameters([...path]);
    const required = parameters?.required ?? [];
    // Optional positional arguments have defaults, so a template that omits
    // them is already the command most users want to paste.
    const positional = service.getPositionalArgs([...path]).filter((key) => required.includes(key));
    const args: Record<string, string> = {};
    for (const key of required) {
        args[key] = `<${key}>`;
    }
    return service.buildCommandString([...path], args, positional);
}

/**
 * Walk the schema tree and collect every leaf command.
 * @param service - Loaded CreatorService.
 * @param path - Path of the node whose children should be visited.
 * @param entries - Accumulator for the leaf commands found.
 */
function collectCommands(
    service: CreatorService,
    path: string[],
    entries: CreatorCommandEntry[],
): void {
    for (const command of service.getCommands(path)) {
        const next = [...path, command.name];
        if (command.hasSubcommands) {
            collectCommands(service, next, entries);
            continue;
        }
        if (next.length === 1 && next[0] === SCHEMA_COMMAND) {
            continue;
        }
        const parameters = service.getCommandParameters(next);
        entries.push({
            path: next.join(' '),
            group: next[0] ?? '',
            name: next.slice(1).join(' ') || (next[0] ?? ''),
            ...(command.description === undefined ? {} : { description: command.description }),
            command: commandTemplate(service, next),
            required: parameters?.required ?? [],
            optionalCount: parameters?.optional.length ?? 0,
        });
    }
}

/**
 * Find the schema node a command path names.
 *
 * The renderer holds the tree and passes paths around as strings, so the main
 * process walks it again rather than trusting a serialized node.
 * @param root - Root of the `ansible-creator schema` tree.
 * @param commandPath - Command segments, for example ['init', 'collection'].
 * @returns The matching node, or undefined when the path does not exist.
 */
export function findSchemaNode(
    root: SchemaNode,
    commandPath: readonly string[],
): SchemaNode | undefined {
    let node: SchemaNode = root;
    for (const segment of commandPath) {
        const next = node.subcommands?.[segment];
        if (next === undefined) {
            return undefined;
        }
        node = next;
    }
    return node;
}

/**
 * Load the ansible-creator schema and flatten it into commands.
 * @returns Commands plus the installation status; never throws.
 */
export async function loadCreator(): Promise<CreatorResult> {
    const service = CreatorService.getInstance();
    try {
        await service.refresh();
        const status = service.getStatus();
        if (service.getSchema() === null) {
            return {
                state: 'error',
                status,
                commands: [],
                detail:
                    status === 'outdated'
                        ? `ansible-creator ${service.getInstalledVersion() ?? ''} is too old to report its schema. Upgrade ansible-creator to scaffold content.`.trim()
                        : 'ansible-creator was not found. Install ansible-dev-tools in the Python environment navita uses.',
            };
        }
        const commands: CreatorCommandEntry[] = [];
        collectCommands(service, [], commands);
        commands.sort((left, right) => left.path.localeCompare(right.path));
        return {
            state: 'ready',
            status,
            ...(service.getInstalledVersion() === undefined
                ? {}
                : { version: service.getInstalledVersion() }),
            commands,
            schema: service.getSchema(),
        };
    } catch (error: unknown) {
        return {
            state: 'error',
            status: 'unknown',
            commands: [],
            detail: error instanceof Error ? error.message : String(error),
        };
    }
}
