import { test, expect } from "@playwright/test";

test("the landing page loads and leads to sign-up", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Your cellar, visualized");
  await page.getByRole("link", { name: "Start Free", exact: true }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByText("Create an account")).toBeVisible();
});

test("the sign-in page shows the email form", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("Welcome back")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
});

test("the terms page renders", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: "Terms of Service" })).toBeVisible();
});

test("the demo opens a seeded cellar without an account", async ({ page }) => {
  await page.goto("/demo");
  await expect(page).toHaveURL(/\/cellar$/);
  await expect(page.getByRole("status", { name: "Demo mode" })).toBeVisible();
  await expect(page.getByText(/\d+\/\d+ bottles/)).toBeVisible();
});
