import { useLiveQuery } from 'dexie-react-hooks';
import type { DependencyList } from 'react';
import { toUserMessage } from '@/lib/errors';

/** Keep read failures in startup state, with an explicit dependency to retry. */
export function useRecoverableLiveQuery<T>(
  query: () => Promise<T> | T,
  dependencies: DependencyList,
  retryToken: number,
): { data: T | undefined; error: string | null } {
  const result = useLiveQuery(async () => {
    try {
      return { data: await query(), error: null, retryToken };
    } catch (error) {
      return { data: undefined, error: toUserMessage(error), retryToken };
    }
  }, [...dependencies, retryToken]);
  // useLiveQuery can retain its last result while a new subscription starts.
  return result?.retryToken === retryToken
    ? result
    : { data: undefined, error: null };
}
