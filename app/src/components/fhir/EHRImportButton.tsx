import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Loader2, Download } from 'lucide-react';
import { launchSMART } from '@/integrations/fhir';
import { useToast } from '@/hooks/use-toast';

interface EHRImportButtonProps {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
  showDialog?: boolean;
}

export function EHRImportButton({ 
  variant = 'outline', 
  size = 'default',
  className = '',
  showDialog = true
}: EHRImportButtonProps) {
  const [isLaunching, setIsLaunching] = useState(false);
  const [showDialogState, setShowDialogState] = useState(false);
  const { toast } = useToast();

  const handleLaunch = async () => {
    setIsLaunching(true);

    try {
      await launchSMART();
    } catch {
      console.error('SMART launch failed');
      setIsLaunching(false);
      toast({
        title: 'EHR connection failed',
        description: 'The secure EHR connection could not be started. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (!showDialog) {
    return (
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={handleLaunch}
        disabled={isLaunching}
      >
        {isLaunching ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <Download className="h-4 w-4 mr-2" />
            Import from EHR
          </>
        )}
      </Button>
    );
  }

  return (
    <Dialog open={showDialogState} onOpenChange={setShowDialogState}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <Download className="h-4 w-4 mr-2" />
          Import from EHR
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Patient from EHR</DialogTitle>
          <DialogDescription>
            Connect to your electronic health record system to import patient 
            demographics, medications, and allergies.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            This will redirect you to your EHR's login page. After authentication, 
            you'll be able to select a patient to import.
          </p>
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowDialogState(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleLaunch} disabled={isLaunching}>
              {isLaunching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                'Connect to EHR'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
