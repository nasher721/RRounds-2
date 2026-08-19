import { useState } from 'react';
import { Wifi, WifiOff, Cloud, RefreshCw, Trash2, Clock, AlertTriangle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useOfflineMode } from '@/hooks/useOfflineMode';
import {
  downloadPendingRecovery,
  pendingRecoverySignature,
} from '@/lib/exportPendingRecovery';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

export function OfflineIndicator({ touchFriendly = false }: { touchFriendly?: boolean } = {}) {
  const {
    isOnline,
    pendingCount,
    pendingMutations,
    failedCount,
    isSyncing,
    syncProgress,
    lastSyncTime,
    triggerSync,
    retryFailed,
    resolveSkippedConflict,
    discardQueue,
    skippedMutations,
  } = useOfflineMode();
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [downloadedQueueSignature, setDownloadedQueueSignature] = useState<string | null>(null);
  const [isClearingQueue, setIsClearingQueue] = useState(false);
  const queueSignature = pendingRecoverySignature(pendingMutations);
  const recoveryReady = pendingMutations.length > 0 && downloadedQueueSignature === queueSignature;

  const handleDownloadRecovery = () => {
    try {
      downloadPendingRecovery(pendingMutations);
      setDownloadedQueueSignature(queueSignature);
      toast.success('Recovery copy downloaded', {
        description: 'This file contains PHI. Store it only under organization policy.',
      });
    } catch {
      toast.error('Recovery copy could not be downloaded');
    }
  };

  const handleConfirmDiscard = async () => {
    if (!recoveryReady || !downloadedQueueSignature || isClearingQueue) return;
    setIsClearingQueue(true);
    try {
      const discarded = await discardQueue(downloadedQueueSignature);
      if (!discarded) {
        setDownloadedQueueSignature(null);
        toast.error('Pending changes changed', {
          description: 'Download a new recovery copy before discarding the current queue.',
        });
        return;
      }
      setDiscardDialogOpen(false);
      setDownloadedQueueSignature(null);
      toast.success('Local pending changes discarded');
    } catch {
      toast.error('Pending changes could not be discarded');
    } finally {
      setIsClearingQueue(false);
    }
  };
  
  // Don't show anything if online with no pending changes
  if (isOnline && pendingCount === 0 && !isSyncing) {
    return null;
  }
  
  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button
          variant="ghost"
          size="sm"
          className={`gap-2 ${touchFriendly ? 'min-h-[44px] min-w-[44px]' : ''} ${!isOnline || failedCount > 0 ? 'text-destructive' : pendingCount > 0 ? 'text-yellow-500' : ''}`}
          data-testid="offline-indicator"
          aria-label={
            !isOnline
              ? `Offline${pendingCount > 0 ? `, ${pendingCount} pending changes` : ""}`
              : failedCount > 0
                ? `Save failed, ${failedCount} changes need retry`
                : pendingCount > 0
                ? `Online, ${pendingCount} changes waiting to sync`
                : "Online"
          }
          aria-haspopup="dialog"
        >
          {isOnline ? (
            pendingCount > 0 ? (
              <>
                <Cloud className="h-4 w-4 shrink-0" aria-hidden />
                <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                  {pendingCount}
                </Badge>
              </>
            ) : (
              <Wifi className="h-4 w-4 shrink-0" aria-hidden />
            )
          ) : (
            <>
              <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
              {pendingCount > 0 && (
                <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                  {pendingCount}
                </Badge>
              )}
            </>
          )}
          </Button>
        </PopoverTrigger>
      
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          {/* Status Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isOnline ? (
                <>
                  <Wifi className="h-4 w-4 text-green-500" />
                  <span className="font-medium text-green-500">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-destructive" />
                  <span className="font-medium text-destructive">Offline</span>
                </>
              )}
            </div>
            
            {lastSyncTime && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(lastSyncTime, { addSuffix: true })}
              </span>
            )}
          </div>
          
          {/* Sync Progress */}
          {isSyncing && syncProgress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Syncing...</span>
                <span className="font-mono text-xs">
                  {syncProgress.completed}/{syncProgress.total}
                </span>
              </div>
              <Progress 
                value={(syncProgress.completed / syncProgress.total) * 100} 
                className="h-2"
              />
              {syncProgress.current && (
                <p className="text-xs text-muted-foreground truncate">
                  {syncProgress.current}
                </p>
              )}
            </div>
          )}
          
          {/* Pending Mutations */}
          {pendingCount > 0 && !isSyncing && (
            <>
              <Separator />
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {failedCount > 0 ? `Save failed (${failedCount})` : `Pending Changes (${pendingCount})`}
                  </span>
                  {isOnline && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={failedCount > 0 ? retryFailed : triggerSync}
                          aria-label={failedCount > 0 ? "Retry failed changes" : "Sync now"}
                        >
                          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{failedCount > 0 ? "Retry failed changes" : "Sync now"}</TooltipContent>
                    </Tooltip>
                  )}
                </div>
                
                <ScrollArea className="h-32">
                  <div className="space-y-1">
                    {pendingMutations.slice(0, 10).map((mutation) => (
                      <div
                        key={mutation.id}
                        className="flex items-center justify-between py-1 px-2 rounded bg-muted/50 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={
                              mutation.operation === 'create' ? 'default' :
                              mutation.operation === 'update' ? 'secondary' :
                              'destructive'
                            }
                            className="h-4 px-1 text-[10px]"
                          >
                            {mutation.operation}
                          </Badge>
                          <span className="text-muted-foreground">
                            {mutation.type}
                          </span>
                        </div>
                        {mutation.retryCount > 0 && (
                          <span className="text-muted-foreground">
                            retry {mutation.retryCount}
                          </span>
                        )}
                      </div>
                    ))}
                    {pendingMutations.length > 10 && (
                      <p className="text-xs text-muted-foreground text-center py-1">
                        +{pendingMutations.length - 10} more
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </>
          )}
          
          {/* Skipped/Conflicted Mutations */}
          {skippedMutations.length > 0 && (
            <>
              <Separator />
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-yellow-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    Conflicts ({skippedMutations.length})
                  </span>
                </div>
                
                <ScrollArea className="h-48">
                  <div className="space-y-1">
                    {skippedMutations.map((skipped) => (
                      <div
                        key={skipped.id}
                        className="space-y-2 rounded bg-yellow-50 px-2 py-2 text-xs dark:bg-yellow-950/30"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="h-4 px-1 text-[10px] border-yellow-500 text-yellow-700"
                            >
                              {skipped.mutation.operation}
                            </Badge>
                            <span className="text-muted-foreground">
                              {skipped.mutation.type}
                            </span>
                          </div>
                          <span className="text-yellow-600 text-[10px]">Server newer</span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="min-h-11 flex-1"
                            onClick={() => void resolveSkippedConflict(skipped, 'server-wins')}
                          >
                            Use server
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="min-h-11 flex-1"
                            onClick={() => void resolveSkippedConflict(skipped, 'client-wins')}
                          >
                            Keep mine
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                
                <p className="text-xs text-muted-foreground">
                  Server and local changes are both retained until you choose which version to keep.
                </p>
              </div>
            </>
          )}
          
          {/* Actions */}
          <Separator />
          
          <div className="flex gap-2">
            {isOnline && pendingCount > 0 && (
              <Button
                variant="default"
                size="sm"
                className="flex-1"
                onClick={failedCount > 0 ? retryFailed : triggerSync}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <Cloud className="h-4 w-4 mr-1.5" />
                    {failedCount > 0 ? "Retry Failed" : "Sync Now"}
                  </>
                )}
              </Button>
            )}
            
            {pendingCount > 0 && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handleDownloadRecovery}
                  disabled={isSyncing}
                >
                  <Download className="mr-1.5 h-4 w-4" aria-hidden />
                  Download recovery copy
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setDiscardDialogOpen(true)}
                      disabled={isSyncing}
                      aria-label="Review discarding pending changes"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Review discard</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
          
          {!isOnline && (
            <p className="text-xs text-muted-foreground text-center">
              {pendingCount > 0
                ? "Listed patient changes are stored on this device and will retry after reconnect."
                : "Edits are stored only after the interface confirms Offline queued. Keep a recovery copy for critical notes."}
            </p>
          )}
        </div>
      </PopoverContent>
      </Popover>
      <AlertDialog
        open={discardDialogOpen}
        onOpenChange={(open) => {
          if (!isClearingQueue) setDiscardDialogOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard local pending changes?</AlertDialogTitle>
            <AlertDialogDescription>
              These changes have not been confirmed on the server. Download a recovery copy before
              discarding them. The JSON contains PHI and is intended for authorized support or manual
              clinical recovery; it is not automatically re-imported.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full"
            onClick={handleDownloadRecovery}
            disabled={isClearingQueue}
          >
            <Download className="mr-2 h-4 w-4" aria-hidden />
            {recoveryReady ? 'Download recovery copy again' : 'Download recovery copy'}
          </Button>

          <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
            {recoveryReady
              ? 'Recovery copy downloaded. You may now discard these local changes.'
              : 'Discard remains unavailable until a recovery copy is downloaded.'}
          </p>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearingQueue}>Keep changes</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!recoveryReady || isClearingQueue}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmDiscard();
              }}
            >
              {isClearingQueue ? 'Discarding…' : 'Discard local changes'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
