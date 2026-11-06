import { useCallback, useEffect, useState, type JSX } from 'react';

import type {
    ExecutionEnvironmentDetailsResult,
    ExecutionEnvironmentsResult,
    PackageEntry,
} from '../../shared/ipc';
import {
    executionEnvironmentCrumb,
    parseExecutionEnvironmentTrail,
} from '../executionEnvironmentPath';
import { CapNotice, FilterBox, useListFilter } from '../filter';
import { useTrail } from '../navigation';
import { DrillLink } from './DrillLink';

/**
 * Execution Environments section: the image list, and the details of one image.
 *
 * The depth comes from the shared trail, so Back and the breadcrumbs behave the
 * same here as in every other view.
 * @returns The execution environments panel.
 */
export function ExecutionEnvironmentsView(): JSX.Element {
    const { trail, push } = useTrail('execution-environments');
    const fullName = parseExecutionEnvironmentTrail(trail);

    if (fullName !== undefined) {
        return <EnvironmentDetails fullName={fullName} />;
    }

    return (
        <EnvironmentList
            onOpen={(name) => {
                push(executionEnvironmentCrumb(name));
            }}
        />
    );
}

/**
 * Images the container engine reports as execution environments.
 * @param props - Component properties.
 * @param props.onOpen - Drills into the image the user picked.
 * @returns The list pane.
 */
