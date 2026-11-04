import { useCallback, useEffect, useState, type JSX } from 'react';

import type { SkillsResult } from '../../shared/ipc';

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

    const load = useCallback(() => {
        setResult(null);
        window.navita
            .getSkills()
            .then(setResult)
            .catch((error: unknown) => {
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

    const copy = (prompt: string, name: string): void => {
        window.navita
            .copyText(prompt)
            .then(() => {
                onCopied(name);
            })
            .catch(() => {
                onCopied(`could not copy ${name}`);
            });
    };

    const total = result?.groups.reduce((count, group) => count + group.skills.length, 0) ?? 0;

    return (
        <section className="card">
            <div className="card-header">
                <h2>AI Skills</h2>
                <span className="muted">{result === null ? '…' : `${String(total)} skills`}</span>
                <button className="ghost" onClick={load}>
                    Refresh
                </button>
            </div>
            {result === null ? (
                <p className="muted">Loading skill sources…</p>
            ) : result.state === 'error' ? (
                <p className="muted">{result.detail ?? 'Could not load skills.'}</p>
            ) : result.groups.length === 0 ? (
                <p className="muted">No skills found in the bundled sources.</p>
            ) : (
                result.groups.map((group) => (
                    <div key={group.id} className="env-group">
                        <h3>{group.label}</h3>
                        <ul className="package-list">
                            {group.skills.map((skill) => (
                                <li key={skill.id}>
                                    <span className="package-name">{skill.name}</span>
                                    <span className="muted">{skill.module}</span>
                                    <button
                                        className="ghost"
                                        onClick={() => {
                                            copy(skill.prompt, skill.name);
                                        }}
                                    >
                                        Copy prompt
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))
            )}
        </section>
    );
}
