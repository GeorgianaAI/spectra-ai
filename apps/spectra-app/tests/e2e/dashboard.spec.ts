import { expect, test } from "@playwright/test";

// These tests require the dev server and a seeded Supabase demo account.
// They are skipped in CI unless PLAYWRIGHT_RUN_E2E=true is set.
const runE2E = process.env.PLAYWRIGHT_RUN_E2E === "true";

test.describe("Dashboard smoke tests", () => {
  test.skip(!runE2E, "Skipped: requires live Supabase — set PLAYWRIGHT_RUN_E2E=true to enable");

  test.beforeEach(async ({ page }) => {
    // Log in as demo user to get a session cookie
    await page.goto("/auth/login");
    await page.getByLabel(/email/i).fill("demo@spectra.app");
    await page.getByLabel(/password/i).fill("spectra-demo");
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test("dashboard renders upload zone and agent graph", async ({ page }) => {
    await expect(page.getByText(/upload_zone/i)).toBeVisible();
    await expect(page.getByText(/agent_graph/i)).toBeVisible();
  });

  test("dashboard shows synthesis panel", async ({ page }) => {
    await expect(page.getByText(/synthesis_panel/i)).toBeVisible();
  });

  test("Run Analysis button is disabled with no files", async ({ page }) => {
    const btn = page.getByRole("button", { name: /run analysis/i });
    await expect(btn).toBeDisabled();
  });

  test("Back to Base link navigates to landing page", async ({ page }) => {
    await page.getByRole("link", { name: /back to base/i }).click();
    await expect(page).toHaveURL("/");
  });
});
