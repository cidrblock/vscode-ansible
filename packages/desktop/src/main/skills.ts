/**
 * AI Skills view: the skills the bundled SkillRegistry can offer.
 *
 * Uses the same registry instance and prompt builder as the MCP server, so a
 * prompt copied from navita is identical to one copied in VS Code. The source
 * list comes from Settings and is the same shape the extension reads from
 * `ansibleEnvironments.skillSources`.
 */

import {
    SkillRegistry,
    buildSkillClipboardPrompt,
    type SkillSource,
} from '@ansible/developer-services';

import type {
    SkillEntryView,
    SkillGroup,
    SkillSourceSetting,
    SkillSourceStatus,
    SkillsResult,
} from '../shared/ipc';

/**
 * Group skills by source and module, mirroring the extension tree.
 * @param skills - Skills loaded by the registry.
 * @returns Groups in load order, each carrying copyable prompts.
 */
export function buildSkillGroups(skills: readonly SkillEntryView[]): SkillGroup[] {
    const order: string[] = [];
    const bySource = new Map<string, SkillEntryView[]>();
    for (const skill of skills) {
        const existing = bySource.get(skill.source);
        if (existing === undefined) {
            order.push(skill.source);
            bySource.set(skill.source, [skill]);
        } else {
            existing.push(skill);
        }
    }
    return order.map((source) => ({
        id: source,
        label: source,
        skills: bySource.get(source) ?? [],
    }));
}

/**
 * Build the source list the registry should load.
 *
 * The bundled directory is first so its skills win the duplicate check against
 * the compiled-in copy; configured sources follow in the order the user set.
 * @param skillsDir - Directory the bundled skills were copied to.
 * @param configured - Sources from Settings.
 * @returns Sources ready for `SkillRegistry.setSources`.
 */
export function buildSkillSources(
    skillsDir: string,
    configured: readonly SkillSourceSetting[] = [],
): SkillSource[] {
    const bundled: SkillSource = {
        id: 'bundled',
        type: 'local',
        url: skillsDir,
        trust: 'certified',
    };
    return [
        bundled,
        ...configured.map((source) => ({
            id: source.id,
            type: source.type,
            url: source.url,
            trust: source.trust,
            ...(source.refreshInterval === undefined
                ? {}
                : { refreshInterval: source.refreshInterval }),
        })),
    ];
}

/**
 * Summarize every source after a load, including the ones that failed.
 *
 * The `bundled` directory holds the same files as the built-in copy, so once
 * the duplicate check has run it contributes nothing; reporting it as a source
 * with no skills would read as a broken source rather than a redundant one.
 * A configured source that returns nothing is still listed, because that is
 * usually a mistake worth seeing.
 * @param registry - Registry that just finished loading.
 * @returns One status per source, builtin first.
 */
export function describeSkillSources(registry: SkillRegistry): SkillSourceStatus[] {
    const skills = registry.getAllSkills();
    return registry
        .getSources()
        .map((source) => {
            const error = registry.getSourceError(source.id);
            return {
                id: source.id,
                type: source.type,
                count: skills.filter((skill) => skill.source === source.id).length,
                state: error === undefined ? ('ready' as const) : ('error' as const),
                error,
            };
        })
        .filter((source) => !(source.id === 'bundled' && source.count === 0));
}

/**
 * Load skills from the bundled directory and the configured sources.
 * @param skillsDir - Directory the bundled skills were copied to.
 * @param configured - Sources from Settings; none means built-in skills only.
 * @param force - Reload through the network instead of the on-disk cache.
 * @returns Grouped skills, per-source status, or the failure detail; never throws.
 */
export async function loadSkills(
    skillsDir: string,
    configured: readonly SkillSourceSetting[] = [],
    force = false,
): Promise<SkillsResult> {
    const registry = SkillRegistry.getInstance();
    try {
        registry.setSources(buildSkillSources(skillsDir, configured));
        if (force) {
            await registry.refresh();
        } else {
            await registry.ensureLoaded();
        }
        const entries: SkillEntryView[] = registry.getAllSkills().map((skill) => ({
            id: skill.id,
            name: skill.name,
            module: skill.module,
            source: skill.source,
            description: skill.description,
            prompt: buildSkillClipboardPrompt(skill.name, skill.id, skill.description),
        }));
        return {
            state: 'ready',
            groups: buildSkillGroups(entries),
            sources: describeSkillSources(registry),
        };
    } catch (error: unknown) {
        return {
            state: 'error',
            groups: [],
            sources: describeSkillSources(registry),
            detail: error instanceof Error ? error.message : String(error),
        };
    }
}
