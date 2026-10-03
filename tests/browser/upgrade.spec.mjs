import { test, expect } from "@playwright/test";
test("upgrade signing fails closed when live deployment verification is unavailable", async ({
  page,
}) => {
  await page.route("**/api/solana/upgrade", (r) =>
    r.fulfill({
      status: 503,
      json: {
        error:
          "Upgrade verification unavailable or deployment changed. No signing action is enabled.",
      },
    }),
  );
  await page.goto("/governor");
  const panel = page.locator("#upgrade");
  await expect(
    panel.getByRole("heading", { name: "Devnet program upgrade" }),
  ).toBeVisible();
  await expect(panel.getByRole("alert")).toContainText(
    "verification unavailable",
  );
  await panel.getByRole("checkbox").check();
  for (const name of [
    "Create upgrade proposal",
    "Compare and approve upgrade",
    "Execute approved upgrade",
  ])
    await expect(
      panel.getByRole("button", { name, exact: true }),
    ).toBeDisabled();
});
