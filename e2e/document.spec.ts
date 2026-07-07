import { test, expect } from "@playwright/test";

test.describe("Collaborative Document Editor E2E and Sync Status", () => {
  test("should redirect unauthenticated requests from dashboard to login page", async ({ page }) => {
    // Navigate to protected page
    await page.goto("/dashboard");
    
    // Expect URL redirect to /login
    await expect(page).toHaveURL(/.*login/);
    
    // Verify login inputs are rendered
    await expect(page.locator("input[placeholder='Email address']")).toBeVisible();
    await expect(page.locator("input[placeholder='Password']")).toBeVisible();
  });

  test("should dynamically capture connection toggles to offline mode", async ({ page, context }) => {
    await page.goto("/login");

    // 1. Initial State: Online
    let isOnline = await page.evaluate(() => navigator.onLine);
    expect(isOnline).toBe(true);

    // 2. Transition State: Offline
    await context.setOffline(true);
    isOnline = await page.evaluate(() => navigator.onLine);
    expect(isOnline).toBe(false);

    // 3. Recovery State: Online
    await context.setOffline(false);
    isOnline = await page.evaluate(() => navigator.onLine);
    expect(isOnline).toBe(true);
  });
});
