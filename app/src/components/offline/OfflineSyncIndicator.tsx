import React, { useState } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

import {
  useOfflineSyncContext,
  useOfflineSync,
  type ConflictData,
} from '@/contexts/offline/OfflineSyncContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export function OfflineSyncIndicator(): React.ReactElement {
  const { state } = useOfflineSyncContext();
  const { sync, resolveConflict } = useOfflineSync();
  const [showConflicts, setShowConflicts] = useState(false);

  const handleResolve = async (
    conflict: ConflictData,
    useServer: boolean
  ): Promise<void> => {
    await resolveConflict(conflict.id, useServer ? 'server-wins' : 'client-wins');
  };

  if (!state.isOnline) {
    return (
      <Badge variant="destructive" className="gap-1" role="status" aria-live="polite">
        <WifiOff className="h-3 w-3" aria-hidden="true" />
        Offline
      </Badge>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2" role="status" aria-live="polite" aria-busy={state.isSyncing || undefined}>
        {state.isSyncing ? (
          <Badge variant="outline" className="gap-1 animate-pulse" aria-busy="true">
            <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />
            Syncing...
          </Badge>
        ) : state.pendingCount > 0 ? (
          <Badge
            variant="secondary"
            className="gap-1 cursor-pointer hover:bg-secondary/80"
            onClick={() => sync()}
            aria-label={`${state.pendingCount} pending sync items. Activate to sync now.`}
          >
            <Wifi className="h-3 w-3" aria-hidden="true" />
            {state.pendingCount} pending
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1">
            <Wifi className="h-3 w-3" aria-hidden="true" />
            Synced
          </Badge>
        )}

        {state.conflicts.length > 0 && (
          <Badge
            variant="destructive"
            className="gap-1 cursor-pointer"
            onClick={() => setShowConflicts(true)}
          >
            <AlertCircle className="h-3 w-3" />
            {state.conflicts.length} conflicts
          </Badge>
        )}
      </div>

      <Dialog open={showConflicts} onOpenChange={setShowConflicts}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Resolve Sync Conflicts</DialogTitle>
            <DialogDescription>
              Choose whether to keep your local edits or the server version for each conflicting field.
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[60vh]">
            <div className="space-y-4 pr-4">
              {state.conflicts.map((conflict) => (
                <ConflictResolver
                  key={conflict.id}
                  conflict={conflict}
                  onResolve={handleResolve}
                />
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Props for individual conflict resolver
 */
interface ConflictResolverProps {
  conflict: ConflictData;
  onResolve: (conflict: ConflictData, useServer: boolean) => void;
}

/**
 * Individual conflict resolution UI
 */
function ConflictResolver({
  conflict,
  onResolve,
}: ConflictResolverProps): React.ReactElement {
  const [viewMode, setViewMode] = useState<'local' | 'server' | 'diff'>('diff');

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold">{conflict.table}</h4>
          <p className="text-sm text-muted-foreground">
            Pending {conflict.operation} conflict
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onResolve(conflict, false)}
          >
            Keep My Changes
          </Button>
          <Button
            size="sm"
            onClick={() => onResolve(conflict, true)}
          >
            Use Server Version
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant={viewMode === 'local' ? 'secondary' : 'ghost'}
          onClick={() => setViewMode('local')}
        >
          My Version
        </Button>
        <Button
          size="sm"
          variant={viewMode === 'server' ? 'secondary' : 'ghost'}
          onClick={() => setViewMode('server')}
        >
          Server Version
        </Button>
        <Button
          size="sm"
          variant={viewMode === 'diff' ? 'secondary' : 'ghost'}
          onClick={() => setViewMode('diff')}
        >
          Compare
        </Button>
      </div>

      <div className="bg-muted rounded p-3 font-mono text-sm overflow-auto">
        {viewMode === 'local' && (
          <pre>{JSON.stringify(conflict.clientData, null, 2)}</pre>
        )}
        {viewMode === 'server' && (
          <pre>{JSON.stringify(conflict.serverData, null, 2)}</pre>
        )}
        {viewMode === 'diff' && (
          <ConflictDiff local={conflict.clientData} server={conflict.serverData} />
        )}
      </div>
    </div>
  );
}

/**
 * Diff view component for comparing local vs server data
 */
function ConflictDiff({
  local,
  server,
}: {
  local: Record<string, unknown>;
  server: Record<string, unknown> | null;
}): React.ReactElement {
  const serverValues = server ?? {};
  const allKeys = new Set([...Object.keys(local), ...Object.keys(serverValues)]);
  
  return (
    <div className="space-y-1">
      {Array.from(allKeys).map((key) => {
        const localVal = local[key];
        const serverVal = serverValues[key];
        const isDifferent = JSON.stringify(localVal) !== JSON.stringify(serverVal);
        
        return (
          <div key={key} className="grid grid-cols-3 gap-2">
            <div className={cn('truncate', isDifferent && 'text-yellow-600 font-semibold')}>
              {key}
            </div>
            <div className={cn('text-green-600', !isDifferent && 'opacity-50')}>
              {JSON.stringify(localVal)}
            </div>
            <div className={cn('text-red-600', !isDifferent && 'opacity-50')}>
              {JSON.stringify(serverVal)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
