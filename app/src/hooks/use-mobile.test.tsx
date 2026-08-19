import assert from 'node:assert/strict';
import test from 'node:test';

import { render } from '@testing-library/react';

import { useIsMobile } from './use-mobile';

function installViewport(width: number): {
  restore: () => void;
} {
  const originalWidth = window.innerWidth;
  const originalMatchMedia = window.matchMedia;
  const matches = width < 768;

  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string): MediaQueryList => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => true,
    }),
  });

  return {
    restore() {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: originalWidth,
      });
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: originalMatchMedia,
      });
    },
  };
}

test('useIsMobile is mobile on the first phone render without a desktop frame', () => {
  const viewport = installViewport(390);
  const renders: Array<boolean | undefined> = [];

  function Probe(): null {
    renders.push(useIsMobile());
    return null;
  }

  try {
    render(<Probe />);
    assert.equal(renders[0], true);
    assert.equal(renders.includes(false), false);
    assert.equal(renders.includes(undefined), false);
  } finally {
    viewport.restore();
  }
});

test('useIsMobile is desktop on the first workstation render', () => {
  const viewport = installViewport(1280);
  const renders: Array<boolean | undefined> = [];

  function Probe(): null {
    renders.push(useIsMobile());
    return null;
  }

  try {
    render(<Probe />);
    assert.equal(renders[0], false);
    assert.equal(renders.includes(true), false);
    assert.equal(renders.includes(undefined), false);
  } finally {
    viewport.restore();
  }
});
