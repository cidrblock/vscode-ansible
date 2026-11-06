import { useCallback, useEffect, useState, type JSX } from 'react';

import type { ToolsResult } from '../../shared/ipc';
import { CapNotice, FilterBox, useGroupedFilter } from '../filter';
import { CopyButton } from './CopyButton';

/**
 * AI Tools section: the catalog the bundled MCP server advertises, grouped by
 * category, with a copy-prompt action per tool.
 * @param props - Component properties.
 * @param props.onCopied - Called with the tool name after its prompt is copied.
 * @returns The tools panel.
 */
export function ToolsView(props: { onCopied: (label: string) => void }): JSX.Element {
    const [result, setResult] = useState<ToolsResult | null>(null);
    const { onCopied } = props;

    const load = useCallback(() => {
        setResult(null);
        window.navita
            .getTools()
            .then(setResult)
            .catch((error: unknown) => {
                setResult({
                    state: 'error',
                    groups: [],
                    toolCount: 0,
                    detail: error instanceof Error ? error.message : String(error),
                });
            });
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const filter = useGroupedFilter(
        result?.groups ?? [],
        (group) => group.tools,
        (tool) => `${tool.name} ${tool.description ?? ''}`,
    );
    const shown = filter.groups.reduce((count, entry) => count + entry.items.length, 0);

    return (
        <section className="card">
            <div className="card-header">
                <h2>Tools</h2>
                <FilterBox label="Filter tools" value={filter.query} onChange={filter.setQuery} />
                <span className="muted">
                    {result === null
                        ? '… tools'
                        : filter.active
                          ? `${String(filter.matches)} of ${String(filter.total)} tools`
                          : `${String(result.toolCount)} tools`}
                </span>
                <button className="ghost" onClick={load}>
                    Refresh
                </button>
            </div>
            {result === null ? (
                <p className="muted">Asking the MCP server for its tools…</p>
            ) : result.state === 'error' ? (
                <p className="muted">{result.detail ?? 'Could not read the tool catalog.'}</p>
            ) : filter.active && filter.groups.length === 0 ? (
                <p className="muted">No tools match “{filter.query}”.</p>
            ) : (
                <>
                    {filter.groups.map(({ group, items }) => (
                        <div key={group.id} className="env-group">
                            <h3>{group.label}</h3>
                            <ul className="item-list">
                                {items.map((tool) => (
                                    <li key={tool.name} className="item-row">
                                        <div className="item-main">
                                            <span className="item-title">{tool.name}</span>
                                            {tool.description !== undefined && (
                                                <span className="item-description">
                                                    {tool.description}
                                                </span>
                                            )}
                                        </div>
                                        <CopyButton
                                            label={tool.name}
                                            prompt={tool.prompt}
                                            onCopied={onCopied}
                                        />
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                    <CapNotice shown={shown} matches={filter.matches} />
                </>
            )}
        </section>
    );
}
