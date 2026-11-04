/**
 * AI Skills view: the skills the bundled SkillRegistry can offer.
 *
 * Uses the same registry instance and prompt builder as the MCP server, so a
 * prompt copied from navita is identical to one copied in VS Code.
 */

import { SkillRegistry, buildSkillClipboardPrompt } from '@ansible/developer-services';

import type { SkillEntryView, SkillGroup, SkillsResult } from '../shared/ipc';

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
 * Load skills from a local source directory and prepare their prompts.
 * @param skillsDir - Directory the bundled skills were copied to.
 * @returns Grouped skills, or the failure detail; never throws.
 */
export async function loadSkills(skillsDir: string): Promise<SkillsResult> {
    const registry = SkillRegistry.getInstance();
    try {
        registry.setSources([{ id: 'bundled', type: 'local', url: skillsDir, trust: 'certified' }]);
        await registry.refresh();
        const entries: SkillEntryView[] = registry.getAllSkills().map((skill) => ({
            id: skill.id,
            name: skill.name,
            module: skill.module,
            source: skill.source,
            description: skill.description,
            prompt: buildSkillClipboardPrompt(skill.name, skill.id, skill.description),
        }));
        return { state: 'ready', groups: buildSkillGroups(entries) };
    } catch (error: unknown) {
        return {
            state: 'error',
            groups: [],
            detail: error instanceof Error ? error.message : String(error),
        };
    }
}
