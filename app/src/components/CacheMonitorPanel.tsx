import { useState, useEffect } from 'react';
import { Activity, Database, Trash2, RefreshCw, HardDrive, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useCacheMonitor } from '@/hooks/useCacheMonitor';
import { useCacheWarming } from '@/hooks/useCacheWarming';
import { toast } from 'sonner';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export function CacheMonitorPanel() {
  const { 
    metrics, 
    isLoading, 
    refreshMetrics, 
    clearAllCaches, 
    resetMetrics,
    getCacheSize 
  } = useCacheMonitor();
  
  const { isWarming, progress, warmCaches } = useCacheWarming();
  
  const [cacheSize, setCacheSize] = useState<{
    usage: number;
    quota: number;
    usagePercentage: number;
  } | null>(null);
  
  const isOnline = useOnlineStatus();
  
  // Load cache size
  useEffect(() => {
    getCacheSize().then(setCacheSize).catch(() => setCacheSize(null));
  }, [getCacheSize]);
  
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };
  
  const handleClearCache = async () => {
    await clearAllCaches();
    const newSize = await getCacheSize();
    setCacheSize(newSize);
    toast.success('All caches cleared');
  };
  
  const handleWarmCaches = async () => {
    const result = await warmCaches();
    if (!result) return;
    if (result.errors.length > 0) {
      toast.error(`${result.errors.length} cache source${result.errors.length === 1 ? '' : 's'} could not be loaded`);
      return;
    }
    toast.success('Caches warmed successfully');
  };
  
  const getHitRateColor = (rate: number): string => {
    if (rate >= 80) return 'text-green-500';
    if (rate >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };
  
  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5" />
            Cache Performance Monitor
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={isOnline ? "default" : "destructive"} className="gap-1">
              {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {isOnline ? 'Online' : 'Offline'}
            </Badge>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={refreshMetrics}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Combined Hit Rate */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall Cache Hit Rate</span>
            <span className={`font-mono font-bold ${getHitRateColor(metrics?.combined.overallHitRate || 0)}`}>
              {(metrics?.combined.overallHitRate || 0).toFixed(1)}%
            </span>
          </div>
          <Progress value={metrics?.combined.overallHitRate || 0} className="h-2" />
        </div>
        
        <Separator />
        
        {/* Query Cache Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Database className="h-3.5 w-3.5" />
              Query Cache
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Hits: </span>
                <span className="font-mono text-green-500">{metrics?.query.hits || 0}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Misses: </span>
                <span className="font-mono text-red-500">{metrics?.query.misses || 0}</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <HardDrive className="h-3.5 w-3.5" />
              Service Worker
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Hits: </span>
                <span className="font-mono text-green-500">{metrics?.serviceWorker?.cacheHits || 0}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Misses: </span>
                <span className="font-mono text-red-500">{metrics?.serviceWorker?.cacheMisses || 0}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Response Time */}
        {metrics?.query?.averageResponseTime != null && metrics.query.averageResponseTime > 0 && (
          <div className="text-sm">
            <span className="text-muted-foreground">Avg Response Time: </span>
            <span className="font-mono">
              {metrics.query.averageResponseTime.toFixed(2)}ms
            </span>
          </div>
        )}
        
        {/* Storage Usage */}
        {cacheSize && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Storage Used</span>
                <span className="font-mono">
                  {formatBytes(cacheSize.usage)} / {formatBytes(cacheSize.quota)}
                </span>
              </div>
              <Progress value={cacheSize.usagePercentage} className="h-2" />
            </div>
          </>
        )}
        
        {/* Cache Warming Progress */}
        {isWarming && progress && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Warming: {progress.current}</span>
                <span className="font-mono">
                  {progress.completed}/{progress.total}
                </span>
              </div>
              <Progress 
                value={(progress.completed / progress.total) * 100} 
                className="h-2" 
              />
            </div>
          </>
        )}
        
        <Separator />
        
        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleWarmCaches}
            disabled={isWarming}
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${isWarming ? 'animate-spin' : ''}`} />
            Warm Caches
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={resetMetrics}
          >
            <Activity className="h-4 w-4 mr-1.5" />
            Reset Metrics
          </Button>
          
          <Button 
            variant="destructive" 
            size="sm"
            onClick={handleClearCache}
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Clear All
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
