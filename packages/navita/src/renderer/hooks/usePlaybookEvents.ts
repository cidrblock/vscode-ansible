import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';
import type { ProgressEvent, PlaybookInfo, PlaybookConfig } from '../../shared/types';

export interface PlayState {
    name: string;
    uuid: string;
    hosts: string[];
    tasks: TaskState[];
}

export interface TaskState {
    name: string;
    uuid: string;
    action: string;
    path?: string;
    isHandler: boolean;
    hostResults: HostResult[];
}

export interface HostResult {
    host: string;
    status: 'ok' | 'changed' | 'failed' | 'skipped' | 'unreachable';
    changed: boolean;
    duration?: number;
    result: Record<string, unknown>;
    ignoreErrors?: boolean;
}

export interface PlaybookStats {
    [host: string]: {
        ok: number;
        changed: number;
        failures: number;
        unreachable: number;
        skipped: number;
        rescued: number;
        ignored: number;
    };
}

export function usePlaybooks() {
    const [playbooks, setPlaybooks] = useState<PlaybookInfo[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        void api
            .getPlaybooks()
            .then(setPlaybooks)
            .catch(() => setPlaybooks([]))
            .finally(() => setLoading(false));
    }, []);

    return { playbooks, loading };
}

export function usePlaybookExecution() {
    const [isRunning, setIsRunning] = useState(false);
    const [plays, setPlays] = useState<PlayState[]>([]);
    const [stats, setStats] = useState<PlaybookStats | null>(null);
    const [duration, setDuration] = useState<number | null>(null);
    const [events, setEvents] = useState<ProgressEvent[]>([]);
    const currentPlayRef = useRef<PlayState | null>(null);
    const currentTaskRef = useRef<TaskState | null>(null);

    const handleEvent = useCallback((event: ProgressEvent) => {
        setEvents((prev) => [...prev, event]);

        switch (event.type) {
            case 'playbook_start':
                setPlays([]);
                setStats(null);
                setDuration(null);
                break;

            case 'play_start': {
                const play: PlayState = {
                    name: (event.data.name as string) || 'Unnamed play',
                    uuid: event.data.uuid as string,
                    hosts: (event.data.hosts as string[]) || [],
                    tasks: [],
                };
                currentPlayRef.current = play;
                setPlays((prev) => [...prev, play]);
                break;
            }

            case 'task_start': {
                const task: TaskState = {
                    name: (event.data.name as string) || 'Unnamed task',
                    uuid: event.data.uuid as string,
                    action: event.data.action as string,
                    path: event.data.path as string | undefined,
                    isHandler: event.data.is_handler as boolean,
                    hostResults: [],
                };
                currentTaskRef.current = task;
                if (currentPlayRef.current) {
                    currentPlayRef.current.tasks.push(task);
                    setPlays((prev) => [...prev]);
                }
                break;
            }

            case 'host_ok':
            case 'host_failed':
            case 'host_skipped':
            case 'host_unreachable': {
                const statusMap: Record<string, HostResult['status']> = {
                    host_ok: (event.data.changed as boolean) ? 'changed' : 'ok',
                    host_failed: 'failed',
                    host_skipped: 'skipped',
                    host_unreachable: 'unreachable',
                };
                const hostResult: HostResult = {
                    host: event.data.host as string,
                    status: statusMap[event.type] ?? 'ok',
                    changed: (event.data.changed as boolean) ?? false,
                    duration: event.data.duration as number | undefined,
                    result: (event.data.result as Record<string, unknown>) ?? {},
                    ignoreErrors: event.data.ignore_errors as boolean | undefined,
                };
                if (currentTaskRef.current) {
                    currentTaskRef.current.hostResults.push(hostResult);
                    setPlays((prev) => [...prev]);
                }
                break;
            }

            case 'playbook_complete':
                setStats((event.data.stats as PlaybookStats) ?? null);
                setDuration((event.data.duration as number) ?? null);
                setIsRunning(false);
                break;
        }
    }, []);

    useEffect(() => {
        const unsubEvent = api.onPlaybookEvent(handleEvent);
        const unsubComplete = api.onPlaybookComplete(() => setIsRunning(false));
        return () => {
            unsubEvent();
            unsubComplete();
        };
    }, [handleEvent]);

    const run = useCallback(async (playbookPath: string, config: PlaybookConfig) => {
        setIsRunning(true);
        setPlays([]);
        setStats(null);
        setDuration(null);
        setEvents([]);
        currentPlayRef.current = null;
        currentTaskRef.current = null;
        await api.runPlaybook(playbookPath, config);
    }, []);

    const stop = useCallback(async () => {
        await api.stopPlaybook();
        setIsRunning(false);
    }, []);

    return { isRunning, plays, stats, duration, events, run, stop };
}
