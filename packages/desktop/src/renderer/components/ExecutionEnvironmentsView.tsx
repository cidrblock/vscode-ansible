import { useCallback, useEffect, useState, type JSX } from 'react';

import type {
    ExecutionEnvironmentDetails,
    ExecutionEnvironmentDetailsResult,
    ExecutionEnvironmentsResult,
    PythonPackageEntry,
} from '../../shared/ipc';
import {
    forgetExecutionEnvironmentDetails,
    loadExecutionEnvironmentDetails,
} from '../executionEnvironmentDetails';
import {
    executionEnvironmentCrumb,
    executionEnvironmentPackageCrumb,
    executionEnvironmentPackageLabel,
    executionEnvironmentPackagesCrumb,
    parseExecutionEnvironmentTrail,
    type ExecutionEnvironmentPackageKind,
} from '../executionEnvironmentPath';
import { CapNotice, FilterBox, useListFilter } from '../filter';
import { useTrail } from '../navigation';
import { DrillLink } from './DrillLink';

/**
 * Execution Environments section: the image list, one image, and each of its
 * package inventories.
 *
 * The depth comes from the shared trail, so Back and the breadcrumbs behave the
 * same here as in every other view.
 * @returns The execution environments panel.
 */
export function ExecutionEnvironmentsView(): JSX.Element {
    const { trail, push } = useTrail('execution-environments');
    const place = parseExecutionEnvironmentTrail(trail);

    if (place?.level === 'package') {
        return <PackageDetails fullName={place.fullName} kind={place.kind} name={place.name} />;
    }

    if (place?.level === 'packages') {
        const { fullName, kind } = place;
        return (
            <PackageList
                fullName={fullName}
                kind={kind}
                onOpen={
                    kind === 'python'
                        ? (name) => {
                              push(executionEnvironmentPackageCrumb(fullName, kind, name));
                          }
                        : undefined
                }
            />
        );
    }

    if (place !== undefined) {
        const { fullName } = place;
        return (
            <EnvironmentDetails
                fullName={fullName}
                onOpen={(kind) => {
                    push(executionEnvironmentPackagesCrumb(fullName, kind));
                }}
            />
        );
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

    const refresh = useCallback(() => {
        forgetExecutionEnvironmentDetails();
        load();
    }, [load]);

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
                <button className="ghost" onClick={refresh}>
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
 * What one image contains, with a way into each inventory.
 * @param props - Component properties.
 * @param props.fullName - Image being inspected.
 * @param props.onOpen - Opens one of the image's package inventories.
 * @returns The detail pane.
 */
function EnvironmentDetails(props: {
    fullName: string;
    onOpen: (kind: ExecutionEnvironmentPackageKind) => void;
}): JSX.Element {
    const { fullName, onOpen } = props;
    const [result, setResult] = useState<ExecutionEnvironmentDetailsResult | null>(null);

    useEffect(() => {
        let active = true;
        setResult(null);
        void loadExecutionEnvironmentDetails(fullName).then((next) => {
            if (active) {
                setResult(next);
            }
        });
        return () => {
            active = false;
        };
    }, [fullName]);

    const details = result?.details;

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

            <section className="card">
                <div className="card-header">
                    <h2>Contents</h2>
                </div>
                <ul className="item-list">
                    {INVENTORIES.map((inventory) => {
                        const entries = packageEntries(details, inventory.kind);
                        return (
                            <li key={inventory.kind} className="item-row item-row-drill">
                                <div className="item-main">
                                    <span className="item-title">{inventory.title}</span>
                                    <span className="item-description">{summarize(entries)}</span>
                                </div>
                                <span className="item-tag">{entries.length}</span>
                                <DrillLink
                                    label={inventory.title}
                                    onOpen={() => {
                                        onOpen(inventory.kind);
                                    }}
                                />
                            </li>
                        );
                    })}
                </ul>
            </section>
        </>
    );
}

/** The three inventories every image reports, in display order. */
const INVENTORIES: readonly {
    readonly kind: ExecutionEnvironmentPackageKind;
    readonly title: string;
}[] = [
    { kind: 'collections', title: executionEnvironmentPackageLabel('collections') },
    { kind: 'python', title: executionEnvironmentPackageLabel('python') },
    { kind: 'system', title: executionEnvironmentPackageLabel('system') },
];

/**
 * One inventory of one image, filterable on its own page.
 * @param props - Component properties.
 * @param props.fullName - Image the inventory came from.
 * @param props.kind - Which inventory to show.
 * @param props.onOpen - Opens one package, when this inventory has a detail page.
 * @returns The package list pane.
 */
function PackageList(props: {
    fullName: string;
    kind: ExecutionEnvironmentPackageKind;
    onOpen?: (name: string) => void;
}): JSX.Element {
    const { fullName, kind, onOpen } = props;
    const [result, setResult] = useState<ExecutionEnvironmentDetailsResult | null>(null);

    useEffect(() => {
        let active = true;
        setResult(null);
        void loadExecutionEnvironmentDetails(fullName).then((next) => {
            if (active) {
                setResult(next);
            }
        });
        return () => {
            active = false;
        };
    }, [fullName]);

    const entries = packageEntries(result?.details, kind);
    const haystack = useCallback(
        (entry: PythonPackageEntry) =>
            entry.summary === undefined
                ? `${entry.name} ${entry.version}`
                : `${entry.name} ${entry.version} ${entry.summary}`,
        [],
    );
    const filter = useListFilter<PythonPackageEntry>(entries, haystack);
    const title = executionEnvironmentPackageLabel(kind);

    if (result === null) {
        return (
            <section className="card">
                <h2>{title}</h2>
                <p className="muted">
                    Inspecting the image. This starts a container, so the first look takes a moment.
                </p>
            </section>
        );
    }

    if (result.state === 'error' || result.details === undefined) {
        return (
            <section className="card">
                <h2>{title}</h2>
                <p className="muted">{result.detail ?? 'Could not inspect this image.'}</p>
            </section>
        );
    }

    return (
        <PackageCard
            title={title}
            label={`Filter ${title.toLowerCase()}`}
            unit={kind === 'collections' ? 'collections' : 'packages'}
            entries={filter.items}
            query={filter.query}
            onQuery={filter.setQuery}
            matches={filter.matches}
            total={filter.total}
            empty={EMPTY[kind]}
            onOpen={onOpen}
        />
    );
}

/**
 * One package of an image, with the metadata the introspection reported.
 * @param props - Component properties.
 * @param props.fullName - Image the package came from.
 * @param props.kind - Inventory it belongs to.
 * @param props.name - Package name exactly as the image reported it.
 * @returns The package pane.
 */
function PackageDetails(props: {
    fullName: string;
    kind: ExecutionEnvironmentPackageKind;
    name: string;
}): JSX.Element {
    const { fullName, kind, name } = props;
    const [result, setResult] = useState<ExecutionEnvironmentDetailsResult | null>(null);

    useEffect(() => {
        let active = true;
        setResult(null);
        void loadExecutionEnvironmentDetails(fullName).then((next) => {
            if (active) {
                setResult(next);
            }
        });
        return () => {
            active = false;
        };
    }, [fullName]);

    if (result === null) {
        return (
            <section className="card">
                <h2>{name}</h2>
                <p className="muted">
                    Inspecting the image. This starts a container, so the first look takes a moment.
                </p>
            </section>
        );
    }

    if (result.state === 'error' || result.details === undefined) {
        return (
            <section className="card">
                <h2>{name}</h2>
                <p className="muted">{result.detail ?? 'Could not inspect this image.'}</p>
            </section>
        );
    }

    const entry = findPackage(result.details, kind, name);
    if (entry === undefined) {
        return (
            <section className="card">
                <h2>{name}</h2>
                <p className="muted">
                    This image does not report a package called “{name}” in{' '}
                    {executionEnvironmentPackageLabel(kind).toLowerCase()}.
                </p>
            </section>
        );
    }

    const author = [entry.author, entry['author-email']]
        .filter((part) => part !== undefined && part.length > 0)
        .join(' · ');
    const requires = entry.requires?.join(', ');
    const requiredBy = entry['required-by']?.join(', ');

    return (
        <section className="card">
            <div className="card-header">
                <h2>{entry.name}</h2>
                <span className="item-tag">{entry.version}</span>
            </div>
            <dl className="facts">
                {entry.summary !== undefined && <Fact label="Summary" value={entry.summary} />}
                {entry.license !== undefined && <Fact label="License" value={entry.license} />}
                {author.length > 0 && <Fact label="Author" value={author} />}
                {entry['home-page'] !== undefined && (
                    <Fact label="Home page" value={entry['home-page']} />
                )}
                {entry.location !== undefined && <Fact label="Location" value={entry.location} />}
                {requires !== undefined && requires.length > 0 && (
                    <Fact label="Requires" value={requires} />
                )}
                {requiredBy !== undefined && requiredBy.length > 0 && (
                    <Fact label="Required by" value={requiredBy} />
                )}
            </dl>
        </section>
    );
}

/**
 * Look one package up by name.
 * @param details - Loaded image details.
 * @param kind - Inventory the package belongs to.
 * @param name - Package name as the image reported it.
 * @returns The entry, or undefined when the image no longer lists it.
 */
function findPackage(
    details: ExecutionEnvironmentDetails,
    kind: ExecutionEnvironmentPackageKind,
    name: string,
): PythonPackageEntry | undefined {
    return packageEntries(details, kind).find((entry) => entry.name === name);
}

/** Text shown when an image reports nothing for an inventory. */
const EMPTY: Readonly<Record<ExecutionEnvironmentPackageKind, string>> = {
    collections: 'The image reports no collections.',
    python: 'The image reports no Python packages.',
    system: 'The image reports no system packages.',
};

/**
 * Read one inventory out of a loaded image.
 * @param details - Loaded image details, if the inspection has finished.
 * @param kind - Which inventory to read.
 * @returns Its entries, or an empty list.
 */
function packageEntries(
    details: ExecutionEnvironmentDetails | undefined,
    kind: ExecutionEnvironmentPackageKind,
): readonly PythonPackageEntry[] {
    if (details === undefined) {
        return [];
    }
    if (kind === 'collections') {
        return details.collections;
    }
    return kind === 'python' ? details.pythonPackages : details.systemPackages;
}

/**
 * First few names of an inventory, for the row that opens it.
 * @param entries - Entries the image reported.
 * @returns A short preview, or a note that there are none.
 */
function summarize(entries: readonly PythonPackageEntry[]): string {
    if (entries.length === 0) {
        return 'None reported.';
    }
    const names = entries.slice(0, 3).map((entry) => entry.name);
    return entries.length > names.length ? `${names.join(', ')}, …` : names.join(', ');
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
 * @param props.unit - Noun for the row count, for example `collections`.
 * @param props.entries - Rows to show after filtering.
 * @param props.query - Current filter text.
 * @param props.onQuery - Replaces the filter text.
 * @param props.matches - Rows matching the query, before the render cap.
 * @param props.total - Rows the image reported.
 * @param props.empty - Text shown when the image reported nothing.
 * @param props.onOpen - Opens one package, when its inventory has a detail page.
 * @returns The card element.
 */
function PackageCard(props: {
    title: string;
    label: string;
    unit: string;
    entries: readonly PythonPackageEntry[];
    query: string;
    onQuery: (value: string) => void;
    matches: number;
    total: number;
    empty: string;
    onOpen?: (name: string) => void;
}): JSX.Element {
    const { title, label, unit, entries, query, onQuery, matches, total, empty, onOpen } = props;

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
                          : `${String(total)} ${unit}`}
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
                            <li
                                key={entry.name}
                                className={
                                    onOpen === undefined ? 'item-row' : 'item-row item-row-drill'
                                }
                            >
                                <div className="item-main">
                                    <span className="item-title">{entry.name}</span>
                                    {entry.summary !== undefined && entry.summary.length > 0 && (
                                        <span className="item-description">{entry.summary}</span>
                                    )}
                                </div>
                                <span className="item-tag">{entry.version}</span>
                                {onOpen !== undefined && (
                                    <DrillLink
                                        label={entry.name}
                                        onOpen={() => {
                                            onOpen(entry.name);
                                        }}
                                    />
                                )}
                            </li>
                        ))}
                    </ul>
                    <CapNotice shown={entries.length} matches={matches} />
                </>
            )}
        </section>
    );
}
