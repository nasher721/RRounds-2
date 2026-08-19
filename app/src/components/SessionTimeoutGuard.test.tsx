import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { IdleSessionBoundary } from './SessionTimeoutGuard.tsx'

globalThis.MutationObserver = window.MutationObserver

test('idle session boundary warns before automatic sign-out and supports explicit continuation', async () => {
  let endCount = 0
  const view = render(
    <IdleSessionBoundary
      timeoutMs={1_300}
      warningMs={1_100}
      onSessionEnd={async () => { endCount += 1 }}
    />,
  )

  await screen.findByRole('alertdialog', {}, { timeout: 1_000 })
  assert.ok(screen.getByRole('heading', { name: 'Session ending soon' }))
  const staySignedIn = screen.getByRole('button', { name: 'Stay signed in' })
  const signOutNow = screen.getByRole('button', { name: 'Sign out now' })
  assert.match(staySignedIn.className, /min-h-\[44px\]/)
  assert.match(signOutNow.className, /min-h-\[44px\]/)
  fireEvent.click(staySignedIn)
  await waitFor(() => assert.equal(screen.queryByRole('alertdialog'), null))
  await new Promise((resolve) => setTimeout(resolve, 250))
  assert.equal(endCount, 0)
  view.unmount()
})

test('idle session boundary resets on activity and terminates after the new deadline', async () => {
  let endCount = 0
  const view = render(
    <IdleSessionBoundary
      timeoutMs={1_100}
      warningMs={500}
      onSessionEnd={async () => { endCount += 1 }}
    />,
  )

  await new Promise((resolve) => setTimeout(resolve, 500))
  fireEvent.pointerDown(window)
  await new Promise((resolve) => setTimeout(resolve, 650))
  assert.equal(endCount, 0)
  await waitFor(() => assert.equal(endCount, 1), { timeout: 1_200 })
  view.unmount()
})
