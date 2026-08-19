import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import Privacy from '@/pages/Privacy';
import Security from '@/pages/Security';

afterEach(cleanup);

for (const [name, Page] of [
  ['Privacy', Privacy],
  ['Security', Security],
] as const) {
  test(`${name} exposes a focusable target for the global skip link`, () => {
    render(
      <MemoryRouter>
        <Page />
      </MemoryRouter>,
    );

    assert.ok(document.querySelector('main#main-content[tabindex="-1"]'));
  });
}
