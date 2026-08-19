import * as React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  Legend,
  ReferenceLine,
  Dot,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Activity,
  ChevronDown,
  Sparkles,
  BrainCircuit,
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
import { LAB_NORMAL_RANGES } from "@/types/labs";
import { useLabPrediction } from "@/hooks/useLabPrediction";

interface TooltipPayloadEntry {
  dataKey: string;
  value: number;
  color: string;
  [key: string]: unknown;
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
  predicted?: boolean;
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

interface EnhancedLabTrendingChartProps {
  labData: LabTrendData[];
  timeRange?: '24h' | '48h' | '7d' | '30d' | 'all';
  onTimeRangeChange?: (range: string) => void;
  onLabToggle?: (labKey: string) => void;
  patientContext?: string;
  enablePredictions?: boolean;
  className?: string;
}

const LAB_COLORS: Record<string, string> = {
  na: '#3b82f6',
  k: '#ef4444',
  cr: '#8b5cf6',
  bun: '#06b6d4',
  glu: '#f59e0b',
  hgb: '#ec4899',
  wbc: '#22c55e',
  plt: '#f97316',
  lactate: '#dc2626',
  ph: '#6366f1',
  pao2: '#14b8a6',
  fio2: '#a855f7',
  troponin: '#e91e63',
  bnp: '#64748b',
};

const TIME_RANGES = [
  { value: '24h', label: '24 Hours' },
  { value: '48h', label: '48 Hours' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: 'all', label: 'All Time' },
];

const CONFIDENCE_COLORS = {
  high: '#10b981',
  medium: '#f59e0b',
  low: '#6b7280',
};

export function EnhancedLabTrendingChart({
  labData,
  timeRange = '48h',
  onTimeRangeChange,
  onLabToggle,
  patientContext = '',
  enablePredictions = false,
  className,
}: EnhancedLabTrendingChartProps) {
  const [selectedLabs, setSelectedLabs] = React.useState<string[]>(
    labData.slice(0, 2).map(l => l.labKey)
  );
  const [showNormalRange, setShowNormalRange] = React.useState(true);
  const [showPredictions, setShowPredictions] = React.useState(false);
  const [labBeingPredicted, setLabBeingPredicted] = React.useState<string | null>(null);

  const { predictions, isGenerating, predictLabValue, getPrediction, clearPredictions } = useLabPrediction();

  // Merge all data points into a single timeline
  const chartData = React.useMemo(() => {
    const timeMap = new Map<string, Record<string, number | string | boolean>>();

    labData.forEach(lab => {
      if (!selectedLabs.includes(lab.labKey)) return;

      lab.dataPoints.forEach(point => {
        const existing = timeMap.get(point.timestamp) || { timestamp: point.timestamp };
        existing[lab.labKey] = point.value;
        existing[`${lab.labKey}_predicted`] = !!point.predicted;
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

  const handlePredict = async (labKey: string) => {
    const lab = labData.find(l => l.labKey === labKey);
    if (!lab) return;

    const history = lab.dataPoints.map(p => ({
      timestamp: p.timestamp,
      value: p.value,
    }));

    setLabBeingPredicted(labKey);
    await predictLabValue(lab.labName, history, patientContext);
    setLabBeingPredicted(null);
  };

  const getTrend = (lab: LabTrendData) => {
    const points = lab.dataPoints.filter(p => !p.predicted);
    if (points.length < 2) return null;

    const latestPoint = points.at(-1);
    const previousPoint = points.at(-2);
    if (!latestPoint || !previousPoint) return null;

    const latest = latestPoint.value;
    const previous = previousPoint.value;
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
          if (!lab) return null;

          const isPredicted = entry[`${lab.labKey}_predicted`] === true;

          return (
            <div key={entry.dataKey} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="font-medium">{lab.labName}</span>
                {isPredicted && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    <BrainCircuit className="h-3 w-3" />
                    Predicted
                  </Badge>
                )}
              </div>
              <span className="font-mono">
                {entry.value} {lab.unit}
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
            Enhanced Lab Trends
          </CardTitle>

          <div className="flex items-center gap-2">
            {enablePredictions && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPredictions(!showPredictions)}
                className="gap-1"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Predictions
                {showPredictions && (
                  <Badge variant="secondary">On</Badge>
                )}
              </Button>
            )}

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

        {/* Lab selection */}
        <div className="flex flex-wrap gap-2 mt-2">
          {labData.map(lab => {
            const trend = getTrend(lab);
            const isAbnormal = trend !== null &&
              (trend.latest < lab.normalLow || trend.latest > lab.normalHigh);

            return (
              <Badge
                key={lab.labKey}
                variant={selectedLabs.includes(lab.labKey) ? "default" : "outline"}
                className={`gap-1.5 cursor-pointer ${
                  selectedLabs.includes(lab.labKey)
                    ? "hover:opacity-80"
                    : "hover:bg-muted"
                }`}
                onClick={() => onLabToggle?.(lab.labKey)}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: lab.color }}
                />
                {lab.labName}
                {selectedLabs.includes(lab.labKey) && trend && (
                  <>
                    {trend.direction === 'up' && (
                      <TrendingUp className="h-3 w-3 text-green-600" />
                    )}
                    {trend.direction === 'down' && (
                      <TrendingDown className="h-3 w-3 text-red-600" />
                    )}
                    {trend.direction === 'stable' && (
                      <Minus className="h-3 w-3 text-yellow-600" />
                    )}
                  </>
                )}
              </Badge>
            );
          })}
        </div>
      </CardHeader>

      <CardContent>
        {chartData.length > 0 ? (
          <div className="h-[350px] w-full">
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
                  width={50}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  formatter={(value) => {
                    const lab = labData.find(l => l.labKey === value);
                    return lab?.labName || value;
                  }}
                />

                {/* Normal range reference areas */}
                {showNormalRange &&
                  selectedLabs.length === 1 &&
                  selectedLabs.map(labKey => {
                    const lab = labData.find(l => l.labKey === labKey);
                    if (!lab) return null;

                    return (
                      <ReferenceArea
                        key={`range-${labKey}`}
                        y1={lab.normalLow}
                        y2={lab.normalHigh}
                        fill={lab.color}
                        fillOpacity={0.1}
                        stroke={lab.color}
                        strokeWidth={0}
                      />
                    );
                  })}

                {/* Prediction markers */}
                {showPredictions &&
                  selectedLabs.map(labKey => {
                    const lab = labData.find(l => l.labKey === labKey);
                    if (!lab) return null;

                    const prediction = getPrediction(lab.labName);

                    if (!prediction) return null;

                    const predictedTime = new Date(prediction.predictedTime).getTime();
                    const hasDataPoint = chartData.some(
                      point => new Date(point.timestamp as string).getTime() >= predictedTime
                    );

                    return (
                      <React.Fragment key={`pred-${labKey}`}>
                        <Line
                          dataKey={`${labKey}_predicted`}
                          type="monotone"
                          data={[{
                            timestamp: prediction.predictedTime,
                            value: prediction.predictedValue,
                            predicted: true,
                          }]}
                          stroke={lab.color}
                          strokeDasharray="5 5"
                          strokeWidth={2}
                          dot={{ r: 6 }}
                          connectNulls
                          activeDot={{ r: 8 }}
                        />

                        {/* Prediction dot */}
                        <Line
                          dataKey={`${labKey}_dot`}
                          type="monotone"
                          data={[{
                            timestamp: prediction.predictedTime,
                            value: prediction.predictedValue,
                          }]}
                          stroke={lab.color}
                          strokeWidth={0}
                          dot={{
                            r: 8,
                            fill: lab.color,
                            fillOpacity: 0.3,
                          }}
                          connectNulls
                        />
                      </React.Fragment>
                    );
                  })}

                {/* Actual data lines */}
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

            {/* Prediction controls */}
            {enablePredictions && selectedLabs.length === 1 && (
              <div className="mt-4 space-y-2">
                {selectedLabs.map(labKey => {
                  const lab = labData.find(l => l.labKey === labKey);
                  if (!lab) return null;

                  const prediction = getPrediction(lab.labName);
                  const isPredicting = labBeingPredicted === labKey;

                  if (!prediction) return null;

                  return (
                    <div key={labKey} className="p-3 border rounded-lg bg-muted/50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="text-sm font-medium mb-1">
                            {lab.labName} Prediction
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Current: {lab.dataPoints[lab.dataPoints.length - 1]?.value} {lab.unit}
                          </div>
                          <div className="text-xs">
                            <span className="text-muted-foreground">Predicted (6h):</span>{' '}
                            <span className="font-semibold">
                              {prediction.predictedValue} {lab.unit}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <Badge
                            variant={prediction.confidence === 'high' ? 'default' : 'secondary'}
                            className="text-xs"
                            style={{
                              backgroundColor: CONFIDENCE_COLORS[prediction.confidence],
                              color: 'white',
                            }}
                          >
                            {prediction.confidence} confidence
                          </Badge>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePredict(labKey)}
                            disabled={isPredicting}
                          >
                            {isPredicting ? (
                              <>
                                <div className="h-3 w-3 mr-1 animate-spin" />
                                Predicting...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-3 w-3 mr-1" />
                                Predict
                              </>
                            )}
                          </Button>
                        </div>
                      </div>

                      {prediction.reasoning && (
                        <div className="mt-2 text-xs text-muted-foreground border-t pt-2">
                          <span className="font-medium">Reasoning:</span> {prediction.reasoning}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="h-[350px] flex items-center justify-center text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>No lab data available</p>
            <p className="text-sm mt-1">Select labs to view trends</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
