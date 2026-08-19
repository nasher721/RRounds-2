import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createSafeLinkHtml, sanitizeHtml, sanitizePastedHtml } from "@/lib/sanitize";

describe("sanitizeHtml", () => {
  it("removes executable markup while preserving supported clinical formatting", () => {
    const result = sanitizeHtml(
      '<p><strong>Assessment</strong></p><img src="x" onerror="alert(1)">' +
      '<a href="javascript:alert(1)" onclick="alert(1)">unsafe link</a>' +
      '<script>alert(1)</script>',
    );

    assert.match(result, /<p><strong>Assessment<\/strong><\/p>/);
    assert.doesNotMatch(result, /onerror|onclick|javascript:|<script/i);
  });

  it("limits inline styles and protects links opened in a new tab", () => {
    const result = sanitizeHtml(
      '<span style="color: red; position: fixed; background-image: url(https://evil.test/x)">Text</span>' +
      '<a href="https://example.com" target="_blank">Reference</a>',
    );

    assert.match(result, /style="color: red;?"/);
    assert.doesNotMatch(result, /position|background-image|evil\.test/i);
    assert.match(result, /rel="noopener noreferrer"/);
  });

  it("prevents clinical HTML from loading untrusted image resources", () => {
    const result = sanitizeHtml(
      '<img src="https://tracker.test/pixel.gif" alt="tracking pixel">' +
      '<img src="https://tracker.test/private-token" data-patient-image-key="owner/image.png" alt="Patient image">',
    );

    assert.doesNotMatch(result, /tracker\.test|tracking pixel/i);
    assert.match(result, /<img data-patient-image-key="owner\/image\.png" alt="Patient image">/);
  });
});

describe("sanitizePastedHtml", () => {
  it("keeps safe rich-text formatting and strips pasted event handlers", () => {
    const result = sanitizePastedHtml(
      '<div><em>Plan</em><img src="x" onload="alert(1)"></div>',
      "Plan",
    );

    assert.match(result, /<em>Plan<\/em>/);
    assert.doesNotMatch(result, /onload/i);
  });

  it("escapes plain text before preserving line breaks", () => {
    assert.equal(
      sanitizePastedHtml("", '<script>alert("x")</script>\nNext'),
      '&lt;script&gt;alert("x")&lt;/script&gt;<br>Next',
    );
  });
});

describe("createSafeLinkHtml", () => {
  it("constructs links through DOM APIs so URL and label input cannot break into markup", () => {
    const result = createSafeLinkHtml(
      'https://example.com/" onmouseover="alert(1)',
      '<img src=x onerror=alert(1)>Reference',
    );

    assert.ok(result);
    assert.match(result, /^<a href="https:\/\/example\.com\//);
    assert.match(result, /&lt;img src=x onerror=alert\(1\)&gt;Reference<\/a>$/);
    assert.doesNotMatch(result, /<img|\sonmouseover=/i);
  });

  it("rejects executable and malformed link schemes before editor insertion", () => {
    assert.equal(createSafeLinkHtml("javascript:alert(1)", "Unsafe"), null);
    assert.equal(createSafeLinkHtml("data:text/html,unsafe", "Unsafe"), null);
    assert.equal(createSafeLinkHtml("not a URL", "Unsafe"), null);
  });
});
