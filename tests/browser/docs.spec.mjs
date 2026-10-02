import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const chapters = JSON.parse(await readFile("lib/docs/content.json", "utf8"));
for (const chapter of chapters)
  test(`native documentation: ${chapter.slug}`, async ({ page }) => {
    const response = await page.goto(`/docs/${chapter.slug}`);
    expect(response.status()).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1, name: chapter.title, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator("body")).not.toContainText(
      /Base Sepolia|Ethereum|ERC-20|0x104093/,
    );
  });
