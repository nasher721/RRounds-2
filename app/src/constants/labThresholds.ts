export interface LabThreshold {
  value: number;
  direction: 'high' | 'low' | 'high-or-low';
  severity: 'critical' | 'warning' | 'info';
  message: string;
}

export const LAB_THRESHOLDS: Record<string, LabThreshold[]> = {
  potassium: [
    { value: 6.0, direction: 'high', severity: 'critical', message: 'Severe hyperkalemia' },
    { value: 5.5, direction: 'high', severity: 'warning', message: 'Hyperkalemia' },
    { value: 3.0, direction: 'low', severity: 'warning', message: 'Hypokalemia' },
    { value: 2.5, direction: 'low', severity: 'critical', message: 'Severe hypokalemia' },
  ],
  sodium: [
    { value: 160, direction: 'high', severity: 'critical', message: 'Severe hypernatremia' },
    { value: 150, direction: 'high', severity: 'warning', message: 'Hypernatremia' },
    { value: 130, direction: 'low', severity: 'warning', message: 'Hyponatremia' },
    { value: 120, direction: 'low', severity: 'critical', message: 'Severe hyponatremia' },
  ],
  hemoglobin: [
    { value: 7.0, direction: 'low', severity: 'critical', message: 'Severe anemia' },
    { value: 8.0, direction: 'low', severity: 'warning', message: 'Anemia' },
  ],
  platelets: [
    { value: 20, direction: 'low', severity: 'critical', message: 'Severe thrombocytopenia' },
    { value: 50, direction: 'low', severity: 'warning', message: 'Thrombocytopenia' },
  ],
  wbc: [
    { value: 20, direction: 'high', severity: 'warning', message: 'Leukocytosis' },
    { value: 30, direction: 'high', severity: 'critical', message: 'Severe leukocytosis' },
    { value: 2.0, direction: 'low', severity: 'warning', message: 'Leukopenia' },
  ],
  creatinine: [
    { value: 4.0, direction: 'high', severity: 'warning', message: 'Elevated creatinine' },
  ],
  lactate: [
    { value: 4.0, direction: 'high', severity: 'critical', message: 'Severe lactic acidosis' },
    { value: 2.0, direction: 'high', severity: 'warning', message: 'Elevated lactate' },
  ],
  glucose: [
    { value: 40, direction: 'low', severity: 'critical', message: 'Severe hypoglycemia' },
    { value: 60, direction: 'low', severity: 'warning', message: 'Hypoglycemia' },
    { value: 400, direction: 'high', severity: 'warning', message: 'Hyperglycemia' },
  ],
  ph: [
    { value: 7.15, direction: 'low', severity: 'critical', message: 'Severe acidemia' },
    { value: 7.25, direction: 'low', severity: 'warning', message: 'Acidemia' },
    { value: 7.55, direction: 'high', severity: 'warning', message: 'Alkalemia' },
    { value: 7.65, direction: 'high', severity: 'critical', message: 'Severe alkalemia' },
  ],
  pao2: [
    { value: 60, direction: 'low', severity: 'critical', message: 'Severe hypoxemia' },
    { value: 80, direction: 'low', severity: 'warning', message: 'Hypoxemia' },
  ],
  fio2: [
    { value: 60, direction: 'high', severity: 'warning', message: 'High FiO2 requirement' },
  ],
};

export function checkLabValue(labName: string, value: number): LabThreshold | null {
  const thresholds = LAB_THRESHOLDS[labName.toLowerCase()];
  if (!thresholds) return null;

  for (const threshold of thresholds) {
    if (threshold.direction === 'high' && value >= threshold.value) {
      return threshold;
    }
    if (threshold.direction === 'low' && value <= threshold.value) {
      return threshold;
    }
  }
  return null;
}

export function parseLabValues(labText: string): Record<string, number> {
  const values: Record<string, number> = {};

  const patterns = [
    { name: 'potassium', regex: /k[+:]?\s*([\d.]+)/i },
    { name: 'sodium', regex: /na[+:]?\s*([\d.]+)/i },
    { name: 'hemoglobin', regex: /hg?b[:]?\s*([\d.]+)/i },
    { name: 'platelets', regex: /plt[s]?\s*[:/]?\s*(\d+)/i },
    { name: 'wbc', regex: /wbc\s*[:/]?\s*([\d.]+)/i },
    { name: 'creatinine', regex: /cr\s*[:/]?\s*([\d.]+)/i },
    { name: 'lactate', regex: /lactate\s*[:/]?\s*([\d.]+)/i },
    { name: 'glucose', regex: /glu?cose\s*[:/]?\s*([\d.]+)/i },
    { name: 'ph', regex: /ph\s*[:/]?\s*([\d.]+)/i },
    { name: 'pao2', regex: /pao2\s*[:/]?\s*([\d.]+)/i },
    { name: 'fio2', regex: /fio2\s*[:/]?\s*([\d.]+)/i },
  ];

  for (const { name, regex } of patterns) {
    const match = labText.match(regex);
    if (match) {
      values[name] = parseFloat(match[1]);
    }
  }

  return values;
}
