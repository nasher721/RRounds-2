import * as React from "react"
import { Activity, ClipboardCopy, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  exportDiagnosticsReport,
  clearTelemetry,
  getErrorFrequencies,
} from "@/lib/observability/telemetry"
import { clearBreadcrumbs } from "@/lib/observability/breadcrumbs"
import { useToast } from "@/hooks/use-toast"

type ObservabilitySupportCardProps = {
  variant?: "desktop" | "mobile"
}

export function ObservabilitySupportCard({ variant = "desktop" }: ObservabilitySupportCardProps) {
  const { toast } = useToast()
  const [busy, setBusy] = React.useState(false)
  const isMobile = variant === "mobile"

  const handleCopy = async () => {
    setBusy(true)
    try {
      const text = await exportDiagnosticsReport()
      await navigator.clipboard.writeText(text)
      toast({
        title: "Diagnostics copied",
        description: "Paste into an issue or engineering channel. No patient content is included.",
      })
    } catch {
      toast({
        variant: "destructive",
        title: "Copy failed",
        description: "Try again or use the browser console: __RR_OBSERVABILITY__.exportReport()",
      })
    } finally {
      setBusy(false)
    }
  }

  const handleClear = async () => {
    setBusy(true)
    try {
      await clearTelemetry()
      clearBreadcrumbs()
      toast({
        title: "Local diagnostics cleared",
        description: "Telemetry cache and breadcrumbs were reset on this device.",
      })
    } finally {
      setBusy(false)
    }
  }

  const freq = getErrorFrequencies()
  const sessionIssues = freq.filter((f) => f.count > 0).length

  return (
    <div
      className={
        isMobile
          ? "rounded-lg border border-border/40 bg-card/50 p-4 space-y-3"
          : "rounded-md border border-border/40 p-3 space-y-2"
      }
    >
      <div className="flex items-center gap-2">
        <Activity className={`${isMobile ? "h-4 w-4" : "h-3.5 w-3.5"} text-muted-foreground`} />
        <p className={`${isMobile ? "text-sm" : "text-xs"} font-medium text-muted-foreground`}>
          Diagnostics &amp; errors
        </p>
      </div>
      <p className={`${isMobile ? "text-xs" : "text-[11px]"} text-muted-foreground leading-relaxed`}>
        Errors are stored locally with fingerprints and navigation history to help reproduce issues. Copy a bundle for
        support, or clear data on this device.
      </p>
      {sessionIssues > 0 && (
        <p className={`${isMobile ? "text-xs" : "text-[11px]"} text-amber-600 dark:text-amber-500`}>
          {sessionIssues} recurring pattern{sessionIssues === 1 ? "" : "s"} detected this session.
        </p>
      )}
      <div className={`flex flex-wrap gap-2 ${isMobile ? "pt-1" : ""}`}>
        <Button
          type="button"
          variant="outline"
          size={isMobile ? "default" : "sm"}
          className="gap-1.5"
          disabled={busy}
          onClick={handleCopy}
        >
          <ClipboardCopy className="h-3.5 w-3.5" />
          Copy diagnostics
        </Button>
        <Button
          type="button"
          variant="ghost"
          size={isMobile ? "default" : "sm"}
          className="gap-1.5 text-muted-foreground"
          disabled={busy}
          onClick={handleClear}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear local data
        </Button>
      </div>
    </div>
  )
}
