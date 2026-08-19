import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CameraScanner } from './CameraScanner';

test.afterEach(() => {
  cleanup();
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: undefined,
  });
});

test('non-permission camera failures stay private, are labeled correctly, and can retry', async () => {
  let attempts = 0;
  let callbackMessage = '';
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: async () => {
        attempts += 1;
        throw new DOMException('driver diagnostic /Users/private', 'NotFoundError');
      },
    },
  });

  render(React.createElement(CameraScanner, {
    onCapture: () => {},
    onError: (error: Error) => {
      callbackMessage = error.message;
    },
  }));

  await screen.findByText('Camera unavailable');
  assert.match(screen.getByText(/camera could not start/i).textContent ?? '', /retry/i);
  assert.equal(screen.queryByText(/access denied/i), null);
  assert.doesNotMatch(document.body.textContent ?? '', /driver diagnostic|Users\/private/i);
  assert.doesNotMatch(callbackMessage, /driver diagnostic|Users\/private/i);

  fireEvent.click(screen.getByRole('button', { name: /retry camera/i }));
  await waitFor(() => assert.equal(attempts, 2));
});

test('permission failures give permission-specific recovery guidance', async () => {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: async () => {
        throw new DOMException('browser diagnostic', 'NotAllowedError');
      },
    },
  });

  render(React.createElement(CameraScanner, { onCapture: () => {} }));

  await screen.findByText('Camera access denied');
  assert.match(screen.getByText(/enable camera access/i).textContent ?? '', /retry/i);
  assert.doesNotMatch(document.body.textContent ?? '', /browser diagnostic/i);
});
