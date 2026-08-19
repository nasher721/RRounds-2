import * as React from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Activity,
  Users,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileCheck,
  Bell,
  Calendar,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  DashboardData,
  QualityMetric,
} from "@/types/analytics";
import { QUALITY_METRICS } from "@/types/analytics";

interface AnalyticsDashboardProps {
  data: DashboardData;
  onRefresh?: () => void;
  onDateRangeChange?: (range: string) => void;
  className?: string;
}

const COLORS = {
  primary: '#3b82f6',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#06b6d4',
  muted: '#94a3b8',
};

const ACUITY_COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  moderate: '#eab308',
  low: '#22c55e',
  stable: '#3b82f6',
};

export function AnalyticsDashboard({
  data,
  onRefresh,
  onDateRangeChange,
  className,
}: AnalyticsDashboardProps) {
  const [dateRange, setDateRange] = React.useState('7d');

  const handleDateRangeChange = (value: string) => {
    setDateRange(value);
    onDateRangeChange?.(value);
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Unit Analytics</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Last updated: {new Date(data.lastUpdated).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={handleDateRangeChange}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Total Patients"
          value={data.unitMetrics.totalPatients}
          icon={Users}
          trend={data.unitMetrics.admissions24h > data.unitMetrics.discharges24h ? 'up' : 'down'}
          trendValue={`${data.unitMetrics.admissions24h - data.unitMetrics.discharges24h} net`}
        />
        <MetricCard
          title="Admissions (24h)"
          value={data.unitMetrics.admissions24h}
          icon={TrendingUp}
          color="success"
        />
        <MetricCard
          title="Discharges (24h)"
          value={data.unitMetrics.discharges24h}
          icon={TrendingDown}
          color="info"
        />
        <MetricCard
          title="Ventilated"
          value={data.unitMetrics.ventilatedPatients}
          icon={Activity}
          subtitle={`${Math.round((data.unitMetrics.ventilatedPatients / data.unitMetrics.totalPatients) * 100)}% of census`}
          color="warning"
        />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="protocols">Protocols</TabsTrigger>
          <TabsTrigger value="quality">Quality</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Acuity Distribution */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Acuity Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={Object.entries(data.acuityDistribution).map(([name, value]) => ({
                          name: name.charAt(0).toUpperCase() + name.slice(1),
                          value,
                        }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {Object.keys(data.acuityDistribution).map((key) => (
                          <Cell
                            key={key}
                            fill={ACUITY_COLORS[key as keyof typeof ACUITY_COLORS]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Patient Flow */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Patient Flow</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.patientFlow}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" fontSize={11} tickLine={false} />
                      <YAxis fontSize={11} tickLine={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="admissions" fill={COLORS.success} name="Admissions" />
                      <Bar dataKey="discharges" fill={COLORS.info} name="Discharges" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Census Trend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Census Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.patientFlow}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" fontSize={11} tickLine={false} />
                    <YAxis fontSize={11} tickLine={false} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="census"
                      stroke={COLORS.primary}
                      strokeWidth={2}
                      dot={{ fill: COLORS.primary }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              title="Total Tasks"
              value={data.taskMetrics.totalTasks}
              icon={FileCheck}
            />
            <MetricCard
              title="Completed"
              value={data.taskMetrics.completedTasks}
              icon={CheckCircle}
              color="success"
            />
            <MetricCard
              title="Pending"
              value={data.taskMetrics.pendingTasks}
              icon={Clock}
              color="warning"
            />
            <MetricCard
              title="Overdue"
              value={data.taskMetrics.overdueTasks}
              icon={AlertTriangle}
              color="danger"
            />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Task Completion Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">
                    {data.taskMetrics.completionRate.toFixed(1)}%
                  </span>
                  <Badge
                    variant={data.taskMetrics.completionRate >= 80 ? "default" : "destructive"}
                  >
                    {data.taskMetrics.completionRate >= 80 ? "On Track" : "Needs Attention"}
                  </Badge>
                </div>
                <Progress value={data.taskMetrics.completionRate} className="h-3" />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{data.taskMetrics.completedTasks} completed</span>
                  <span>{data.taskMetrics.pendingTasks} remaining</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="protocols" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              title="Active Protocols"
              value={data.protocolMetrics.activeProtocols}
              icon={FileCheck}
            />
            <MetricCard
              title="Completed"
              value={data.protocolMetrics.completedProtocols}
              icon={CheckCircle}
              color="success"
            />
            <MetricCard
              title="Compliance Rate"
              value={`${data.protocolMetrics.complianceRate.toFixed(0)}%`}
              icon={Activity}
              color={data.protocolMetrics.complianceRate >= 90 ? "success" : "warning"}
            />
            <MetricCard
              title="Alerts"
              value={data.alertMetrics.criticalAlerts}
              icon={Bell}
              color="danger"
            />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Protocol Compliance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(data.protocolMetrics.protocolsByType).map(([type, count]) => (
                  <div key={type} className="flex items-center gap-4">
                    <span className="w-24 text-sm font-medium capitalize">{type}</span>
                    <Progress
                      value={Math.min(100, count * 10)}
                      className="flex-1 h-2"
                    />
                    <span className="w-8 text-sm text-right">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quality" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {QUALITY_METRICS.slice(0, 4).map(metric => (
              <QualityMetricCard key={metric.id} metric={metric} />
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Quality Indicators</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {QUALITY_METRICS.map(metric => (
                  <div key={metric.id} className="flex items-center gap-4">
                    <div className="w-32">
                      <span className="text-sm font-medium">{metric.shortName}</span>
                      <p className="text-xs text-muted-foreground">{metric.category}</p>
                    </div>
                    <Progress value={75} className="flex-1 h-2" />
                    <div className="w-20 text-right">
                      <span className="text-sm font-medium">0.0</span>
                      <span className="text-xs text-muted-foreground ml-1">{metric.unit}</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        "bg-green-50 text-green-700 border-green-200"
                      )}
                    >
                      Target: {metric.target}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  trend?: 'up' | 'down';
  trendValue?: string;
  subtitle?: string;
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
}

function MetricCard({
  title,
  value,
  icon: Icon,
  trend,
  trendValue,
  subtitle,
  color = 'primary',
}: MetricCardProps) {
  const colorMap = {
    primary: 'text-blue-600 bg-blue-50',
    success: 'text-green-600 bg-green-50',
    warning: 'text-amber-600 bg-amber-50',
    danger: 'text-red-600 bg-red-50',
    info: 'text-cyan-600 bg-cyan-50',
  };

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold">{value}</span>
              {trend && (
                <span className={cn(
                  "text-xs flex items-center",
                  trend === 'up' ? "text-green-600" : "text-red-600"
                )}>
                  {trend === 'up' ? (
                    <TrendingUp className="h-3 w-3 mr-0.5" />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-0.5" />
                  )}
                  {trendValue}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          <div className={cn("p-2 rounded-lg", colorMap[color])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface QualityMetricCardProps {
  metric: QualityMetric;
  value?: number;
}

function QualityMetricCard({ metric, value = 0 }: QualityMetricCardProps) {
  const isAtTarget = value <= metric.target;

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-sm font-medium">{metric.shortName}</p>
            <p className="text-xs text-muted-foreground capitalize">{metric.category}</p>
          </div>
          <Badge
            variant={isAtTarget ? "default" : "destructive"}
            className="text-xs"
          >
            {isAtTarget ? "At Target" : "Above Target"}
          </Badge>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold">{value}</span>
          <span className="text-sm text-muted-foreground">{metric.unit}</span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span>Target: {metric.target}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default AnalyticsDashboard;
