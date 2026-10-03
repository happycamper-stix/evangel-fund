import { test, expect } from "@playwright/test";
import release from "../../docs/DAO_RELEASE_CANDIDATE.json" with { type: "json" };
import { getAddressEncoder } from "@solana/kit";
test("Devnet deposits stay unavailable when live verification fails", async ({
  page,
}) => {
  await page.route("**/api/solana/dao/rehearsal?*", (route) =>
    route.fulfill({
      status: 503,
      json: {
        error:
          "The rehearsal could not be verified on Devnet. Signing is disabled; try refreshing shortly.",
      },
    }),
  );
  await page.addInitScript(
    ({ address, publicKey }) => {
      const account = {
        address,
        publicKey: Uint8Array.from(publicKey),
        chains: ["solana:devnet"],
        features: ["solana:signAndSendTransaction"],
      };
      const wallet = {
        version: "1.0.0",
        name: "Rehearsal test wallet",
        icon: "data:image/svg+xml;base64,PHN2Zy8+",
        chains: ["solana:devnet"],
        accounts: [account],
        features: {
          "standard:connect": {
            version: "1.0.0",
            connect: async () => ({ accounts: [account] }),
          },
          "solana:signAndSendTransaction": {
            version: "1.0.0",
            signAndSendTransaction: async () => {
              throw Error("Signing must not be called");
            },
          },
        },
      };
      window.addEventListener("wallet-standard:app-ready", (event) =>
        event.detail.register(wallet),
      );
    },
    {
      address: release.developer,
      publicKey: Array.from(getAddressEncoder().encode(release.developer)),
    },
  );
  await page.goto("/governor/rehearsal");
  await page
    .getByRole("button", { name: "Connect Solana wallet", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Rehearsal test wallet", exact: true })
    .click();
  await expect(page.locator("#deposit").getByRole("alert")).toContainText(
    "Signing is disabled",
  );
  await expect(
    page.getByRole("button", { name: "Deposit test voting balance" }),
  ).toHaveCount(0);
});
