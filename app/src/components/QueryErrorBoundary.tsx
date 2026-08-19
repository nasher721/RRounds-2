import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { ErrorState } from '@/components/ui/loading-state';

interface QueryErrorBoundaryProps {
  children: ReactNode;
  /** Optional fallback UI */
  fallback?: ReactNode;
}

/**
 * React Query Error Boundary
 * Catches and handles query errors with retry capability
 * 
 * Usage:
 * <QueryErrorBoundary>
 *   <YourComponent />
 * </QueryErrorBoundary>
 */
export function QueryErrorBoundary({ 
  children, 
  fallback 
}: QueryErrorBoundaryProps) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <>
          {fallback ? (
            fallback
          ) : (
            <ErrorState
              title="Failed to load data"
              message="There was a problem fetching the latest data. Your cached data may be shown."
              onRetry={reset}
            />
          )}
        </>
      )}
    </QueryErrorResetBoundary>
  );
}
