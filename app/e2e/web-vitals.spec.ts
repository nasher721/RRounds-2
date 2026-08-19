import { expect, test } from '@playwright/test';

interface BrowserMetricPayload {
  message?: string;
  context?: Record<string, unknown>;
}

test('production emits PHI-free scalar browser experience metrics @public', async ({ page }) => {
  test.skip(
    process.env.E2E_USE_PREVIEW !== '1' && !process.env.E2E_BASE_URL,
    'Core Web Vitals initialize only in a production build.',
  );

  const metrics: BrowserMetricPayload[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'log') return;
    try {
      const payload = JSON.parse(message.text()) as BrowserMetricPayload;
      const metricName = payload.context?.metricName;
      if (typeof metricName === 'string' && metricName.startsWith('web.vital.')) {
        metrics.push(payload);
      }
    } catch {
      // Other application and browser console lines are outside this contract.
    }
  });

  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));

  await expect.poll(
    () => metrics.some((payload) => payload.context?.metricName === 'web.vital.ttfb_ms'),
  ).toBe(true);
  await expect.poll(
    () => metrics.some((payload) => payload.context?.metricName === 'web.vital.fcp_ms'),
  ).toBe(true);

  for (const payload of metrics) {
    assertMetricPayloadIsScalar(payload);
  }
});

function assertMetricPayloadIsScalar(payload: BrowserMetricPayload): void {
  expect(payload.message).toBe('metric');
  expect(Object.keys(payload.context ?? {}).sort()).toEqual([
    'metricName',
    'metricUnit',
    'metricValue',
    'type',
  ]);
  expect(typeof payload.context?.metricValue).toBe('number');
  expect(['count', 'ms']).toContain(payload.context?.metricUnit);
  expect(JSON.stringify(payload)).not.toMatch(/patient|mrn|element|interaction|url/i);
}