function EnvironmentList(props: { onOpen: (fullName: string) => void }): JSX.Element {
    const { onOpen } = props;
    const [result, setResult] = useState<ExecutionEnvironmentsResult | null>(null);

    const load = useCallback(() => {
        setResult(null);
        window.navita
            .getExecutionEnvironments()
            .then(setResult)
            .catch((error: unknown) => {
                setResult({
                    state: 'error',
                    environments: [],
                    detail: error instanceof Error ? error.message : String(error),
                });
            });
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <section className="card">
            <div className="card-header">
                <h2>Execution Environments</h2>
                <span className="muted">
                    {result === null ? '…' : `${String(result.environments.length)} images`}
                </span>
                <button className="ghost" onClick={load}>
                    Refresh
                </button>
            </div>
            {result === null ? (
                <p className="muted">Asking podman or docker for EE images…</p>
            ) : result.state === 'error' ? (
                <p className="muted">{result.detail ?? 'Could not list images.'}</p>
            ) : result.environments.length === 0 ? (
                <p className="muted">
                    No execution-environment images found. Build one with ansible-builder.
                </p>
            ) : (
                <ul className="item-list">
                    {result.environments.map((environment) => (
                        <li key={environment.fullName} className="item-row item-row-drill">
                            <div className="item-main">
                                <span className="item-title">{environment.fullName}</span>
                                <span className="item-description">
                                    {environment.imageId} · created {environment.created}
                                </span>
                            </div>
                            <span className="item-tag">EE</span>
                            <DrillLink
                                label={environment.fullName}
                                onOpen={() => {
                                    onOpen(environment.fullName);
                                }}
                            />
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

/**
 * Everything the introspection script reports for one image.
 * @param props - Component properties.
 * @param props.fullName - Image being inspected.
 * @returns The detail pane.
 */
function EnvironmentDetails(props: { fullName: string }): JSX.Element {
    const { fullName } = props;
    const [result, setResult] = useState<ExecutionEnvironmentDetailsResult | null>(null);

    useEffect(() => {
        let active = true;
        setResult(null);
        window.navita
            .getExecutionEnvironmentDetails(fullName)
            .then((next) => {
                if (active) {
                    setResult(next);
                }
            })
            .catch((error: unknown) => {
                if (active) {
                    setResult({
                        state: 'error',
                        detail: error instanceof Error ? error.message : String(error),
                    });
                }
            });
        return () => {
            active = false;
        };
    }, [fullName]);

    const details = result?.details;
    const collections = useListFilter<PackageEntry>(
        details?.collections ?? [],
        useCallback((entry: PackageEntry) => `${entry.name} ${entry.version}`, []),
    );
    const pythonPackages = useListFilter(
        details?.pythonPackages ?? [],
        useCallback(
            (entry: { name: string; version: string; summary?: string }) =>
                `${entry.name} ${entry.version} ${entry.summary ?? ''}`,
            [],
        ),
    );
    const systemPackages = useListFilter<PackageEntry>(
        details?.systemPackages ?? [],
        useCallback((entry: PackageEntry) => `${entry.name} ${entry.version}`, []),
    );

    if (result === null) {
        return (
            <section className="card">
                <h1>{fullName}</h1>
                <p className="muted">
                    Inspecting the image. This starts a container, so the first look takes a moment.
                </p>
            </section>
        );
    }

    if (result.state === 'error' || details === undefined) {
        return (
            <section className="card">
                <h1>{fullName}</h1>
                <p className="muted">{result.detail ?? 'Could not inspect this image.'}</p>
            </section>
        );
    }

    return (
        <>
            <section className="card">
                <div className="card-header">
                    <h2>Image</h2>
                    <span className="muted">{details.fullName}</span>
                </div>
                <dl className="facts">
                    {details.info.ansible !== undefined && (
                        <Fact label="Ansible" value={details.info.ansible} />
                    )}
                    {details.info.os !== undefined && <Fact label="OS" value={details.info.os} />}
                    {details.imageId !== undefined && (
                        <Fact label="Image ID" value={details.imageId} />
                    )}
                    {details.created !== undefined && (
                        <Fact label="Created" value={details.created} />
                    )}
                </dl>
            </section>

            <PackageCard
                title="Ansible collections"
                label="Filter collections"
                entries={collections.items}
                query={collections.query}
                onQuery={collections.setQuery}
                matches={collections.matches}
                total={collections.total}
                empty="The image reports no collections."
            />

            <PackageCard
                title="Python packages"
                label="Filter Python packages"
                entries={pythonPackages.items}
                query={pythonPackages.query}
                onQuery={pythonPackages.setQuery}
                matches={pythonPackages.matches}
                total={pythonPackages.total}
                empty="The image reports no Python packages."
            />

            <PackageCard
                title="System packages"
                label="Filter system packages"
                entries={systemPackages.items}
                query={systemPackages.query}
                onQuery={systemPackages.setQuery}
                matches={systemPackages.matches}
                total={systemPackages.total}
                empty="The image reports no system packages."
            />
        </>
    );
}

/**
 * One label/value pair in the image facts list.
 * @param props - Component properties.
 * @param props.label - Fact name.
 * @param props.value - Fact value.
 * @returns The fact element.
 */
function Fact(props: { label: string; value: string }): JSX.Element {
    return (
        <>
            <dt>{props.label}</dt>
            <dd>{props.value}</dd>
        </>
    );
}

/**
 * A filterable package list inside one image.
 * @param props - Component properties.
 * @param props.title - Card heading.
 * @param props.label - Placeholder for the filter input.
 * @param props.entries - Rows to show after filtering.
 * @param props.query - Current filter text.
 * @param props.onQuery - Replaces the filter text.
 * @param props.matches - Rows matching the query, before the render cap.
 * @param props.total - Rows the image reported.
 * @param props.empty - Text shown when the image reported nothing.
 * @returns The card element.
 */
function PackageCard(props: {
    title: string;
    label: string;
    entries: readonly { name: string; version: string; summary?: string }[];
    query: string;
    onQuery: (value: string) => void;
    matches: number;
    total: number;
    empty: string;
}): JSX.Element {
    const { title, label, entries, query, onQuery, matches, total, empty } = props;

    return (
        <section className="card">
            <div className="card-header">
                <h2>{title}</h2>
                <FilterBox label={label} value={query} onChange={onQuery} />
                <span className="muted">
                    {total === 0
                        ? '—'
                        : query.trim().length > 0
                          ? `${String(matches)} of ${String(total)}`
                          : `${String(total)} packages`}
                </span>
            </div>
            {total === 0 ? (
                <p className="muted">{empty}</p>
            ) : entries.length === 0 ? (
                <p className="muted">Nothing matches “{query}”.</p>
            ) : (
                <>
                    <ul className="item-list">
                        {entries.map((entry) => (
                            <li key={entry.name} className="item-row">
                                <div className="item-main">
                                    <span className="item-title">{entry.name}</span>
                                    {entry.summary !== undefined && entry.summary.length > 0 && (
                                        <span className="item-description">{entry.summary}</span>
                                    )}
                                </div>
                                <span className="item-tag">{entry.version}</span>
                            </li>
                        ))}
                    </ul>
                    <CapNotice shown={entries.length} matches={matches} />
                </>
            )}
        </section>
    );
}
