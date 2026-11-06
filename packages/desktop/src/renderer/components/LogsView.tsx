import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';

import { LOG_SOURCES, type LogEntry, type LogSource, type LogsResult } from '../../shared/ipc';
import { FilterBox, useListFilter } from '../filter';

/** Filter selection: every source, or one of them. */
type SourceFilter = 'all' | LogSource;

/** Rows the page renders before it stops, so a huge buffer cannot stall it. */
const ROW_LIMIT = 500;

/**
 * Pluralize a count.
 * @param count - How many there are.
 * @param singular - Noun for one.
 * @returns The noun with an `s` unless the count is exactly one.
 */
function noun(count: number, singular: string): string {
    return count === 1 ? singular : `${singular}s`;
}

/**
 * Logs section: everything navita and the processes it spawns have printed.
 *
 * Reachable from View › Logs rather than the sidebar. Lines arrive on a debounced
 * event while the page is open, and the same lines are on disk for afterwards.
 * @param props - Component properties.
 * @param props.onNotice - Shows a short confirmation as a toast.
 * @returns The logs panel.
 */
export function LogsView(props: { onNotice: (message: string) => void }): JSX.Element {
    const { onNotice } = props;
    const [result, setResult] = useState<LogsResult | null>(null);
    const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
    const [errorsOnly, setErrorsOnly] = useState(false);
    const [follow, setFollow] = useState(true);
    const listRef = useRef<HTMLUListElement | null>(null);

    useEffect(() => {
        let active = true;
        window.navita
            .getLogs()
            .then((next) => {
                if (active) {
                    setResult(next);
                }
            })
            .catch((error: unknown) => {
                onNotice(error instanceof Error ? error.message : String(error));
            });
        const off = window.navita.onLogsChanged((next) => {
            if (active) {
                setResult(next);
            }
        });
        return () => {
            active = false;
            off();
        };
    }, [onNotice]);

    const entries = useMemo(() => {
        const all = result?.entries ?? [];
        const bySource =
            sourceFilter === 'all' ? all : all.filter((e) => e.source === sourceFilter);
        return errorsOnly ? bySource.filter((e) => e.level !== 'info') : bySource;
    }, [result, sourceFilter, errorsOnly]);

    const filter = useListFilter<LogEntry>(entries, (entry) => entry.message);
    const visible = filter.items.slice(-ROW_LIMIT);

    useEffect(() => {
        if (!follow) {
            return;
        }
        const list = listRef.current;
        if (list !== null) {
            list.scrollTop = list.scrollHeight;
        }
    }, [visible.length, follow]);

    const copy = useCallback(() => {
        const text = visible
            .map((entry) => `${entry.time} ${entry.source} ${entry.message}`)
            .join('\n');
        void window.navita.copyText(text).then(() => {
            onNotice(`Copied ${String(visible.length)} log ${noun(visible.length, 'line')}.`);
        });
    }, [onNotice, visible]);

    const reveal = useCallback(() => {
        if (result === null || result.filePath.length === 0) {
            return;
        }
        void window.navita.openPath(result.filePath).catch(() => {
            onNotice('Could not reveal the log file.');
        });
    }, [onNotice, result]);

    const clear = useCallback(() => {
        void window.navita.clearLogs().then((next) => {
            setResult(next);
            onNotice('Logs cleared.');
        });
    }, [onNotice]);

    const errorCount = entries.filter((entry) => entry.level === 'error').length;

    return (
        <section className="card">
            <div className="card-header">
                <h2>Logs</h2>
                <FilterBox label="Filter lines" value={filter.query} onChange={filter.setQuery} />
                <span className="muted">
                    {filter.active
                        ? `${String(filter.matches)} of ${String(entries.length)} ${noun(entries.length, 'line')}`
                        : `${String(entries.length)} ${noun(entries.length, 'line')}`}
                    {errorCount > 0 ? ` · ${String(errorCount)} ${noun(errorCount, 'error')}` : ''}
                </span>
            </div>

            <div className="log-controls">
                <label className="log-control">
                    <span className="muted">Source</span>
                    <select
                        value={sourceFilter}
                        onChange={(event) => {
                            setSourceFilter(event.target.value as SourceFilter);
                        }}
                    >
                        <option value="all">All</option>
                        {LOG_SOURCES.map((source) => (
                            <option key={source.id} value={source.id}>
                                {source.label}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="log-control">
                    <input
                        type="checkbox"
                        checked={errorsOnly}
                        onChange={(event) => {
                            setErrorsOnly(event.target.checked);
                        }}
                    />
                    <span className="muted">Warnings and errors</span>
                </label>
                <label className="log-control">
                    <input
                        type="checkbox"
                        checked={follow}
                        onChange={(event) => {
                            setFollow(event.target.checked);
                        }}
                    />
                    <span className="muted">Follow</span>
                </label>
                <span className="spacer" />
                <button className="ghost" onClick={copy} disabled={visible.length === 0}>
                    Copy
                </button>
                <button className="ghost" onClick={reveal} disabled={result?.filePath === ''}>
                    Reveal file
                </button>
                <button className="ghost" onClick={clear}>
                    Clear
                </button>
            </div>

            {result === null ? (
                <p className="muted">Reading the log buffer…</p>
            ) : entries.length === 0 ? (
                <p className="muted">
                    Nothing logged yet. Lines from the app, the MCP server, the language server and
                    the commands navita runs appear here as they happen.
                </p>
            ) : visible.length === 0 ? (
                <p className="muted">No lines match the current filters.</p>
            ) : (
                <ul className="log-list" ref={listRef}>
                    {visible.map((entry) => (
                        <li key={entry.id} className={`log-row log-${entry.level}`}>
                            <span className="log-time">{entry.time.slice(11, 19)}</span>
                            <span className="log-source">{entry.source}</span>
                            <span className="log-message">{entry.message}</span>
                        </li>
                    ))}
                </ul>
            )}

            {result !== null && result.filePath.length > 0 && (
                <p className="muted log-file">{result.filePath}</p>
            )}
        </section>
    );
}
