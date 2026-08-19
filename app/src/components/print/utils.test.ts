import assert from 'node:assert/strict';
import test from 'node:test';

import { formatMedicationsHtml, formatTodosHtml } from './utils';

test('formatMedicationsHtml escapes structured and raw medication text', () => {
  const structured = formatMedicationsHtml({
    infusions: ['norepinephrine <img src=x onerror=alert(1)>'],
    scheduled: ['aspirin & clopidogrel'],
    prn: [],
    rawText: '',
  });

  assert.match(structured, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(structured, /aspirin &amp; clopidogrel/);
  assert.doesNotMatch(structured, /<img/i);

  const raw = formatMedicationsHtml({
    infusions: [],
    scheduled: [],
    prn: [],
    rawText: '<svg onload=alert(1)>',
  });

  assert.equal(raw, '&lt;svg onload=alert(1)&gt;');
});

test('formatTodosHtml treats todo content as text', () => {
  const html = formatTodosHtml([
    {
      id: 'todo-1',
      patientId: 'patient-1',
      userId: 'user-1',
      section: null,
      content: '<img src=x onerror=alert(1)> & follow up',
      completed: false,
      createdAt: '2026-07-11T00:00:00.000Z',
      updatedAt: '2026-07-11T00:00:00.000Z',
    },
  ]);

  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt; &amp; follow up/);
  assert.doesNotMatch(html, /<img/i);
});
