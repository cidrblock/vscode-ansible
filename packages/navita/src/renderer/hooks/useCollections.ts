import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import type { SearchResult } from '../../shared/types';

interface CollectionItem {
    name: string;
    version: string;
    path: string;
}

interface PluginItem {
    name: string;
    description?: string;
}

export function useCollections() {
    const [collections, setCollections] = useState<CollectionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await api.getCollections();
            setCollections(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }, []);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            await api.refreshCollections();
            const result = await api.getCollections();
            setCollections(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    return { collections, loading, error, refresh };
}

export function usePlugins(collection: string | null, pluginType: string) {
    const [plugins, setPlugins] = useState<PluginItem[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!collection) {
            setPlugins([]);
            return;
        }
        setLoading(true);
        void api
            .getPlugins(collection, pluginType)
            .then(setPlugins)
            .catch(() => setPlugins([]))
            .finally(() => setLoading(false));
    }, [collection, pluginType]);

    return { plugins, loading };
}

export function usePluginDoc(pluginName: string | null, pluginType: string) {
    const [doc, setDoc] = useState<Record<string, unknown> | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!pluginName) {
            setDoc(null);
            return;
        }
        setLoading(true);
        void api
            .getPluginDoc(pluginName, pluginType)
            .then(setDoc)
            .catch(() => setDoc(null))
            .finally(() => setLoading(false));
    }, [pluginName, pluginType]);

    return { doc, loading };
}

export function usePluginSearch() {
    const [results, setResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);

    const search = useCallback(async (query: string) => {
        if (!query.trim()) {
            setResults([]);
            return;
        }
        setSearching(true);
        try {
            const r = await api.searchPlugins(query);
            setResults(r);
        } catch {
            setResults([]);
        } finally {
            setSearching(false);
        }
    }, []);

    return { results, searching, search };
}
