import * as React from "react";
import {
  Bell,
  Activity,
  ArrowRightLeft,
  FileCheck,
  Clock,
  BarChart3,
  ChevronRight,
  AlertTriangle,
  Users,
  Mic,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ClinicalAlert } from "@/types/clinicalAlerts";
import type { Patient } from "@/types/patient";
import type { PatientProtocol } from "@/types/protocols";

interface MobileClinicalToolsProps {
  patients: Patient[];
  alerts: ClinicalAlert[];
  activeProtocols: PatientProtocol[];
  onOpenAlerts: () => void;
  onOpenLabTrends: () => void;
  onOpenHandoff: () => void;
  onOpenProtocols: () => void;
  onOpenTimeline: () => void;
  onOpenAnalytics: () => void;
  onOpenVoice: () => void;
  onOpenBatchCourse: () => void;
  className?: string;
}

interface ToolCardProps {
  icon: React.ElementType;
  label: string;
  description: string;
  badge?: string | number;
  badgeVariant?: "default" | "destructive" | "warning";
  onClick: () => void;
  iconClassName: string;
}

function ToolCard({
  icon: Icon,
  label,
  description,
  badge,
  badgeVariant = "default",
  onClick,
  iconClassName,
}: ToolCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left"
    >
      <Card className="transition-colors hover:bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-muted p-2.5">
              <Icon className={cn("h-5 w-5", iconClassName)} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{label}</h3>
                {badge !== undefined && (
                  <Badge
                    variant={badgeVariant === "warning" ? "outline" : badgeVariant}
                    className={cn(
                      "text-xs",
                      badgeVariant === "warning" && "border-amber-300 text-amber-700 bg-amber-50"
                    )}
                  >
                    {badge}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

export function MobileClinicalTools({
  patients,
  alerts,
  activeProtocols,
  onOpenAlerts,
  onOpenLabTrends,
  onOpenHandoff,
  onOpenProtocols,
  onOpenTimeline,
  onOpenAnalytics,
  onOpenVoice,
  onOpenBatchCourse,
  className,
}: MobileClinicalToolsProps) {
  const unacknowledgedAlerts = alerts.filter(a => !a.acknowledged);
  const criticalAlerts = unacknowledgedAlerts.filter(a => a.severity === 'critical');
  const pendingProtocols = activeProtocols.filter(p => p.status === 'active');

  return (
    <div className={cn("px-4 py-4 space-y-6", className)}>
      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <QuickStat
          label="Patients"
          value={patients.length}
          icon={Users}
          iconClassName="text-primary"
        />
        <QuickStat
          label="Alerts"
          value={unacknowledgedAlerts.length}
          icon={Bell}
          iconClassName={criticalAlerts.length > 0 ? "text-destructive" : "text-amber-600"}
          highlight={criticalAlerts.length > 0}
        />
        <QuickStat
          label="Protocols"
          value={pendingProtocols.length}
          icon={FileCheck}
          iconClassName="text-emerald-600"
        />
      </div>

      {/* Critical Alerts Banner */}
      {criticalAlerts.length > 0 && (
        <button
          type="button"
          onClick={onOpenAlerts}
          className="w-full p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 active:bg-red-100 transition-colors"
        >
          <div className="p-2 bg-red-100 rounded-full animate-pulse">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div className="flex-1 text-left">
            <p className="font-semibold text-red-900">
              {criticalAlerts.length} Critical Alert{criticalAlerts.length > 1 ? 's' : ''}
            </p>
            <p className="text-sm text-red-700">
              {criticalAlerts[0]?.patientName}: {criticalAlerts[0]?.title}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-red-400" />
        </button>
      )}

      {/* Tool Cards */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
          Clinical Tools
        </h2>

        <ToolCard
          icon={Bell}
          label="Alerts"
          description="Critical values and notifications"
          badge={unacknowledgedAlerts.length > 0 ? unacknowledgedAlerts.length : undefined}
          badgeVariant={criticalAlerts.length > 0 ? "destructive" : "warning"}
          onClick={onOpenAlerts}
          iconClassName="text-destructive"
        />

        <ToolCard
          icon={Activity}
          label="Lab Trends"
          description="View lab value trends over time"
          onClick={onOpenLabTrends}
          iconClassName="text-cyan-600"
        />

        <ToolCard
          icon={ArrowRightLeft}
          label="Shift Handoff"
          description="SBAR documentation for handoffs"
          onClick={onOpenHandoff}
          iconClassName="text-violet-600"
        />

        <ToolCard
          icon={FileCheck}
          label="Protocols"
          description="Evidence-based clinical checklists"
          badge={pendingProtocols.length > 0 ? pendingProtocols.length : undefined}
          onClick={onOpenProtocols}
          iconClassName="text-emerald-600"
        />

        <ToolCard
          icon={Clock}
          label="Timeline"
          description="Patient event history"
          onClick={onOpenTimeline}
          iconClassName="text-amber-600"
        />

        <ToolCard
          icon={BarChart3}
          label="Analytics"
          description="Unit metrics and quality data"
          onClick={onOpenAnalytics}
          iconClassName="text-primary"
        />
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
          AI tools
        </h2>

        <ToolCard
          icon={Sparkles}
          label="Batch course generator"
          description="Draft patient-course summaries in batches"
          badge="AI"
          onClick={onOpenBatchCourse}
          iconClassName="text-violet-600"
        />
      </div>

      {/* Voice Commands */}
      <div className="pt-4 border-t">
        <button
          type="button"
          onClick={onOpenVoice}
          className="w-full p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-center gap-3 active:bg-primary/10 transition-colors"
        >
          <div className="p-2 bg-primary/20 rounded-full">
            <Mic className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 text-left">
            <p className="font-semibold">Voice Commands</p>
            <p className="text-sm text-muted-foreground">Hands-free navigation</p>
          </div>
          <Badge variant="outline" className="text-xs">Beta</Badge>
        </button>
      </div>
    </div>
  );
}

interface QuickStatProps {
  label: string;
  value: number;
  icon: React.ElementType;
  iconClassName: string;
  highlight?: boolean;
}

function QuickStat({ label, value, icon: Icon, iconClassName, highlight }: QuickStatProps) {
  return (
    <div
      className={cn(
        "p-3 rounded-xl border text-center transition-colors",
        highlight ? "bg-red-50 border-red-200" : "bg-muted/30 border-border"
      )}
    >
      <Icon
        className={cn("h-5 w-5 mx-auto mb-1", highlight ? "text-destructive" : iconClassName)}
      />
      <div className={cn(
        "text-2xl font-bold",
        highlight && "text-red-600"
      )}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

// Mobile Alert Panel
interface MobileAlertPanelProps {
  alerts: ClinicalAlert[];
  onAcknowledge: (id: string) => void;
  onDismiss: (id: string) => void;
  onNavigateToPatient: (patientId: string) => void;
}

export function MobileAlertPanel({
  alerts,
  onAcknowledge,
  onDismiss,
  onNavigateToPatient,
}: MobileAlertPanelProps) {
  const unacknowledged = alerts.filter(a => !a.acknowledged);

  return (
    <div className="space-y-3 p-4">
      {unacknowledged.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Bell className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p className="font-medium">No active alerts</p>
          <p className="text-sm mt-1">All values are within normal limits</p>
        </div>
      ) : (
        unacknowledged.map(alert => (
          <MobileAlertCard
            key={alert.id}
            alert={alert}
            onAcknowledge={() => onAcknowledge(alert.id)}
            onDismiss={() => onDismiss(alert.id)}
            onNavigate={() => onNavigateToPatient(alert.patientId)}
          />
        ))
      )}
    </div>
  );
}

interface MobileAlertCardProps {
  alert: ClinicalAlert;
  onAcknowledge: () => void;
  onDismiss: () => void;
  onNavigate: () => void;
}

function MobileAlertCard({ alert, onAcknowledge, onDismiss, onNavigate }: MobileAlertCardProps) {
  const isCritical = alert.severity === 'critical';

  return (
    <Card className={cn(
      "border-l-4",
      isCritical ? "border-l-red-500 bg-red-50/50" : "border-l-amber-500 bg-amber-50/50"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn(
            "p-2 rounded-full",
            isCritical ? "bg-red-100" : "bg-amber-100"
          )}>
            <AlertTriangle className={cn(
              "h-5 w-5",
              isCritical ? "text-red-600" : "text-amber-600"
            )} />
          </div>
          <div className="flex-1 min-w-0">
            <button
              type="button"
              onClick={onNavigate}
              className="font-semibold hover:underline text-left"
            >
              {alert.patientName}
            </button>
            <p className={cn(
              "text-sm mt-0.5",
              isCritical ? "text-red-700" : "text-amber-700"
            )}>
              {alert.message}
            </p>
            {alert.normalRange && (
              <p className="text-xs text-muted-foreground mt-1">
                Normal: {alert.normalRange}
              </p>
            )}
            <div className="flex items-center gap-2 mt-3">
              <Button
                size="sm"
                variant={isCritical ? "destructive" : "default"}
                onClick={onAcknowledge}
                className="h-8"
              >
                Acknowledge
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onDismiss}
                className="h-8"
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default MobileClinicalTools;
