import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { cleanup, render, waitFor } from "@testing-library/react";
import { PhraseContentEditor } from "@/components/phrases/PhraseContentEditor";

afterEach(cleanup);

describe("PhraseContentEditor", () => {
  it("sanitizes stored phrase HTML before rendering it", async () => {
    const { container } = render(
      <PhraseContentEditor
        value={'<p><strong>Plan</strong></p><img src="x" onerror="alert(1)"><script>alert(1)</script>'}
        onChange={() => undefined}
      />,
    );

    const editor = container.querySelector<HTMLElement>('[contenteditable="true"]');
    assert.ok(editor);

    await waitFor(() => assert.match(editor.innerHTML, /<strong>Plan<\/strong>/));
    assert.doesNotMatch(editor.innerHTML, /onerror|<script/i);
  });
});
