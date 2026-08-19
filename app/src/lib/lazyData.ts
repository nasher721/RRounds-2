/**
 * Lazy Data Loader
 *
 * Enables code-splitting for large static data files (IBCC, guidelines, etc.)
 * by loading them via dynamic import() instead of synchronous import.
 *
 * This moves large data (~200KB+ of JSON-like TS) out of the initial bundle
 * and into separate chunks that load asynchronously.
 */

import { useState, useEffect, useRef } from 'react';

type LazyDataState<T> = {
  data: T | null;
  loading: boolean;
  error: Error | null;
};

/**
 * Hook to lazy-load a module and extract a named export.
 *
 * @param loader - Dynamic import function, e.g. () => import('@/data/ibccContent')
 * @param selector - Function to extract the desired export from the module
 *
 * @example
 * const { data: chapters, loading } = useLazyData(
 *   () => import('@/data/ibccContent'),
 *   (mod) => mod.IBCC_CHAPTERS,
 * );
 */
export function useLazyData<TModule, TData>(
  loader: () => Promise<TModule>,
  selector: (mod: TModule) => TData,
): LazyDataState<TData> {
  const [state, setState] = useState<LazyDataState<TData>>({
    data: null,
    loading: true,
    error: null,
  });

  const loaderRef = useRef(loader);
  const selectorRef = useRef(selector);
  const hasLoadedRef = useRef(false);

  if (loader.toString() !== loaderRef.current.toString()) {
    loaderRef.current = loader;
    hasLoadedRef.current = false;
  }
  if (selector.toString() !== selectorRef.current.toString()) {
    selectorRef.current = selector;
    hasLoadedRef.current = false;
  }

  useEffect(() => {
    if (hasLoadedRef.current) return;
    
    let cancelled = false;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    loaderRef.current()
      .then((mod) => {
        if (!cancelled) {
          hasLoadedRef.current = true;
          setState({ data: selectorRef.current(mod), loading: false, error: null });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          hasLoadedRef.current = true;
          setState({
            data: null,
            loading: false,
            error: err instanceof Error ? err : new Error('Failed to load lazy data'),
          });
        }
    });

    return () => { cancelled = true; };
  }, []);

  return state;
}

// ---------------------------------------------------------------------------
// Pre-built loaders for large data modules
// ---------------------------------------------------------------------------

// Cache resolved modules to avoid re-loading
let ibccCache: typeof import('@/data/ibccContent') | null = null;
let guidelinesCache: typeof import('@/data/clinicalGuidelinesData') | null = null;

export async function loadIBCCData() {
  if (!ibccCache) {
    ibccCache = await import('@/data/ibccContent');
  }
  return ibccCache;
}

export async function loadGuidelinesData() {
  if (!guidelinesCache) {
    guidelinesCache = await import('@/data/clinicalGuidelinesData');
  }
  return guidelinesCache;
}

// NOTE: ibccChapterContent intentionally has no dynamic loader here. It is
// statically imported by IBCCChapterView, which is only reachable through the
// React.lazy IBCCPanelContent chunk, so the 160 KB module already loads with
// the IBCC panel and never enters the entry bundle. A dynamic import would be
// an ineffective no-op (Rollup keeps it in the static importer's chunk).
