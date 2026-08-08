import { expect, test } from "@playwright/test";

test("Nassus CRM Pro UI 2.0 is active on the login experience", async ({ page }) => {
  await page.goto("/sign-in");

  await expect(page.locator("html")).toHaveClass(/nassus-pro-ui2/);
  await expect(page).toHaveTitle(/Nassus CRM Pro/);
  await expect(page.locator(".pro-auth-card")).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar no CRM" })).toBeVisible();

  const cardBackground = await page.locator(".pro-auth-card").evaluate((element) => getComputedStyle(element).backgroundColor);
  const formBackground = await page.locator(".pro-auth-form-side").evaluate((element) => getComputedStyle(element).backgroundColor);

  expect(cardBackground).toBe("rgb(255, 255, 255)");
  expect(formBackground).toBe("rgb(240, 240, 241)");
});

test("Pro UI keeps the privacy page public and healthy", async ({ page }) => {
  const response = await page.goto("/privacidade");
  expect(response?.status()).toBe(200);
  await expect(page.locator("html")).toHaveClass(/nassus-pro-ui2/);
});
