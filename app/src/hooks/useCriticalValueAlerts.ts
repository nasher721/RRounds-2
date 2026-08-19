import { useMemo } from 'react';
import { checkLabValue, parseLabValues, type LabThreshold } from '@/constants/labThresholds';

export function useCriticalValueAlerts(labText: string) {
  const alerts = useMemo(() => {
    const values = parseLabValues(labText);
    const alerts: Array<{ lab: string; value: number; threshold: LabThreshold }> = [];

    for (const [labName, value] of Object.entries(values)) {
      const threshold = checkLabValue(labName, value);
      if (threshold) {
        alerts.push({ lab: labName, value, threshold });
      }
    }

    return alerts;
  }, [labText]);

  const criticalAlerts = alerts.filter(a => a.threshold.severity === 'critical');
  const warningAlerts = alerts.filter(a => a.threshold.severity === 'warning');

  return {
    alerts,
    criticalAlerts,
    warningAlerts,
    hasCriticalAlerts: criticalAlerts.length > 0,
    hasWarningAlerts: warningAlerts.length > 0,
  };
}
