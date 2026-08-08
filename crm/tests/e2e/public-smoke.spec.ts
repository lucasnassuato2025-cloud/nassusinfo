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

test("portal de assinatura v2 oferece documento e evidência", async ({ page }) => {
  await page.goto("/assinar/token-de-teste-sem-acesso");
  await expect(page.getByText("ASSINATURA ELETRÔNICA V2")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ler e assinar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Consultar evidência" })).toBeVisible();
  await expect(page.getByLabel("CPF ou CNPJ do contratante")).toBeVisible();
});

test("healthcheck confirma a aplicação e informa o estado do banco", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.ok).toBe(true);
  expect(["ok", "not_configured"]).toContain(data.database);
  expect(data.service).toBe("nassus-crm");
});

test("headers críticos de segurança estão ativos", async ({ request }) => {
  const response = await request.get("/sign-in");
  expect(response.status()).toBe(200);
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["strict-transport-security"]).toContain("max-age=");
  expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
});
