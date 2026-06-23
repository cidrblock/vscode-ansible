import React from 'react';
import type { NavPath } from './hooks/useMillerNav';
import type { SettingsState } from './views/SettingsView';
import type { ColumnDef } from './components/MillerColumns';
import { EmptyColumn } from './components/EmptyColumn';
import { RootNav } from './views/RootNav';
import { ProjectList } from './views/ProjectList';
import { ProjectFacets } from './views/ProjectFacets';
import { PlatformTab } from './views/PlatformTab';
import { SettingsCategoryList, SettingsCategoryForm } from './views/SettingsView';

import { EnvironmentList, EnvironmentDetail } from './views/EnvironmentManagers';
import { DevToolsList, DevToolDetail } from './views/DevToolsView';
import { CollectionsList, PluginTypeList, PluginList } from './views/CollectionsBrowser';
import { PluginDocPanel } from './views/PluginDocPanel';
import { CollectionSourceSearch, CollectionSourceDetail } from './views/CollectionSources';
import { EEList, EEFacets, EEFacetDetail } from './views/ExecutionEnvironments';
import { CreatorCommandList, CreatorCommandForm } from './views/CreatorForm';
import { PlaybookList, PlaybookDetail } from './views/PlaybookExecution';
import { McpToolList, McpToolDetail } from './views/McpToolsView';
import { SkillList, SkillDetail } from './views/SkillsView';

interface ResolverContext {
    select: (depth: number, columnType: string, selectedId: string) => void;
    path: NavPath;
    settingsState: SettingsState;
    refreshStatus: () => void;
}

const nav = (node: React.ReactNode, label?: string): ColumnDef => ({ node, label });
const content = (node: React.ReactNode): ColumnDef => ({ node, flex: true });

const ROOT_LABELS: Record<string, string> = {
    projects: 'Projects',
    platform: 'Platform',
    ee: 'Execution Environments',
    settings: 'Settings',
};

const FACET_LABELS: Record<string, string> = {
    env: 'Environment',
    devtools: 'Dev Tools',
    collections: 'Collections',
    sources: 'Sources',
    creator: 'Creator',
    playbooks: 'Playbooks',
    'ai-tools': 'AI Tools',
    skills: 'AI Skills',
};

const SETTINGS_LABELS: Record<string, string> = {
    general: 'General',
    appearance: 'Appearance',
    mcp: 'MCP Servers',
    lsp: 'Language Server',
};

const EE_FACET_LABELS: Record<string, string> = {
    overview: 'Overview',
    collections: 'Collections',
    python: 'Python Packages',
    system: 'System Packages',
};

function shortenProjectPath(p: string): string {
    return p.replace(/^\/home\/[^/]+/, '~').split('/').pop() ?? p;
}

/**
 * Maps the current NavPath into an array of ColumnDefs.
 * Navigation columns stay at fixed width; content columns flex to fill.
 */
