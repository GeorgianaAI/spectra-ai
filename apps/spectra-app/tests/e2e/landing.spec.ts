import { expect, test } from "@playwright/test";

test.describe("Landing page", () => {
  test("renders the Spectra AI heading and CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /spectra/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /try the demo/i })).toBeVisible();
  });

  test("shows demo credentials on the landing page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("demo@spectra.app")).toBeVisible();
  });

  test("CTA link points to /auth/login", async ({ page }) => {
    await page.goto("/");
    const cta = page.getByRole("link", { name: /try the demo/i });
    const href = await cta.getAttribute("href");
    expect(href).toContain("/auth/login");
  });
});
