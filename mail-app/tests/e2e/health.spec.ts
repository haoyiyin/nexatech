import { expect, test } from '@playwright/test'

test.describe('Health endpoint smoke check', () => {
  test('returns healthy json without authentication', async ({ request }) => {
    const response = await request.get('/mail/api/health')

    expect(response.status()).toBe(200)
    expect(response.headers()['cache-control']).toContain('no-store')

    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.status).toBe('healthy')
    expect(body.checks.supabase).toBe('ok')
    expect(typeof body.timestamp).toBe('string')
    expect(body.environment).toBeUndefined()
  })
})
