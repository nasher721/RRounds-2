import * as React from "react";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  X,
  Check,
  Bell,
  BellOff,
  ChevronDown,
  ChevronUp,
  Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { ClinicalAlert, AlertSeverity } from "@/types/clinicalAlerts";

interface CriticalValueAlertsProps {
  alerts: ClinicalAlert[];
  onAcknowledge: (alertId: string) => void;
  onDismiss: (alertId: string) => void;
  onNavigateToPatient?: (patientId: string) => void;
  className?: string;
}

const SEVERITY_CONFIG: Record<AlertSeverity, {
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  label: string;
}> = {
  critical: {
    icon: AlertTriangle,
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    label: "Critical",
  },
  warning: {
    icon: AlertCircle,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    label: "Warning",
  },
  info: {
    icon: Info,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    label: "Info",
  },
};

export function CriticalValueAlerts({
  alerts,
  onAcknowledge,
  onDismiss,
  onNavigateToPatient,
  className,
}: CriticalValueAlertsProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const [soundEnabled, setSoundEnabled] = React.useState(true);

  const unacknowledgedAlerts = alerts.filter(a => !a.acknowledged);
  const criticalCount = unacknowledgedAlerts.filter(a => a.severity === 'critical').length;
  const warningCount = unacknowledgedAlerts.filter(a => a.severity === 'warning').length;

  if (unacknowledgedAlerts.length === 0) {
    return null;
  }

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={setIsExpanded}
      className={cn("w-full", className)}
    >
      <Card className={cn(
        "border-2 transition-colors",
        criticalCount > 0 ? "border-red-300 bg-red-50/50" : "border-amber-300 bg-amber-50/50"
      )}>
        <CollapsibleTrigger asChild>
          <CardHeader className="py-3 px-4 cursor-pointer hover:bg-black/5 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-1.5 rounded-full animate-pulse",
                  criticalCount > 0 ? "bg-red-100" : "bg-amber-100"
                )}>
                  <Bell className={cn(
                    "h-4 w-4",
                    criticalCount > 0 ? "text-red-600" : "text-amber-600"
                  )} />
                </div>
                <CardTitle className="text-sm font-semibold">
                  Clinical Alerts
                </CardTitle>
                <div className="flex gap-1.5">
                  {criticalCount > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {criticalCount} Critical
                    </Badge>
                  )}
                  {warningCount > 0 && (
                    <Badge variant="outline" className="text-xs border-amber-300 text-amber-700">
                      {warningCount} Warning
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSoundEnabled(!soundEnabled);
                  }}
                >
                  {soundEnabled ? (
                    <Volume2 className="h-3.5 w-3.5" />
                  ) : (
                    <BellOff className="h-3.5 w-3.5" />
                  )}
                </Button>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-3 px-4">
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2">
                {unacknowledgedAlerts
                  .sort((a, b) => {
                    const severityOrder = { critical: 0, warning: 1, info: 2 };
                    return severityOrder[a.severity] - severityOrder[b.severity];
                  })
                  .map((alert) => (
                    <AlertItem
                      key={alert.id}
                      alert={alert}
                      onAcknowledge={() => onAcknowledge(alert.id)}
                      onDismiss={() => onDismiss(alert.id)}
                      onNavigate={() => onNavigateToPatient?.(alert.patientId)}
                    />
                  ))}
              </div>
            </ScrollArea>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

interface AlertItemProps {
  alert: ClinicalAlert;
  onAcknowledge: () => void;
  onDismiss: () => void;
  onNavigate?: () => void;
}

function AlertItem({ alert, onAcknowledge, onDismiss, onNavigate }: AlertItemProps) {
  const config = SEVERITY_CONFIG[alert.severity];
  const IconComponent = config.icon;

  return (
    <div
      className={cn(
        "p-3 rounded-lg border transition-all",
        config.bgColor,
        config.borderColor
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn("p-1 rounded", config.bgColor)}>
          <IconComponent className={cn("h-4 w-4", config.color)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onNavigate}
              className="font-medium text-sm hover:underline truncate"
            >
              {alert.patientName}
            </button>
            <Badge variant="outline" className="text-[10px]">
              {alert.category}
            </Badge>
          </div>

          <p className={cn("text-sm mt-0.5", config.color)}>
            {alert.message}
          </p>

          {alert.normalRange && (
            <p className="text-xs text-muted-foreground mt-1">
              Normal range: {alert.normalRange}
            </p>
          )}

          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">
              {new Date(alert.timestamp).toLocaleTimeString()}
            </span>

            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs"
                onClick={onAcknowledge}
              >
                <Check className="h-3 w-3 mr-1" />
                Acknowledge
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={onDismiss}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Floating alert badge for header/nav
interface AlertBadgeProps {
  alerts: ClinicalAlert[];
  onClick?: () => void;
}

export function AlertBadge({ alerts, onClick }: AlertBadgeProps) {
  const unacknowledged = alerts.filter(a => !a.acknowledged);
  const hasCritical = unacknowledged.some(a => a.severity === 'critical');

  if (unacknowledged.length === 0) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative p-2 rounded-full transition-colors",
        hasCritical
          ? "bg-red-100 hover:bg-red-200 animate-pulse"
          : "bg-amber-100 hover:bg-amber-200"
      )}
    >
      <Bell className={cn(
        "h-5 w-5",
        hasCritical ? "text-red-600" : "text-amber-600"
      )} />
      <span
        className={cn(
          "absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs font-bold rounded-full text-white",
          hasCritical ? "bg-red-600" : "bg-amber-600"
        )}
      >
        {unacknowledged.length}
      </span>
    </button>
  );
}

// Alert panel as a sheet/drawer
interface AlertPanelProps {
  alerts: ClinicalAlert[];
  onAcknowledge: (alertId: string) => void;
  onDismiss: (alertId: string) => void;
  onNavigateToPatient?: (patientId: string) => void;
  children?: React.ReactNode; // Trigger element
}

export function AlertPanel({
  alerts,
  onAcknowledge,
  onDismiss,
  onNavigateToPatient,
  children,
}: AlertPanelProps) {
  const unacknowledged = alerts.filter(a => !a.acknowledged);
  const acknowledged = alerts.filter(a => a.acknowledged);

  return (
    <Sheet>
      <SheetTrigger asChild>
        {children || <AlertBadge alerts={alerts} />}
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Clinical Alerts
            {unacknowledged.length > 0 && (
              <Badge variant="destructive">{unacknowledged.length}</Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {unacknowledged.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3">Active Alerts</h3>
              <div className="space-y-2">
                {unacknowledged.map((alert) => (
                  <AlertItem
                    key={alert.id}
                    alert={alert}
                    onAcknowledge={() => onAcknowledge(alert.id)}
                    onDismiss={() => onDismiss(alert.id)}
                    onNavigate={() => onNavigateToPatient?.(alert.patientId)}
                  />
                ))}
              </div>
            </div>
          )}

          {acknowledged.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
                Acknowledged ({acknowledged.length})
              </h3>
              <div className="space-y-2 opacity-60">
                {acknowledged.slice(0, 5).map((alert) => (
                  <div
                    key={alert.id}
                    className="p-2 rounded border bg-muted/30 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{alert.patientName}</span>
                      <span className="text-xs text-muted-foreground">
                        {alert.acknowledgedAt && new Date(alert.acknowledgedAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-xs mt-1">
                      {alert.message}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {alerts.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No clinical alerts</p>
              <p className="text-sm mt-1">All values are within normal limits</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default CriticalValueAlerts;