export function resolveColumns(ctx: ResolverContext): ColumnDef[] {
    const { select, path, settingsState, refreshStatus } = ctx;
    const columns: ColumnDef[] = [];

    const selectedAt = (depth: number) => path[depth]?.selectedId ?? null;

    // --- Column 0: Root navigation (always present) ---
    const rootLabel = path[0] ? ROOT_LABELS[path[0].selectedId] : undefined;
    columns.push(nav(
        <RootNav
            key="root"
            selected={selectedAt(0)}
            onSelect={(id) => select(0, id, id)}
        />,
        rootLabel,
    ));

    if (path.length === 0) return columns;

    const rootSelection = path[0].selectedId;

    // --- Column 1: depends on root selection ---
    switch (rootSelection) {
        case 'projects': {
            const projLabel = path[1] ? shortenProjectPath(path[1].selectedId) : undefined;
            columns.push(nav(
                <ProjectList
                    key="project-list"
                    selected={selectedAt(1)}
                    onSelect={(id) => select(1, 'projectFacets', id)}
                    onProjectChanged={refreshStatus}
                />,
                projLabel,
            ));
            break;
        }

        case 'platform':
            columns.push(content(<PlatformTab key="platform" />));
            return columns;

        case 'ee': {
            const eeLabel = path[1] ? path[1].selectedId : undefined;
            columns.push(nav(
                <EEList
                    key="ee-list"
                    selected={selectedAt(1)}
                    onSelect={(id) => select(1, 'eeFacets', id)}
                />,
                eeLabel,
            ));
            break;
        }

        case 'settings': {
            const setLabel = path[1] ? (SETTINGS_LABELS[path[1].selectedId] ?? path[1].selectedId) : undefined;
            columns.push(nav(
                <SettingsCategoryList
                    key="settings-categories"
                    selected={selectedAt(1)}
                    onSelect={(id) => select(1, 'settingsForm', id)}
                    state={settingsState}
                />,
                setLabel,
            ));
            break;
        }

        default:
            return columns;
    }

    if (path.length < 2) return columns;

    // --- Column 2: depends on column-1 context ---
    const col1Type = path[1].columnType;
    const col1Id = path[1].selectedId;

    if (col1Type === 'projectFacets') {
        const facetLabel = path[2] ? (FACET_LABELS[path[2].selectedId] ?? path[2].selectedId) : undefined;
        columns.push(nav(
            <ProjectFacets
                key={`facets-${col1Id}`}
                selected={selectedAt(2)}
                onSelect={(id) => select(2, 'facetList', id)}
            />,
            facetLabel,
        ));
    } else if (col1Type === 'eeFacets') {
        const eeFacetLabel = path[2] ? (EE_FACET_LABELS[path[2].selectedId] ?? path[2].selectedId) : undefined;
        columns.push(nav(
            <EEFacets
                key={`ee-facets-${col1Id}`}
                eeName={col1Id}
                selected={selectedAt(2)}
                onSelect={(id) => select(2, 'eeFacetDetail', id)}
            />,
            eeFacetLabel,
        ));
    } else if (col1Type === 'settingsForm') {
        columns.push(content(
            <SettingsCategoryForm
                key={`settings-${col1Id}`}
                categoryId={col1Id}
                state={settingsState}
            />,
        ));
        return columns;
    }

    if (path.length < 3) return columns;

    // --- Column 3: EE facet detail (if in EE flow) ---
    const col2Type = path[2].columnType;
    const col2Id = path[2].selectedId;

    if (col2Type === 'eeFacetDetail') {
        columns.push(content(
            <EEFacetDetail
                key={`ee-detail-${col1Id}-${col2Id}`}
                eeName={col1Id}
                facetId={col2Id}
            />,
        ));
        return columns;
    }

    // --- Column 3: project facet item lists ---
    const facetId = col2Id;
    const col3Selected = selectedAt(3);
    const col3Select = (id: string) => select(3, 'facetDetail', id);
    const itemLabel = path[3]?.selectedId;

    switch (facetId) {
        case 'env':
            columns.push(nav(<EnvironmentList key="env-list" selected={col3Selected} onSelect={col3Select} />, itemLabel));
            break;
        case 'devtools':
            columns.push(nav(<DevToolsList key="devtools-list" selected={col3Selected} onSelect={col3Select} />, itemLabel));
            break;
        case 'collections':
            columns.push(nav(<CollectionsList key="collections-list" selected={col3Selected} onSelect={col3Select} />, itemLabel));
            break;
        case 'sources':
            columns.push(nav(<CollectionSourceSearch key="sources-list" selected={col3Selected} onSelect={col3Select} />, itemLabel));
            break;
        case 'creator':
            columns.push(nav(<CreatorCommandList key="creator-list" selected={col3Selected} onSelect={col3Select} />, itemLabel));
            break;
        case 'playbooks':
            columns.push(nav(<PlaybookList key="playbook-list" selected={col3Selected} onSelect={col3Select} />, itemLabel));
            break;
        case 'ai-tools':
            columns.push(nav(<McpToolList key="mcp-list" selected={col3Selected} onSelect={col3Select} />, itemLabel));
            break;
        case 'skills':
            columns.push(nav(<SkillList key="skill-list" selected={col3Selected} onSelect={col3Select} />, itemLabel));
            break;
        default:
            columns.push(nav(<EmptyColumn key="unknown-facet" />));
    }

    if (path.length < 4) return columns;

    // --- Column 4: project facet item detail ---
    const detailId = path[3].selectedId;

    switch (facetId) {
        case 'env':
            columns.push(content(<EnvironmentDetail key={`env-${detailId}`} pythonPath={detailId} onSelect={refreshStatus} />));
            return columns;
        case 'devtools':
            columns.push(content(<DevToolDetail key={`dt-${detailId}`} toolName={detailId} />));
            return columns;
        case 'collections': {
            // Collection → plugin type list (nav column)
            const pluginTypeLabel = path[4] ? path[4].selectedId : undefined;
            columns.push(nav(
                <PluginTypeList
                    key={`coltypes-${detailId}`}
                    collectionName={detailId}
                    selected={selectedAt(4)}
                    onSelect={(type) => select(4, 'pluginType', type)}
                />,
                pluginTypeLabel,
            ));
            break;
        }
        case 'sources':
            columns.push(content(<CollectionSourceDetail key={`src-${detailId}`} sourceKey={detailId} />));
            return columns;
        case 'creator':
            columns.push(content(<CreatorCommandForm key={`cr-${detailId}`} commandName={detailId} />));
            return columns;
        case 'playbooks':
            columns.push(content(<PlaybookDetail key={`pb-${detailId}`} playbookPath={detailId} />));
            return columns;
        case 'ai-tools':
            columns.push(content(<McpToolDetail key={`mcp-${detailId}`} toolName={detailId} />));
            return columns;
        case 'skills':
            columns.push(content(<SkillDetail key={`skill-${detailId}`} skillId={detailId} />));
            return columns;
        default:
            columns.push(content(<EmptyColumn key="unknown-detail" />));
            return columns;
    }

    if (path.length < 5) return columns;

    // --- Column 5: plugin list for the selected type ---
    const pluginType = path[4].selectedId;
    const pluginLabel = path[5]?.selectedId?.split('.').pop();
    columns.push(nav(
        <PluginList
            key={`plugins-${detailId}-${pluginType}`}
            collectionName={detailId}
            pluginType={pluginType}
            selected={selectedAt(5)}
            onSelect={(fqcn) => select(5, 'pluginDoc', fqcn)}
        />,
        pluginLabel,
    ));

    if (path.length < 6) return columns;

    // --- Column 6: plugin documentation (content) ---
    const pluginFqcn = path[5].selectedId;
    columns.push(content(
        <PluginDocPanel
            key={`doc-${pluginFqcn}`}
            pluginName={pluginFqcn}
            pluginType={pluginType}
        />,
    ));

    return columns;
}
