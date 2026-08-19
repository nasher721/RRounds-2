import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getCurrentAccessToken } from '@/lib/edgeFunctionHeaders'

describe('getCurrentAccessToken', () => {
  it('resolves the live session on every request so a prior user token is never reused', async () => {
    let currentToken = 'token-user-a'
    let sessionReads = 0
    const authClient = {
      getSession: async () => {
        sessionReads += 1
        return {
          data: { session: { access_token: currentToken } },
          error: null,
        }
      },
      refreshSession: async () => ({ data: { session: null }, error: null }),
    }

    assert.equal(await getCurrentAccessToken(authClient as never), 'token-user-a')
    currentToken = 'token-user-b'
    assert.equal(await getCurrentAccessToken(authClient as never), 'token-user-b')
    assert.equal(sessionReads, 2)
  })

  it('fails closed when neither the current session nor a refresh has a token', async () => {
    const authClient = {
      getSession: async () => ({ data: { session: null }, error: null }),
      refreshSession: async () => ({ data: { session: null }, error: null }),
    }

    await assert.rejects(
      getCurrentAccessToken(authClient as never),
      /Please sign in/,
    )
  })
})
