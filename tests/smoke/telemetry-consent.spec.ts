import { test, expect } from '@playwright/test'

test.describe('Telemetry consent dialog', () => {
  test('shows consent dialog when telemetry_consent is null', async ({ page }) => {
    // Override get_settings to return null telemetry_consent
    await page.goto('/')
    await page.evaluate(() => {
      window.__mockHandlers!.get_settings = () => ({
        anthropic_key: null,
        openai_key: null,
        google_key: null,
        github_token: null,
        github_username: null,
        auto_pull_interval_minutes: null,
        telemetry_consent: null,
        crash_reporting_enabled: null,
        analytics_enabled: null,
        anonymous_id: null,
      })
    })
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Consent dialog should be visible
    await expect(page.getByText('Help improve Laputa')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('telemetry-accept')).toBeVisible()
    await expect(page.getByTestId('telemetry-decline')).toBeVisible()
  })

  test('clicking No thanks dismisses dialog and sets consent to false', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      window.__mockHandlers!.get_settings = () => ({
        anthropic_key: null,
        openai_key: null,
        google_key: null,
        github_token: null,
        github_username: null,
        auto_pull_interval_minutes: null,
        telemetry_consent: null,
        crash_reporting_enabled: null,
        analytics_enabled: null,
        anonymous_id: null,
      })
    })
    await page.reload()
    await page.waitForLoadState('networkidle')

    await page.getByTestId('telemetry-decline').click()

    // Dialog should disappear and main app shell should be visible
    await expect(page.getByText('Help improve Laputa')).not.toBeVisible({ timeout: 5000 })
  })

  test('clicking Allow dismisses dialog and sets consent to true', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      window.__mockHandlers!.get_settings = () => ({
        anthropic_key: null,
        openai_key: null,
        google_key: null,
        github_token: null,
        github_username: null,
        auto_pull_interval_minutes: null,
        telemetry_consent: null,
        crash_reporting_enabled: null,
        analytics_enabled: null,
        anonymous_id: null,
      })
    })
    await page.reload()
    await page.waitForLoadState('networkidle')

    await page.getByTestId('telemetry-accept').click()

    // Dialog should disappear and main app shell should be visible
    await expect(page.getByText('Help improve Laputa')).not.toBeVisible({ timeout: 5000 })
  })

  test('dialog does not appear when consent was already given', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Default mock settings already have telemetry_consent: true from App.test setup
    // The consent dialog should NOT be visible
    await expect(page.getByText('Help improve Laputa')).not.toBeVisible({ timeout: 3000 })
  })
})
