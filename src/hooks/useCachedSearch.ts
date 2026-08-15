import { useCallback, useEffect, useRef, useState } from 'react';

interface UseCachedSearchOptions<T> {
  open: boolean;
  initialQuery: string;
  search: (query: string, signal: AbortSignal) => Promise<T[]>;
  getErrorMessage: (error: unknown) => string;
  debounceMs?: number;
}

export function useCachedSearch<T>({
  open,
  initialQuery,
  search,
  getErrorMessage,
  debounceMs = 0,
}: UseCachedSearchOptions<T>) {
  const [query, setQueryState] = useState(initialQuery);
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const queryRef = useRef(initialQuery);
  const previousOpenRef = useRef(false);
  const cacheRef = useRef(new Map<string, T[]>());
  const requestIdRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setQuery = useCallback((value: string) => {
    queryRef.current = value;
    setQueryState(value);
  }, []);

  const runSearch = useCallback(
    async (overrideQuery?: string) => {
      const normalizedQuery = (overrideQuery ?? queryRef.current).trim();
      if (!normalizedQuery) return;

      const requestId = ++requestIdRef.current;
      controllerRef.current?.abort();

      const cachedResults = cacheRef.current.get(normalizedQuery);
      if (cachedResults) {
        setLoading(false);
        setError(null);
        setResults(cachedResults);
        setHasSearched(true);
        return;
      }

      setLoading(true);
      setError(null);
      setResults([]);
      setHasSearched(true);
      const controller = new AbortController();
      controllerRef.current = controller;

      try {
        const nextResults = await search(normalizedQuery, controller.signal);
        if (requestId !== requestIdRef.current) return;
        cacheRef.current.set(normalizedQuery, nextResults);
        setResults(nextResults);
      } catch (searchError) {
        if (controller.signal.aborted || requestId !== requestIdRef.current) {
          return;
        }
        setError(getErrorMessage(searchError));
        setResults([]);
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [getErrorMessage, search],
  );

  const runDebouncedSearch = useCallback(
    (overrideQuery?: string) => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      debounceTimeoutRef.current = setTimeout(
        () => void runSearch(overrideQuery),
        debounceMs,
      );
    },
    [debounceMs, runSearch],
  );

  useEffect(() => {
    if (open && !previousOpenRef.current) {
      setQuery(initialQuery);
      const normalizedQuery = initialQuery.trim();
      if (normalizedQuery) {
        void runSearch(initialQuery);
      } else {
        setResults([]);
        setError(null);
        setHasSearched(false);
      }
    } else if (!open) {
      requestIdRef.current += 1;
      controllerRef.current?.abort();
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      setLoading(false);
    }
    previousOpenRef.current = open;

    return () => {
      controllerRef.current?.abort();
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [initialQuery, open, runSearch, setQuery]);

  return {
    query,
    setQuery,
    results,
    loading,
    error,
    hasSearched,
    runSearch,
    runDebouncedSearch,
  };
}
