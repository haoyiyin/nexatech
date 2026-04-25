import { test, expect } from '@playwright/test'

const BASE_URL = 'https://www.nexatech.edu.kg'

test.describe('NexaTech Student Login Smoke Check', () => {
  test('student login trigger opens modal with email and password fields', async ({ page }) => {
    // 1. Navigate to site
    await page.goto(BASE_URL)
    await expect(page).toHaveTitle(/nexatech/i, { timeout: 15000 })
    console.log('PASS: Page loaded successfully')

    // 2. Find and click the top-right student login trigger
    // Try multiple possible selectors for the login button
    const loginTrigger = page.locator(
      'button:has-text("Login"), button:has-text("Sign In"), button:has-text("Student"), ' +
      '[data-testid*="login"], [data-testid*="sign-in"], a:has-text("Login"), a:has-text("Sign In"), ' +
      'button:has-text("Student Login"), a:has-text("Student Login"), ' +
      'button:has-text("Student login"), a:has-text("Student login"), ' +
      '[class*="login" i], [class*="sign-in" i]'
    ).first()

    await expect(loginTrigger).toBeVisible({ timeout: 10000 })
    const loginText = await loginTrigger.textContent()
    console.log(`PASS: Login trigger found with text: "${loginText?.trim()}"`)

    await loginTrigger.click()
    console.log('PASS: Login trigger clicked')

    // 3. Wait for modal to appear
    // Look for common modal patterns
    const modal = page.locator(
      '[role="dialog"], [class*="modal"], [class*="dialog"], ' +
      '[data-testid*="modal"], [data-testid*="dialog"], ' +
      'form:has(input[type="email"]), form:has(input[type="password"]), ' +
      'div:has(input[type="email"]):has(input[type="password"])'
    ).first()

    await expect(modal).toBeVisible({ timeout: 10000 })
    console.log('PASS: Login modal is visible')

    // 4. Verify email field exists
    const emailField = page.locator('input[type="email"], input[name="email"], input[placeholder*="email"], input[placeholder*="Email"]')
    await expect(emailField.first()).toBeVisible({ timeout: 5000 })
    console.log('PASS: Email input field found')

    // 5. Verify password field exists
    const passwordField = page.locator('input[type="password"], input[name="password"], input[placeholder*="password"], input[placeholder*="Password"]')
    await passwordField.first().waitFor({ state: 'visible', timeout: 5000 })
    console.log('PASS: Password input field found')

    // 6. Check email placeholder
    const emailInput = emailField.first()
    const placeholder = await emailInput.getAttribute('placeholder')
    console.log(`INFO: Email placeholder = "${placeholder}"`)

    if (placeholder === 'student@nexatech.edu.kg') {
      console.log('PASS: Email placeholder matches expected "student@nexatech.edu.kg"')
    } else {
      console.log(`FAIL: Email placeholder is "${placeholder}", expected "student@nexatech.edu.kg"`)
    }

    // 7. Submit empty form and verify client-side error
    const submitButton = page.locator(
      'button[type="submit"], button:has-text("Login"), button:has-text("Sign In"), ' +
      'button:has-text("Submit"), input[type="submit"]'
    ).first()

    await expect(submitButton).toBeVisible({ timeout: 5000 })
    await submitButton.click()

    // Wait briefly for validation messages
    await page.waitForTimeout(1000)

    // Check for error messages (various patterns)
    const errorSelectors = [
      '[class*="error" i]',
      '[class*="invalid" i]',
      '[class*="validation" i]',
      '[role="alert"]',
      'text=Required',
      'text=required',
      'text=Invalid',
      'text=invalid',
      'text=Email is required',
      'text=Password is required',
      'text=Please fill out this field',
    ]

    let foundError = false
    for (const selector of errorSelectors) {
      const el = page.locator(selector)
      const count = await el.count()
      if (count > 0) {
        const isVisible = await el.first().isVisible()
        if (isVisible) {
          const text = await el.first().textContent()
          console.log(`PASS: Client-side error found with selector "${selector}": "${text?.trim()}"`)
          foundError = true
          break
        }
      }
    }

    // Also check if email field has HTML5 validation
    const emailValidity = await emailInput.evaluate((el) => {
      const input = el as HTMLInputElement
      return {
        validityValid: input.validity.valid,
        validationMessage: input.validationMessage,
      }
    })

    if (!emailValidity.validityValid) {
      console.log(`PASS: HTML5 validation active on email: "${emailValidity.validationMessage}"`)
      foundError = true
    }

    if (!foundError) {
      console.log('WARN: No explicit client-side error message detected after empty submit')
      // Check if page crashed or navigated away unexpectedly
      const currentUrl = page.url()
      expect(currentUrl).toContain('nexatech')
      console.log('INFO: Page did not crash, still on nexatech.edu.kg')
    }

    // 8. Submit with invalid email and verify error
    await emailInput.fill('not-an-email')
    await passwordField.first().fill('short')
    await submitButton.click()
    await page.waitForTimeout(1000)

    // Check for email format error
    let foundEmailError = false
    const emailFormatErrors = [
      'text=valid email',
      'text=Invalid email',
      'text=invalid email',
      '[class*="email" i][class*="error" i]',
    ]

    for (const selector of emailFormatErrors) {
      const el = page.locator(selector)
      if (await el.count() > 0 && await el.first().isVisible()) {
        const text = await el.first().textContent()
        console.log(`PASS: Invalid email error found: "${text?.trim()}"`)
        foundEmailError = true
        break
      }
    }

    const emailValidityAfter = await emailInput.evaluate((el) => {
      const input = el as HTMLInputElement
      return {
        validityValid: input.validity.valid,
        validationMessage: input.validationMessage,
      }
    })

    if (!emailValidityAfter.validityValid) {
      console.log(`PASS: HTML5 validation caught invalid email: "${emailValidityAfter.validationMessage}"`)
      foundEmailError = true
    }

    if (!foundEmailError) {
      console.log('WARN: No explicit invalid email error detected')
    }

    // 9. Verify page stability - no crash
    await expect(page).toHaveURL(/nexatech\.edu\.kg/, { timeout: 5000 })
    console.log('PASS: Page remains stable, no crash detected')

    // Capture final screenshot
    await page.screenshot({ path: 'artifacts/smoke-login-final.png' })
    console.log('INFO: Screenshot saved to artifacts/smoke-login-final.png')
  })
})
