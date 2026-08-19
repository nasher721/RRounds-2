/**
 * Analytics Dashboard Types
 * Unit-level metrics and reporting
 */

export interface UnitMetrics {
  totalPatients: number;
  admissions24h: number;
  discharges24h: number;
  transfers24h: number;
  averageLOS: number; // days
  occupancyRate: number; // percentage
  ventilatedPatients: number;
  vasopressorPatients: number;
  dialysisPatients: number;
}

export interface AcuityDistribution {
  critical: number;
  high: number;
  moderate: number;
  low: number;
  stable: number;
}

export interface PatientFlowData {
  date: string;
  admissions: number;
  discharges: number;
  transfers_in: number;
  transfers_out: number;
  census: number;
}

export interface TaskMetrics {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  completionRate: number;
  avgCompletionTime: number; // minutes
}

export interface AlertMetrics {
  totalAlerts: number;
  criticalAlerts: number;
  acknowledgedAlerts: number;
  avgResponseTime: number; // minutes
  alertsByCategory: Record<string, number>;
}

export interface ProtocolMetrics {
  activeProtocols: number;
  completedProtocols: number;
  complianceRate: number;
  protocolsByType: Record<string, number>;
  avgTimeToCompletion: Record<string, number>; // protocol type -> minutes
}

export interface HandoffMetrics {
  totalHandoffs: number;
  completedHandoffs: number;
  avgHandoffTime: number; // minutes
  missedHandoffs: number;
  sbarCompletionRate: number;
}

export interface DashboardData {
  unitMetrics: UnitMetrics;
  acuityDistribution: AcuityDistribution;
  patientFlow: PatientFlowData[];
  taskMetrics: TaskMetrics;
  alertMetrics: AlertMetrics;
  protocolMetrics: ProtocolMetrics;
  handoffMetrics: HandoffMetrics;
  lastUpdated: string;
}

export interface AnalyticsFilter {
  dateRange: {
    start: string;
    end: string;
  };
  unit?: string;
  team?: string;
  provider?: string;
}

export interface TrendDataPoint {
  date: string;
  value: number;
  label?: string;
}

export interface ChartConfig {
  type: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
  title: string;
  xAxisKey: string;
  yAxisKey: string;
  color: string;
  showLegend: boolean;
  showGrid: boolean;
}

// Quality metrics types
export interface QualityMetric {
  id: string;
  name: string;
  shortName: string;
  description: string;
  target: number;
  unit: string;
  category: 'infection' | 'safety' | 'efficiency' | 'outcome';
}

export const QUALITY_METRICS: QualityMetric[] = [
  { id: 'vap-rate', name: 'VAP Rate', shortName: 'VAP', description: 'Ventilator-associated pneumonia rate per 1000 vent days', target: 0, unit: '/1000 vent days', category: 'infection' },
  { id: 'cauti-rate', name: 'CAUTI Rate', shortName: 'CAUTI', description: 'Catheter-associated UTI rate per 1000 catheter days', target: 0, unit: '/1000 cath days', category: 'infection' },
  { id: 'clabsi-rate', name: 'CLABSI Rate', shortName: 'CLABSI', description: 'Central line-associated BSI rate per 1000 line days', target: 0, unit: '/1000 line days', category: 'infection' },
  { id: 'falls', name: 'Fall Rate', shortName: 'Falls', description: 'Patient falls per 1000 patient days', target: 0, unit: '/1000 pt days', category: 'safety' },
  { id: 'pressure-injury', name: 'Pressure Injury Rate', shortName: 'HAPI', description: 'Hospital-acquired pressure injury rate', target: 0, unit: '%', category: 'safety' },
  { id: 'avg-los', name: 'Average Length of Stay', shortName: 'ALOS', description: 'Average length of stay in days', target: 5, unit: 'days', category: 'efficiency' },
  { id: 'mortality', name: 'Mortality Rate', shortName: 'Mort', description: 'In-hospital mortality rate', target: 0, unit: '%', category: 'outcome' },
  { id: 'readmit-30d', name: '30-Day Readmission', shortName: 'Readmit', description: '30-day readmission rate', target: 0, unit: '%', category: 'outcome' },
];

// Calculate metrics from patient data
export const calculateUnitMetrics = (patients: Array<{
  id: string;
  createdAt: string;
  lastModified: string;
  systems?: {
    resp?: string;
    cv?: string;
    renalGU?: string;
  };
}>): Partial<UnitMetrics> => {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const admissions24h = patients.filter(p => new Date(p.createdAt) > oneDayAgo).length;

  // Estimate ventilated/vasopressor/dialysis from system notes
  const countMatching = (
    select: (p: (typeof patients)[number]) => string | undefined,
    needles: string[],
  ) => patients.filter(p => {
    const text = select(p)?.toLowerCase();
    if (!text) return false;
    return needles.some(needle => text.includes(needle));
  }).length;

  const ventilated = countMatching(p => p.systems?.resp, ['vent', 'intubat']);
  const vasopressor = countMatching(p => p.systems?.cv, [
    'vasopressor', 'levophed', 'norepinephrine', 'vasopressin',
  ]);
  const dialysis = countMatching(p => p.systems?.renalGU, ['dialysis', 'crrt', 'cvvh']);

  return {
    totalPatients: patients.length,
    admissions24h,
    ventilatedPatients: ventilated,
    vasopressorPatients: vasopressor,
    dialysisPatients: dialysis,
  };
};

export const calculateAcuityDistribution = (patients: Array<{
  id: string;
  systems?: Record<string, string>;
}>): AcuityDistribution => {
  // Simple acuity estimation based on system complexity
  const distribution: AcuityDistribution = {
    critical: 0,
    high: 0,
    moderate: 0,
    low: 0,
    stable: 0,
  };

  patients.forEach(patient => {
    const systems = patient.systems || {};
    const filledSystems = Object.values(systems).filter(v => v && v.trim().length > 0).length;

    // Check for critical indicators
    const allText = Object.values(systems).join(' ').toLowerCase();
    const hasCriticalIndicators =
      allText.includes('unstable') ||
      allText.includes('shock') ||
      allText.includes('arrest') ||
      allText.includes('critical');

    const hasHighIndicators =
      allText.includes('vent') ||
      allText.includes('vasopressor') ||
      allText.includes('dialysis') ||
      allText.includes('deteriorat');

    if (hasCriticalIndicators) {
      distribution.critical++;
    } else if (hasHighIndicators || filledSystems >= 8) {
      distribution.high++;
    } else if (filledSystems >= 5) {
      distribution.moderate++;
    } else if (filledSystems >= 2) {
      distribution.low++;
    } else {
      distribution.stable++;
    }
  });

  return distribution;
};

export const calculateTaskMetrics = (todos: Array<{
  completed: boolean;
  createdAt?: string;
  completedAt?: string;
}>): TaskMetrics => {
  const total = todos.length;
  const completed = todos.filter(t => t.completed).length;
  const pending = total - completed;

  // Estimate overdue (tasks older than 24h that aren't completed)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const overdue = todos.filter(t =>
    !t.completed &&
    t.createdAt &&
    new Date(t.createdAt) < oneDayAgo
  ).length;

  return {
    totalTasks: total,
    completedTasks: completed,
    pendingTasks: pending,
    overdueTasks: overdue,
    completionRate: total > 0 ? (completed / total) * 100 : 0,
    avgCompletionTime: 0, // Would need actual timestamps to calculate
  };
};
