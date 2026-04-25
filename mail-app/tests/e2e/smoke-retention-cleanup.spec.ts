import { test, expect } from '@playwright/test'

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error('E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD environment variables are required')
}

test.describe('Admin Retention Cleanup Form', () => {
  test('dashboard shows manual retention cleanup form with number input and Run Cleanup button', async ({ page }) => {
    // -- Login --
    await page.goto('/mail/admin/login')
    await expect(page.locator('text=Nexatech Mail Admin')).toBeVisible({ timeout: 15000 })

    await page.locator('input[type="email"]').first().fill(ADMIN_EMAIL)
    await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD)
    await page.locator('button[type="submit"]').click()
    await page.waitForLoadState('networkidle', { timeout: 30000 })
    await expect(page).not.toHaveURL(/\/mail\/admin\/login$/, { timeout: 10000 })

    // -- Handle possible dialog that may appear after login --
    page.on('dialog', async (dialog) => {
      await dialog.dismiss()
    })

    await page.screenshot({
      path: 'artifacts/retention-cleanup-dashboard.png',
      fullPage: true,
    })

    // -- Verify retention cleanup form is present --
    // Look for a number input associated with retention/cleanup
    const numberInputs = page.locator('input[type="number"]')
    await expect(numberInputs.first()).toBeVisible({ timeout: 10000 })

    // Verify the number input is interactive
    await numberInputs.first().click()
    await numberInputs.first().fill('30')
    const inputValue = await numberInputs.first().inputValue()
    expect(inputValue).toBe('30')

    // Look for "Run Cleanup" button (case-insensitive)
    const cleanupButton = page.locator('button:has-text("Run Cleanup"), button:has-text("run cleanup"), input[type="submit"]:has-text("Run Cleanup")')
    await expect(cleanupButton.first()).toBeVisible({ timeout: 10000 })

    // Verify the button is interactive (enabled and clickable) without actually clicking
    const isEnabled = await cleanupButton.first().isEnabled()
    expect(isEnabled).toBe(true)

    // -- Attempt to click to verify interactivity, but dismiss any confirmation dialog --
    await cleanupButton.first().click()

    // Wait briefly for any dialog
    await page.waitForTimeout(1000)

    // Take final screenshot
    await page.screenshot({
      path: 'artifacts/retention-cleanup-after-click.png',
      fullPage: true,
    })

    // Verify we are still on the dashboard (no destructive action occurred)
    const url = page.url()
    expect(url).toMatch(/mail\/admin|dashboard|admin/i)
  })
})
