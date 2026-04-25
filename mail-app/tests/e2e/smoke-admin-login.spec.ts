import { test, expect } from '@playwright/test'

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error('E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD environment variables are required')
}

test.describe('Admin Login Smoke Test', () => {
  test('admin login succeeds and dashboard loads without application error', async ({ page }) => {
    await page.goto('/mail/admin/login')

    // Verify admin login page is rendered (page title is "Nexatech Student Mail" but heading says "Admin")
    await expect(page.locator('text=Nexatech Mail Admin')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=Sign in with your administrator mailbox credentials')).toBeVisible({ timeout: 10000 })

    // Fill credentials
    const emailInput = page.locator('input[type="email"]').first()
    const passwordInput = page.locator('input[type="password"]').first()

    await expect(emailInput).toBeVisible({ timeout: 10000 })
    await emailInput.fill(ADMIN_EMAIL)
    await passwordInput.fill(ADMIN_PASSWORD)

    // Submit
    await page.locator('button[type="submit"]').click()

    // Wait for navigation or redirect after login
    await page.waitForLoadState('networkidle', { timeout: 30000 })

    // Verify we are no longer on the login page
    await expect(page).not.toHaveURL(/\/mail\/admin\/login$/, { timeout: 10000 })

    // Capture dashboard screenshot
    await page.screenshot({
      path: 'artifacts/admin-dashboard.png',
      fullPage: true,
    })

    // Verify no application error is shown on the dashboard
    // Check only visible rendered text, not serialized React RSC payload
    const visibleText = await page.locator('main, article, [role="main"], body > div').first().textContent()
    expect(visibleText).not.toMatch(/application error/i)
    expect(visibleText).not.toMatch(/Something went wrong/i)
    expect(visibleText).not.toMatch(/Internal Server Error/i)

    // Verify dashboard elements are present (admin-related content)
    const url = page.url()
    expect(url).toMatch(/mail\/admin|dashboard|admin/i)
  })
})
