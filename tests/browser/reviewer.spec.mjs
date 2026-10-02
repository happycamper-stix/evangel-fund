import { test, expect } from "@playwright/test";
test("reviewer workspace rejects another network and never enables unsigned review", async ({
  page,
}) => {
  await page.route("**/api/solana/state", (route) =>
    route.fulfill({
      json: {
        config: {
          configured: true,
          cluster: "devnet",
          program: "Ac4F5CNu8tYdUx4RZTKRchFyj5nZ9wG12eh3zDVJn7LV",
        },
        factory: { authority: "GqMSNe6TuhP1KgZontrDAhr4JCwe7FohiRHDBMUFuURy" },
        governance: {
          address: "4jiu9tuEWQueXfhPd6HwvVVzpZr2pvVrtrcEyMCb1VMh",
          vault: "GqMSNe6TuhP1KgZontrDAhr4JCwe7FohiRHDBMUFuURy",
          threshold: 2,
          members: [],
          timeLock: 172800,
          transactionIndex: "0",
        },
      },
    }),
  );
  await page.goto("/governor");
  await expect(
    page.getByRole("heading", { name: "Reviewer workspace" }),
  ).toBeVisible();
  await page
    .getByLabel("Verified action JSON from the governor")
    .fill(JSON.stringify({ version: 3, cluster: "testnet" }));
  await expect(
    page.getByRole("alert").filter({ hasText: "different network" }),
  ).toContainText("different network");
  await expect(
    page.getByRole("button", { name: "Create proposal", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Compare and approve proposal" }),
  ).toBeDisabled();
});
