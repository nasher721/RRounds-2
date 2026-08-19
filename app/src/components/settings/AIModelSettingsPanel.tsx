import { Building2, Server, ShieldCheck } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function AIModelSettingsPanel() {
  return (
    <Card className="border-0 bg-transparent shadow-none">
      <CardHeader className="px-0 pb-4">
        <CardTitle className="text-xl">Clinical AI</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Organization-managed processing for approved clinical workflows.
        </p>
      </CardHeader>

      <CardContent className="space-y-4 px-0">
        <Alert className="border-primary/20 bg-primary/5">
          <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
          <AlertTitle>Protected provider boundary</AlertTitle>
          <AlertDescription>
            Clinical requests are sent through the authenticated Rolling Rounds service. Provider keys are never entered or stored in this browser.
          </AlertDescription>
        </Alert>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
            <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
            <div>
              <h3 className="text-sm font-semibold">Managed by your organization</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Availability depends on the deployment operator&apos;s provider agreements, privacy review, and clinical policy.
              </p>
            </div>
          </div>

          <div className="flex gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
            <Server className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
            <div>
              <h3 className="text-sm font-semibold">Configured on the server</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Requests use the deployment&apos;s configured providers and automatically fail over during rate limits or outages. Identifiers are removed before anything leaves the service.
              </p>
            </div>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          AI output can be incomplete or incorrect. Review generated content before adding it to the clinical record or using it in care decisions.
        </p>
      </CardContent>
    </Card>
  );
}
