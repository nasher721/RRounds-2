import * as React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Legend,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Activity,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TooltipPayloadEntry {
  dataKey: string;
  value: number;
  color: string;
  payload: Record<string, unknown>;
}

interface TooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

export interface LabDataPoint {
  timestamp: string;
  value: number;
  labKey: string;
}

interface LabTrendData {
  labKey: string;
  labName: string;
  unit: string;
  dataPoints: LabDataPoint[];
  normalLow: number;
  normalHigh: number;
  color: string;
}

interface LabTrendingChartProps {
  labData: LabTrendData[];
  timeRange?: '24h' | '48h' | '7d' | '30d' | 'all';
  onTimeRangeChange?: (range: string) => void;
  className?: string;
}

const TIME_RANGES = [
  { value: '24h', label: '24 Hours' },
  { value: '48h', label: '48 Hours' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: 'all', label: 'All Time' },
];

export function LabTrendingChart({
  labData,
  timeRange = '48h',
  onTimeRangeChange,
  className,
}: LabTrendingChartProps) {
  const [selectedLabs, setSelectedLabs] = React.useState<string[]>(
    labData.slice(0, 3).map(l => l.labKey)
  );
  const [showNormalRange, setShowNormalRange] = React.useState(true);

  // Merge all data points into a single timeline
  const chartData = React.useMemo(() => {
    const timeMap = new Map<string, Record<string, number | string>>();

    labData.forEach(lab => {
      if (!selectedLabs.includes(lab.labKey)) return;

      lab.dataPoints.forEach(point => {
        const existing = timeMap.get(point.timestamp) || { timestamp: point.timestamp };
        existing[lab.labKey] = point.value;
        timeMap.set(point.timestamp, existing);
      });
    });

    return Array.from(timeMap.values()).sort(
      (a, b) => new Date(a.timestamp as string).getTime() - new Date(b.timestamp as string).getTime()
    );
  }, [labData, selectedLabs]);

  const toggleLab = (labKey: string) => {
    setSelectedLabs(prev =>
      prev.includes(labKey)
        ? prev.filter(k => k !== labKey)
        : [...prev, labKey]
    );
  };

  // Calculate trends for selected labs
  const getTrend = (lab: LabTrendData) => {
    const points = lab.dataPoints;
    if (points.length < 2) return null;

    const latest = points[points.length - 1].value;
    const previous = points[points.length - 2].value;
    const diff = latest - previous;
    const percentChange = ((diff / previous) * 100).toFixed(1);

    return {
      direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'stable',
      change: Math.abs(diff).toFixed(2),
      percentChange,
      latest,
    };
  };

  const formatXAxis = (timestamp: string) => {
    const date = new Date(timestamp);
    if (timeRange === '24h' || timeRange === '48h') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
    if (!active || !payload) return null;

    return (
      <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm">
        <p className="font-medium mb-2">
          {new Date(label as string).toLocaleString()}
        </p>
        {payload.map((entry) => {
          const lab = labData.find(l => l.labKey === entry.dataKey);
          return (
            <div
              key={entry.dataKey}
              className="flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span>{lab?.labName || entry.dataKey}</span>
              </div>
              <span className="font-mono">
                {entry.value} {lab?.unit}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Lab Trends
          </CardTitle>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Labs ({selectedLabs.length})
                  <ChevronDown className="h-4 w-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Select Labs</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {labData.map(lab => (
                  <DropdownMenuCheckboxItem
                    key={lab.labKey}
                    checked={selectedLabs.includes(lab.labKey)}
                    onCheckedChange={() => toggleLab(lab.labKey)}
                  >
                    <div
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: lab.color }}
                    />
                    {lab.labName}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Select value={timeRange} onValueChange={onTimeRangeChange}>
              <SelectTrigger className="w-[120px] h-8">
                <Calendar className="h-3.5 w-3.5 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_RANGES.map(range => (
                  <SelectItem key={range.value} value={range.value}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Trend indicators */}
        <div className="flex flex-wrap gap-2 mt-3">
          {labData
            .filter(lab => selectedLabs.includes(lab.labKey))
            .map(lab => {
              const trend = getTrend(lab);
              if (!trend) return null;

              const isAbnormal =
                trend.latest < lab.normalLow || trend.latest > lab.normalHigh;

              return (
                <Badge
                  key={lab.labKey}
                  variant={isAbnormal ? "destructive" : "secondary"}
                  className="gap-1.5"
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: lab.color }}
                  />
                  {lab.labName}: {trend.latest} {lab.unit}
                  {trend.direction === 'up' && (
                    <TrendingUp className="h-3 w-3" />
                  )}
                  {trend.direction === 'down' && (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {trend.direction === 'stable' && (
                    <Minus className="h-3 w-3" />
                  )}
                </Badge>
              );
            })}
        </div>
      </CardHeader>

      <CardContent>
        {chartData.length > 0 ? (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatXAxis}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={45}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  formatter={(value) => {
                    const lab = labData.find(l => l.labKey === value);
                    return lab?.labName || value;
                  }}
                />

                {/* Normal range reference areas */}
                {showNormalRange && selectedLabs.length === 1 && (
                  <>
                    {labData
                      .filter(lab => selectedLabs.includes(lab.labKey))
                      .map(lab => (
                        <ReferenceArea
                          key={`range-${lab.labKey}`}
                          y1={lab.normalLow}
                          y2={lab.normalHigh}
                          fill="#22c55e"
                          fillOpacity={0.1}
                        />
                      ))}
                  </>
                )}

                {/* Data lines */}
                {labData
                  .filter(lab => selectedLabs.includes(lab.labKey))
                  .map(lab => (
                    <Line
                      key={lab.labKey}
                      type="monotone"
                      dataKey={lab.labKey}
                      stroke={lab.color}
                      strokeWidth={2}
                      dot={{ fill: lab.color, strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, strokeWidth: 2 }}
                      connectNulls
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Activity className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No lab data available</p>
              <p className="text-sm mt-1">Select labs to view trends</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Mini sparkline version for inline display
interface LabSparklineProps {
  dataPoints: { timestamp: string; value: number }[];
  normalLow?: number;
  normalHigh?: number;
  color?: string;
  width?: number;
  height?: number;
}

export function LabSparkline({
  dataPoints,
  normalLow,
  normalHigh,
  color = '#3b82f6',
  width = 80,
  height = 24,
}: LabSparklineProps) {
  if (dataPoints.length < 2) {
    return <span className="text-muted-foreground text-xs">--</span>;
  }

  const values = dataPoints.map(p => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = dataPoints.map((point, i) => {
    const x = (i / (dataPoints.length - 1)) * width;
    const y = height - ((point.value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  const latest = values[values.length - 1];
  const isAbnormal = normalLow !== undefined && normalHigh !== undefined &&
    (latest < normalLow || latest > normalHigh);

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        fill="none"
        stroke={isAbnormal ? '#ef4444' : color}
        strokeWidth="1.5"
        points={points}
      />
      <circle
        cx={width}
        cy={height - ((latest - min) / range) * height}
        r="2"
        fill={isAbnormal ? '#ef4444' : color}
      />
    </svg>
  );
}

export default LabTrendingChart;
