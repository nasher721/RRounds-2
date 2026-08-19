import assert from 'node:assert/strict';
import test from 'node:test';

import {
  htmlToExcelRichText,
  htmlToFormattedText,
  htmlToPDFSegments,
  htmlToRTF,
} from './htmlFormatter';

const hostileHtml = '<p>Safe text</p><script>attackMarker()</script><img src="x" onerror="attackMarker()">';

test('HTML export formatters discard executable markup before parsing', () => {
  assert.equal(htmlToFormattedText(hostileHtml).includes('attackMarker'), false);
  assert.equal(htmlToRTF(hostileHtml).includes('attackMarker'), false);
  assert.equal(htmlToExcelRichText(hostileHtml).some(run => run.text.includes('attackMarker')), false);
  assert.equal(htmlToPDFSegments(hostileHtml).some(segment => segment.text.includes('attackMarker')), false);
});
