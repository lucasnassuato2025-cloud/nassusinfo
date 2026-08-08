import { expect, test } from "@playwright/test";

test("login privado carrega sem cadastro público", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { name: "Bem-vindo de volta" })).toBeVisible();
  await expect(page.getByText("Novos acessos são liberados somente pelo administrador.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Esqueci minha senha" })).toHaveAttribute("href", "/forgot-password");
});

test("recuperação de senha está acessível", async ({ page }) => {
  await page.goto("/forgot-password");
  await expect(page.locator("body")).toContainText(/senha|recuper/i);
});

test("aviso de privacidade descreve retenção e assinatura", async ({ page }) => {
  await page.goto("/privacidade");
  await expect(page.getByRole("heading", { name: "Aviso de privacidade do Nassus CRM" })).toBeVisible();
  await expect(page.getByText("Assinatura eletrônica e evidências")).toBeVisible();
  await expect(page.getByText("Retenção e exclusão")).toBeVisible();
});

test("headers críticos de segurança estão ativos", async ({ request }) => {
  const response = await request.get("/sign-in");
  expect(response.status()).toBe(200);
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["strict-transport-security"]).toContain("max-age=");
  expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
});
