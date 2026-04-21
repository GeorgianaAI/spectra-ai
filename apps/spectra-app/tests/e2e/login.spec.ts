import { expect, test } from "@playwright/test";

test.describe("Login page", () => {
  test("renders email and password fields", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in|log in/i })).toBeVisible();
  });

  test("shows an error for invalid credentials", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByLabel(/email/i).fill("wrong@example.com");
    await page.getByLabel(/password/i).fill("wrongpassword");
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await expect(page.getByText(/invalid|incorrect|error/i)).toBeVisible({ timeout: 5000 });
  });

  test("unauthenticated visit to /dashboard redirects to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
