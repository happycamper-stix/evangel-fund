import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const path of [
  "/",
  "/launch",
  "/fund",
  "/eacc",
  "/governor",
  "/setup",
  "/launchpad-setup",
  "/missing-page",
]) {
  test(`page quality and accessibility: ${path}`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto(path);
    expect(response.status()).toBe(path === "/missing-page" ? 404 : 200);
    if (path === "/") {
      await expect(page.locator(".landing")).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Gathering the latest." }),
      ).toBeHidden();
    }
    await expect(page.locator("h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("navigation", { name: "Main navigation" }),
    ).toBeVisible();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
    expect(errors).toEqual([]);
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["content-security-policy"]).toContain(
      "frame-ancestors 'none'",
    );
  });
}
