import * as React from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
} from "recharts";
import {
  Users,
  TrendingUp,
  TrendingDown,
  Activity,
  CheckCircle,
  Clock,
  AlertTriangle,
  BarChart3,
  RefreshCw,
  ShieldCheck,
  BellRing,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { DashboardData } from "@/types/analytics";

interface MobileAnalyticsProps {
  data?: DashboardData;
  onRefresh?: () => void;
  className?: string;
}

const ACUITY_COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  moderate: '#eab308',
  low: '#22c55e',
  stable: '#3b82f6',
};

export function MobileAnalytics({
  data,
  onRefresh,
  className,
}: MobileAnalyticsProps) {
  if (!data) {
    return (
      <ScrollArea className={cn("h-full", className)}>
        <div className="p-4 pb-24 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Unit Analytics</h2>
            {onRefresh && (
              <Button variant="outline" size="icon" onClick={onRefresh} aria-label="Refresh analytics" className="h-10 w-10 rounded-xl">
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Card className="rounded-2xl border-border/50">
            <CardContent className="flex flex-col items-center justify-center p-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                <BarChart3 className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <p className="font-semibold text-sm">No analytics data available</p>
              <p className="mt-1.5 text-xs text-muted-foreground max-w-[240px] leading-relaxed">
                Connect or refresh unit metrics to populate this dashboard.
              </p>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    );
  }

  const updatedTime = new Date(data.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <ScrollArea className={cn("h-full", className)}>
      <div className="p-4 space-y-4 pb-24">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight">Unit Analytics</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Updated {updatedTime}
            </p>
          </div>
          {onRefresh && (
            <Button variant="outline" size="icon" onClick={onRefresh} className="h-10 w-10 rounded-xl shrink-0" aria-label="Refresh analytics">
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          <MetricCard
            icon={Users}
            label="Census"
            value={data.unitMetrics.totalPatients}
            sublabel={`${data.unitMetrics.occupancyRate}% occupancy`}
            color="#3b82f6"
          />
          <MetricCard
            icon={TrendingUp}
            label="Admits"
            value={data.unitMetrics.admissions24h}
            color="#22c55e"
          />
          <MetricCard
            icon={TrendingDown}
            label="Discharges"
            value={data.unitMetrics.discharges24h}
            color="#06b6d4"
          />
          <MetricCard
            icon={Activity}
            label="Ventilated"
            value={data.unitMetrics.ventilatedPatients}
            sublabel={`${data.unitMetrics.totalPatients > 0
              ? Math.round((data.unitMetrics.ventilatedPatients / data.unitMetrics.totalPatients) * 100)
              : 0}%`}
            color="#f59e0b"
          />
        </div>

        {/* Acuity Distribution */}
        <Card className="rounded-2xl border-border/50">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              </div>
              Acuity Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={Object.entries(data.acuityDistribution).map(([name, value]) => ({
                        name,
                        value,
                      }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={25}
                      outerRadius={40}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {Object.keys(data.acuityDistribution).map((key) => (
                        <Cell
                          key={key}
                          fill={ACUITY_COLORS[key as keyof typeof ACUITY_COLORS]}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-1.5 min-w-0">
                {Object.entries(data.acuityDistribution).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: ACUITY_COLORS[key as keyof typeof ACUITY_COLORS] }}
                    />
                    <span className="text-xs capitalize flex-1 text-muted-foreground truncate">{key}</span>
                    <span className="text-xs font-semibold tabular-nums">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Task Completion */}
        <Card className="rounded-2xl border-border/50">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm font-semibold tracking-tight flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CheckCircle className="h-3.5 w-3.5 text-primary" />
                </div>
                Task Completion
              </div>
              <Badge variant="secondary" className="text-xs font-bold rounded-lg px-2.5 py-0.5">
                {data.taskMetrics.completionRate.toFixed(0)}%
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <Progress value={data.taskMetrics.completionRate} className="h-2 rounded-full mb-4" />
            <div className="grid grid-cols-3 gap-2.5">
              <div className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-center">
                <CheckCircle className="h-4 w-4 text-emerald-600 mx-auto mb-1" />
                <div className="text-sm font-bold text-emerald-700 tabular-nums">
                  {data.taskMetrics.completedTasks}
                </div>
                <div className="text-[10px] font-medium text-emerald-600">Completed</div>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/10 text-center">
                <Clock className="h-4 w-4 text-amber-600 mx-auto mb-1" />
                <div className="text-sm font-bold text-amber-700 tabular-nums">
                  {data.taskMetrics.pendingTasks}
                </div>
                <div className="text-[10px] font-medium text-amber-600">Pending</div>
              </div>
              <div className="p-2.5 rounded-xl bg-red-500/5 border border-red-500/10 text-center">
                <AlertTriangle className="h-4 w-4 text-red-600 mx-auto mb-1" />
                <div className="text-sm font-bold text-red-700 tabular-nums">
                  {data.taskMetrics.overdueTasks}
                </div>
                <div className="text-[10px] font-medium text-red-600">Overdue</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Patient Flow Chart */}
        <Card className="rounded-2xl border-border/50">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                <BarChart3 className="h-3.5 w-3.5 text-primary" />
              </div>
              Patient Flow
              <span className="text-[10px] font-normal text-muted-foreground ml-1">7 days</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.patientFlow} barGap={4}>
                  <XAxis
                    dataKey="date"
                    fontSize={9}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Bar dataKey="admissions" fill="#22c55e" radius={[3, 3, 0, 0]} name="Admissions" />
                  <Bar dataKey="discharges" fill="#06b6d4" radius={[3, 3, 0, 0]} name="Discharges" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                <span className="text-[10px] font-medium text-muted-foreground">Admissions</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 bg-cyan-500 rounded-full" />
                <span className="text-[10px] font-medium text-muted-foreground">Discharges</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Protocol Compliance */}
        <Card className="rounded-2xl border-border/50">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm font-semibold tracking-tight flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                </div>
                Protocol Compliance
              </div>
              <Badge
                variant={data.protocolMetrics.complianceRate >= 90 ? "default" : "destructive"}
                className="text-xs font-bold rounded-lg px-2.5 py-0.5"
              >
                {data.protocolMetrics.complianceRate.toFixed(0)}%
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2.5">
              {Object.entries(data.protocolMetrics.protocolsByType).slice(0, 4).map(([type, count]) => (
                <div key={type} className="flex items-center gap-2.5">
                  <span className="text-xs capitalize flex-1 text-muted-foreground truncate">{type}</span>
                  <div className="w-24 shrink-0">
                    <Progress value={Math.min(100, count * 15)} className="h-1.5 rounded-full" />
                  </div>
                  <span className="text-xs font-semibold w-7 text-right tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Alert Summary */}
        <Card className="rounded-2xl border-border/50">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                <BellRing className="h-3.5 w-3.5 text-primary" />
              </div>
              Alert Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3.5 rounded-xl bg-red-500/5 border border-red-500/10 text-center">
                <div className="text-2xl font-bold text-red-600 tabular-nums">
                  {data.alertMetrics.criticalAlerts}
                </div>
                <div className="text-[10px] font-semibold text-red-600 mt-0.5">Critical</div>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-center">
                <div className="text-2xl font-bold text-emerald-600 tabular-nums">
                  {data.alertMetrics.acknowledgedAlerts}
                </div>
                <div className="text-[10px] font-semibold text-emerald-600 mt-0.5">Acknowledged</div>
              </div>
            </div>
            <div className="mt-3 text-center text-[10px] font-medium text-muted-foreground">
              Avg response time: {data.alertMetrics.avgResponseTime} min
            </div>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}

interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sublabel?: string;
  color: string;
}

function MetricCard({ icon: Icon, label, value, sublabel, color }: MetricCardProps) {
  return (
    <Card className="rounded-2xl border-border/50">
      <CardContent className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-xl font-bold mt-0.5 tabular-nums">{value}</p>
            {sublabel && (
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{sublabel}</p>
            )}
          </div>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${color}12` }}
          >
            <Icon className="h-4.5 w-4.5" style={{ color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default MobileAnalytics;
