import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createApiClient } from '@/api/apiClient'

afterEach(() => {
  window.dispatchEvent(new Event('online'))
})

describe('createApiClient request isolation', () => {
  it('fails known-offline requests without invoking fetch or retrying', async () => {
    const originalOnline = Object.getOwnPropertyDescriptor(globalThis.navigator, 'onLine')
    Object.defineProperty(globalThis.navigator, 'onLine', {
      configurable: true,
      value: false,
    })

    try {
      let attempts = 0
      const fetchImpl = async () => {
        attempts += 1
        return new Response('unexpected')
      }
      const { apiFetch } = createApiClient(fetchImpl as typeof fetch)

      await assert.rejects(
        apiFetch('https://offline.example.test/auth/v1/user', {
          retryCount: 2,
          retryDelayMs: 0,
        }),
        /offline/i,
      )
      assert.equal(attempts, 0)
    } finally {
      if (originalOnline) {
        Object.defineProperty(globalThis.navigator, 'onLine', originalOnline)
      } else {
        Reflect.deleteProperty(globalThis.navigator, 'onLine')
      }
    }
  })

  it('stops retrying and preserves the circuit when connectivity drops mid-request', async () => {
    const originalOnline = Object.getOwnPropertyDescriptor(globalThis.navigator, 'onLine')
    let isOnline = true
    Object.defineProperty(globalThis.navigator, 'onLine', {
      configurable: true,
      get: () => isOnline,
    })

    try {
      let attempts = 0
      let failDuringRequest = true
      const fetchImpl = async () => {
        attempts += 1
        if (failDuringRequest) {
          isOnline = false
          throw new TypeError('Failed to fetch')
        }
        return new Response('healthy')
      }
      const { apiFetch } = createApiClient(fetchImpl as typeof fetch)
      const url = 'https://offline-transition.example.test/auth/v1/user'

      for (let index = 0; index < 5; index += 1) {
        isOnline = true
        window.dispatchEvent(new Event('online'))
        await assert.rejects(
          apiFetch(url, { retryCount: 2, retryDelayMs: 0 }),
          /offline/i,
        )
      }
      assert.equal(attempts, 5)

      isOnline = true
      window.dispatchEvent(new Event('online'))
      failDuringRequest = false
      const response = await apiFetch(url, { retryCount: 0 })
      assert.equal(await response.text(), 'healthy')
      assert.equal(attempts, 6)
    } finally {
      if (originalOnline) {
        Object.defineProperty(globalThis.navigator, 'onLine', originalOnline)
      } else {
        Reflect.deleteProperty(globalThis.navigator, 'onLine')
      }
    }
  })

  it('rejects an already-aborted caller signal without invoking fetch', async () => {
    let attempts = 0
    const fetchImpl = async () => {
      attempts += 1
      return new Response('unexpected')
    }
    const controller = new AbortController()
    controller.abort()
    const { apiFetch } = createApiClient(fetchImpl as typeof fetch)

    await assert.rejects(
      apiFetch('https://pre-aborted.example.test/patients', {
        signal: controller.signal,
        retryCount: 2,
      }),
      /cancelled/i,
    )
    assert.equal(attempts, 0)
  })

  it('does not retry a GET after the caller aborts an in-flight request', async () => {
    let attempts = 0
    const fetchImpl = async (_input: URL | RequestInfo, init?: RequestInit) => {
      attempts += 1
      return await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true },
        )
      })
    }
    const controller = new AbortController()
    const { apiFetch } = createApiClient(fetchImpl as typeof fetch)

    const request = apiFetch('https://caller-abort.example.test/patients', {
      signal: controller.signal,
      retryCount: 2,
      retryDelayMs: 0,
    })
    controller.abort()

    await assert.rejects(request, /cancelled/i)
    assert.equal(attempts, 1)
  })

  it('does not count caller cancellations as circuit-breaker failures', async () => {
    let attempts = 0
    const fetchImpl = async (_input: URL | RequestInfo, init?: RequestInit) => {
      attempts += 1
      if (!init?.signal) return new Response('ok')
      return await new Promise<Response>((resolve, reject) => {
        init.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true },
        )
        if (attempts > 3) resolve(new Response('healthy'))
      })
    }
    const { apiFetch } = createApiClient(fetchImpl as typeof fetch)
    const url = 'https://cancellation-circuit.example.test/functions/v1/test'

    for (let index = 0; index < 3; index += 1) {
      const controller = new AbortController()
      const request = apiFetch(url, { signal: controller.signal, retryCount: 0 })
      controller.abort()
      await assert.rejects(request, /cancelled/i)
    }

    const response = await apiFetch(url, { retryCount: 0 })
    assert.equal(await response.text(), 'healthy')
    assert.equal(attempts, 4)
  })

  it('cancels promptly while waiting between retries', async () => {
    let attempts = 0
    const fetchImpl = async () => {
      attempts += 1
      throw new Error('temporary network failure')
    }
    const controller = new AbortController()
    const { apiFetch } = createApiClient(fetchImpl as typeof fetch)
    const request = apiFetch('https://backoff-abort.example.test/patients', {
      signal: controller.signal,
      retryCount: 2,
      retryDelayMs: 1_000,
    }).then(
      () => 'resolved',
      (error: Error) => error.message,
    )

    await new Promise((resolve) => setTimeout(resolve, 10))
    controller.abort()
    const outcome = await Promise.race([
      request,
      new Promise<string>((resolve) => setTimeout(() => resolve('still waiting'), 100)),
    ])

    assert.match(outcome, /cancelled/i)
    assert.equal(attempts, 1)
  })

  it('reports internal deadline expiry as a timeout', async () => {
    let attempts = 0
    const fetchImpl = async (_input: URL | RequestInfo, init?: RequestInit) => {
      attempts += 1
      return await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true },
        )
      })
    }
    const { apiFetch } = createApiClient(fetchImpl as typeof fetch)

    await assert.rejects(
      apiFetch('https://timeout.example.test/patients', {
        timeoutMs: 5,
        retryCount: 0,
      }),
      /timed out/i,
    )
    assert.equal(attempts, 1)
  })

  it('never deduplicates concurrent requests carrying different auth owners', async () => {
    const seenTokens: string[] = []
    const fetchImpl = async (_input: URL | RequestInfo, init?: RequestInit) => {
      const token = new Headers(init?.headers).get('authorization') ?? ''
      seenTokens.push(token)
      await Promise.resolve()
      return new Response(token)
    }
    const { apiFetch } = createApiClient(fetchImpl as typeof fetch)

    const [responseA, responseB] = await Promise.all([
      apiFetch('https://api.example.test/patients', {
        dedupe: true,
        headers: { Authorization: 'Bearer user-a' },
      }),
      apiFetch('https://api.example.test/patients', {
        dedupe: true,
        headers: { Authorization: 'Bearer user-b' },
      }),
    ])

    assert.deepEqual(seenTokens.sort(), ['Bearer user-a', 'Bearer user-b'])
    assert.equal(await responseA.text(), 'Bearer user-a')
    assert.equal(await responseB.text(), 'Bearer user-b')
  })

  it('preserves Request headers and method when a Request object is passed', async () => {
    let observed: Request | undefined
    const fetchImpl = async (input: URL | RequestInfo, init?: RequestInit) => {
      observed = new Request(input, init)
      return new Response('ok')
    }
    const { apiFetch } = createApiClient(fetchImpl as typeof fetch)
    const request = new Request('https://api.example.test/patients', {
      method: 'POST',
      headers: { Authorization: 'Bearer current-user' },
      body: '{}',
    })

    await apiFetch(request, { retryCount: 0 })

    assert.equal(observed?.method, 'POST')
    assert.equal(observed?.headers.get('authorization'), 'Bearer current-user')
    assert.equal(await observed?.text(), '{}')
  })

  it('does not automatically replay non-idempotent database writes after a network failure', async () => {
    let attempts = 0
    const fetchImpl = async () => {
      attempts += 1
      throw new Error('connection reset after request was sent')
    }
    const { apiFetch } = createApiClient(fetchImpl as typeof fetch)

    await assert.rejects(
      apiFetch('https://database-write.example.test/rest/v1/patients', {
        method: 'POST',
        body: '{}',
      }),
      /connection reset/,
    )
    assert.equal(attempts, 1)
  })
})
