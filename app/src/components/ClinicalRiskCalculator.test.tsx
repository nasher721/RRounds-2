import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ClinicalRiskCalculator } from './ClinicalRiskCalculator';

globalThis.MutationObserver = window.MutationObserver;
globalThis.NodeFilter = window.NodeFilter;
globalThis.HTMLInputElement = window.HTMLInputElement;
globalThis.HTMLTextAreaElement = window.HTMLTextAreaElement;
globalThis.ResizeObserver =
  window.ResizeObserver ??
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? function scrollIntoView() {};

test.afterEach(cleanup);

test('qSOFA is an explicit manual calculation and does not produce treatment advice', () => {
  render(React.createElement(ClinicalRiskCalculator));

  fireEvent.click(screen.getByRole('button', { name: /risk scores/i }));
  assert.ok(screen.getByText(/manual entry only/i));
  const calculateButton = screen.getByRole('button', { name: /calculate qSOFA/i });
  assert.equal(calculateButton.hasAttribute('disabled'), true);

  fireEvent.change(screen.getByPlaceholderText('22'), { target: { value: '22' } });
  fireEvent.change(screen.getByPlaceholderText('100'), { target: { value: '120' } });

  assert.equal(calculateButton.hasAttribute('disabled'), false);
  assert.equal(screen.queryByText(/1 of 3 qSOFA criteria present/i), null);
  fireEvent.click(calculateButton);

  assert.ok(screen.getByText(/1 of 3 qSOFA criteria present/i));
  assert.equal(screen.queryByText(/sepsis workup|ICU evaluation|continue monitoring/i), null);

  fireEvent.change(screen.getByPlaceholderText('100'), { target: { value: '90' } });
  assert.equal(screen.queryByText(/1 of 3 qSOFA criteria present/i), null);
});
