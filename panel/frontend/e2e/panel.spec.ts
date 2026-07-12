import { test, expect } from "@playwright/test"

const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:2090"
const adminUser = process.env.E2E_ADMIN_USER ?? "e2eadmin"
const adminPass = process.env.E2E_ADMIN_PASS ?? "password1234"

test.describe("panel smoke", () => {
  test("setup status endpoint is reachable via panel web proxy", async ({ request }) => {
    const response = await request.get(`${base}/api/v1/setup/status`)
    expect(response.ok()).toBeTruthy()
    const json = await response.json()
    expect(json).toHaveProperty("data")
  })

  test("setup wizard, login, and domains page", async ({ page, request }) => {
    const statusRes = await request.get(`${base}/api/v1/setup/status`)
    const statusJson = await statusRes.json()
    const needsSetup = statusJson?.data?.needs_setup === true

    if (needsSetup) {
      await page.goto("/setup")
      await page.locator("#name").fill("E2E Admin")
      await page.locator("#username").fill(adminUser)
      await page.locator("#password").fill(adminPass)
      await page.locator("#password_confirmation").fill(adminPass)
      await page.getByRole("button", { name: /continue|ادامه/i }).click()
      await page.locator("#panel_name").fill("WebinoServer")
      await page.getByRole("button", { name: /continue|ادامه/i }).click()
      await page.getByRole("button", { name: /complete setup|اتمام راه‌اندازی/i }).click()
      await page.waitForURL("**/login**", { timeout: 60_000 })
    }

    await page.goto("/login")
    await page.keyboard.press("Tab")
    const skipLogin = page.locator('a[href="#login-form"]')
    await expect(skipLogin).toBeFocused()

    await page.locator("#username").fill(adminUser)
    await page.locator("#password").fill(adminPass)
    await page.getByRole("button", { name: /sign in|login|ورود/i }).click()
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30_000 })

    await page.evaluate(() => {
      localStorage.removeItem("webino_onboarding_v1")
    })
    await page.goto("/")
    const tourDialog = page.getByRole("dialog")
    if (await tourDialog.isVisible().catch(() => false)) {
      await page.getByRole("button", { name: /skip tour|رد کردن تور/i }).click()
      await expect(tourDialog).not.toBeVisible({ timeout: 5_000 })
    }

    await page.goto("/domains")
    await expect(page.getByRole("heading", { name: /domains|دامنه/i })).toBeVisible({
      timeout: 15_000,
    })
  })
})
