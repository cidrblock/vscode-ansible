import { useCallback, useEffect, useState, type JSX } from 'react';

import type { SkillsResult } from '../../shared/ipc';
import { CapNotice, FilterBox, useGroupedFilter } from '../filter';
import { CopyButton } from './CopyButton';

/**
 * AI Skills section: skills found by the registry the MCP server shares, with
 * a copy-prompt action per skill.
 * @param props - Component properties.
 * @param props.onCopied - Called with the skill name after its prompt is copied.
 * @returns The skills panel.
 */
export function SkillsView(props: { onCopied: (label: string) => void }): JSX.Element {
    const [result, setResult] = useState<SkillsResult | null>(null);
    const { onCopied } = props;

    const load = useCallback((force = false) => {
        setResult(null);
        const request = force ? window.navita.refreshSkills() : window.navita.getSkills();
        request.then(setResult).catch((error: unknown) => {
            setResult({
                state: 'error',
                groups: [],
                detail: error instanceof Error ? error.message : String(error),
            });
        });
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const total = result?.groups.reduce((count, group) => count + group.skills.length, 0) ?? 0;

    const filter = useGroupedFilter(
        result?.groups ?? [],
        (group) => group.skills,
        (skill) => `${skill.name} ${skill.description} ${skill.module}`,
    );
    const shown = filter.groups.reduce((count, entry) => count + entry.items.length, 0);

    return (
        <section className="card">
            <div className="card-header">
                <h2>Skills</h2>
                <FilterBox label="Filter skills" value={filter.query} onChange={filter.setQuery} />
                <span className="muted">
                    {result === null
                        ? '…'
                        : filter.active
                          ? `${String(filter.matches)} of ${String(filter.total)} skills`
                          : `${String(total)} skills`}
                </span>
                <button
                    className="ghost"
                    title="Reload every source, bypassing the on-disk cache"
                    onClick={() => {
                        load(true);
                    }}
                >
                    Refresh
                </button>
            </div>
            {result?.sources === undefined || result.sources.length === 0 ? null : (
                <>
                    <p className="muted">
                        {result.sources
                            .map((source) => `${source.id} ${String(source.count)}`)
                            .join(' · ')}
                    </p>
                    {result.sources
                        .filter((source) => source.state === 'error')
                        .map((source) => (
                            <p key={source.id} className="install-error">
                                {source.id}: {source.error ?? 'could not be loaded'}
                            </p>
                        ))}
                </>
            )}
            {result === null ? (
                <p className="muted">Loading skill sources…</p>
            ) : result.state === 'error' ? (
                <p className="muted">{result.detail ?? 'Could not load skills.'}</p>
            ) : result.groups.length === 0 ? (
                <p className="muted">
                    No skills loaded. Built-in skills ship with navita; add sources in Settings →
                    Skill sources.
                </p>
            ) : filter.active && filter.groups.length === 0 ? (
                <p className="muted">No skills match “{filter.query}”.</p>
            ) : (
                <>
                    {filter.groups.map(({ group, items }) => (
                        <div key={group.id} className="env-group">
                            <h3>{group.label}</h3>
                            <ul className="item-list">
                                {items.map((skill) => (
                                    <li key={skill.id} className="item-row">
                                        <div className="item-main">
                                            <span className="item-title">{skill.name}</span>
                                            <span className="item-description">
                                                {skill.description}
                                            </span>
                                        </div>
                                        <span className="item-tag">{skill.module}</span>
                                        <CopyButton
                                            label={skill.name}
                                            prompt={skill.prompt}
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
